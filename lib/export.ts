import { csvEscape } from "./csv";
import { topCitedDomains } from "./analyze";
import type { RunResponse } from "./types";

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/** Flatten a run into a spreadsheet-friendly CSV. */
export function runToCSV(run: RunResponse): string {
  const competitors = run.config.competitors;
  const header = [
    "prompt_id",
    "prompt",
    "category",
    "engine",
    "mock",
    "error",
    "mentioned",
    "mention_count",
    "position",
    "sentiment",
    "domain_cited",
    ...competitors.map((c) => `mentions:${c}`),
    "citations",
    "answer",
  ];
  const lines = [header.map(csvEscape).join(",")];
  for (const r of run.results) {
    lines.push(
      [
        r.promptId,
        r.prompt,
        r.category ?? "",
        r.engine,
        r.mock ? "yes" : "no",
        r.error ?? "",
        r.analysis.mentioned ? "yes" : "no",
        String(r.analysis.mentionCount),
        r.analysis.position ?? "",
        r.analysis.sentiment ?? "",
        r.analysis.domainCited ? "yes" : "no",
        ...competitors.map((c) => String(r.analysis.competitorMentions[c] ?? 0)),
        r.citations.map((c) => c.url).join(" "),
        r.answer,
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  return lines.join("\n");
}

/** Human-readable Markdown report of a run. */
export function runToMarkdown(run: RunResponse): string {
  const s = run.summary;
  const c = run.config;
  const date = new Date(run.runAt).toLocaleString();
  const lines: string[] = [];

  lines.push(`# AEO Discoverability Report — ${c.brand}`);
  lines.push("");
  lines.push(`*Generated ${date} by Beacon${run.anyMock ? " — ⚠️ contains mock data" : ""}*`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("|---|---|");
  lines.push(`| Queries run | ${s.totalQueries} |`);
  lines.push(`| Mention rate | ${pct(s.mentionRate)} |`);
  lines.push(`| Citation rate (${c.domain ?? "no domain set"}) | ${pct(s.citationRate)} |`);
  lines.push(`| Share of voice | ${pct(s.shareOfVoice)} |`);
  lines.push("");

  lines.push("## Per-engine");
  lines.push("");
  lines.push("| Engine | Queries | Mention rate | Citation rate |");
  lines.push("|---|---|---|---|");
  for (const [engine, e] of Object.entries(s.perEngine)) {
    lines.push(`| ${engine} | ${e.queries} | ${pct(e.mentionRate)} | ${pct(e.citationRate)} |`);
  }
  lines.push("");

  if (c.competitors.length) {
    lines.push("## Share of voice (total mentions)");
    lines.push("");
    lines.push(`- **${c.brand}: ${s.brandMentions}**`);
    for (const [comp, n] of Object.entries(s.competitorMentions)) {
      lines.push(`- ${comp}: ${n}`);
    }
    lines.push("");
  }

  const misses = run.results.filter((r) => !r.analysis.mentioned && !r.error);
  if (misses.length) {
    lines.push("## Prompts where the brand was NOT mentioned");
    lines.push("");
    for (const m of misses.slice(0, 25)) {
      lines.push(`- [${m.engine}] ${m.prompt}`);
    }
    lines.push("");
  }

  const cited = topCitedDomains(run.results, c.domain);
  if (cited.length) {
    lines.push("## Most-cited sources (target these for AEO)");
    lines.push("");
    for (const d of cited) {
      lines.push(`- ${d.domain} — cited ${d.count}×${d.isBrand ? " **(your domain)**" : ""}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/** Trigger a browser download of a text file. */
export function downloadFile(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
