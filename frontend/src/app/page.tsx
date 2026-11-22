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
    borderRadius: 8, fontSize: 11,
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
      <header className="flex flex-wrap items-center justify-between gap-4 px-3 md:px-6 py-3 md:py-2" style={{
        borderBottom: "1px solid var(--color-surface-border)",
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
          <div className="hidden md:block" style={{ fontSize: 12, color: "#6b7280", fontFamily: "monospace" }}>
            Powered by Groq · yfinance · NSE/BSE
          </div>
          <LogoutButton />
        </div>
      </header>

      {/* Index bar */}
      <div className="px-3 md:px-6 py-1.5 overflow-x-auto" style={{
        borderBottom: "1px solid var(--color-surface-border)",
        backgroundColor: "var(--color-surface-card)",
      }}>
        <IndexBar />
      </div>

      {/* Main layout */}
      <main className="grid gap-4 md:gap-4 p-2 md:p-4 min-h-[calc(100vh-100px)] min-w-0" style={{
        gridTemplateColumns: "1fr",
      }}>
        <div className="min-w-0" style={{ display: "contents" }}>
          <Watchlist />
        </div>

        <div className="min-w-0" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{
            display: "flex", gap: 4, flexWrap: "wrap",
            background: "var(--color-surface-card)",
            border: "1px solid var(--color-surface-border)",
            borderRadius: 10, padding: 6,
          }}>
            <button className="h-10 md:h-auto px-2 md:px-2.5" style={tabStyle("chat")}      onClick={() => setActiveTab("chat")}>🤖 AI</button>
            <button className="h-10 md:h-auto px-2 md:px-2.5" style={tabStyle("trade")}     onClick={() => setActiveTab("trade")}>📈 Trade</button>
            <button className="h-10 md:h-auto px-2 md:px-2.5" style={tabStyle("algo")}      onClick={() => setActiveTab("algo")}>⚡ Algo</button>
            <button className="h-10 md:h-auto px-2 md:px-2.5" style={tabStyle("backtest")}  onClick={() => setActiveTab("backtest")}>🔬 Backtest</button>
            <button className="h-10 md:h-auto px-2 md:px-2.5" style={tabStyle("learn")}     onClick={() => setActiveTab("learn")}>🎓 Learn</button>
            <button className="h-10 md:h-auto px-2 md:px-2.5" style={tabStyle("portfolio")} onClick={() => setActiveTab("portfolio")}>💼 Portfolio</button>
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
