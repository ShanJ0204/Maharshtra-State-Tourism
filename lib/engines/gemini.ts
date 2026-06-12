import type { Citation } from "../types";
import { mockAnswer, SYSTEM_PROMPT, type EngineOutput } from "./shared";

/**
 * Gemini with Google Search grounding so the answer reflects current web data
 * and returns grounding sources we can treat as citations.
 */
export async function queryGemini(prompt: string): Promise<EngineOutput> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return mockAnswer("gemini", prompt);

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  const answer: string = parts
    .map((p: { text?: string }) => p.text ?? "")
    .join("")
    .trim();

  const citations: Citation[] = [];
  const chunks = candidate?.groundingMetadata?.groundingChunks ?? [];
  for (const ch of chunks) {
    if (ch.web?.uri) citations.push({ url: ch.web.uri, title: ch.web.title });
  }

  return { answer, citations, mock: false };
}
