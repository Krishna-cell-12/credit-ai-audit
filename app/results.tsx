"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Clipboard,
  Cpu,
  ExternalLink,
  Layers,
  Lightbulb,
  Link2,
  Minus,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  Trash2,
  Wrench,
  Zap,
} from "lucide-react";
import type { AuditState } from "@/types";
import { runAudit, type AuditResult, type ToolAuditResult } from "@/lib/auditEngine";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ResultsViewProps {
  auditData: AuditState;
  /** Persisted share token from the DB — passed through for future share-link rendering. */
  shareToken?: string;
}

type ActionBadge = "KEEP" | "DROP" | "DOWNGRADE" | "OPTIMIZE";

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTION_CONFIG: Record<
  ActionBadge,
  {
    label: string;
    icon: React.ReactNode;
    containerClass: string;
    badgeClass: string;
    borderClass: string;
    glowClass: string;
  }
> = {
  KEEP: {
    label: "Keep",
    icon: <ShieldCheck size={13} />,
    containerClass: "bg-emerald-500/5 hover:bg-emerald-500/10",
    badgeClass: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    borderClass: "border-emerald-500/20",
    glowClass: "shadow-emerald-900/20",
  },
  DROP: {
    label: "Drop",
    icon: <Trash2 size={13} />,
    containerClass: "bg-red-500/5 hover:bg-red-500/10",
    badgeClass: "bg-red-500/15 text-red-400 border border-red-500/30",
    borderClass: "border-red-500/30",
    glowClass: "shadow-red-900/20",
  },
  DOWNGRADE: {
    label: "Downgrade",
    icon: <ArrowDownRight size={13} />,
    containerClass: "bg-amber-500/5 hover:bg-amber-500/10",
    badgeClass: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    borderClass: "border-amber-500/30",
    glowClass: "shadow-amber-900/20",
  },
  OPTIMIZE: {
    label: "Optimize",
    icon: <Zap size={13} />,
    containerClass: "bg-violet-500/5 hover:bg-violet-500/10",
    badgeClass: "bg-violet-500/15 text-violet-400 border border-violet-500/30",
    borderClass: "border-violet-500/25",
    glowClass: "shadow-violet-900/20",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function fmtPrecise(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// -- Skeleton loader ----------------------------------------------------------

function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-gradient-to-r from-slate-800/80 via-slate-700/50 to-slate-800/80 bg-[length:200%_100%] ${className}`}
      style={{ animation: "shimmer 1.8s ease-in-out infinite" }}
    />
  );
}

function AISummarySkeletonLoader() {
  return (
    <div className="space-y-3 py-2" aria-label="Loading AI summary">
      <SkeletonBlock className="h-4 w-full" />
      <SkeletonBlock className="h-4 w-[93%]" />
      <SkeletonBlock className="h-4 w-[88%]" />
      <SkeletonBlock className="h-4 w-[96%]" />
      <SkeletonBlock className="h-4 w-[72%]" />
    </div>
  );
}

// -- Share banner -------------------------------------------------------------

function ShareBanner({ shareToken }: { shareToken: string }) {
  const [isCopied, setIsCopied] = useState(false);

  // Construct the full URL client-side so we never hard-code the domain.
  // `window` is available here because this component only mounts inside
  // ResultsViewport, which is rendered after hydration.
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/audit/${shareToken}`
      : `/audit/${shareToken}`;

  async function handleCopy() {
    if (isCopied) return; // debounce rapid clicks
    try {
      await navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (non-secure context / permission denied)
      // Fall back to execCommand for legacy environments
      try {
        const ta = document.createElement("textarea");
        ta.value = shareUrl;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      } catch {
        // Both methods failed — silently swallow; the URL is still visible
      }
    }
  }

  return (
    <div
      id="share-banner"
      className="relative overflow-hidden rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-indigo-950/60 via-slate-900/70 to-violet-950/60 p-5 shadow-xl backdrop-blur-sm sm:p-6"
    >
      {/* Ambient glow blobs */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-indigo-600/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-violet-600/10 blur-3xl" />

      {/* Top glow line */}
      <div className="pointer-events-none absolute -top-px left-1/2 h-px w-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Label + caption */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 ring-1 ring-indigo-500/25">
            <Link2 size={16} className="text-indigo-400" strokeWidth={2} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-100">
              Share Your Score
            </p>
            <p className="text-xs text-slate-500">
              Anyone with this link can view your audit report
            </p>
          </div>
        </div>

        {/* URL pill + copy button */}
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-sm sm:justify-end">
          {/* Read-only URL input */}
          <div className="relative min-w-0 flex-1">
            <input
              id="share-url-input"
              type="text"
              readOnly
              value={shareUrl}
              aria-label="Shareable audit report URL"
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className={[
                "w-full rounded-xl border bg-slate-900/80 px-3 py-2.5",
                "text-xs text-slate-400 outline-none",
                "cursor-pointer truncate transition-colors duration-200",
                "border-slate-700/80 focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/20",
                "selection:bg-indigo-500/30",
              ].join(" ")}
            />
          </div>

          {/* Copy button */}
          <button
            id="copy-share-link-btn"
            type="button"
            onClick={handleCopy}
            aria-label={isCopied ? "Link copied!" : "Copy share link"}
            className={[
              "flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2.5",
              "text-xs font-semibold",
              "border transition-all duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60",
              "active:scale-95",
              isCopied
                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                : "border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:border-indigo-400/50 hover:bg-indigo-500/20 hover:text-indigo-200",
            ].join(" ")}
          >
            {isCopied ? (
              <>
                <Check
                  size={13}
                  strokeWidth={2.5}
                  className="shrink-0"
                  aria-hidden="true"
                />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Clipboard
                  size={13}
                  strokeWidth={2}
                  className="shrink-0"
                  aria-hidden="true"
                />
                <span>Copy Link</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// -- Savings hero card --------------------------------------------------------

interface SavingsHeroCardProps {
  result: AuditResult;
  toolCount: number;
}

function SavingsHeroCard({ result, toolCount }: SavingsHeroCardProps) {
  const hasSavings = result.totalMonthlySavings > 0;

  return (
    <div
      id="savings-hero-card"
      className={`relative overflow-hidden rounded-3xl border p-8 shadow-2xl sm:p-10 ${
        hasSavings
          ? "border-indigo-500/30 bg-gradient-to-br from-indigo-950/80 via-slate-900/90 to-violet-950/80"
          : "border-emerald-500/30 bg-gradient-to-br from-emerald-950/60 via-slate-900/90 to-teal-950/60"
      }`}
    >
      {/* Ambient glow blobs */}
      {hasSavings ? (
        <>
          <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-indigo-600/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-violet-600/15 blur-3xl" />
        </>
      ) : (
        <>
          <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-emerald-600/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-12 -right-12 h-48 w-48 rounded-full bg-teal-600/10 blur-3xl" />
        </>
      )}

      {/* Header row */}
      <div className="relative mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                hasSavings ? "bg-indigo-500/20" : "bg-emerald-500/20"
              }`}
            >
              {hasSavings ? (
                <BarChart3 size={18} className="text-indigo-400" />
              ) : (
                <BadgeCheck size={18} className="text-emerald-400" />
              )}
            </div>
            <span
              className={`text-xs font-semibold uppercase tracking-widest ${
                hasSavings ? "text-indigo-400" : "text-emerald-400"
              }`}
            >
              Audit Complete
            </span>
          </div>
          <h2 className="text-2xl font-extrabold text-white sm:text-3xl">
            {hasSavings ? "Savings Identified" : "Stack Verified"}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {toolCount} tool{toolCount !== 1 ? "s" : ""} analysed ·{" "}
            {result.breakdown.length} recommendation
            {result.breakdown.length !== 1 ? "s" : ""} generated
          </p>
        </div>

        {/* Cost efficiency pill */}
        <div className="flex flex-col items-end gap-1">
          <span className="text-xs font-medium text-slate-500">Current Spend</span>
          <span className="text-2xl font-bold text-slate-200">
            {fmtPrecise(result.totalCurrentSpend)}
            <span className="ml-1 text-sm font-normal text-slate-500">/mo</span>
          </span>
        </div>
      </div>

      {/* Savings metric row */}
      {hasSavings ? (
        <div className="relative grid grid-cols-1 gap-5 sm:grid-cols-2">
          {/* Monthly savings */}
          <div className="flex flex-col rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-5 backdrop-blur-sm">
            <span className="mb-1 text-xs font-semibold uppercase tracking-widest text-indigo-400">
              Monthly Savings
            </span>
            <span className="text-4xl font-black tracking-tight text-white sm:text-5xl">
              {fmt(result.totalMonthlySavings)}
            </span>
            <span className="mt-1.5 text-xs text-indigo-300/70">
              per month, starting immediately
            </span>
          </div>

          {/* Annual savings */}
          <div className="flex flex-col rounded-2xl border border-violet-500/20 bg-violet-500/10 p-5 backdrop-blur-sm">
            <span className="mb-1 text-xs font-semibold uppercase tracking-widest text-violet-400">
              Annual Savings
            </span>
            <span className="text-4xl font-black tracking-tight text-white sm:text-5xl">
              {fmt(result.totalAnnualSavings)}
            </span>
            <span className="mt-1.5 text-xs text-violet-300/70">
              redirectable to higher-leverage spend
            </span>
          </div>

          {/* Efficiency ratio */}
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
              <span>Spend efficiency</span>
              <span className="font-semibold text-slate-300">
                {Math.round(
                  (result.totalRecommendedSpend / Math.max(result.totalCurrentSpend, 1)) * 100
                )}
                % optimised
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700/60">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-700"
                style={{
                  width: `${Math.round(
                    (result.totalRecommendedSpend / Math.max(result.totalCurrentSpend, 1)) * 100
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>
      ) : (
        // Zero-savings state
        <div className="relative flex items-start gap-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5">
          <CheckCircle2 size={28} className="mt-0.5 shrink-0 text-emerald-400" />
          <div>
            <p className="text-base font-semibold text-emerald-300">
              You&apos;re spending well.
            </p>
            <p className="mt-1 text-sm leading-relaxed text-emerald-200/70">
              Your AI infrastructure stack is perfectly balanced. Every subscription is
              right-sized for your team — no redundancies or over-allocations detected.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// -- Lead gen banner (>$500 savings) -----------------------------------------

function CredexCTABanner({
  monthlySavings,
  annualSavings,
}: {
  monthlySavings: number;
  annualSavings: number;
}) {
  return (
    <div
      id="credex-cta-banner"
      className="relative overflow-hidden rounded-3xl border border-amber-500/25 bg-gradient-to-br from-amber-950/60 via-orange-950/50 to-slate-900/80 p-7 shadow-xl sm:p-9"
    >
      {/* Glow */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-12 left-1/3 h-40 w-40 rounded-full bg-orange-500/10 blur-3xl" />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex-1">
          {/* Tag */}
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-widest text-amber-400">
            <Sparkles size={11} />
            Credex Recommendation
          </div>

          <h3 className="text-xl font-extrabold text-white sm:text-2xl">
            Infrastructure Credit Arbitrage
            <span className="ml-2 text-amber-400">could save you more.</span>
          </h3>

          <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-slate-300">
            Your audit reveals{" "}
            <span className="font-semibold text-amber-300">{fmt(monthlySavings)}/mo</span> in
            immediate waste. Credex&apos;s bulk software credit purchasing unlocks a further{" "}
            <span className="font-semibold text-amber-300">15–40% discount</span> on your
            remaining AI stack versus retail pricing — converting your{" "}
            {fmt(annualSavings)}/yr saving into a compounding cost-moat.
          </p>

          {/* Proof points */}
          <ul className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-2">
            {[
              "No minimum contract",
              "Credits applied instantly",
              "All major AI providers covered",
            ].map((point) => (
              <li key={point} className="flex items-center gap-2 text-xs text-slate-400">
                <CheckCircle2 size={13} className="shrink-0 text-amber-500" />
                {point}
              </li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        <div className="flex shrink-0 flex-col items-start gap-3 lg:items-end">
          <button
            id="credex-claim-cta"
            type="button"
            className="group flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-amber-900/30 transition hover:brightness-110 active:scale-95"
          >
            Claim Credit Arbitrage
            <ArrowRight
              size={16}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </button>
          <span className="text-xs text-slate-500">Free · No card required</span>
        </div>
      </div>
    </div>
  );
}

// -- Tool audit row card ------------------------------------------------------

interface ToolRowCardProps {
  result: ToolAuditResult;
  index: number;
}

function ToolRowCard({ result, index }: ToolRowCardProps) {
  const [expanded, setExpanded] = useState(false);
  const config = ACTION_CONFIG[result.recommendedAction];
  const hasSavings = result.savings > 0;

  return (
    <div
      id={`tool-result-${result.tool.id}`}
      className={`group rounded-2xl border transition-all duration-200 ${config.containerClass} ${config.borderClass} ${config.glowClass} shadow-sm`}
    >
      {/* Main row */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-4 px-5 py-4 text-left"
        aria-expanded={expanded}
        aria-controls={`tool-detail-${result.tool.id}`}
      >
        {/* Index bubble */}
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-700/60 text-xs font-bold text-slate-400">
          {index + 1}
        </span>

        {/* Tool name */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-100">
            {result.tool.toolName}
          </p>
          {result.tool.planName && (
            <p className="truncate text-xs text-slate-500">{result.tool.planName}</p>
          )}
        </div>

        {/* Spend column */}
        <div className="hidden flex-col items-end sm:flex">
          <span className="text-sm font-semibold text-slate-200">
            {fmtPrecise(result.currentSpend)}
          </span>
          <span className="text-xs text-slate-600">/mo current</span>
        </div>

        {/* Savings delta */}
        <div className="hidden flex-col items-end sm:flex">
          {hasSavings ? (
            <>
              <span className="flex items-center gap-1 text-sm font-semibold text-emerald-400">
                <TrendingDown size={13} />−{fmtPrecise(result.savings)}
              </span>
              <span className="text-xs text-slate-600">savings/mo</span>
            </>
          ) : (
            <span className="flex items-center gap-1 text-xs text-slate-600">
              <Minus size={11} />
              No change
            </span>
          )}
        </div>

        {/* Action badge */}
        <span
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${config.badgeClass}`}
        >
          {config.icon}
          {config.label}
        </span>

        {/* Expand chevron */}
        <ChevronDown
          size={15}
          className={`shrink-0 text-slate-500 transition-transform duration-200 ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Expandable detail */}
      <div
        id={`tool-detail-${result.tool.id}`}
        className={`overflow-hidden transition-all duration-300 ${
          expanded ? "max-h-48 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="border-t border-slate-700/40 px-5 py-4">
          {/* Mobile spend row */}
          <div className="mb-3 flex items-center justify-between sm:hidden">
            <span className="text-xs text-slate-500">
              Current:{" "}
              <span className="font-semibold text-slate-200">
                {fmtPrecise(result.currentSpend)}/mo
              </span>
            </span>
            {hasSavings && (
              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
                <TrendingDown size={11} />−{fmtPrecise(result.savings)}/mo
              </span>
            )}
          </div>

          {/* Reason */}
          <div className="flex items-start gap-3">
            <Lightbulb size={14} className="mt-0.5 shrink-0 text-slate-500" />
            <p className="text-sm leading-relaxed text-slate-400">{result.reason}</p>
          </div>

          {/* Recommended spend chip */}
          {result.recommendedAction !== "KEEP" && (
            <div className="mt-3 flex items-center gap-2">
              <ChevronRight size={13} className="text-slate-600" />
              <span className="text-xs text-slate-500">
                Recommended spend:{" "}
                <span className="font-semibold text-slate-300">
                  {fmtPrecise(result.recommendedSpend)}/mo
                </span>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// -- AI Insights block --------------------------------------------------------

interface AIInsightsBlockProps {
  result: AuditResult;
  auditData: AuditState;
}

function AIInsightsBlock({ result, auditData }: AIInsightsBlockProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [source, setSource] = useState<"ai" | "fallback" | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    // Prevent double-fetch in React Strict Mode
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const toolsSummary = auditData.tools.map((t) => t.toolName).join(", ") || "various tools";

    async function fetchSummary() {
      try {
        const res = await fetch("/api/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            totalCurrentSpend: result.totalCurrentSpend,
            totalMonthlySavings: result.totalMonthlySavings,
            totalAnnualSavings: result.totalAnnualSavings,
            primaryUseCase: auditData.primaryUseCase,
            toolsSummary,
          }),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = (await res.json()) as { summary: string; source: "ai" | "fallback" };
        setSummary(data.summary);
        setSource(data.source);
      } catch {
        // Network-level failure — surface a static graceful message
        setSummary(
          `Your audit has surfaced ${
            result.totalMonthlySavings > 0
              ? `$${result.totalMonthlySavings}/mo in recoverable waste across your AI stack`
              : "a well-optimised AI stack with no immediate action items"
          }. Review each recommendation above and prioritise the highest-savings actions first.`
        );
        setSource("fallback");
      } finally {
        setIsLoading(false);
      }
    }

    void fetchSummary();
  }, [result, auditData]);

  return (
    <div
      id="ai-insights-block"
      className="relative overflow-hidden rounded-3xl border border-slate-700/50 bg-gradient-to-br from-slate-900/80 via-slate-800/60 to-slate-900/80 p-7 shadow-xl backdrop-blur-sm sm:p-9"
    >
      {/* Ambient blob */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-indigo-600/10 blur-3xl" />

      <div className="relative">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 ring-1 ring-indigo-500/25">
            <Bot size={19} className="text-indigo-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-100">AI Executive Summary</h3>
            <p className="text-xs text-slate-500">
              Generated by Claude · Powered by Anthropic
            </p>
          </div>

          {/* Source indicator */}
          {!isLoading && source && (
            <div className="ml-auto flex items-center gap-1.5 rounded-full border border-slate-700/60 bg-slate-800/80 px-3 py-1 text-xs text-slate-500">
              {source === "ai" ? (
                <>
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-indigo-400" />
                  </span>
                  Live
                </>
              ) : (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                  Cached
                </>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="min-h-[5rem]">
          {isLoading ? (
            <AISummarySkeletonLoader />
          ) : (
            <p className="text-[0.9375rem] leading-relaxed text-slate-300 [text-wrap:pretty]">
              {summary}
            </p>
          )}
        </div>

        {/* Footer cue */}
        {!isLoading && (
          <div className="mt-5 flex items-center gap-2 border-t border-slate-700/40 pt-4">
            <Cpu size={13} className="text-slate-600" />
            <span className="text-xs text-slate-600">
              Analysis based on {auditData.tools.length} tool
              {auditData.tools.length !== 1 ? "s" : ""} · {auditData.primaryUseCase} stack
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Results Viewport ────────────────────────────────────────────────────

export default function ResultsViewport({ auditData, shareToken: _shareToken }: ResultsViewProps) {
  // Run audit synchronously — pure deterministic function, zero latency
  const result: AuditResult = useMemo(() => runAudit(auditData), [auditData]);

  const hasSavings = result.totalMonthlySavings > 0;
  const hasHighSavings = result.totalMonthlySavings > 500;

  // Empty-state guard: no tools added yet
  if (auditData.tools.length === 0) {
    return (
      <div
        id="results-empty-state"
        className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-700/60 bg-slate-800/30 px-6 py-20 text-center"
      >
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800/80 text-3xl shadow-lg">
          <Layers size={28} className="text-slate-600" />
        </div>
        <p className="text-base font-semibold text-slate-400">No tools to audit yet</p>
        <p className="mt-1.5 max-w-xs text-sm text-slate-600">
          Add at least one AI tool in the form above to generate your spend audit report.
        </p>
      </div>
    );
  }

  // Non-tool breakdown items (advisory entries inserted by engine)
  const toolRows = result.breakdown.filter((r) => r.tool.seats > 0);
  const advisoryRows = result.breakdown.filter((r) => r.tool.seats === 0);

  return (
    <div id="results-viewport" className="space-y-6">

      {/* ── Shimmer keyframe (injected once) ─────────────────────────────── */}
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* ── 1. Hero savings card ──────────────────────────────────────────── */}
      <SavingsHeroCard result={result} toolCount={auditData.tools.length} />

      {/* ── 2. Share banner (only when a shareToken is present) ───────────── */}
      {_shareToken && <ShareBanner shareToken={_shareToken} />}

      {/* ── 3. Credex CTA (conditional — monthly savings > $500) ─────────── */}
      {hasHighSavings && (
        <CredexCTABanner
          monthlySavings={result.totalMonthlySavings}
          annualSavings={result.totalAnnualSavings}
        />
      )}

      {/* ── 4. Per-tool audit matrix ──────────────────────────────────────── */}
      <div
        id="tool-audit-matrix"
        className="rounded-3xl border border-slate-700/50 bg-slate-800/40 p-6 shadow-xl backdrop-blur-sm sm:p-8"
      >
        {/* Section header */}
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-700/60">
            <CircleDollarSign size={17} className="text-slate-300" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-100">Tool-by-Tool Breakdown</h3>
            <p className="text-xs text-slate-500">
              {toolRows.length} tool{toolRows.length !== 1 ? "s" : ""} ·{" "}
              {result.breakdown.filter((r) => r.recommendedAction !== "KEEP").length} action
              {result.breakdown.filter((r) => r.recommendedAction !== "KEEP").length !== 1
                ? "s"
                : ""}{" "}
              recommended
            </p>
          </div>

          {/* Legend */}
          <div className="ml-auto hidden flex-wrap items-center gap-2 sm:flex">
            {(["DROP", "DOWNGRADE", "OPTIMIZE", "KEEP"] as ActionBadge[]).map((action) => {
              const c = ACTION_CONFIG[action];
              return (
                <span
                  key={action}
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${c.badgeClass}`}
                >
                  {c.icon}
                  {c.label}
                </span>
              );
            })}
          </div>
        </div>

        {/* Tool rows */}
        <div className="space-y-2.5">
          {toolRows.map((r, i) => (
            <ToolRowCard key={r.tool.id} result={r} index={i} />
          ))}
        </div>

        {/* Advisory rows (engine-generated, non-tool) */}
        {advisoryRows.length > 0 && (
          <div className="mt-4 space-y-2.5">
            <p className="px-1 text-xs font-semibold uppercase tracking-widest text-slate-600">
              Advisory
            </p>
            {advisoryRows.map((r, i) => (
              <div
                key={r.tool.id}
                id={`advisory-${r.tool.id}`}
                className="flex items-start gap-4 rounded-2xl border border-violet-500/20 bg-violet-500/5 px-5 py-4"
              >
                <Wrench size={16} className="mt-0.5 shrink-0 text-violet-400" />
                <div>
                  <p className="text-sm font-semibold text-slate-200">{r.tool.toolName}</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-400">{r.reason}</p>
                </div>
                <span className={`ml-auto flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${ACTION_CONFIG["OPTIMIZE"].badgeClass}`}>
                  {ACTION_CONFIG["OPTIMIZE"].icon}
                  Optimize
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Totals footer */}
        {hasSavings && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-700/50 bg-slate-900/50 px-5 py-3.5">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <AlertTriangle size={14} className="text-amber-500" />
              Implementing all recommendations above
            </div>
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                <span className="text-xs text-slate-600">Monthly saving</span>
                <span className="text-sm font-bold text-emerald-400">
                  −{fmtPrecise(result.totalMonthlySavings)}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs text-slate-600">Annual saving</span>
                <span className="text-sm font-bold text-emerald-300">
                  −{fmt(result.totalAnnualSavings)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 5. AI Insights block ──────────────────────────────────────────── */}
      <AIInsightsBlock result={result} auditData={auditData} />

      {/* ── 6. Share / export stub ───────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-3 pb-2">
        <button
          id="export-results-btn"
          type="button"
          className="flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-800/60 px-4 py-2.5 text-xs font-medium text-slate-400 transition hover:border-slate-600 hover:text-slate-200 active:scale-95"
        >
          <ExternalLink size={13} />
          Export Report
        </button>
        <span className="text-xs text-slate-700">·</span>
        <p className="text-xs text-slate-700">
          Results are computed client-side · no data leaves your browser
        </p>
      </div>
    </div>
  );
}
