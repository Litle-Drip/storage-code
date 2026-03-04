import { useState, useRef, useEffect } from "react";

const fmt = (n, d = 2) => Number(n).toFixed(d);
const pct = (n) => `${fmt(n * 100, 1)}%`;
const usd = (n) => `$${fmt(Math.abs(n))}`;
const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);

const COLORS = {
  bg: "#0f1117", surface: "#1a1d2e", card: "#222537", border: "#2e3150",
  accent: "#6c63ff", accentSoft: "#6c63ff22", green: "#22c55e", greenSoft: "#22c55e22",
  red: "#ef4444", redSoft: "#ef444422", yellow: "#f59e0b", yellowSoft: "#f59e0b22",
  text: "#e2e8f0", muted: "#94a3b8", dim: "#475569",
};

const TAB_STYLE = (active) => ({
  padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer",
  fontWeight: 600, fontSize: 13, transition: "all .2s",
  background: active ? COLORS.accent : "transparent",
  color: active ? "#fff" : COLORS.muted,
});
const CARD = { background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 20 };
const INPUT_STYLE = { background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.text, padding: "8px 12px", fontSize: 14, width: "100%", outline: "none", boxSizing: "border-box" };
const BTN = (color = COLORS.accent) => ({ background: color, border: "none", borderRadius: 8, color: "#fff", padding: "10px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer" });

async function askClaude(messages, system = "") {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514", max_tokens: 1000,
      system: system || `You are an expert prediction market trader and strategist. You understand probability theory, behavioral finance, Kelly criterion, expected value, and market microstructure deeply. Give sharp, practical, quantitative advice. Be direct and specific. Use numbers. Point out risks clearly. Keep responses under 250 words unless more depth is needed.`,
      messages,
    }),
  });
  const data = await res.json();
  return data.content?.map((b) => b.text || "").join("") || "No response.";
}

function EVCalculator() {
  const [form, setForm] = useState({ question: "", marketProb: 40, yourProb: 55, bankroll: 1000, side: "YES" });
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const mp = clamp(Number(form.marketProb) / 100, 0.01, 0.99);
  const yp = clamp(Number(form.yourProb) / 100, 0.01, 0.99);
  const bankroll = Number(form.bankroll);
  const sharePrice = form.side === "YES" ? mp : 1 - mp;
  const winProb = form.side === "YES" ? yp : 1 - yp;
  const profitPerShare = 1 - sharePrice;
  const b = profitPerShare / sharePrice;
  const ev = winProb * profitPerShare - (1 - winProb) * sharePrice;
  const evPct = ev / sharePrice;
  const kelly = clamp((b * winProb - (1 - winProb)) / b, 0, 1);
  const halfKelly = kelly / 2;
  const betAmt = halfKelly * bankroll;
  const shares = betAmt / sharePrice;
  const expectedProfit = ev * shares;
  const verdict = ev > 0.02 ? { label: "Strong BUY ✅", color: COLORS.green } : ev > 0 ? { label: "Marginal Edge ⚠️", color: COLORS.yellow } : { label: "PASS — Negative EV ❌", color: COLORS.red };

  async function getAIAnalysis() {
    if (!form.question.trim()) return alert("Enter a market question first.");
    setLoading(true);
    try {
      const text = await askClaude([{ role: "user", content: `Analyze this prediction market trade:\n\nMarket: "${form.question}"\nSide: ${form.side}\nMarket probability: ${pct(mp)}\nMy estimated probability: ${pct(yp)}\nShare price: ${usd(sharePrice)}\nEV per share: ${usd(ev)} (${pct(evPct)} edge)\nHalf-Kelly bet: ${usd(betAmt)} (${fmt(shares,0)} shares)\nExpected profit: ${usd(expectedProfit)}\n\nGive me:\n1. Is this a good trade? Red flags?\n2. What info/events should I watch?\n3. What could make my probability estimate wrong?\n4. Any correlated markets to trade?` }]);
      setAnalysis(text);
    } finally { setLoading(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={CARD}>
        <div style={{ fontWeight: 700, color: COLORS.text, marginBottom: 14, fontSize: 15 }}>📊 Trade Setup</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={{ color: COLORS.muted, fontSize: 12, display: "block", marginBottom: 4 }}>Market Question</label>
            <input style={INPUT_STYLE} placeholder='e.g. "Will the Fed cut rates in March 2026?"' value={form.question} onChange={set("question")} />
          </div>
          {[["Side", "side", "select"], ["Bankroll ($)", "bankroll", "number"], ["Market Probability (%)", "marketProb", "number"], ["YOUR Probability (%)", "yourProb", "number"]].map(([label, key, type]) => (
            <div key={key}>
              <label style={{ color: COLORS.muted, fontSize: 12, display: "block", marginBottom: 4 }}>{label}</label>
              {type === "select" ? (
                <select style={INPUT_STYLE} value={form[key]} onChange={set(key)}><option>YES</option><option>NO</option></select>
              ) : (
                <input style={INPUT_STYLE} type="number" min={1} max={key.includes("Prob") ? 99 : undefined} value={form[key]} onChange={set(key)} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {[
          { label: "Share Price", val: usd(sharePrice), sub: `${form.side} side` },
          { label: "EV per Share", val: usd(ev), sub: `${pct(evPct)} edge`, color: ev > 0 ? COLORS.green : COLORS.red },
          { label: "Win Probability", val: pct(winProb), sub: "your estimate" },
          { label: "Full Kelly", val: pct(kelly), sub: "of bankroll" },
          { label: "Half Kelly (Rec.)", val: pct(halfKelly), sub: usd(betAmt), color: COLORS.accent },
          { label: "Expected Profit", val: usd(expectedProfit), sub: `${fmt(shares, 0)} shares`, color: expectedProfit > 0 ? COLORS.green : COLORS.red },
        ].map((item) => (
          <div key={item.label} style={{ ...CARD, textAlign: "center" }}>
            <div style={{ color: COLORS.muted, fontSize: 11, marginBottom: 4 }}>{item.label}</div>
            <div style={{ color: item.color || COLORS.text, fontWeight: 800, fontSize: 20 }}>{item.val}</div>
            <div style={{ color: COLORS.dim, fontSize: 11 }}>{item.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ ...CARD, background: verdict.color + "18", border: `1px solid ${verdict.color}44`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <span style={{ color: verdict.color, fontWeight: 800, fontSize: 18 }}>{verdict.label}</span>
          <div style={{ color: COLORS.muted, fontSize: 12, marginTop: 2 }}>Bet {usd(betAmt)} on {form.side} → expected return {usd(expectedProfit)}</div>
        </div>
        <button style={BTN()} onClick={getAIAnalysis} disabled={loading}>{loading ? "Analyzing…" : "🤖 AI Deep Analysis"}</button>
      </div>

      {analysis && (
        <div style={{ ...CARD, borderColor: COLORS.accent + "66" }}>
          <div style={{ color: COLORS.accent, fontWeight: 700, marginBottom: 10, fontSize: 14 }}>🤖 AI Strategy Analysis</div>
          <div style={{ color: COLORS.text, fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{analysis}</div>
        </div>
      )}
    </div>
  );
}

function PortfolioBuilder() {
  const [positions, setPositions] = useState([
    { id: 1, question: "Fed cuts rates in Q1 2026", side: "NO", marketProb: 35, yourProb: 25, stake: 200, tag: "Macro" },
    { id: 2, question: "US GDP > 2% in Q1 2026", side: "YES", marketProb: 55, yourProb: 65, stake: 150, tag: "Macro" },
  ]);
  const [thesis, setThesis] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const nextId = useRef(3);

  const addPosition = () => setPositions((p) => [...p, { id: nextId.current++, question: "", side: "YES", marketProb: 50, yourProb: 60, stake: 100, tag: "" }]);
  const update = (id, key, val) => setPositions((p) => p.map((pos) => pos.id === id ? { ...pos, [key]: val } : pos));
  const remove = (id) => setPositions((p) => p.filter((pos) => pos.id !== id));

  const positionsWithEV = positions.map((p) => {
    const mp = clamp(Number(p.marketProb) / 100, 0.01, 0.99);
    const yp = clamp(Number(p.yourProb) / 100, 0.01, 0.99);
    const sharePrice = p.side === "YES" ? mp : 1 - mp;
    const winProb = p.side === "YES" ? yp : 1 - yp;
    const profit = 1 - sharePrice;
    const ev = winProb * profit - (1 - winProb) * sharePrice;
    const expectedProfit = ev * (Number(p.stake) / sharePrice);
    return { ...p, ev, expectedProfit, sharePrice, winProb };
  });

  const totalStake = positions.reduce((s, p) => s + Number(p.stake), 0);
  const totalExpectedProfit = positionsWithEV.reduce((s, p) => s + p.expectedProfit, 0);
  const portfolioEdge = totalStake > 0 ? totalExpectedProfit / totalStake : 0;

  async function analyzePortfolio() {
    setLoading(true);
    try {
      const posStr = positionsWithEV.map((p) => `- "${p.question}" (${p.side}) | Market: ${p.marketProb}% | Mine: ${p.yourProb}% | Stake: $${p.stake} | EV: $${fmt(p.expectedProfit)} | Tag: ${p.tag || "untagged"}`).join("\n");
      const text = await askClaude([{ role: "user", content: `Analyze this prediction market portfolio:\n\nThesis: "${thesis || "Not provided"}"\n\nPositions:\n${posStr}\n\nTotal Stake: $${fmt(totalStake)}\nExpected Profit: $${fmt(totalExpectedProfit)}\nPortfolio Edge: ${pct(portfolioEdge)}\n\nAnalyze:\n1. Correlation risk — which positions move together?\n2. Is the thesis internally consistent?\n3. Single biggest risk to this whole portfolio\n4. Any position that looks mispriced or should be cut\n5. What's missing — what else should I trade to complete this thesis?` }]);
      setAnalysis(text);
    } finally { setLoading(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={CARD}>
        <label style={{ color: COLORS.muted, fontSize: 12, display: "block", marginBottom: 6 }}>Your Macro Thesis</label>
        <input style={INPUT_STYLE} placeholder='e.g. "The Fed is more hawkish than the market thinks in early 2026"' value={thesis} onChange={(e) => setThesis(e.target.value)} />
      </div>

      {positionsWithEV.map((pos) => (
        <div key={pos.id} style={{ ...CARD, position: "relative" }}>
          <button onClick={() => remove(pos.id)} style={{ position: "absolute", top: 12, right: 12, background: COLORS.redSoft, border: "none", color: COLORS.red, borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontSize: 12 }}>✕</button>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 0.7fr 0.7fr 0.7fr 0.7fr 0.7fr", gap: 10, alignItems: "end" }}>
            {[["Question", "question", "text", "Market question…"], ["Side", "side", "select", ""], ["Mkt %", "marketProb", "number", ""], ["Your %", "yourProb", "number", ""], ["Stake $", "stake", "number", ""], ["Tag", "tag", "text", "Macro…"]].map(([label, key, type, placeholder]) => (
              <div key={key}>
                <label style={{ color: COLORS.muted, fontSize: 11, display: "block", marginBottom: 3 }}>{label}</label>
                {type === "select" ? (
                  <select style={INPUT_STYLE} value={pos[key]} onChange={(e) => update(pos.id, key, e.target.value)}><option>YES</option><option>NO</option></select>
                ) : (
                  <input style={INPUT_STYLE} type={type} value={pos[key]} onChange={(e) => update(pos.id, key, e.target.value)} placeholder={placeholder} />
                )}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
            {[{ l: "Share Price", v: usd(pos.sharePrice) }, { l: "Win Prob", v: pct(pos.winProb) }, { l: "EV/Share", v: usd(pos.ev), c: pos.ev > 0 ? COLORS.green : COLORS.red }, { l: "Expected Profit", v: usd(pos.expectedProfit), c: pos.expectedProfit > 0 ? COLORS.green : COLORS.red }].map((item) => (
              <div key={item.l} style={{ fontSize: 12 }}><span style={{ color: COLORS.dim }}>{item.l}: </span><span style={{ color: item.c || COLORS.text, fontWeight: 700 }}>{item.v}</span></div>
            ))}
          </div>
        </div>
      ))}

      <button style={{ ...BTN(COLORS.surface), border: `1px dashed ${COLORS.border}`, color: COLORS.muted, alignSelf: "flex-start" }} onClick={addPosition}>+ Add Position</button>

      <div style={{ ...CARD, background: COLORS.accentSoft, border: `1px solid ${COLORS.accent}44`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 24 }}>
          {[{ l: "Total Stake", v: usd(totalStake) }, { l: "Expected Profit", v: usd(totalExpectedProfit), c: totalExpectedProfit > 0 ? COLORS.green : COLORS.red }, { l: "Portfolio Edge", v: pct(portfolioEdge), c: portfolioEdge > 0 ? COLORS.green : COLORS.red }, { l: "Positions", v: positions.length }].map((item) => (
            <div key={item.l}><div style={{ color: COLORS.dim, fontSize: 11 }}>{item.l}</div><div style={{ color: item.c || COLORS.text, fontWeight: 800, fontSize: 16 }}>{item.v}</div></div>
          ))}
        </div>
        <button style={BTN()} onClick={analyzePortfolio} disabled={loading}>{loading ? "Analyzing…" : "🤖 Analyze Portfolio"}</button>
      </div>

      {analysis && (
        <div style={{ ...CARD, borderColor: COLORS.accent + "66" }}>
          <div style={{ color: COLORS.accent, fontWeight: 700, marginBottom: 10, fontSize: 14 }}>🤖 Portfolio Analysis</div>
          <div style={{ color: COLORS.text, fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{analysis}</div>
        </div>
      )}
    </div>
  );
}

function BiasChecker() {
  const [desc, setDesc] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);

  const BIASES = [
    { name: "Long-Shot Bias", emoji: "🎰", desc: "Overpaying for unlikely events (<10% chances)." },
    { name: "Recency Bias", emoji: "📰", desc: "Overweighting the latest news. One bad poll ≠ a trend." },
    { name: "Narrative Bias", emoji: "📖", desc: "Good stories feel more probable than data supports." },
    { name: "Status Quo Bias", emoji: "🏛️", desc: "Assuming nothing changes. Change is often underpriced." },
    { name: "Overconfidence", emoji: "💪", desc: "Your probability is likely closer to 50% than you think." },
    { name: "Anchoring", emoji: "⚓", desc: "Being too influenced by the current market price." },
    { name: "Favorite-Longshot Flip", emoji: "⚖️", desc: "Heavy favorites (85%+) are sometimes still underpriced." },
    { name: "Correlation Blindness", emoji: "🔗", desc: "Missing that your positions move together — concentrated risk." },
  ];

  async function checkBiases() {
    if (!desc.trim()) return alert("Describe your trade reasoning first.");
    setLoading(true);
    try {
      const text = await askClaude([{ role: "user", content: `A prediction market trader described their reasoning:\n\n"${desc}"\n\nRuthlessly audit this for cognitive biases: long-shot bias, recency bias, narrative bias, status quo bias, overconfidence, anchoring, favorite-longshot flip, correlation blindness.\n\nFor each bias detected: (a) where it shows in their reasoning, (b) how to correct for it.\nThen give a bias-adjusted probability range. Be specific and tough.` }]);
      setAnalysis(text);
    } finally { setLoading(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {BIASES.map((b) => (
          <div key={b.name} style={{ ...CARD, padding: 14 }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{b.emoji}</div>
            <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 12, marginBottom: 4 }}>{b.name}</div>
            <div style={{ color: COLORS.dim, fontSize: 11, lineHeight: 1.5 }}>{b.desc}</div>
          </div>
        ))}
      </div>
      <div style={CARD}>
        <label style={{ color: COLORS.muted, fontSize: 12, display: "block", marginBottom: 6 }}>Describe your trade reasoning — the AI will find your blind spots</label>
        <textarea style={{ ...INPUT_STYLE, minHeight: 100, resize: "vertical", fontFamily: "inherit", lineHeight: 1.6 }} placeholder='e.g. "I think YES on Fed cutting because the last jobs report was weak and everyone on Twitter is saying a cut is coming. Market says 40% but I feel it should be 70%..."' value={desc} onChange={(e) => setDesc(e.target.value)} />
        <button style={{ ...BTN(), marginTop: 10 }} onClick={checkBiases} disabled={loading}>{loading ? "Scanning for biases…" : "🔍 Audit My Reasoning"}</button>
      </div>
      {analysis && (
        <div style={{ ...CARD, borderColor: COLORS.yellow + "66", background: COLORS.yellowSoft }}>
          <div style={{ color: COLORS.yellow, fontWeight: 700, marginBottom: 10, fontSize: 14 }}>🧠 Bias Audit Report</div>
          <div style={{ color: COLORS.text, fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{analysis}</div>
        </div>
      )}
    </div>
  );
}

function StrategyChat() {
  const [messages, setMessages] = useState([{ role: "assistant", content: "Hey! I'm your prediction market strategy advisor. Ask me anything — trade analysis, probability estimation, finding edges, Kelly sizing, reading order books, or specific markets you're considering.\n\nWhat's on your mind?" }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send() {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setLoading(true);
    try {
      const reply = await askClaude(history.map((m) => ({ role: m.role, content: m.content })));
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } finally { setLoading(false); }
  }

  const STARTERS = ["How do I find edges in political markets?", "Explain how to read an order book", "What makes a good prediction market trader?", "How do I handle correlated positions?"];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: 520 }}>
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, paddingBottom: 8 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "80%", background: m.role === "user" ? COLORS.accent : COLORS.card, border: `1px solid ${m.role === "user" ? COLORS.accent : COLORS.border}`, borderRadius: m.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px", padding: "12px 14px", color: COLORS.text, fontSize: 14, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
            {m.content}
          </div>
        ))}
        {loading && <div style={{ alignSelf: "flex-start", background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: "12px 12px 12px 4px", padding: "12px 14px", color: COLORS.dim, fontSize: 14 }}>Thinking…</div>}
        <div ref={bottomRef} />
      </div>
      {messages.length === 1 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          {STARTERS.map((s) => (
            <button key={s} style={{ background: COLORS.accentSoft, border: `1px solid ${COLORS.accent}44`, borderRadius: 20, padding: "6px 12px", color: COLORS.accent, fontSize: 12, cursor: "pointer" }} onClick={() => setInput(s)}>{s}</button>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <input style={{ ...INPUT_STYLE, flex: 1 }} placeholder="Ask anything about prediction market strategy…" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()} />
        <button style={BTN()} onClick={send} disabled={loading || !input.trim()}>Send</button>
      </div>
    </div>
  );
}

const TABS = [
  { id: "ev", label: "📊 EV & Kelly", Component: EVCalculator },
  { id: "portfolio", label: "🗂 Portfolio Builder", Component: PortfolioBuilder },
  { id: "bias", label: "🧠 Bias Auditor", Component: BiasChecker },
  { id: "chat", label: "🤖 Strategy AI", Component: StrategyChat },
];

export default function App() {
  const [tab, setTab] = useState("ev");
  const active = TABS.find((t) => t.id === tab);
  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif", color: COLORS.text, padding: "24px 20px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, background: "linear-gradient(90deg, #6c63ff, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Prediction Market Strategy Engine</h1>
          <p style={{ margin: "4px 0 0", color: COLORS.muted, fontSize: 13 }}>EV Calculator · Kelly Sizing · Portfolio Analysis · AI Strategy Advisor</p>
        </div>
        <div style={{ display: "flex", gap: 4, marginBottom: 20, background: COLORS.surface, padding: 4, borderRadius: 10, border: `1px solid ${COLORS.border}`, width: "fit-content" }}>
          {TABS.map((t) => <button key={t.id} style={TAB_STYLE(t.id === tab)} onClick={() => setTab(t.id)}>{t.label}</button>)}
        </div>
        <active.Component />
      </div>
    </div>
  );
}
