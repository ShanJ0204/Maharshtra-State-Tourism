export type EngineId = "claude" | "openai" | "gemini" | "perplexity";

export const ENGINES: { id: EngineId; label: string; web: boolean }[] = [
  { id: "claude", label: "Claude", web: true },
  { id: "openai", label: "ChatGPT (OpenAI)", web: false },
  { id: "gemini", label: "Gemini", web: true },
  { id: "perplexity", label: "Perplexity", web: true },
];

export interface Citation {
  url: string;
  title?: string;
}

export interface PromptRow {
  id: string;
  prompt: string;
  category?: string;
}

/** Raw output from a single engine for a single prompt. */
export interface EngineResult {
  engine: EngineId;
  promptId: string;
  prompt: string;
  category?: string;
  answer: string;
  citations: Citation[];
  latencyMs: number;
  /** True when no API key was configured and a fake answer was substituted. */
  mock: boolean;
  error?: string;
}

export type Position = "early" | "middle" | "late";
export type Sentiment = "positive" | "neutral" | "negative";

export interface Analysis {
  mentioned: boolean;
  mentionCount: number;
  /** 0..1 position of the first mention within the answer. */
  positionRatio: number | null;
  position: Position | null;
  sentiment: Sentiment | null;
  /** Brand domain appeared in the answer text or in a citation. */
  domainCited: boolean;
  /** Per-competitor mention counts. */
  competitorMentions: Record<string, number>;
}

export interface AnalyzedResult extends EngineResult {
  analysis: Analysis;
}

export interface RunConfig {
  brand: string;
  domain?: string;
  competitors: string[];
  engines: EngineId[];
}

export interface RunSummary {
  totalQueries: number;
  /** Queries that errored (excluded from rate denominators). */
  failedQueries: number;
  mentionRate: number;
  citationRate: number;
  avgPosition: number | null;
  /** Brand share-of-voice vs competitors, 0..1. */
  shareOfVoice: number;
  brandMentions: number;
  competitorMentions: Record<string, number>;
  perEngine: Record<
    EngineId,
    {
      queries: number;
      failed: number;
      mentions: number;
      mentionRate: number;
      citations: number;
      citationRate: number;
    }
  >;
}

export interface RunResponse {
  results: AnalyzedResult[];
  summary: RunSummary;
  config: RunConfig;
  runAt: string;
  anyMock: boolean;
}
