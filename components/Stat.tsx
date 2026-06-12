export function Stat({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-400"
      : tone === "warn"
        ? "text-amber-400"
        : tone === "bad"
          ? "text-rose-400"
          : "text-white";
  return (
    <div className="card p-4">
      <div className="label">{label}</div>
      <div className={`text-2xl font-bold ${toneClass}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

export function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}
