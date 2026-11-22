"use client";
import { useEffect, useRef, useCallback } from "react";
import { usePriceStore } from "@/stores/priceStore";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Module-level client cache (symbol -> { data, timestamp }) ────────────────
const priceCache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 10_000; // 10 seconds

function getCached(symbol: string) {
  const entry = priceCache.get(symbol);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}

function setCached(symbol: string, data: any) {
  priceCache.set(symbol, { data, ts: Date.now() });
}

function getCachedBatch(symbols: string[]) {
  const result: Record<string, any> = {};
  const missing: string[] = [];
  for (const s of symbols) {
    const cached = getCached(s);
    if (cached) result[s] = cached;
    else missing.push(s);
  }
  return { result, missing };
}

function setCachedBatch(data: any[]) {
  for (const item of data) {
    if (item?.symbol) setCached(item.symbol, item);
  }
}

// ── SSE stream hook (shared connection for all symbols) ──────────────────────
export function usePriceStream(symbols: string[]) {
  const updatePrices = usePriceStore((s) => s.updatePrices);
  const symbolsRef = useRef(symbols);
  symbolsRef.current = symbols;

  useEffect(() => {
    if (!symbols.length) return;
    const symbolStr = symbols.join(",");
    const url = `${API_BASE}/api/market/stream/prices?symbols=${symbolStr}`;
    const es = new EventSource(url);

    es.addEventListener("price_update", (event) => {
      try {
        const prices = JSON.parse(event.data);
        updatePrices(prices);
        setCachedBatch(prices);
      } catch (e) {
        console.error("SSE parse error:", e);
      }
    });

    es.onerror = () => {
      console.warn("SSE connection lost — retrying…");
    };

    return () => es.close();
  }, [symbols.join(",")]);
}

// ── REST fetch with cache + dedupe + visibility pause ────────────────────────
type FetchPromise = Promise<any> | null;
const inFlight = new Map<string, FetchPromise>();

let visibilityPaused = false;
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    visibilityPaused = document.hidden;
    if (!visibilityPaused) {
      // Optional: could trigger immediate refresh here if needed
    }
  });
}

export async function fetchPrices(symbols: string[]): Promise<any[]> {
  if (!symbols.length) return [];

  // Check cache first
  const { result, missing } = getCachedBatch(symbols);
  if (missing.length === 0) {
    return symbols.map(s => result[s]).filter(Boolean);
  }

  // Pause if tab hidden
  if (visibilityPaused) {
    return symbols.map(s => result[s]).filter(Boolean);
  }

  // Dedupe in-flight requests per symbol
  const promises = missing.map(async (sym) => {
    let promise = inFlight.get(sym);
    if (promise) return promise;

    promise = (async () => {
      try {
        const res = await timedFetch(`${API_BASE}/api/market/price/${sym}`);
        if (!res.ok) return null;
        const data = await res.json();
        setCached(sym, data);
        return data;
      } catch {
        return null;
      } finally {
        inFlight.delete(sym);
      }
    })();

    inFlight.set(sym, promise);
    return promise;
  });

  const results = await Promise.all(promises);
  const valid = results.filter(Boolean);
  if (valid.length) setCachedBatch(valid);
  return [...Object.values(result), ...valid];
}

// ── One-shot fetch for default watchlist (uses same cache/dedupe) ────────────
export async function fetchDefaultPrices(symbols: string[]): Promise<any[]> {
  return fetchPrices(symbols);
}

// ── Development-only fetch timing helper ─────────────────────────────────────
export async function timedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (process.env.NODE_ENV !== "development") {
    return fetch(input, init);
  }
  const start = performance.now();
  try {
    return await fetch(input, init);
  } finally {
    const duration = Math.round(performance.now() - start);
    console.log(`[fetch] ${typeof input === "string" ? input : input.toString()} ${duration}ms`);
  }
}
