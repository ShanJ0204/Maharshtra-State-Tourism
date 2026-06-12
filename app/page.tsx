"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { parsePrompts } from "@/lib/csv";
import { summarize } from "@/lib/analyze";
import { ENGINES } from "@/lib/types";
import type { AnalyzedResult, EngineId, RunConfig, RunResponse } from "@/lib/types";
import {
  clearHistory,
  deleteFullRun,
  loadConfig,
  loadFullRuns,
  loadHistory,
  previousEntry,
  saveConfig,
  saveRun,
  type HistoryEntry,
} from "@/lib/history";
import { downloadFile, runToCSV, runToMarkdown } from "@/lib/export";
import { Stat, pct } from "@/components/Stat";
import { ShareOfVoice } from "@/components/ShareOfVoice";
import { ResultsTable } from "@/components/ResultsTable";
import { Recommendations } from "@/components/Recommendations";
import { Matrix } from "@/components/Matrix";
import { CitedDomains } from "@/components/CitedDomains";
import { PromptGenerator } from "@/components/PromptGenerator";
import { RunHistory } from "@/components/RunHistory";

const SAMPLE_CSV = `prompt,category
What are the best project management tools for startups?,tools
Which CRM should a small business use?,crm
Recommend reliable cloud hosting providers,hosting
What's the best tool for team collaboration?,collaboration
Top analytics platforms for marketers,analytics`;

const ENGINE_LABEL: Record<EngineId, string> = {
  claude: "Claude",
  openai: "ChatGPT",
  gemini: "Gemini",
  perplexity: "Perplexity",
};

const BATCH_SIZE = 5; // prompts per /api/run call — keeps each request fast
const MAX_PROMPTS = 100;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default function Page() {
  const [brand, setBrand] = useState("");
  const [domain, setDomain] = useState("");
  const [competitors, setCompetitors] = useState("");
  const [engines, setEngines] = useState<EngineId[]>(["claude", "openai", "gemini", "perplexity"]);
  const [csvText, setCsvText] = useState("");

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<RunResponse | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [fullRuns, setFullRuns] = useState<RunResponse[]>([]);
  const [engineStatus, setEngineStatus] = useState<Record<EngineId, boolean> | null>(null);

  const cancelRef = useRef(false);
  const loadedRef = useRef(false);

  // Restore saved state + fetch engine key status on mount.
  useEffect(() => {
    setHistory(loadHistory());
    setFullRuns(loadFullRuns());
    const saved = loadConfig();
    if (saved) {
      setBrand(saved.brand);
      setDomain(saved.domain);
      setCompetitors(saved.competitors);
      if (saved.engines.length) setEngines(saved.engines as EngineId[]);
      setCsvText(saved.csvText);
    }
    loadedRef.current = true;
    fetch("/api/status")
      .then((r) => r.json())
      .then((d) => setEngineStatus(d.engines))
      .catch(() => {});
  }, []);

  // Persist setup so a reload doesn't lose it.
  useEffect(() => {
    if (!loadedRef.current) return;
    saveConfig({ brand, domain, competitors, engines, csvText });
  }, [brand, domain, competitors, engines, csvText]);

  const prompts = useMemo(() => parsePrompts(csvText), [csvText]);
  const competitorList = useMemo(
    () => competitors.split(",").map((s) => s.trim()).filter(Boolean),
    [competitors],
  );

  function toggleEngine(id: EngineId) {
    setEngines((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]));
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result || ""));
    reader.readAsText(file);
  }

  function buildRun(results: AnalyzedResult[], config: RunConfig): RunResponse {
    return {
      results,
      summary: summarize(results, config),
      config,
      runAt: new Date().toISOString(),
      anyMock: results.some((r) => r.mock),
    };
  }

  async function handleRun() {
    setError(null);
    if (!brand.trim()) return setError("Enter your brand name.");
    if (prompts.length === 0) return setError("Add at least one prompt (upload a CSV, paste rows, or generate them).");
    if (engines.length === 0) return setError("Select at least one engine.");

    const config: RunConfig = {
      brand: brand.trim(),
      domain: domain.trim() || undefined,
      competitors: competitorList,
      engines,
    };
    const capped = prompts.slice(0, MAX_PROMPTS);
    const batches = chunk(capped, BATCH_SIZE);

    cancelRef.current = false;
    setRunning(true);
    setRun(null);
    setProgress({ done: 0, total: capped.length * engines.length });

    let all: AnalyzedResult[] = [];
    try {
      for (const batch of batches) {
        if (cancelRef.current) break;
        const res = await fetch("/api/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompts: batch, config }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Run failed");
        all = [...all, ...(data.results as AnalyzedResult[])];
        setProgress({ done: all.length, total: capped.length * engines.length });
        setRun(buildRun(all, config)); // live partial results
      }
      if (all.length > 0) {
        const final = buildRun(all, config);
        setRun(final);
        const saved = saveRun(final);
        setHistory(saved.history);
        setFullRuns(saved.fullRuns);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }

  function handleDeleteRun(runAt: string) {
    setFullRuns(deleteFullRun(runAt));
    if (run?.runAt === runAt) setRun(null);
  }

  const s = run?.summary;
  const prev = run ? previousEntry(history, run) : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📡</span>
          <h1 className="text-2xl font-bold text-white">Beacon</h1>
          <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-medium text-accent-soft">
            AEO Discoverability
          </span>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-gray-400">
          Upload the prompts your customers actually ask, run them across Claude, ChatGPT,
          Gemini and Perplexity, and measure whether <strong>your brand is getting seen</strong> —
          mentions, position, citations, and share of voice vs competitors.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* ---- Config panel ---- */}
        <div className="space-y-4">
          <section className="card h-fit p-5">
            <h2 className="mb-4 text-sm font-semibold text-white">Setup</h2>

            <div className="space-y-3">
              <div>
                <label className="label">Brand name *</label>
                <input className="input" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Notion" />
              </div>
              <div>
                <label className="label">Brand domain</label>
                <input className="input" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="e.g. notion.so" />
              </div>
              <div>
                <label className="label">Competitors (comma-separated)</label>
                <input className="input" value={competitors} onChange={(e) => setCompetitors(e.target.value)} placeholder="Asana, Trello, ClickUp" />
              </div>

              <div>
                <label className="label">Engines</label>
                <div className="flex flex-wrap gap-2">
                  {ENGINES.map((e) => {
                    const live = engineStatus?.[e.id];
                    return (
                      <button
                        key={e.id}
                        onClick={() => toggleEngine(e.id)}
                        title={
                          engineStatus
                            ? live
                              ? "API key configured — live answers"
                              : "No API key — mock answers"
                            : undefined
                        }
                        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                          engines.includes(e.id)
                            ? "border-accent bg-accent/20 text-accent-soft"
                            : "border-ink-600 text-gray-400 hover:bg-ink-700"
                        }`}
                      >
                        {engineStatus && (
                          <span
                            className={`inline-block h-1.5 w-1.5 rounded-full ${live ? "bg-emerald-400" : "bg-amber-400"}`}
                          />
                        )}
                        {e.label}
                      </button>
                    );
                  })}
                </div>
                {engineStatus && (
                  <p className="mt-1.5 text-[11px] text-gray-600">
                    <span className="text-emerald-400">●</span> live key ·{" "}
                    <span className="text-amber-400">●</span> mock (no key)
                  </p>
                )}
              </div>

              <PromptGenerator
                brand={brand}
                domain={domain}
                competitors={competitorList}
                onGenerated={setCsvText}
              />

              <div>
                <div className="flex items-center justify-between">
                  <label className="label mb-0">Prompts (CSV)</label>
                  <button onClick={() => setCsvText(SAMPLE_CSV)} className="text-xs text-accent-soft hover:underline">
                    load sample
                  </button>
                </div>
                <input type="file" accept=".csv,text/csv" onChange={onFile} className="mt-1 block w-full text-xs text-gray-400 file:mr-3 file:rounded-lg file:border-0 file:bg-ink-700 file:px-3 file:py-1.5 file:text-xs file:text-gray-200" />
                <textarea
                  className="input mt-2 h-32 resize-y font-mono text-xs"
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder={"prompt,category\nWhat are the best CRMs?,crm"}
                />
                <p className="mt-1 text-xs text-gray-500">
                  {prompts.length} prompt{prompts.length === 1 ? "" : "s"} parsed
                  {prompts.length > MAX_PROMPTS && ` (first ${MAX_PROMPTS} will run)`}
                  {prompts.length > 0 && ` · ${Math.min(prompts.length, MAX_PROMPTS) * engines.length} queries`}
                </p>
              </div>

              {running ? (
                <button
                  onClick={() => {
                    cancelRef.current = true;
                  }}
                  className="btn-ghost w-full"
                >
                  Stop after current batch
                </button>
              ) : (
                <button onClick={handleRun} className="btn-primary w-full">
                  Run discoverability check
                </button>
              )}
              {error && <p className="text-sm text-rose-400">{error}</p>}
            </div>
          </section>

          <RunHistory
            runs={fullRuns}
            activeRunAt={run?.runAt}
            onView={(r) => setRun(r)}
            onDelete={handleDeleteRun}
          />
        </div>

        {/* ---- Results panel ---- */}
        <section className="space-y-6">
          {progress && (
            <div className="card p-4">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>Querying engines… {progress.done}/{progress.total} answers</span>
                <span>{Math.round((progress.done / Math.max(progress.total, 1)) * 100)}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-700">
                <div
                  className="h-full bg-accent transition-all duration-500"
                  style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }}
                />
              </div>
            </div>
          )}

          {!run && !running && (
            <div className="card flex h-64 flex-col items-center justify-center px-6 text-center text-gray-500">
              <span className="text-3xl">🔍</span>
              <p className="mt-2 text-sm">Configure your brand and prompts, then run a check.</p>
              <p className="mt-1 text-xs text-gray-600">
                No prompts yet? Use <span className="text-accent-soft">✨ Generate</span> in the
                setup panel and Claude will write realistic discovery queries for your category.
              </p>
            </div>
          )}

          {run && s && (
            <>
              {run.anyMock && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
                  Some answers are <strong>mock data</strong> because an API key wasn&apos;t set for that
                  engine. Add keys in <code>.env.local</code> for real results.
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat
                  label="Mention rate"
                  value={pct(s.mentionRate)}
                  tone={s.mentionRate >= 0.5 ? "good" : s.mentionRate > 0 ? "warn" : "bad"}
                  sub={`across ${s.totalQueries} queries`}
                  delta={prev ? s.mentionRate - prev.mentionRate : undefined}
                />
                <Stat
                  label="Share of voice"
                  value={pct(s.shareOfVoice)}
                  tone={s.shareOfVoice >= 0.5 ? "good" : "warn"}
                  sub="vs competitors"
                  delta={prev ? s.shareOfVoice - prev.shareOfVoice : undefined}
                />
                <Stat
                  label="Citation rate"
                  value={pct(s.citationRate)}
                  tone={s.citationRate > 0 ? "good" : "bad"}
                  sub="your domain cited"
                  delta={prev ? s.citationRate - prev.citationRate : undefined}
                />
                <Stat
                  label="Avg. position"
                  value={s.avgPosition === null ? "—" : s.avgPosition < 0.34 ? "early" : s.avgPosition < 0.67 ? "mid" : "late"}
                  sub="in the answer"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <ShareOfVoice summary={s} brand={run.config.brand} />
                <div className="card p-5">
                  <div className="label mb-3">Per-engine mention rate</div>
                  <div className="space-y-2">
                    {Object.entries(s.perEngine).map(([id, e]) => (
                      <div key={id} className="flex items-center gap-3 text-sm">
                        <span className="w-20 text-gray-400">{ENGINE_LABEL[id as EngineId]}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-700">
                          <div className="h-full bg-accent" style={{ width: `${e.mentionRate * 100}%` }} />
                        </div>
                        <span className="w-10 text-right text-xs text-gray-400">{pct(e.mentionRate)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <Matrix results={run.results} engines={run.config.engines} />

              <CitedDomains results={run.results} brandDomain={run.config.domain} />

              {!running && <Recommendations run={run} />}

              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-white">Per-prompt results</h3>
                  <div className="flex gap-2">
                    <button
                      className="btn-ghost px-3 py-1 text-xs"
                      onClick={() =>
                        downloadFile(`beacon-${run.config.brand}-${run.runAt.slice(0, 10)}.csv`, runToCSV(run), "text/csv")
                      }
                    >
                      ⬇ CSV
                    </button>
                    <button
                      className="btn-ghost px-3 py-1 text-xs"
                      onClick={() =>
                        downloadFile(`beacon-report-${run.config.brand}-${run.runAt.slice(0, 10)}.md`, runToMarkdown(run), "text/markdown")
                      }
                    >
                      ⬇ Report (MD)
                    </button>
                    <button
                      className="btn-ghost px-3 py-1 text-xs"
                      onClick={() =>
                        downloadFile(`beacon-run-${run.runAt.slice(0, 10)}.json`, JSON.stringify(run, null, 2), "application/json")
                      }
                    >
                      ⬇ JSON
                    </button>
                  </div>
                </div>
                <ResultsTable results={run.results} />
              </div>

              {history.length > 1 && (
                <TrendStrip
                  history={history}
                  onClear={() => {
                    clearHistory();
                    setHistory([]);
                    setFullRuns([]);
                  }}
                />
              )}
            </>
          )}
        </section>
      </div>

      <footer className="mt-12 text-center text-xs text-gray-600">
        Beacon · keys stay server-side · history stored in your browser
      </footer>
    </main>
  );
}

function TrendStrip({ history, onClear }: { history: HistoryEntry[]; onClear: () => void }) {
  const recent = history.slice(-10);
  const max = Math.max(...recent.map((h) => h.mentionRate), 0.0001);
  return (
    <div className="card mt-4 w-full p-4">
      <div className="flex items-center justify-between">
        <div className="label mb-0">Mention-rate trend ({recent.length} runs)</div>
        <button onClick={onClear} className="text-xs text-gray-500 hover:text-rose-400">clear all history</button>
      </div>
      <div className="mt-3 flex h-16 items-end gap-1">
        {recent.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-accent/70"
            style={{ height: `${(h.mentionRate / max) * 100}%`, minHeight: 2 }}
            title={`${new Date(h.runAt).toLocaleString()} — ${Math.round(h.mentionRate * 100)}% mention, ${Math.round(h.shareOfVoice * 100)}% SOV`}
          />
        ))}
      </div>
    </div>
  );
}
