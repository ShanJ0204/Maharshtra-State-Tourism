import Anthropic from "@anthropic-ai/sdk";
import type { Citation } from "../types";
import { mockAnswer, type EngineOutput } from "./shared";

const SYSTEM =
  "You are answering as a helpful AI assistant that real users consult to discover and compare brands, products, and services. Answer the user's question naturally and specifically, naming concrete brands/companies/products where relevant. Use web search to ground your answer in current information.";

/**
 * Query Claude with server-side web search enabled so the answer is grounded
 * and returns real citations (which feed the citation/visibility metrics).
 */
export async function queryClaude(prompt: string): Promise<EngineOutput> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return mockAnswer("claude", prompt);

  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];
  let text = "";
  const citations: Citation[] = [];

  // Server-side web search runs an internal loop; it may return pause_turn when
  // it hits the iteration cap. Re-send to resume, bounded by maxContinuations.
  for (let i = 0; i < 4; i++) {
    const response = await client.messages.create({
      model,
      max_tokens: 2000,
      system: SYSTEM,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages,
    });

    for (const block of response.content) {
      if (block.type === "text") {
        text += block.text;
      } else if (block.type === "web_search_tool_result") {
        const content = block.content;
        if (Array.isArray(content)) {
          for (const item of content) {
            if (item.type === "web_search_result") {
              citations.push({ url: item.url, title: item.title });
            }
          }
        }
      }
    }

    if (response.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: response.content });
  }

  // De-dupe citations by url
  const seen = new Set<string>();
  const deduped = citations.filter((c) => {
    if (seen.has(c.url)) return false;
    seen.add(c.url);
    return true;
  });

  return { answer: text.trim(), citations: deduped, mock: false };
}
