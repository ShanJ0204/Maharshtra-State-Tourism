"use client";

import { useEffect, useMemo, useState } from "react";
import { parsePrompts } from "@/lib/csv";
import { ENGINES } from "@/lib/types";
import type { EngineId, RunResponse } from "@/lib/types";
import { appendHistory, clearHistory, loadHistory, type HistoryEntry } from "@/lib/history";
import { Stat, pct } from "@/components/Stat";
import { ShareOfVoice } from "@/components/ShareOfVoice";
import { ResultsTable } from "@/components/ResultsTable";
import { Recommendations } from "@/components/Recommendations";

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

export default function Page() {
  const [brand, setBrand] = useState("");
  const [domain, setDomain] = useState("");
  const [competitors, setCompetitors] = useState("");
  const [engines, setEngines] = useState<EngineId[]>(["claude", "openai", "gemini", "perplexity"]);
  const [csvText, setCsvText] = useState("");

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<RunResponse | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => setHistory(loadHistory()), []);

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

  async function handleRun() {
    setError(null);
    if (!brand.trim()) return setError("Enter your brand name.");
    if (prompts.length === 0) return setError("Add at least one prompt (upload a CSV or paste rows).");
    if (engines.length === 0) return setError("Select at least one engine.");

    setRunning(true);
    setRun(null);
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompts,
          config: { brand: brand.trim(), domain: domain.trim() || undefined, competitors: competitorList, engines },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Run failed");
      setRun(data);
      setHistory(appendHistory(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  const s = run?.summary;

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
                {ENGINES.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => toggleEngine(e.id)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                      engines.includes(e.id)
                        ? "border-accent bg-accent/20 text-accent-soft"
                        : "border-ink-600 text-gray-400 hover:bg-ink-700"
                    }`}
                  >
                    {e.label}
                  </button>
                ))}
              </div>
            </div>

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
                {prompts.length > 0 && ` · ${prompts.length * engines.length} queries`}
              </p>
            </div>

            <button onClick={handleRun} disabled={running} className="btn-primary w-full">
              {running ? "Running…" : "Run discoverability check"}
            </button>
            {error && <p className="text-sm text-rose-400">{error}</p>}
          </div>
        </section>

        {/* ---- Results panel ---- */}
        <section className="space-y-6">
          {!run && !running && (
            <div className="card flex h-64 flex-col items-center justify-center text-center text-gray-500">
              <span className="text-3xl">🔍</span>
              <p className="mt-2 text-sm">Configure your brand and prompts, then run a check.</p>
              {history.length > 0 && <TrendStrip history={history} onClear={() => { clearHistory(); setHistory([]); }} />}
            </div>
          )}

          {running && (
            <div className="card flex h-64 items-center justify-center text-gray-400">
              <span className="animate-pulse text-sm">Querying engines… this can take up to a minute.</span>
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
                <Stat label="Mention rate" value={pct(s.mentionRate)} tone={s.mentionRate >= 0.5 ? "good" : s.mentionRate > 0 ? "warn" : "bad"} sub={`across ${s.totalQueries} queries`} />
                <Stat label="Share of voice" value={pct(s.shareOfVoice)} tone={s.shareOfVoice >= 0.5 ? "good" : "warn"} sub="vs competitors" />
                <Stat label="Citation rate" value={pct(s.citationRate)} tone={s.citationRate > 0 ? "good" : "bad"} sub="your domain cited" />
                <Stat label="Avg. position" value={s.avgPosition === null ? "—" : s.avgPosition < 0.34 ? "early" : s.avgPosition < 0.67 ? "mid" : "late"} sub="in the answer" />
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

              <Recommendations run={run} />

              <div>
                <h3 className="mb-2 text-sm font-semibold text-white">Per-prompt results</h3>
                <ResultsTable results={run.results} />
              </div>

              {history.length > 1 && <TrendStrip history={history} onClear={() => { clearHistory(); setHistory([]); }} />}
            </>
          )}
        </section>
      </div>

      <footer className="mt-12 text-center text-xs text-gray-600">
        Beacon · runs locally · history stored in your browser
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
        <button onClick={onClear} className="text-xs text-gray-500 hover:text-rose-400">clear</button>
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
