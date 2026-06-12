import { NextRequest, NextResponse } from "next/server";
import { runEngine } from "@/lib/engines";
import { analyzeResult, summarize } from "@/lib/analyze";
import type {
  AnalyzedResult,
  EngineId,
  PromptRow,
  RunConfig,
  RunResponse,
} from "@/lib/types";
import { ENGINES } from "@/lib/types";

export const maxDuration = 300;

interface RunRequestBody {
  prompts: PromptRow[];
  config: RunConfig;
}

const VALID_ENGINES = new Set(ENGINES.map((e) => e.id));

export async function POST(req: NextRequest) {
  let body: RunRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { prompts, config } = body;
  if (!Array.isArray(prompts) || prompts.length === 0) {
    return NextResponse.json({ error: "No prompts provided" }, { status: 400 });
  }
  if (!config?.brand?.trim()) {
    return NextResponse.json({ error: "Brand name is required" }, { status: 400 });
  }
  const engines = (config.engines || []).filter((e): e is EngineId =>
    VALID_ENGINES.has(e),
  );
  if (engines.length === 0) {
    return NextResponse.json({ error: "Select at least one engine" }, { status: 400 });
  }

  // Cap workload to keep within serverless time limits.
  const cappedPrompts = prompts.slice(0, 50);

  // Build the full matrix of (prompt x engine) jobs and run them concurrently.
  const jobs: { prompt: PromptRow; engine: EngineId }[] = [];
  for (const prompt of cappedPrompts) {
    for (const engine of engines) jobs.push({ prompt, engine });
  }

  const results: AnalyzedResult[] = await Promise.all(
    jobs.map(async ({ prompt, engine }) => {
      const start = Date.now();
      try {
        const out = await runEngine(engine, prompt.prompt);
        const base = {
          engine,
          promptId: prompt.id,
          prompt: prompt.prompt,
          category: prompt.category,
          answer: out.answer,
          citations: out.citations,
          latencyMs: Date.now() - start,
          mock: out.mock,
        };
        return { ...base, analysis: analyzeResult(base, config) };
      } catch (err) {
        const base = {
          engine,
          promptId: prompt.id,
          prompt: prompt.prompt,
          category: prompt.category,
          answer: "",
          citations: [],
          latencyMs: Date.now() - start,
          mock: false,
          error: err instanceof Error ? err.message : String(err),
        };
        return { ...base, analysis: analyzeResult(base, config) };
      }
    }),
  );

  const summary = summarize(results, config);
  const response: RunResponse = {
    results,
    summary,
    config,
    runAt: new Date().toISOString(),
    anyMock: results.some((r) => r.mock),
  };
  return NextResponse.json(response);
}
