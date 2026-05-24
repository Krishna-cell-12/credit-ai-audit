import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { audits } from "@/db/schema";
import ResultsViewport from "@/app/results";
import type { AuditState, PrimaryUseCase, ToolSpend } from "@/types";

// ---------------------------------------------------------------------------
// Route params
// ---------------------------------------------------------------------------

interface PageParams {
  token: string;
}

// ---------------------------------------------------------------------------
// Type guards
// Drizzle returns `jsonb` columns typed as `unknown`. We narrow them here
// rather than casting blindly — a malformed DB row produces an empty tools
// array rather than a runtime crash.
// ---------------------------------------------------------------------------

function isToolSpendArray(value: unknown): value is ToolSpend[] {
  if (!Array.isArray(value)) return false;
  return value.every((item) => {
    if (item === null || typeof item !== "object") return false;
    const t = item as Record<string, unknown>;
    return (
      typeof t.id === "string" &&
      typeof t.toolName === "string" &&
      typeof t.planName === "string" &&
      typeof t.monthlySpend === "number" &&
      typeof t.seats === "number"
    );
  });
}

function isValidUseCase(value: unknown): value is PrimaryUseCase {
  return (
    typeof value === "string" &&
    (["coding", "writing", "data", "research", "mixed"] as string[]).includes(
      value
    )
  );
}

// ---------------------------------------------------------------------------
// Data fetching helper
// Shared by generateMetadata() and the page component so the DB is only
// queried once per render (Next.js deduplicates fetch() calls, but this
// pattern works for any async data source including Drizzle).
// ---------------------------------------------------------------------------

async function fetchAuditByToken(token: string) {
  // Reject tokens that cannot possibly be valid before hitting the DB.
  // Our tokens are base64url (18 raw bytes → 24 chars): [A-Za-z0-9_-]{24}
  if (!/^[A-Za-z0-9_-]{10,}$/.test(token)) {
    return null;
  }

  try {
    const audit = await db.query.audits.findFirst({
      where: eq(audits.shareToken, token),
    });
    return audit ?? null;
  } catch (err) {
    // Surface the error to server logs but never to the client response.
    console.error("[audit/token] DB query failed:", {
      token,
      error: err instanceof Error ? err.message : String(err),
      timestamp: new Date().toISOString(),
    });
    return null;
  }
}

/**
 * Reconstruct a valid AuditState from the raw DB row.
 *
 * `teamSize` is not persisted as a dedicated column, so we derive it as
 * max(seats) across all stored tools — the most accurate proxy available.
 * Falls back to 1 when the tools array is empty or corrupted.
 *
 * `primaryUseCase` is validated against the enum union; defaults to "mixed".
 */
function reconstructAuditState(row: {
  toolsData: unknown;
  primaryUseCase: string;
}): AuditState {
  const tools: ToolSpend[] = isToolSpendArray(row.toolsData)
    ? row.toolsData
    : [];

  const teamSize = tools.reduce((max, t) => Math.max(max, t.seats), 1);

  const primaryUseCase: PrimaryUseCase = isValidUseCase(row.primaryUseCase)
    ? row.primaryUseCase
    : "mixed";

  return { teamSize, primaryUseCase, tools };
}

// ---------------------------------------------------------------------------
// generateMetadata — runs on the server before the page renders.
// Dynamic OG + Twitter cards per shared token.
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { token } = await params;
  const audit = await fetchAuditByToken(token);

  if (!audit) {
    return {
      title: "Audit Not Found | AI Spend Auditor",
      description: "This audit report could not be found or has been removed.",
    };
  }

  // Postgres returns numeric columns as strings — parse before formatting.
  const monthlySavings = parseFloat(audit.totalMonthlySavings);
  const annualSavings = parseFloat(audit.totalAnnualSavings);

  const savingsLabel =
    monthlySavings > 0
      ? `$${Math.round(monthlySavings).toLocaleString("en-US")}/mo Saved`
      : "Stack Verified — Spend Optimised";

  const title = `AI Stack Audit | ${savingsLabel}`;

  const description =
    monthlySavings > 0
      ? `This AI spend audit identified $${Math.round(monthlySavings).toLocaleString("en-US")}/mo ($${Math.round(annualSavings).toLocaleString("en-US")}/yr) in recoverable waste. See the full tool-by-tool breakdown and recommendations.`
      : "This AI spend audit verified a well-optimised tool stack with no immediate redundancies or over-allocations detected.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      // metadataBase in layout.tsx (or next.config) populates the canonical URL.
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

// ---------------------------------------------------------------------------
// Page — React Server Component (no "use client" directive)
// ---------------------------------------------------------------------------

export default async function SharedAuditPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { token } = await params;
  const audit = await fetchAuditByToken(token);

  // Hand off to the nearest not-found boundary — renders Next.js 404 UI.
  if (!audit) {
    notFound();
  }

  const auditState = reconstructAuditState(audit);
  const monthlySavings = parseFloat(audit.totalMonthlySavings);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 font-sans">
      {/* Grain texture overlay — matches the main app aesthetic */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      <main className="relative mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {/* Shared report badge */}
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-widest text-indigo-300 backdrop-blur">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-400" />
              </span>
              Shared Audit Report
            </div>

            <h1 className="mt-2 bg-gradient-to-br from-white via-slate-200 to-indigo-300 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-4xl">
              AI Spend Auditor
            </h1>

            {monthlySavings > 0 ? (
              <p className="mt-1.5 text-sm text-slate-400">
                This audit identified{" "}
                <span className="font-semibold text-emerald-400">
                  ${Math.round(monthlySavings).toLocaleString("en-US")}/mo
                </span>{" "}
                in recoverable waste
              </p>
            ) : (
              <p className="mt-1.5 text-sm text-slate-400">
                Stack verified — spending optimised
              </p>
            )}
          </div>

          {/* Viral hook — drives new audit starts */}
          <a
            id="run-own-audit-cta"
            href="/"
            className="group flex shrink-0 items-center gap-2 self-start rounded-2xl border border-indigo-500/40 bg-indigo-500/10 px-5 py-2.5 text-sm font-semibold text-indigo-300 shadow-sm transition hover:border-indigo-400/60 hover:bg-indigo-500/20 hover:text-indigo-200 active:scale-95 sm:self-auto"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="transition-transform group-hover:rotate-12"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            Audit Your Own Stack
          </a>
        </header>

        {/* ── Read-only notice ──────────────────────────────────────────── */}
        <div
          role="note"
          aria-label="Read-only shared report notice"
          className="mb-6 flex items-center gap-2.5 rounded-2xl border border-slate-700/50 bg-slate-800/40 px-4 py-3 text-xs text-slate-500 backdrop-blur-sm"
        >
          {/* Inline lock SVG — avoids importing Lucide into a Server Component */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="shrink-0 text-slate-600"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          This is a read-only shared report. Run your own audit above to
          generate personalised recommendations for your team.
        </div>

        {/* ── Results viewport — identical component, read-only data ────── */}
        <div className="space-y-8">
          <ResultsViewport auditData={auditState} />
        </div>

      </main>
    </div>
  );
}
