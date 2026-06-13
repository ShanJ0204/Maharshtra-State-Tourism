import type { AnalyzedResult, EngineId } from "@/lib/types";

const ENGINE_SHORT: Record<EngineId, string> = {
  claude: "Claude",
  openai: "GPT",
  gemini: "Gemini",
  perplexity: "Pplx",
};

/**
 * Prompt × engine heatmap: one glance shows which prompts your brand wins,
 * which it loses everywhere, and which engines are weakest.
 */
export function Matrix({
  results,
  engines,
}: {
  results: AnalyzedResult[];
  engines: EngineId[];
}) {
  // Group by prompt, preserving first-seen order.
  const byPrompt = new Map<string, { prompt: string; cells: Map<EngineId, AnalyzedResult> }>();
  for (const r of results) {
    let row = byPrompt.get(r.promptId);
    if (!row) {
      row = { prompt: r.prompt, cells: new Map() };
      byPrompt.set(r.promptId, row);
    }
    row.cells.set(r.engine, r);
  }
  const rows = [...byPrompt.values()];
  if (rows.length === 0) return null;

  return (
    <div className="card p-5">
      <div className="label mb-3">Visibility matrix</div>
      <div className="overflow-x-auto">
        <table className="w-full border-separate" style={{ borderSpacing: "3px 3px" }}>
          <thead>
            <tr>
              <th className="w-full" />
              {engines.map((e) => (
                <th key={e} className="px-1 pb-1 text-center text-[11px] font-medium text-gray-500">
                  {ENGINE_SHORT[e]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td
                  className="max-w-0 truncate pr-3 text-xs text-gray-400"
                  title={row.prompt}
                >
                  {row.prompt}
                </td>
                {engines.map((e) => {
                  const cell = row.cells.get(e);
                  let cls = "bg-ink-700/60"; // not run
                  let label = "not run";
                  if (cell) {
                    if (cell.error) {
                      cls = "bg-rose-500/40";
                      label = `error: ${cell.error}`;
                    } else if (cell.analysis.domainCited) {
                      cls = "bg-emerald-400";
                      label = "mentioned + cited";
                    } else if (cell.analysis.mentioned) {
                      cls = "bg-emerald-500/55";
                      label = `mentioned ${cell.analysis.mentionCount}×`;
                    } else {
                      cls = "bg-ink-600";
                      label = "not mentioned";
                    }
                  }
                  return (
                    <td key={e} className="p-0">
                      <div
                        className={`h-5 w-9 rounded ${cls}`}
                        title={`${ENGINE_SHORT[e]} — ${label}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500">
        <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded bg-emerald-400" /> mentioned + cited</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded bg-emerald-500/55" /> mentioned</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded bg-ink-600" /> not mentioned</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded bg-rose-500/40" /> error</span>
      </div>
    </div>
  );
}
