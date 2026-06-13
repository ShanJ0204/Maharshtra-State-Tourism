import type { Citation, EngineId } from "../types";

export interface EngineOutput {
  answer: string;
  citations: Citation[];
  mock: boolean;
}

const SAMPLE_BRANDS = [
  "Acme",
  "Globex",
  "Initech",
  "Umbrella",
  "Hooli",
  "Stark Industries",
  "Wayne Enterprises",
];

/**
 * Returns a clearly-labelled fake answer when an engine has no API key, so the
 * full UI + scoring pipeline still works end-to-end. Deterministic per prompt.
 */
export function mockAnswer(engine: EngineId, prompt: string): EngineOutput {
  const picks = SAMPLE_BRANDS.slice(0, 3 + (prompt.length % 3));
  const answer =
    `[MOCK ${engine} response — no API key configured] ` +
    `Based on the question "${prompt}", some notable options include ` +
    `${picks.join(", ")}. ${picks[0]} is frequently described as a leading, ` +
    `trusted choice, while ${picks[1]} is popular for value.`;
  return {
    answer,
    citations: [
      { url: "https://example.com/review", title: "Sample review (mock)" },
    ],
    mock: true,
  };
}

const SYSTEM_PROMPT =
  "You are answering as a helpful AI assistant that real users consult to discover and compare brands, products, and services. Answer naturally and specifically, naming concrete brands/companies/products where relevant.";

export { SYSTEM_PROMPT };
