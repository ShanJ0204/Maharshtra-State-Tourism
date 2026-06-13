import type { Citation } from "../types";
import { mockAnswer, SYSTEM_PROMPT, type EngineOutput } from "./shared";

export async function queryOpenAI(prompt: string): Promise<EngineOutput> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return mockAnswer("openai", prompt);

  const model = process.env.OPENAI_MODEL || "gpt-4o";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
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
      max_tokens: 800,
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const answer: string = data.choices?.[0]?.message?.content ?? "";
  // OpenAI chat completions has no native web citations.
  const citations: Citation[] = [];
  return { answer: answer.trim(), citations, mock: false };
}
