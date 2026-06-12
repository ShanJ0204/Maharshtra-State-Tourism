import type { RunSummary } from "@/lib/types";

const COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ec4899", "#06b6d4", "#a855f7"];

export function ShareOfVoice({
  summary,
  brand,
}: {
  summary: RunSummary;
  brand: string;
}) {
  const entries: { name: string; count: number }[] = [
    { name: brand, count: summary.brandMentions },
    ...Object.entries(summary.competitorMentions).map(([name, count]) => ({
      name,
      count,
    })),
  ].filter((e) => e.name.trim() !== "");

  const total = entries.reduce((a, b) => a + b.count, 0);

  if (total === 0) {
    return (
      <div className="card p-5">
        <div className="label">Share of Voice</div>
        <p className="text-sm text-gray-500">
          No brand or competitor mentions detected yet.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="label mb-3">Share of Voice (mentions)</div>
      <div className="flex h-4 w-full overflow-hidden rounded-full">
        {entries.map((e, i) => {
          const w = (e.count / total) * 100;
          if (w === 0) return null;
          return (
            <div
              key={e.name}
              style={{ width: `${w}%`, background: COLORS[i % COLORS.length] }}
              title={`${e.name}: ${e.count}`}
            />
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {entries.map((e, i) => (
          <div key={e.name} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: COLORS[i % COLORS.length] }}
            />
            <span className={i === 0 ? "font-semibold text-white" : "text-gray-400"}>
              {e.name}
            </span>
            <span className="text-gray-500">
              {Math.round((e.count / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
