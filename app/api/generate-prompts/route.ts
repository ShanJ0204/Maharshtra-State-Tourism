import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

interface GenerateBody {
  brand: string;
  domain?: string;
  description: string;
  competitors?: string[];
  count?: number;
}

interface GeneratedPrompt {
  prompt: string;
  category: string;
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON found in response");
  return JSON.parse(candidate.slice(start, end + 1));
}

const TRAILING_STOPWORDS = new Set(["for", "of", "in", "on", "to", "and", "or", "the", "a", "an", "with"]);

function mockPrompts(description: string, count: number): GeneratedPrompt[] {
  const words = description.trim().split(/\s+/).slice(0, 5);
  while (words.length > 1 && TRAILING_STOPWORDS.has(words[words.length - 1].toLowerCase())) {
    words.pop();
  }
  const topic = words.join(" ") || "this category";
  const base: GeneratedPrompt[] = [
    { prompt: `What are the best options for ${topic}?`, category: "best-of" },
    { prompt: `Which ${topic} solution should a small business choose?`, category: "comparison" },
    { prompt: `Recommend a reliable provider for ${topic}`, category: "recommendation" },
    { prompt: `What do people use for ${topic} these days?`, category: "discovery" },
    { prompt: `Compare the top tools for ${topic}`, category: "comparison" },
    { prompt: `What's a good affordable choice for ${topic}?`, category: "budget" },
    { prompt: `Which ${topic} option is best for beginners?`, category: "use-case" },
    { prompt: `What are alternatives to the most popular ${topic} product?`, category: "alternatives" },
    { prompt: `Who are the leading companies in ${topic}?`, category: "leaders" },
    { prompt: `What should I look for when picking ${topic}?`, category: "buying-guide" },
  ];
  // Audience qualifiers let us produce as many distinct prompts as requested
  // (the 10 base templates alone can't satisfy a 20- or 30-prompt request).
  const audiences = [
    "for startups",
    "for enterprise teams",
    "for freelancers",
    "for remote teams",
    "for nonprofits",
    "for agencies",
    "in 2025",
    "for large organizations",
  ];

  const out: GeneratedPrompt[] = [];
  const seen = new Set<string>();
  const push = (p: GeneratedPrompt) => {
    if (out.length >= count || seen.has(p.prompt)) return;
    seen.add(p.prompt);
    out.push(p);
  };

  base.forEach(push);
  // Then expand with audience-qualified variants until we hit the count.
  for (const aud of audiences) {
    if (out.length >= count) break;
    for (const t of base) {
      if (out.length >= count) break;
      const q = t.prompt.replace(/\?$/, "").trim();
      push({ prompt: `${q} ${aud}?`, category: t.category });
    }
  }
  return out.slice(0, count);
}

export async function POST(req: NextRequest) {
  let body: GenerateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.description?.trim()) {
    return NextResponse.json(
      { error: "Describe your product/category first" },
      { status: 400 },
    );
  }
  const count = Math.min(Math.max(body.count ?? 15, 5), 30);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      prompts: mockPrompts(body.description, count),
      mock: true,
    });
  }

  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

  const prompt =
    "You are an Answer Engine Optimization strategist. Generate realistic prompts that " +
    "real users would type into AI assistants (ChatGPT, Claude, Gemini, Perplexity) when " +
    "they are in a position to DISCOVER brands in the category below. These are used to " +
    "audit whether a specific brand shows up in AI answers.\n\n" +
    `Category / product description: ${body.description}\n` +
    (body.brand ? `Brand being audited: ${body.brand} (for context only)\n` : "") +
    (body.competitors?.length ? `Known competitors: ${body.competitors.join(", ")}\n` : "") +
    `\nRules:\n` +
    `- Generate exactly ${count} prompts.\n` +
    "- Prompts must be UNBRANDED discovery queries — never name the audited brand " +
    "(naming a competitor in an 'alternatives to X' query is fine).\n" +
    "- Mix intents: best-of lists, comparisons, use-case specific ('for startups', 'for enterprise'), " +
    "budget-conscious, alternatives-to-competitor, how-to-choose, and niche long-tail questions.\n" +
    "- Phrase them the way real people talk to chatbots, with varied length and tone.\n" +
    "- Give each a short lowercase category tag.\n\n" +
    'Respond with ONLY this JSON shape: {"prompts": [{"prompt": string, "category": string}]}';

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });
    const textBlock = response.content.find((b) => b.type === "text");
    const raw = textBlock && "text" in textBlock ? textBlock.text : "";
    const json = extractJson(raw) as { prompts: GeneratedPrompt[] };
    if (!Array.isArray(json.prompts) || json.prompts.length === 0) {
      throw new Error("Model returned no prompts");
    }
    return NextResponse.json({ prompts: json.prompts.slice(0, count), mock: false });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
