import type { RunResponse } from "@/lib/types";
import { pct } from "./Stat";

export function RunHistory({
  runs,
  activeRunAt,
  onView,
  onDelete,
}: {
  runs: RunResponse[];
  activeRunAt?: string;
  onView: (run: RunResponse) => void;
  onDelete: (runAt: string) => void;
}) {
  if (runs.length === 0) return null;
  return (
    <div className="card p-4">
      <div className="label mb-2">Past runs</div>
      <ul className="space-y-1">
        {runs.map((r) => {
          const active = r.runAt === activeRunAt;
          return (
            <li
              key={r.runAt}
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${
                active ? "bg-accent/10" : "hover:bg-ink-700/50"
              }`}
            >
              <button
                onClick={() => onView(r)}
                className="flex flex-1 items-center gap-2 text-left"
                title="View this run"
              >
                <span className={`font-medium ${active ? "text-accent-soft" : "text-gray-300"}`}>
                  {r.config.brand}
                </span>
                <span className="text-gray-600">
                  {new Date(r.runAt).toLocaleDateString()}{" "}
                  {new Date(r.runAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="ml-auto text-gray-500">
                  {pct(r.summary.mentionRate)} mention · {r.summary.totalQueries} queries
                </span>
              </button>
              <button
                onClick={() => onDelete(r.runAt)}
                className="text-gray-600 hover:text-rose-400"
                title="Delete this run"
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
