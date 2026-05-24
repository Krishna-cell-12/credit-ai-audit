"use client";

import { useEffect, useState } from "react";
import type { AuditState, PrimaryUseCase, ToolSpend } from "@/types";
import { runAudit } from "@/lib/auditEngine";
import ResultsViewport from "./results";
import LeadGateModal, { type LeadData } from "@/components/LeadGateModal";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = "ai-spend-auditor-v1";

const USE_CASE_OPTIONS: { value: PrimaryUseCase; label: string }[] = [
  { value: "coding", label: "💻 Coding & Development" },
  { value: "writing", label: "✍️ Writing & Content" },
  { value: "data", label: "📊 Data & Analytics" },
  { value: "research", label: "🔬 Research & Discovery" },
  { value: "mixed", label: "🔀 Mixed / General Purpose" },
];

const TOOL_NAME_OPTIONS = [
  "Cursor",
  "GitHub Copilot",
  "Claude",
  "ChatGPT",
  "Anthropic API",
  "OpenAI API",
  "Gemini",
  "Windsurf",
];

const DEFAULT_STATE: AuditState = {
  teamSize: 1,
  primaryUseCase: "coding",
  tools: [],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return `tool-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function loadFromStorage(): AuditState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    return JSON.parse(raw) as AuditState;
  } catch {
    return DEFAULT_STATE;
  }
}

function saveToStorage(state: AuditState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable — silently ignore
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Home() {
  const [auditData, setAuditData] = useState<AuditState>(DEFAULT_STATE);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showResults, setShowResults] = useState(false);
  // Lead gate — opens after the user clicks "Run Free Audit"
  const [isGateOpen, setIsGateOpen] = useState(false);
  // Persisted share token returned by /api/audit/save
  const [shareToken, setShareToken] = useState<string | null>(null);

  // Hydration-safe load from localStorage
  useEffect(() => {
    setAuditData(loadFromStorage());
    setIsLoaded(true);
  }, []);

  // Persist to localStorage whenever state changes (after initial load)
  useEffect(() => {
    if (isLoaded) saveToStorage(auditData);
  }, [auditData, isLoaded]);

  // ---------- State updaters ----------

  function updateField<K extends keyof AuditState>(
    key: K,
    value: AuditState[K]
  ) {
    setAuditData((prev: AuditState) => ({ ...prev, [key]: value }));
  }

  function addTool() {
    const newTool: ToolSpend = {
      id: generateId(),
      toolName: TOOL_NAME_OPTIONS[0],
      planName: "",
      monthlySpend: 0,
      seats: 1,
    };
    setAuditData((prev: AuditState) => ({ ...prev, tools: [...prev.tools, newTool] }));
  }

  function removeTool(id: string) {
    setAuditData((prev: AuditState) => ({
      ...prev,
      tools: prev.tools.filter((t: ToolSpend) => t.id !== id),
    }));
  }

  function updateTool(id: string, patch: Partial<Omit<ToolSpend, "id">>) {
    setAuditData((prev: AuditState) => ({
      ...prev,
      tools: prev.tools.map((t: ToolSpend) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (auditData.tools.length === 0) return;
    // Open the lead-gate modal instead of jumping straight to results.
    // The modal's onSuccess callback will call the API and then reveal results.
    setIsGateOpen(true);
  }

  /**
   * Called by <LeadGateModal> after the user fills in their details.
   * POSTs to /api/audit/save, stores the shareToken, then reveals results.
   * Throwing here lets the modal's internal catch block surface the error.
   */
  async function handleLeadSuccess(leadData: LeadData): Promise<void> {
    // Derive the same metrics the results view will display so the API
    // receives a consistent, pre-computed snapshot.
    const auditResult = runAudit(auditData);

    const res = await fetch("/api/audit/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...leadData,
        auditState: auditData,
        metrics: {
          totalCurrentSpend: auditResult.totalCurrentSpend,
          totalMonthlySavings: auditResult.totalMonthlySavings,
          totalAnnualSavings: auditResult.totalAnnualSavings,
        },
      }),
    });

    if (!res.ok) {
      // Parse the error body if available, otherwise use the HTTP status text
      let message = `Save failed (${res.status})`;
      try {
        const errBody = (await res.json()) as { error?: string };
        if (errBody.error) message = errBody.error;
      } catch {
        // body was not JSON — keep the default message
      }
      throw new Error(message);
    }

    const { shareToken: token } = (await res.json()) as { shareToken: string };

    // Persist token, close gate, reveal results
    setShareToken(token);
    setIsGateOpen(false);
    setShowResults(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleStartOver() {
    setShowResults(false);
    setShareToken(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Compute totals for the summary strip
  const totalMonthly = auditData.tools.reduce(
    (sum: number, t: ToolSpend) => sum + t.monthlySpend * t.seats,
    0
  );
  const totalAnnual = totalMonthly * 12;
  const costPerSeat =
    auditData.teamSize > 0 ? totalMonthly / auditData.teamSize : 0;

  // ---------- Render ----------

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 font-sans">
      {/* ── Noise / grain texture overlay ── */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      <main className="relative mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">

        {/* ══════════════════════════════════════════════════════════════
            RESULTS VIEW
        ══════════════════════════════════════════════════════════════ */}
        {isLoaded && showResults ? (
          <div className="space-y-8">
            {/* Results header strip */}
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-400" />
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
                    Audit Report
                  </span>
                </div>
                <h1 className="bg-gradient-to-br from-white via-slate-200 to-indigo-300 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-4xl">
                  AI Spend Auditor
                </h1>
              </div>

              <button
                id="start-over-btn"
                type="button"
                onClick={handleStartOver}
                className="group flex shrink-0 items-center gap-2 self-start rounded-2xl border border-slate-600/60 bg-slate-800/60 px-5 py-2.5 text-sm font-medium text-slate-300 shadow-sm transition hover:border-slate-500 hover:bg-slate-700/60 hover:text-white active:scale-95 sm:self-auto"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-transform group-hover:-rotate-45"
                  aria-hidden="true"
                >
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                Start Over
              </button>
            </header>

            {/* Results component */}
            <ResultsViewport auditData={auditData} shareToken={shareToken ?? undefined} />
          </div>
        ) : (
          <>
            {/* ══════════════════════════════════════════════
                HERO HEADER
            ══════════════════════════════════════════════ */}
            <header className="mb-14 text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-sm font-medium text-indigo-300 backdrop-blur">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-400" />
                </span>
                Beta · Free Audit Tool
              </div>

              <h1 className="mt-3 bg-gradient-to-br from-white via-slate-200 to-indigo-300 bg-clip-text text-5xl font-extrabold leading-tight tracking-tight text-transparent sm:text-6xl">
                AI Spend Auditor
              </h1>
              <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-slate-400">
                Map every AI subscription your team pays for, spot redundancy, and
                understand your true cost-per-seat in seconds.
              </p>

              {/* Stat pills */}
              {isLoaded && auditData.tools.length > 0 && (
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  {[
                    {
                      label: "Monthly Spend",
                      value: `$${totalMonthly.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
                      color: "from-violet-500/20 to-indigo-500/20 border-violet-500/30 text-violet-300",
                    },
                    {
                      label: "Annual Projection",
                      value: `$${totalAnnual.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
                      color: "from-indigo-500/20 to-cyan-500/20 border-cyan-500/30 text-cyan-300",
                    },
                    {
                      label: "Cost / Seat / Mo",
                      value: `$${costPerSeat.toFixed(2)}`,
                      color: "from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-300",
                    },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className={`flex flex-col items-center rounded-2xl border bg-gradient-to-br px-6 py-3 backdrop-blur-sm ${stat.color}`}
                    >
                      <span className="text-xl font-bold">{stat.value}</span>
                      <span className="mt-0.5 text-xs font-medium opacity-80">
                        {stat.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </header>

            {/* Skeleton shimmer while localStorage loads */}
            {!isLoaded && (
              <div className="space-y-4 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 rounded-2xl bg-slate-800/60" />
                ))}
              </div>
            )}

            {isLoaded && (
              <form onSubmit={handleSubmit} noValidate className="space-y-8">

                {/* ══════════════════════════════════════════════
                    SECTION 1 — GENERAL INFO
                ══════════════════════════════════════════════ */}
                <section className="rounded-3xl border border-slate-700/60 bg-slate-800/50 p-6 shadow-xl backdrop-blur-sm sm:p-8">
                  <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-lg">
                      🏢
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-slate-100">
                        Team Overview
                      </h2>
                      <p className="text-xs text-slate-500">
                        Tell us about your organisation
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    {/* Team Size */}
                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor="teamSize"
                        className="text-sm font-medium text-slate-300"
                      >
                        Team Size
                        <span className="ml-1 text-slate-500">(seats)</span>
                      </label>
                      <div className="relative">
                        <input
                          id="teamSize"
                          type="number"
                          min={1}
                          value={auditData.teamSize}
                          onChange={(e) =>
                            updateField("teamSize", Math.max(1, Number(e.target.value)))
                          }
                          className="w-full rounded-xl border border-slate-600/60 bg-slate-900/70 px-4 py-3 pr-16 text-sm text-slate-100 placeholder-slate-600 outline-none ring-0 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
                        />
                        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                          people
                        </span>
                      </div>
                    </div>

                    {/* Primary Use Case */}
                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor="primaryUseCase"
                        className="text-sm font-medium text-slate-300"
                      >
                        Primary Use Case
                      </label>
                      <select
                        id="primaryUseCase"
                        value={auditData.primaryUseCase}
                        onChange={(e) =>
                          updateField(
                            "primaryUseCase",
                            e.target.value as PrimaryUseCase
                          )
                        }
                        className="w-full appearance-none rounded-xl border border-slate-600/60 bg-slate-900/70 px-4 py-3 text-sm text-slate-100 outline-none ring-0 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
                        style={{
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                          backgroundRepeat: "no-repeat",
                          backgroundPosition: "right 1rem center",
                        }}
                      >
                        {USE_CASE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </section>

                {/* ══════════════════════════════════════════════
                    SECTION 2 — AI TOOLS
                ══════════════════════════════════════════════ */}
                <section className="rounded-3xl border border-slate-700/60 bg-slate-800/50 p-6 shadow-xl backdrop-blur-sm sm:p-8">
                  {/* Section header */}
                  <div className="mb-6 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/20 text-lg">
                        🤖
                      </div>
                      <div>
                        <h2 className="text-base font-semibold text-slate-100">
                          AI Tools &amp; Subscriptions
                        </h2>
                        <p className="text-xs text-slate-500">
                          Add every tool your team pays for
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      id="add-tool-btn"
                      onClick={addTool}
                      className="group flex shrink-0 items-center gap-2 rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-4 py-2 text-sm font-medium text-indigo-300 transition hover:border-indigo-400/60 hover:bg-indigo-500/20 hover:text-indigo-200 active:scale-95"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="transition group-hover:rotate-90"
                        aria-hidden="true"
                      >
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      Add Tool
                    </button>
                  </div>

                  {/* Empty state */}
                  {auditData.tools.length === 0 && (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 py-14 text-center">
                      <div className="mb-3 text-4xl opacity-50">💸</div>
                      <p className="text-sm font-medium text-slate-400">
                        No tools added yet
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        Click &ldquo;Add Tool&rdquo; to start tracking your AI spend
                      </p>
                    </div>
                  )}

                  {/* Tool cards */}
                  <div className="space-y-4">
                    {auditData.tools.map((tool: ToolSpend, index: number) => (
                      <ToolCard
                        key={tool.id}
                        tool={tool}
                        index={index}
                        onUpdate={(patch: Partial<Omit<ToolSpend, "id">>) => updateTool(tool.id, patch)}
                        onRemove={() => removeTool(tool.id)}
                      />
                    ))}
                  </div>
                </section>

                {/* ══════════════════════════════════════════════
                    SUBMIT
                ══════════════════════════════════════════════ */}
                <div className="flex flex-col items-center gap-3">
                  <button
                    id="run-audit-btn"
                    type="submit"
                    disabled={auditData.tools.length === 0}
                    className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-indigo-900/40 transition hover:shadow-indigo-700/50 hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:min-w-[260px]"
                  >
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                      Run Free Audit
                    </span>
                    {/* Shine sweep */}
                    <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
                  </button>
                  <p className="text-xs text-slate-600">
                    {auditData.tools.length === 0
                      ? "Add at least one tool to run your audit"
                      : "Data is saved locally in your browser · never sent to a server"}
                  </p>
                </div>
              </form>
            )}
          </>
        )}
      </main>

      {/* ── Lead Gate Modal ─────────────────────────────────────────────── */}
      <LeadGateModal
        isOpen={isGateOpen}
        onClose={() => setIsGateOpen(false)}
        onSuccess={handleLeadSuccess}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ToolCard sub-component
// ---------------------------------------------------------------------------

interface ToolCardProps {
  tool: ToolSpend;
  index: number;
  onUpdate: (patch: Partial<Omit<ToolSpend, "id">>) => void;
  onRemove: () => void;
}

function ToolCard({ tool, index, onUpdate, onRemove }: ToolCardProps) {
  const monthlyCost = tool.monthlySpend * tool.seats;

  return (
    <div
      id={`tool-card-${tool.id}`}
      className="group relative rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5 transition hover:border-indigo-500/40 hover:bg-slate-900/80"
    >
      {/* Card header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/20 text-xs font-bold text-indigo-400">
            {index + 1}
          </span>
          <span className="text-sm font-semibold text-slate-200">
            {tool.toolName || "New Tool"}
          </span>
          {monthlyCost > 0 && (
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
              ${monthlyCost.toLocaleString("en-US", { minimumFractionDigits: 2 })} / mo
            </span>
          )}
        </div>

        <button
          type="button"
          id={`remove-tool-${tool.id}`}
          onClick={onRemove}
          aria-label={`Remove ${tool.toolName}`}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 opacity-0 transition hover:bg-red-500/15 hover:text-red-400 group-hover:opacity-100"
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
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </button>
      </div>

      {/* Inputs grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Tool Name */}
        <div className="flex flex-col gap-1.5 lg:col-span-1">
          <label
            htmlFor={`toolName-${tool.id}`}
            className="text-xs font-medium text-slate-500"
          >
            Tool Name
          </label>
          <select
            id={`toolName-${tool.id}`}
            value={tool.toolName}
            onChange={(e) => onUpdate({ toolName: e.target.value })}
            className="w-full appearance-none rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2.5 text-sm text-slate-200 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 0.75rem center",
              paddingRight: "2.25rem",
            }}
          >
            {TOOL_NAME_OPTIONS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {/* Plan Name */}
        <div className="flex flex-col gap-1.5 lg:col-span-1">
          <label
            htmlFor={`planName-${tool.id}`}
            className="text-xs font-medium text-slate-500"
          >
            Plan Name
          </label>
          <input
            id={`planName-${tool.id}`}
            type="text"
            placeholder="e.g. Pro, Business…"
            value={tool.planName}
            onChange={(e) => onUpdate({ planName: e.target.value })}
            className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        {/* Monthly Spend (per seat) */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={`monthlySpend-${tool.id}`}
            className="text-xs font-medium text-slate-500"
          >
            Spend / Seat / Mo
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
              $
            </span>
            <input
              id={`monthlySpend-${tool.id}`}
              type="number"
              min={0}
              step={0.01}
              placeholder="0.00"
              value={tool.monthlySpend === 0 ? "" : tool.monthlySpend}
              onChange={(e) =>
                onUpdate({ monthlySpend: Math.max(0, Number(e.target.value)) })
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-800/80 py-2.5 pl-7 pr-3 text-sm text-slate-200 placeholder-slate-600 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        {/* Seats */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={`seats-${tool.id}`}
            className="text-xs font-medium text-slate-500"
          >
            Seats
          </label>
          <input
            id={`seats-${tool.id}`}
            type="number"
            min={1}
            placeholder="1"
            value={tool.seats === 0 ? "" : tool.seats}
            onChange={(e) =>
              onUpdate({ seats: Math.max(1, Number(e.target.value)) })
            }
            className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      </div>
    </div>
  );
}
