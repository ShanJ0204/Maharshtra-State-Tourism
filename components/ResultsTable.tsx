"use client";

import { useState } from "react";
import type { AnalyzedResult } from "@/lib/types";

const ENGINE_LABEL: Record<string, string> = {
  claude: "Claude",
  openai: "ChatGPT",
  gemini: "Gemini",
  perplexity: "Perplexity",
};

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
        ok ? "bg-emerald-500/15 text-emerald-400" : "bg-ink-700 text-gray-500"
      }`}
    >
      {label}
    </span>
  );
}

export function ResultsTable({ results }: { results: AnalyzedResult[] }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-12 gap-2 border-b border-ink-700 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        <div className="col-span-5">Prompt</div>
        <div className="col-span-2">Engine</div>
        <div className="col-span-2">Mention</div>
        <div className="col-span-2">Position</div>
        <div className="col-span-1">Cited</div>
      </div>
      <div className="divide-y divide-ink-700/60">
        {results.map((r) => {
          const key = `${r.promptId}-${r.engine}`;
          const isOpen = open === key;
          return (
            <div key={key}>
              <button
                onClick={() => setOpen(isOpen ? null : key)}
                className="grid w-full grid-cols-12 items-center gap-2 px-4 py-3 text-left text-sm hover:bg-ink-700/40"
              >
                <div className="col-span-5 truncate text-gray-200" title={r.prompt}>
                  {r.prompt}
                </div>
                <div className="col-span-2 text-gray-400">
                  {ENGINE_LABEL[r.engine]}
                  {r.mock && <span className="ml-1 text-amber-500">·mock</span>}
                </div>
                <div className="col-span-2">
                  {r.error ? (
                    <Badge ok={false} label="error" />
                  ) : r.analysis.mentioned ? (
                    <span className="text-emerald-400">
                      ✓ {r.analysis.mentionCount}×
                      {r.analysis.sentiment && (
                        <span className="ml-1 text-xs text-gray-500">
                          {r.analysis.sentiment}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-gray-600">—</span>
                  )}
                </div>
                <div className="col-span-2 text-xs text-gray-400">
                  {r.analysis.position ?? "—"}
                </div>
                <div className="col-span-1">
                  <Badge ok={r.analysis.domainCited} label={r.analysis.domainCited ? "yes" : "no"} />
                </div>
              </button>
              {isOpen && (
                <div className="bg-ink-900/60 px-4 py-3 text-sm">
                  {r.error ? (
                    <p className="text-rose-400">Error: {r.error}</p>
                  ) : (
                    <>
                      <p className="whitespace-pre-wrap text-gray-300">{r.answer}</p>
                      {r.citations.length > 0 && (
                        <div className="mt-3">
                          <div className="label">Citations</div>
                          <ul className="space-y-1">
                            {r.citations.map((c, i) => (
                              <li key={i} className="truncate text-xs">
                                <a
                                  href={c.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-accent-soft hover:underline"
                                >
                                  {c.title || c.url}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
