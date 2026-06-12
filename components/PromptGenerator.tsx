"use client";

import { useState } from "react";
import { promptsToCSV } from "@/lib/csv";

/**
 * Generates unbranded discovery prompts with Claude so users don't have to
 * invent a test set by hand. Output is written straight into the CSV box.
 */
export function PromptGenerator({
  brand,
  domain,
  competitors,
  onGenerated,
}: {
  brand: string;
  domain: string;
  competitors: string[];
  onGenerated: (csv: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [count, setCount] = useState(15);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function generate() {
    if (!description.trim()) {
      setError("Describe your product/category first.");
      return;
    }
    setLoading(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/generate-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand, domain, competitors, description, count }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      onGenerated(promptsToCSV(data.prompts));
      setNote(
        data.mock
          ? `Generated ${data.prompts.length} template prompts (set ANTHROPIC_API_KEY for AI-written ones).`
          : `Generated ${data.prompts.length} prompts with Claude.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-left text-xs font-semibold text-accent-soft"
      >
        <span>✨ Don&apos;t have prompts? Generate them</span>
        <span className="text-gray-500">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          <textarea
            className="input h-20 resize-y text-xs"
            placeholder="Describe your product & audience, e.g. 'project management software for small remote teams'"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <select
              className="input w-auto text-xs"
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            >
              <option value={10}>10 prompts</option>
              <option value={15}>15 prompts</option>
              <option value={20}>20 prompts</option>
              <option value={30}>30 prompts</option>
            </select>
            <button onClick={generate} disabled={loading} className="btn-ghost flex-1 text-xs">
              {loading ? "Generating…" : "Generate with Claude"}
            </button>
          </div>
          {error && <p className="text-xs text-rose-400">{error}</p>}
          {note && <p className="text-xs text-emerald-400">{note}</p>}
        </div>
      )}
    </div>
  );
}
