export function Stat({
  label,
  value,
  sub,
  tone = "default",
  delta,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "good" | "warn" | "bad";
  /** Change vs the previous run for the same brand, as a fraction (e.g. 0.12). */
  delta?: number;
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-400"
      : tone === "warn"
        ? "text-amber-400"
        : tone === "bad"
          ? "text-rose-400"
          : "text-white";

  const showDelta = delta !== undefined && Math.abs(delta) >= 0.005;

  return (
    <div className="card p-4">
      <div className="label">{label}</div>
      <div className="flex items-baseline gap-2">
        <div className={`text-2xl font-bold ${toneClass}`}>{value}</div>
        {showDelta && (
          <span
            className={`text-xs font-semibold ${delta! > 0 ? "text-emerald-400" : "text-rose-400"}`}
            title="vs previous run for this brand"
          >
            {delta! > 0 ? "▲" : "▼"} {Math.abs(Math.round(delta! * 100))}pt
          </span>
        )}
      </div>
      {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

export function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}
