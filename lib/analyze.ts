import type {
  Analysis,
  AnalyzedResult,
  Citation,
  EngineId,
  EngineResult,
  Position,
  RunConfig,
  RunSummary,
  Sentiment,
} from "./types";
import { ENGINES } from "./types";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Count case-insensitive whole-word-ish occurrences and the first index. */
function findMentions(text: string, term: string): { count: number; firstIndex: number } {
  const t = term.trim();
  if (!t) return { count: 0, firstIndex: -1 };
  // \b doesn't play nice with some brand chars; use lookarounds on word chars.
  const re = new RegExp(`(?<![\\w])${escapeRegex(t)}(?![\\w])`, "gi");
  let m: RegExpExecArray | null;
  let count = 0;
  let firstIndex = -1;
  while ((m = re.exec(text)) !== null) {
    if (firstIndex === -1) firstIndex = m.index;
    count++;
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return { count, firstIndex };
}

const POSITIVE = [
  "best", "leading", "top", "excellent", "great", "popular", "trusted",
  "recommended", "reliable", "innovative", "premium", "favorite", "strong",
  "award", "love", "powerful", "quality", "superior", "go-to",
];
const NEGATIVE = [
  "worst", "bad", "poor", "expensive", "limited", "lacking", "weak", "slow",
  "outdated", "issue", "problem", "complaint", "avoid", "difficult", "concern",
  "drawback", "downside", "unreliable",
];

function sentimentAround(text: string, index: number): Sentiment {
  const window = text.slice(Math.max(0, index - 140), index + 140).toLowerCase();
  let score = 0;
  for (const w of POSITIVE) if (window.includes(w)) score++;
  for (const w of NEGATIVE) if (window.includes(w)) score--;
  if (score > 0) return "positive";
  if (score < 0) return "negative";
  return "neutral";
}

function positionFromRatio(ratio: number): Position {
  if (ratio < 0.34) return "early";
  if (ratio < 0.67) return "middle";
  return "late";
}

function rootDomain(input: string): string {
  let d = input.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "").replace(/^www\./, "");
  d = d.split("/")[0];
  return d;
}

function domainCited(domain: string | undefined, text: string, citations: Citation[]): boolean {
  if (!domain) return false;
  const root = rootDomain(domain);
  if (!root) return false;
  if (text.toLowerCase().includes(root)) return true;
  return citations.some((c) => rootDomain(c.url).includes(root) || root.includes(rootDomain(c.url)));
}

export function analyzeResult(result: EngineResult, config: RunConfig): Analysis {
  const text = result.answer || "";
  const { count, firstIndex } = findMentions(text, config.brand);
  const mentioned = count > 0;
  const positionRatio = mentioned && text.length > 0 ? firstIndex / text.length : null;

  const competitorMentions: Record<string, number> = {};
  for (const comp of config.competitors) {
    competitorMentions[comp] = findMentions(text, comp).count;
  }

  return {
    mentioned,
    mentionCount: count,
    positionRatio,
    position: positionRatio !== null ? positionFromRatio(positionRatio) : null,
    sentiment: mentioned ? sentimentAround(text, firstIndex) : null,
    domainCited: domainCited(config.domain, text, result.citations),
    competitorMentions,
  };
}

export function summarize(results: AnalyzedResult[], config: RunConfig): RunSummary {
  const totalQueries = results.length;
  const mentions = results.filter((r) => r.analysis.mentioned).length;
  const citations = results.filter((r) => r.analysis.domainCited).length;

  const positions = results
    .map((r) => r.analysis.positionRatio)
    .filter((p): p is number => p !== null);
  const avgPosition = positions.length
    ? positions.reduce((a, b) => a + b, 0) / positions.length
    : null;

  const brandMentions = results.reduce((sum, r) => sum + r.analysis.mentionCount, 0);
  const competitorMentions: Record<string, number> = {};
  for (const comp of config.competitors) competitorMentions[comp] = 0;
  for (const r of results) {
    for (const [comp, n] of Object.entries(r.analysis.competitorMentions)) {
      competitorMentions[comp] = (competitorMentions[comp] ?? 0) + n;
    }
  }
  const totalCompetitor = Object.values(competitorMentions).reduce((a, b) => a + b, 0);
  const shareOfVoice =
    brandMentions + totalCompetitor > 0
      ? brandMentions / (brandMentions + totalCompetitor)
      : 0;

  const perEngine = {} as RunSummary["perEngine"];
  for (const { id } of ENGINES) {
    const rs = results.filter((r) => r.engine === id);
    if (rs.length === 0) continue;
    const m = rs.filter((r) => r.analysis.mentioned).length;
    const c = rs.filter((r) => r.analysis.domainCited).length;
    perEngine[id as EngineId] = {
      queries: rs.length,
      mentions: m,
      mentionRate: rs.length ? m / rs.length : 0,
      citations: c,
      citationRate: rs.length ? c / rs.length : 0,
    };
  }

  return {
    totalQueries,
    mentionRate: totalQueries ? mentions / totalQueries : 0,
    citationRate: totalQueries ? citations / totalQueries : 0,
    avgPosition,
    shareOfVoice,
    brandMentions,
    competitorMentions,
    perEngine,
  };
}
