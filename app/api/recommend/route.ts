import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { RunResponse } from "@/lib/types";

export const maxDuration = 120;

interface Recommendation {
  title: string;
  rationale: string;
  priority: "high" | "medium" | "low";
}

/** Pull the first JSON object out of a model response, tolerating ```json fences. */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON found in response");
  return JSON.parse(candidate.slice(start, end + 1));
}

function mockRecommendations(brand: string) {
  return {
    summary: `[MOCK — set ANTHROPIC_API_KEY for real AI recommendations] A quick heuristic read on ${brand}'s answer-engine visibility.`,
    recommendations: [
      {
        title: "Publish comparison & 'best X for Y' content",
        rationale:
          "Answer engines lean heavily on listicle and comparison pages when naming brands. Create authoritative comparison content that positions your brand against named competitors.",
        priority: "high" as const,
      },
      {
        title: "Earn citations on high-authority third-party sites",
        rationale:
          "Perplexity and AI Overviews cite sources directly. Getting mentioned on reviews, Wikipedia, and reputable industry sites increases the chance your domain is cited.",
        priority: "high" as const,
      },
      {
        title: "Add structured data and clear entity descriptions",
        rationale:
          "Schema.org markup and a crisp, consistent brand description help models associate your brand with the right topics and queries.",
        priority: "medium" as const,
      },
    ],
  };
}

export async function POST(req: NextRequest) {
  let run: RunResponse;
  try {
    run = (await req.json()).run;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!run?.config?.brand) {
    return NextResponse.json({ error: "Missing run data" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(mockRecommendations(run.config.brand));
  }

  // Compact the run into a digest small enough to reason over.
  const digest = {
    brand: run.config.brand,
    domain: run.config.domain,
    competitors: run.config.competitors,
    mentionRate: run.summary.mentionRate,
    citationRate: run.summary.citationRate,
    shareOfVoice: run.summary.shareOfVoice,
    perEngine: run.summary.perEngine,
    competitorMentions: run.summary.competitorMentions,
    misses: run.results
      .filter((r) => !r.analysis.mentioned)
      .slice(0, 15)
      .map((r) => ({ engine: r.engine, prompt: r.prompt })),
    sampleAnswers: run.results.slice(0, 8).map((r) => ({
      engine: r.engine,
      prompt: r.prompt,
      mentioned: r.analysis.mentioned,
      answer: r.answer.slice(0, 600),
    })),
  };

  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

  const prompt =
    "You are an Answer Engine Optimization (AEO/GEO) strategist. Below is a JSON digest " +
    "of how a brand currently appears (or doesn't) across LLM answer engines for a set of " +
    "user prompts. Analyse where the brand is losing visibility and share of voice versus " +
    "competitors, then produce concrete, prioritised recommendations to improve how often " +
    "the brand is mentioned and cited in AI answers. Be specific and actionable.\n\n" +
    "Respond with ONLY a JSON object of this exact shape (no prose outside the JSON):\n" +
    '{"summary": string, "recommendations": [{"title": string, "rationale": string, ' +
    '"priority": "high"|"medium"|"low"}]}\n\n' +
    "DIGEST:\n" +
    JSON.stringify(digest, null, 2);

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });
    const textBlock = response.content.find((b) => b.type === "text");
    const raw = textBlock && "text" in textBlock ? textBlock.text : "";
    const json = extractJson(raw) as { summary: string; recommendations: Recommendation[] };
    if (!json.recommendations) throw new Error("Empty recommendation response");
    return NextResponse.json(json);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
