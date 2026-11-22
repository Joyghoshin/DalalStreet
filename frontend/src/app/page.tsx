"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { usePriceStream } from "@/hooks/usePriceStream";
import Watchlist    from "@/components/Watchlist";
import IndexBar     from "@/components/IndexBar";
import LogoutButton from "@/components/LogoutButton";

const DEFAULT_SYMBOLS = [
  "RELIANCE","TCS","INFY","HDFCBANK","ITC",
  "SBIN","BHARTIARTL","KOTAKBANK","WIPRO","TATAMOTORS",
];

type Tab = "chat" | "trade" | "algo" | "backtest" | "learn" | "portfolio";

const TradePanel = dynamic(() => import("@/components/TradePanel").then(m => m.default), {
  loading: () => <div style={{ height: 520, background: "var(--color-surface-card)", border: "1px solid var(--color-surface-border)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>Loading…</div>,
});
const AIChat = dynamic(() => import("@/components/AIChat").then(m => m.default), {
  loading: () => <div style={{ height: 520, background: "var(--color-surface-card)", border: "1px solid var(--color-surface-border)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>Loading…</div>,
});
const AlgoTrading = dynamic(() => import("@/components/AlgoTrading").then(m => m.default), {
  loading: () => <div style={{ height: 520, background: "var(--color-surface-card)", border: "1px solid var(--color-surface-border)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>Loading…</div>,
});
const Backtest = dynamic(() => import("@/components/Backtest").then(m => m.default), {
  loading: () => <div style={{ height: 520, background: "var(--color-surface-card)", border: "1px solid var(--color-surface-border)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>Loading…</div>,
});
const Learn = dynamic(() => import("@/components/Learn").then(m => m.default), {
  loading: () => <div style={{ height: 520, background: "var(--color-surface-card)", border: "1px solid var(--color-surface-border)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>Loading…</div>,
});
const Portfolio = dynamic(() => import("@/components/Portfolio").then(m => m.default), {
  loading: () => <div style={{ height: 520, background: "var(--color-surface-card)", border: "1px solid var(--color-surface-border)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>Loading…</div>,
});

export default function Dashboard() {
  usePriceStream(DEFAULT_SYMBOLS);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab,  setActiveTab]  = useState<Tab>("chat");

  const tabStyle = (t: Tab) => ({
    padding: "5px 10px", borderRadius: 8, fontSize: 11,
    fontWeight: 600, cursor: "pointer", border: "none",
    fontFamily: "monospace",
    background: activeTab === t
      ? "var(--color-accent)" : "var(--color-surface-elevated)",
    color: activeTab === t ? "#fff" : "#9ca3af",
    transition: "all 0.15s",
    whiteSpace: "nowrap" as const,
  });

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--color-surface)" }}>

      {/* Header */}
      <header style={{
        borderBottom: "1px solid var(--color-surface-border)",
        padding: "10px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: "#fff", margin: 0 }}>
            🇮🇳 DalalStreet AI
          </h1>
          <span style={{
            fontSize: 10, color: "var(--color-muted)",
            background: "var(--color-surface-elevated)",
            padding: "2px 8px", borderRadius: 20,
            border: "1px solid var(--color-surface-border)",
          }}>DEMO · Virtual Trading</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 12, color: "#6b7280", fontFamily: "monospace" }}>
            Powered by Groq · yfinance · NSE/BSE
          </div>
          <LogoutButton />
        </div>
      </header>

      {/* Index bar */}
      <div style={{
        borderBottom: "1px solid var(--color-surface-border)",
        padding: "6px 24px",
        backgroundColor: "var(--color-surface-card)",
      }}>
        <IndexBar />
      </div>

      {/* Main layout */}
      <main style={{
        display: "grid",
        gridTemplateColumns: "1fr 340px",
        gap: 16, padding: 16,
        alignItems: "start",
        minHeight: "calc(100vh - 100px)",
      }}>
        <Watchlist />

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{
            display: "flex", gap: 4, flexWrap: "wrap",
            background: "var(--color-surface-card)",
            border: "1px solid var(--color-surface-border)",
            borderRadius: 10, padding: 6,
          }}>
            <button style={tabStyle("chat")}      onClick={() => setActiveTab("chat")}>🤖 AI</button>
            <button style={tabStyle("trade")}     onClick={() => setActiveTab("trade")}>📈 Trade</button>
            <button style={tabStyle("algo")}      onClick={() => setActiveTab("algo")}>⚡ Algo</button>
            <button style={tabStyle("backtest")}  onClick={() => setActiveTab("backtest")}>🔬 Backtest</button>
            <button style={tabStyle("learn")}     onClick={() => setActiveTab("learn")}>🎓 Learn</button>
            <button style={tabStyle("portfolio")} onClick={() => setActiveTab("portfolio")}>💼 Portfolio</button>
          </div>

          {activeTab === "chat"      && <AIChat />}
          {activeTab === "trade"     && <TradePanel onTrade={() => setRefreshKey(k => k + 1)} />}
          {activeTab === "algo"      && <AlgoTrading />}
          {activeTab === "backtest"  && <Backtest />}
          {activeTab === "learn"     && <Learn />}
          {activeTab === "portfolio" && <Portfolio refreshKey={refreshKey} />}
        </div>
      </main>
    </div>
  );
}
