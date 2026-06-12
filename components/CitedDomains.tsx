import { topCitedDomains } from "@/lib/analyze";
import type { AnalyzedResult } from "@/lib/types";

/**
 * The sources answer engines actually cite for these prompts — i.e. where AEO
 * effort (guest posts, listings, reviews) is most likely to pay off.
 */
export function CitedDomains({
  results,
  brandDomain,
}: {
  results: AnalyzedResult[];
  brandDomain?: string;
}) {
  const domains = topCitedDomains(results, brandDomain);
  if (domains.length === 0) return null;
  const max = domains[0].count;

  return (
    <div className="card p-5">
      <div className="label mb-1">Most-cited sources</div>
      <p className="mb-3 text-xs text-gray-500">
        Domains the engines cited for your prompts — get featured on these to improve
        AI visibility.
      </p>
      <ul className="space-y-1.5">
        {domains.map((d) => (
          <li key={d.domain} className="flex items-center gap-3 text-sm">
            <span
              className={`w-44 truncate ${d.isBrand ? "font-semibold text-emerald-400" : "text-gray-300"}`}
              title={d.domain}
            >
              {d.domain}
              {d.isBrand && " ✓"}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-700">
              <div
                className={`h-full ${d.isBrand ? "bg-emerald-400" : "bg-accent/70"}`}
                style={{ width: `${(d.count / max) * 100}%` }}
              />
            </div>
            <span className="w-8 text-right text-xs text-gray-500">{d.count}×</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
