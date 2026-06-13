"use client";

import { useMemo, useState } from "react";
import type { AnalyzedResult, EngineId } from "@/lib/types";
import { ENGINES } from "@/lib/types";

const ENGINE_LABEL: Record<string, string> = {
  claude: "Claude",
  openai: "ChatGPT",
  gemini: "Gemini",
  perplexity: "Perplexity",
};

type StatusFilter = "all" | "mentioned" | "missed" | "cited" | "error";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "mentioned", label: "Mentioned" },
  { value: "missed", label: "Missed" },
  { value: "cited", label: "Cited" },
  { value: "error", label: "Errors" },
];

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
  const [engineFilter, setEngineFilter] = useState<"all" | EngineId>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return results.filter((r) => {
      if (engineFilter !== "all" && r.engine !== engineFilter) return false;
      if (statusFilter === "mentioned" && !r.analysis.mentioned) return false;
      if (statusFilter === "missed" && (r.analysis.mentioned || r.error)) return false;
      if (statusFilter === "cited" && !r.analysis.domainCited) return false;
      if (statusFilter === "error" && !r.error) return false;
      if (q && !r.prompt.toLowerCase().includes(q) && !r.answer.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [results, engineFilter, statusFilter, search]);

  const presentEngines = useMemo(
    () => ENGINES.filter((e) => results.some((r) => r.engine === e.id)),
    [results],
  );

  return (
    <div className="card overflow-hidden">
      {/* filter bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-700 px-4 py-2.5">
        <input
          className="input h-8 w-48 text-xs"
          placeholder="Search prompts & answers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input h-8 w-auto text-xs"
          value={engineFilter}
          onChange={(e) => setEngineFilter(e.target.value as "all" | EngineId)}
        >
          <option value="all">All engines</option>
          {presentEngines.map((e) => (
            <option key={e.id} value={e.id}>
              {e.label}
            </option>
          ))}
        </select>
        <div className="flex gap-1">
          {STATUS_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setStatusFilter(o.value)}
              className={`rounded-lg px-2 py-1 text-[11px] font-medium transition ${
                statusFilter === o.value
                  ? "bg-accent/20 text-accent-soft"
                  : "text-gray-500 hover:bg-ink-700"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[11px] text-gray-500">
          {filtered.length} / {results.length}
        </span>
      </div>

      <div className="grid grid-cols-12 gap-2 border-b border-ink-700 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        <div className="col-span-5">Prompt</div>
        <div className="col-span-2">Engine</div>
        <div className="col-span-2">Mention</div>
        <div className="col-span-2">Position</div>
        <div className="col-span-1">Cited</div>
      </div>
      <div className="divide-y divide-ink-700/60">
        {filtered.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-gray-600">
            No results match the current filters.
          </div>
        )}
        {filtered.map((r) => {
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
