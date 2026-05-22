import { AuditState, ToolSpend } from "@/types";

// ---------------------------------------------------------------------------
// Canonical retail pricing (per seat / per month, USD)
// Source: PRICING_DATA.md — verified 2026-05-21
// ---------------------------------------------------------------------------

interface PricingTier {
  planKeywords: string[]; // substrings to match against planName (lowercase)
  pricePerSeat: number;
}

interface ToolPricingMap {
  tiers: PricingTier[];
  /** The cheapest individual/pro tier price for downgrade suggestions */
  individualPrice: number;
  /** The team/business tier price used for over-allocation checks */
  teamPrice: number;
  /** Human-readable names for the individual and team plans */
  individualPlanName: string;
  teamPlanName: string;
}

const PRICING: Record<string, ToolPricingMap> = {
  cursor: {
    tiers: [
      { planKeywords: ["hobby", "free"], pricePerSeat: 0 },
      { planKeywords: ["pro"], pricePerSeat: 20 },
      { planKeywords: ["business"], pricePerSeat: 40 },
    ],
    individualPrice: 20,
    teamPrice: 40,
    individualPlanName: "Pro",
    teamPlanName: "Business",
  },
  "github copilot": {
    tiers: [
      { planKeywords: ["individual", "free"], pricePerSeat: 10 },
      { planKeywords: ["business"], pricePerSeat: 19 },
      { planKeywords: ["enterprise"], pricePerSeat: 39 },
    ],
    individualPrice: 10,
    teamPrice: 19,
    individualPlanName: "Individual",
    teamPlanName: "Business",
  },
  claude: {
    tiers: [
      { planKeywords: ["free"], pricePerSeat: 0 },
      { planKeywords: ["pro"], pricePerSeat: 20 },
      { planKeywords: ["team"], pricePerSeat: 30 },
    ],
    individualPrice: 20,
    teamPrice: 30,
    individualPlanName: "Pro",
    teamPlanName: "Team",
  },
  chatgpt: {
    tiers: [
      { planKeywords: ["free"], pricePerSeat: 0 },
      { planKeywords: ["plus"], pricePerSeat: 20 },
      { planKeywords: ["pro"], pricePerSeat: 200 },
      { planKeywords: ["team"], pricePerSeat: 30 },
    ],
    individualPrice: 20,
    teamPrice: 30,
    individualPlanName: "Plus",
    teamPlanName: "Team",
  },
  gemini: {
    tiers: [
      { planKeywords: ["free"], pricePerSeat: 0 },
      { planKeywords: ["advanced", "ai pro", "google one"], pricePerSeat: 21.99 },
      { planKeywords: ["workspace", "business"], pricePerSeat: 22 },
    ],
    individualPrice: 21.99,
    teamPrice: 22,
    individualPlanName: "Gemini Advanced",
    teamPlanName: "Workspace",
  },
};

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

function normalizeToolName(name: string): string {
  return name.trim().toLowerCase();
}

function resolveToolKey(toolName: string): string | null {
  const normalized = normalizeToolName(toolName);
  for (const key of Object.keys(PRICING)) {
    if (normalized.includes(key) || key.includes(normalized)) return key;
  }
  return null;
}

function isTeamOrBusinessPlan(planName: string): boolean {
  const lower = planName.toLowerCase();
  return (
    lower.includes("team") ||
    lower.includes("business") ||
    lower.includes("enterprise")
  );
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// ---------------------------------------------------------------------------
// Per-tool result shape
// ---------------------------------------------------------------------------

export interface ToolAuditResult {
  tool: ToolSpend;
  currentSpend: number;
  recommendedAction: "KEEP" | "DROP" | "DOWNGRADE" | "OPTIMIZE";
  recommendedSpend: number;
  savings: number;
  reason: string;
}

// ---------------------------------------------------------------------------
// Full audit output shape
// ---------------------------------------------------------------------------

export interface AuditResult {
  breakdown: ToolAuditResult[];
  totalCurrentSpend: number;
  totalRecommendedSpend: number;
  totalMonthlySavings: number;
  totalAnnualSavings: number;
  summaryMessage: string;
}

// ---------------------------------------------------------------------------
// Core audit function
// ---------------------------------------------------------------------------

export function runAudit(state: AuditState): AuditResult {
  const { tools, teamSize } = state;

  // Pre-compute canonical tool name index for cross-tool checks
  const toolNameSet = new Set(tools.map((t) => normalizeToolName(t.toolName)));

  const hasCursor = toolNameSet.has("cursor");
  const hasCopilot =
    toolNameSet.has("github copilot") || toolNameSet.has("copilot");

  const breakdown: ToolAuditResult[] = tools.map((tool): ToolAuditResult => {
    const currentSpend = round2(tool.monthlySpend * tool.seats);
    const normalized = normalizeToolName(tool.toolName);
    const pricingKey = resolveToolKey(tool.toolName);
    const pricing = pricingKey ? PRICING[pricingKey] : null;

    // ------------------------------------------------------------------
    // RULE 1 — CROSS-TOOL REDUNDANCY: Cursor + GitHub Copilot
    // Copilot is 100% redundant when Cursor is present (Cursor ships its
    // own LLM code-completion layer that fully supersedes Copilot).
    // ------------------------------------------------------------------
    const isCopilot =
      normalized.includes("copilot") || normalized === "github copilot";

    if (isCopilot && hasCursor) {
      return {
        tool,
        currentSpend,
        recommendedAction: "DROP",
        recommendedSpend: 0,
        savings: round2(currentSpend),
        reason:
          "Cursor already provides native, superior LLM code-completion — GitHub Copilot is 100% redundant and should be cancelled immediately.",
      };
    }

    // ------------------------------------------------------------------
    // RULE 2 — SEAT OVER-ALLOCATION: Team/Business plan for a team of 1
    // ------------------------------------------------------------------
    if (pricing && teamSize === 1 && isTeamOrBusinessPlan(tool.planName)) {
      const recommendedSpend = round2(
        pricing.individualPrice * tool.seats
      );
      const savings = round2(currentSpend - recommendedSpend);

      if (savings > 0) {
        return {
          tool,
          currentSpend,
          recommendedAction: "DOWNGRADE",
          recommendedSpend,
          savings,
          reason: `A solo operator has no need for the ${pricing.teamPlanName} plan — downgrading to ${pricing.individualPlanName} ($${pricing.individualPrice}/mo) saves $${savings}/mo with zero capability loss.`,
        };
      }
    }

    // ------------------------------------------------------------------
    // Default — tool is well-configured; flag as KEEP
    // ------------------------------------------------------------------
    return {
      tool,
      currentSpend,
      recommendedAction: "KEEP",
      recommendedSpend: currentSpend,
      savings: 0,
      reason: `${tool.toolName} is appropriately sized for your current team and use-case; no action required.`,
    };
  });

  // ------------------------------------------------------------------
  // Aggregate totals
  // ------------------------------------------------------------------
  const totalCurrentSpend = round2(
    breakdown.reduce((sum, r) => sum + r.currentSpend, 0)
  );
  const totalRecommendedSpend = round2(
    breakdown.reduce((sum, r) => sum + r.recommendedSpend, 0)
  );
  const totalMonthlySavings = round2(totalCurrentSpend - totalRecommendedSpend);
  const totalAnnualSavings = round2(totalMonthlySavings * 12);

  // ------------------------------------------------------------------
  // RULE 3 — RETAIL MARKUP / BULK CREDIT ARBITRAGE FLAG
  // Inject an "OPTIMIZE" advisory entry when cumulative spend > $500/mo.
  // This is surfaced as an additional line item (non-tool-specific).
  // ------------------------------------------------------------------
  if (totalCurrentSpend > 500) {
    breakdown.push({
      tool: {
        id: "advisory-bulk-credits",
        toolName: "Bulk Software Credit Arbitrage",
        planName: "Advisory",
        monthlySpend: 0,
        seats: 0,
      },
      currentSpend: 0,
      recommendedAction: "OPTIMIZE",
      recommendedSpend: 0,
      savings: 0,
      reason: `Your cumulative AI spend ($${totalCurrentSpend}/mo) exceeds $500 — you are an ideal candidate for bulk software credit purchasing, which can unlock 15–40% effective discounts versus retail SaaS pricing.`,
    });
  }

  // ------------------------------------------------------------------
  // Summary message
  // ------------------------------------------------------------------
  let summaryMessage: string;

  if (totalMonthlySavings <= 0) {
    summaryMessage =
      "You're spending well. Your AI stack is already highly optimised — every dollar is justified and no redundancies were detected.";
  } else {
    summaryMessage = `Your stack has $${totalMonthlySavings}/mo ($${totalAnnualSavings}/yr) in recoverable waste. Implementing the recommendations above will right-size your AI spend without sacrificing capability.`;
  }

  return {
    breakdown,
    totalCurrentSpend,
    totalRecommendedSpend,
    totalMonthlySavings,
    totalAnnualSavings,
    summaryMessage,
  };
}
