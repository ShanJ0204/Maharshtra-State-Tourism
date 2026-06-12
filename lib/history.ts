import type { RunResponse } from "./types";

const KEY = "beacon.runs.v1";

export interface HistoryEntry {
  runAt: string;
  brand: string;
  mentionRate: number;
  citationRate: number;
  shareOfVoice: number;
  totalQueries: number;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function appendHistory(run: RunResponse): HistoryEntry[] {
  const entry: HistoryEntry = {
    runAt: run.runAt,
    brand: run.config.brand,
    mentionRate: run.summary.mentionRate,
    citationRate: run.summary.citationRate,
    shareOfVoice: run.summary.shareOfVoice,
    totalQueries: run.summary.totalQueries,
  };
  const all = [...loadHistory(), entry].slice(-50);
  if (typeof window !== "undefined") {
    localStorage.setItem(KEY, JSON.stringify(all));
  }
  return all;
}

export function clearHistory() {
  if (typeof window !== "undefined") localStorage.removeItem(KEY);
}
