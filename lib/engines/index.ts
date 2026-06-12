import type { EngineId } from "../types";
import type { EngineOutput } from "./shared";
import { queryClaude } from "./claude";
import { queryOpenAI } from "./openai";
import { queryGemini } from "./gemini";
import { queryPerplexity } from "./perplexity";

const REGISTRY: Record<EngineId, (prompt: string) => Promise<EngineOutput>> = {
  claude: queryClaude,
  openai: queryOpenAI,
  gemini: queryGemini,
  perplexity: queryPerplexity,
};

export async function runEngine(
  engine: EngineId,
  prompt: string,
): Promise<EngineOutput> {
  return REGISTRY[engine](prompt);
}

/** Which engines have a real API key configured (for UI hints). */
export function configuredEngines(): Record<EngineId, boolean> {
  return {
    claude: !!process.env.ANTHROPIC_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
    perplexity: !!process.env.PERPLEXITY_API_KEY,
  };
}
