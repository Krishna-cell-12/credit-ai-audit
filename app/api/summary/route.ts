import Anthropic, { APIError } from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

// ─── Request payload ──────────────────────────────────────────────────────────

interface SummaryRequestPayload {
  totalCurrentSpend: number;
  totalMonthlySavings: number;
  totalAnnualSavings: number;
  primaryUseCase: string;
  toolsSummary: string;
}

// ─── Response shape ───────────────────────────────────────────────────────────

interface SummaryResponse {
  summary: string;
  source: "ai" | "fallback";
}

// ─── Anthropic client (singleton, module-scoped) ──────────────────────────────

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Returns a polished, data-rich fallback paragraph so the frontend never
 * surfaces a broken state — even when the Anthropic API is unavailable.
 */
function buildFallbackSummary(payload: SummaryRequestPayload): string {
  const monthly = formatCurrency(payload.totalMonthlySavings);
  const annual = formatCurrency(payload.totalAnnualSavings);
  const current = formatCurrency(payload.totalCurrentSpend);

  return (
    `Our audit engine has highlighted immediate cost-optimization opportunities totaling ${monthly}/mo ` +
    `(${annual}/yr) across your ${payload.primaryUseCase} development stack. ` +
    `Your current tooling expenditure of ${current}/mo contains identifiable redundancies within ` +
    `${payload.toolsSummary}. ` +
    `By consolidating overlapping capabilities and right-sizing licence tiers to actual consumption, ` +
    `your organization can redirect freed capital toward higher-leverage engineering priorities — ` +
    `without disrupting existing workflows. We recommend scheduling a 30-minute optimization review ` +
    `to action these findings within the current quarter.`
  );
}

// ─── System prompt factory ────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return [
    "You are a senior technology spend consultant producing executive-ready audit summaries.",
    "Your output is a single paragraph of approximately 100 words — no lists, no headers, no markdown.",
    "Tone: highly consultative, authoritative, and action-oriented.",
    "Write as though addressing a CTO or VP of Engineering who values precision over enthusiasm.",
    "Quantify the savings opportunity prominently in the opening sentence.",
    "Identify the specific tool categories creating waste, then close with a clear recommended next step.",
    "Never use filler phrases such as 'In conclusion' or 'It is important to note'.",
    "Output only the paragraph — nothing else.",
  ].join(" ");
}

function buildUserPrompt(payload: SummaryRequestPayload): string {
  const monthly = formatCurrency(payload.totalMonthlySavings);
  const annual = formatCurrency(payload.totalAnnualSavings);
  const current = formatCurrency(payload.totalCurrentSpend);

  return (
    `Generate a ~100-word professional AI spend audit summary using the following workspace data:\n\n` +
    `- Current monthly tool spend: ${current}\n` +
    `- Identified monthly savings: ${monthly}\n` +
    `- Identified annual savings: ${annual}\n` +
    `- Primary use case: ${payload.primaryUseCase}\n` +
    `- Tools under review: ${payload.toolsSummary}\n\n` +
    `The summary must quantify the opportunity, name the problem tool categories, and prescribe a concrete next step.`
  );
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse<SummaryResponse>> {
  // 1. Parse and validate the request body
  let payload: SummaryRequestPayload;

  try {
    const body = await request.json();

    const {
      totalCurrentSpend,
      totalMonthlySavings,
      totalAnnualSavings,
      primaryUseCase,
      toolsSummary,
    } = body as Partial<SummaryRequestPayload>;

    if (
      typeof totalCurrentSpend !== "number" ||
      typeof totalMonthlySavings !== "number" ||
      typeof totalAnnualSavings !== "number" ||
      typeof primaryUseCase !== "string" ||
      typeof toolsSummary !== "string"
    ) {
      return NextResponse.json(
        { summary: "Invalid request payload.", source: "fallback" } as SummaryResponse,
        { status: 400 },
      );
    }

    payload = {
      totalCurrentSpend,
      totalMonthlySavings,
      totalAnnualSavings,
      primaryUseCase: primaryUseCase.trim(),
      toolsSummary: toolsSummary.trim(),
    };
  } catch {
    return NextResponse.json(
      { summary: "Malformed JSON body.", source: "fallback" } as SummaryResponse,
      { status: 400 },
    );
  }

  // 2. Attempt Anthropic API call with graceful degradation
  try {
    const message = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 256,
      system: buildSystemPrompt(),
      messages: [
        {
          role: "user",
          content: buildUserPrompt(payload),
        },
      ],
    });

    // Extract text from the first content block
    const contentBlock = message.content[0];
    const aiSummary =
      contentBlock.type === "text" ? contentBlock.text.trim() : buildFallbackSummary(payload);

    return NextResponse.json(
      { summary: aiSummary, source: "ai" } as SummaryResponse,
      { status: 200 },
    );
  } catch (error: unknown) {
    // ── Categorised error handling ────────────────────────────────────────────

    if (error instanceof APIError) {
      const status = error.status;

      // Rate-limited (429) — degrade gracefully, never surface to frontend
      if (status === 429) {
        console.warn("[summary/route] Anthropic rate limit hit (429). Serving fallback summary.");
      }
      // Authentication failure (401) — mis-configured key; log for ops, fallback for user
      else if (status === 401) {
        console.error("[summary/route] Anthropic authentication failed (401). Check ANTHROPIC_API_KEY.");
      }
      // Upstream timeout or server error (5xx) — transient; fallback is safe
      else if (status !== undefined && status >= 500) {
        console.error(`[summary/route] Anthropic upstream error (${status}). Serving fallback.`);
      }
      // Any other Anthropic API error
      else {
        console.error(`[summary/route] Anthropic API error ${status ?? "unknown"}:`, error.message);
      }
    } else if (error instanceof Error) {
      // Network timeout, DNS failure, etc.
      const isTimeout =
        error.name === "AbortError" ||
        error.message.toLowerCase().includes("timeout") ||
        error.message.toLowerCase().includes("timed out");

      if (isTimeout) {
        console.warn("[summary/route] Anthropic request timed out. Serving fallback summary.");
      } else {
        console.error("[summary/route] Unexpected error calling Anthropic:", error.message);
      }
    } else {
      console.error("[summary/route] Unknown error type:", error);
    }

    // ── Always return 200 with fallback — frontend must never crash ───────────
    return NextResponse.json(
      { summary: buildFallbackSummary(payload), source: "fallback" } as SummaryResponse,
      { status: 200 },
    );
  }
}
