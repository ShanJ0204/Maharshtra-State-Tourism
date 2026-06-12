import { NextResponse } from "next/server";
import { configuredEngines } from "@/lib/engines";

export const dynamic = "force-dynamic";

/** Which engines have real API keys (booleans only — never the keys). */
export async function GET() {
  return NextResponse.json({ engines: configuredEngines() });
}
