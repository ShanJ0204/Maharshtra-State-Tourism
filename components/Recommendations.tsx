"use client";

import { useState } from "react";
import type { RunResponse } from "@/lib/types";

interface Recommendation {
  title: string;
  rationale: string;
  priority: "high" | "medium" | "low";
}

const PRIORITY_TONE: Record<string, string> = {
  high: "bg-rose-500/15 text-rose-400",
  medium: "bg-amber-500/15 text-amber-400",
  low: "bg-sky-500/15 text-sky-400",
};

export function Recommendations({ run }: { run: RunResponse }) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [recs, setRecs] = useState<Recommendation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setSummary(data.summary);
      setRecs(data.recommendations);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">AEO Recommendations</h3>
        <button onClick={generate} disabled={loading} className="btn-ghost text-xs">
          {loading ? "Analysing…" : recs ? "Regenerate" : "Generate with Claude"}
        </button>
      </div>

      {!recs && !error && (
        <p className="mt-2 text-sm text-gray-500">
          Generate prioritised, AI-written recommendations to improve how often your
          brand is mentioned and cited across answer engines.
        </p>
      )}

      {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}

      {summary && <p className="mt-3 text-sm text-gray-300">{summary}</p>}

      {recs && (
        <ul className="mt-4 space-y-3">
          {recs.map((r, i) => (
            <li key={i} className="rounded-xl border border-ink-700 bg-ink-900/50 p-3">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold uppercase ${PRIORITY_TONE[r.priority]}`}
                >
                  {r.priority}
                </span>
                <span className="text-sm font-semibold text-white">{r.title}</span>
              </div>
              <p className="mt-1.5 text-sm text-gray-400">{r.rationale}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
