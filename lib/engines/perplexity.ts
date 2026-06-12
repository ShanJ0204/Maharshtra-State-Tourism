import type { Citation } from "../types";
import { mockAnswer, SYSTEM_PROMPT, type EngineOutput } from "./shared";

/** Perplexity is OpenAI-compatible and returns a top-level `citations` array. */
export async function queryPerplexity(prompt: string): Promise<EngineOutput> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) return mockAnswer("perplexity", prompt);

  const model = process.env.PERPLEXITY_MODEL || "sonar";
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Perplexity ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const answer: string = data.choices?.[0]?.message?.content ?? "";

  const citations: Citation[] = [];
  // Newer responses use `search_results: [{url,title}]`; older use `citations: [url]`.
  if (Array.isArray(data.search_results)) {
    for (const r of data.search_results) {
      if (r.url) citations.push({ url: r.url, title: r.title });
    }
  } else if (Array.isArray(data.citations)) {
    for (const u of data.citations) {
      if (typeof u === "string") citations.push({ url: u });
    }
  }

  return { answer: answer.trim(), citations, mock: false };
}
