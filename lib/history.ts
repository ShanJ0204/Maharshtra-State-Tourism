import type { RunResponse } from "./types";

const TREND_KEY = "beacon.runs.v1";
const FULL_KEY = "beacon.fullruns.v1";
const CONFIG_KEY = "beacon.config.v1";

export interface HistoryEntry {
  runAt: string;
  brand: string;
  mentionRate: number;
  citationRate: number;
  shareOfVoice: number;
  totalQueries: number;
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage full or unavailable — degrade silently
  }
}

// ---------- trend entries (lightweight, long-lived) ----------

export function loadHistory(): HistoryEntry[] {
  return read<HistoryEntry[]>(TREND_KEY, []);
}

export function clearHistory() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TREND_KEY);
  localStorage.removeItem(FULL_KEY);
}

// ---------- full runs (trimmed, last few only) ----------

/** Trim answers/citations so a handful of full runs fit in localStorage. */
function trimRun(run: RunResponse): RunResponse {
  return {
    ...run,
    results: run.results.map((r) => ({
      ...r,
      answer: r.answer.slice(0, 4000),
      citations: r.citations.slice(0, 10),
    })),
  };
}

export function loadFullRuns(): RunResponse[] {
  return read<RunResponse[]>(FULL_KEY, []);
}

export function deleteFullRun(runAt: string): RunResponse[] {
  const kept = loadFullRuns().filter((r) => r.runAt !== runAt);
  write(FULL_KEY, kept);
  return kept;
}

/** Persist a finished run: appends a trend entry and stores the trimmed run. */
export function saveRun(run: RunResponse): {
  history: HistoryEntry[];
  fullRuns: RunResponse[];
} {
  const entry: HistoryEntry = {
    runAt: run.runAt,
    brand: run.config.brand,
    mentionRate: run.summary.mentionRate,
    citationRate: run.summary.citationRate,
    shareOfVoice: run.summary.shareOfVoice,
    totalQueries: run.summary.totalQueries,
  };
  const history = [...loadHistory(), entry].slice(-50);
  write(TREND_KEY, history);

  const fullRuns = [trimRun(run), ...loadFullRuns()].slice(0, 8);
  write(FULL_KEY, fullRuns);

  return { history, fullRuns };
}

/** Most recent prior run for the same brand — used for delta arrows. */
export function previousEntry(history: HistoryEntry[], run: RunResponse): HistoryEntry | null {
  const prior = history.filter(
    (h) => h.brand === run.config.brand && h.runAt < run.runAt,
  );
  return prior.length ? prior[prior.length - 1] : null;
}

// ---------- saved setup ----------

export interface SavedConfig {
  brand: string;
  domain: string;
  competitors: string;
  engines: string[];
  csvText: string;
}

export function loadConfig(): SavedConfig | null {
  return read<SavedConfig | null>(CONFIG_KEY, null);
}

export function saveConfig(config: SavedConfig) {
  write(CONFIG_KEY, config);
}
