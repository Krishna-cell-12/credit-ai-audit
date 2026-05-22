import { describe, it, expect } from "vitest";
import { runAudit } from "./auditEngine";
import { AuditState } from "@/types";

// ---------------------------------------------------------------------------
// Test 1 — Fully optimised stack: zero savings → "You're spending well"
// Stack: Solo developer on Cursor Pro ($20/mo). No redundancies, correct plan.
// ---------------------------------------------------------------------------
describe("Test 1: Fully optimised stack produces zero savings message", () => {
  const state: AuditState = {
    teamSize: 1,
    primaryUseCase: "coding",
    tools: [
      {
        id: "tool-1",
        toolName: "Cursor",
        planName: "Pro",
        monthlySpend: 20,
        seats: 1,
      },
    ],
  };

  it("reports zero monthly savings", () => {
    const result = runAudit(state);
    expect(result.totalMonthlySavings).toBe(0);
  });

  it("reports zero annual savings", () => {
    const result = runAudit(state);
    expect(result.totalAnnualSavings).toBe(0);
  });

  it("summary message confirms stack is optimised", () => {
    const result = runAudit(state);
    expect(result.summaryMessage).toContain("You're spending well");
  });

  it("the single tool is flagged KEEP with no savings", () => {
    const result = runAudit(state);
    const cursorEntry = result.breakdown.find(
      (r) => r.tool.toolName === "Cursor"
    );
    expect(cursorEntry).toBeDefined();
    expect(cursorEntry!.recommendedAction).toBe("KEEP");
    expect(cursorEntry!.savings).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Test 2 — Cursor + GitHub Copilot redundancy trap
// Stack: Cursor Pro (1 seat, $20/mo) + GitHub Copilot Individual (1 seat, $10/mo).
// Copilot should be flagged DROP with 100% of its spend as savings ($10).
// ---------------------------------------------------------------------------
describe("Test 2: Cursor + GitHub Copilot cross-tool redundancy", () => {
  const state: AuditState = {
    teamSize: 1,
    primaryUseCase: "coding",
    tools: [
      {
        id: "tool-cursor",
        toolName: "Cursor",
        planName: "Pro",
        monthlySpend: 20,
        seats: 1,
      },
      {
        id: "tool-copilot",
        toolName: "GitHub Copilot",
        planName: "Individual",
        monthlySpend: 10,
        seats: 1,
      },
    ],
  };

  it("flags GitHub Copilot as DROP", () => {
    const result = runAudit(state);
    const copilotEntry = result.breakdown.find((r) =>
      r.tool.toolName.toLowerCase().includes("copilot")
    );
    expect(copilotEntry).toBeDefined();
    expect(copilotEntry!.recommendedAction).toBe("DROP");
  });

  it("Copilot savings equals 100% of its current spend ($10)", () => {
    const result = runAudit(state);
    const copilotEntry = result.breakdown.find((r) =>
      r.tool.toolName.toLowerCase().includes("copilot")
    );
    expect(copilotEntry!.savings).toBe(10);
    expect(copilotEntry!.recommendedSpend).toBe(0);
  });

  it("Copilot current spend is captured correctly at $10", () => {
    const result = runAudit(state);
    const copilotEntry = result.breakdown.find((r) =>
      r.tool.toolName.toLowerCase().includes("copilot")
    );
    expect(copilotEntry!.currentSpend).toBe(10);
  });

  it("Cursor itself remains KEEP — not penalised by the redundancy rule", () => {
    const result = runAudit(state);
    const cursorEntry = result.breakdown.find(
      (r) => r.tool.toolName === "Cursor"
    );
    expect(cursorEntry!.recommendedAction).toBe("KEEP");
  });

  it("total monthly savings equals Copilot spend ($10)", () => {
    const result = runAudit(state);
    expect(result.totalMonthlySavings).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Test 3 — Seat over-allocation: solo user on Cursor Business ($40/mo)
// Should be downgraded to Cursor Pro ($20/mo) → $20/mo savings.
// ---------------------------------------------------------------------------
describe("Test 3: Seat over-allocation — solo user on Business plan", () => {
  const state: AuditState = {
    teamSize: 1,
    primaryUseCase: "coding",
    tools: [
      {
        id: "tool-cursor-biz",
        toolName: "Cursor",
        planName: "Business",
        monthlySpend: 40,
        seats: 1,
      },
    ],
  };

  it("flags Cursor as DOWNGRADE", () => {
    const result = runAudit(state);
    const entry = result.breakdown.find((r) => r.tool.toolName === "Cursor");
    expect(entry!.recommendedAction).toBe("DOWNGRADE");
  });

  it("savings equals exact Business-to-Pro delta ($40 - $20 = $20)", () => {
    const result = runAudit(state);
    const entry = result.breakdown.find((r) => r.tool.toolName === "Cursor");
    expect(entry!.savings).toBe(20);
  });

  it("recommendedSpend equals Pro plan price ($20)", () => {
    const result = runAudit(state);
    const entry = result.breakdown.find((r) => r.tool.toolName === "Cursor");
    expect(entry!.recommendedSpend).toBe(20);
  });

  it("total monthly savings is $20", () => {
    const result = runAudit(state);
    expect(result.totalMonthlySavings).toBe(20);
  });

  it("total current spend is $40", () => {
    const result = runAudit(state);
    expect(result.totalCurrentSpend).toBe(40);
  });
});

// ---------------------------------------------------------------------------
// Test 4 — Multiple rules combined
// Stack: Solo user with Cursor Business (over-alloc) + GitHub Copilot Business
// (both redundancy AND over-alloc — redundancy should win and flag DROP).
//   Cursor Business (1 seat): $40  → DOWNGRADE to Pro ($20) → saves $20
//   Copilot Business (1 seat): $19 → DROP (Cursor present)  → saves $19
//   Total monthly savings: $39 | Annual: $468
// ---------------------------------------------------------------------------
describe("Test 4: Multiple rules fire simultaneously on one stack", () => {
  const state: AuditState = {
    teamSize: 1,
    primaryUseCase: "coding",
    tools: [
      {
        id: "tool-cursor-biz",
        toolName: "Cursor",
        planName: "Business",
        monthlySpend: 40,
        seats: 1,
      },
      {
        id: "tool-copilot-biz",
        toolName: "GitHub Copilot",
        planName: "Business",
        monthlySpend: 19,
        seats: 1,
      },
    ],
  };

  it("Cursor is flagged DOWNGRADE (over-allocation rule)", () => {
    const result = runAudit(state);
    const cursorEntry = result.breakdown.find(
      (r) => r.tool.toolName === "Cursor"
    );
    expect(cursorEntry!.recommendedAction).toBe("DOWNGRADE");
  });

  it("Copilot is flagged DROP (redundancy rule takes precedence)", () => {
    const result = runAudit(state);
    const copilotEntry = result.breakdown.find((r) =>
      r.tool.toolName.toLowerCase().includes("copilot")
    );
    expect(copilotEntry!.recommendedAction).toBe("DROP");
  });

  it("combined total monthly savings is $39 ($20 downgrade + $19 drop)", () => {
    const result = runAudit(state);
    expect(result.totalMonthlySavings).toBe(39);
  });

  it("total current spend is $59 ($40 + $19)", () => {
    const result = runAudit(state);
    expect(result.totalCurrentSpend).toBe(59);
  });

  it("total recommended spend is $20 (Cursor Pro only)", () => {
    const result = runAudit(state);
    expect(result.totalRecommendedSpend).toBe(20);
  });

  it("summary message reflects recoverable waste, not 'spending well'", () => {
    const result = runAudit(state);
    expect(result.summaryMessage).not.toContain("You're spending well");
    expect(result.summaryMessage).toContain("$39");
  });
});

// ---------------------------------------------------------------------------
// Test 5 — Annual projection: totalAnnualSavings must equal totalMonthlySavings × 12
// Stack: 5-person team with GitHub Copilot Business ($19/mo × 5 = $95/mo).
// No Cursor present, so no redundancy. teamSize 5 ≠ 1, no over-alloc.
// Savings = $0 → but we validate the math contract holds for ANY result.
// Then confirm with an explicit over-alloc case that produces real savings.
// ---------------------------------------------------------------------------
describe("Test 5: Annual savings projection is exactly monthly savings × 12", () => {
  it("holds when savings are zero (optimised stack)", () => {
    const state: AuditState = {
      teamSize: 5,
      primaryUseCase: "coding",
      tools: [
        {
          id: "tool-copilot-team",
          toolName: "GitHub Copilot",
          planName: "Business",
          monthlySpend: 19,
          seats: 5,
        },
      ],
    };
    const result = runAudit(state);
    expect(result.totalAnnualSavings).toBe(
      Math.round(result.totalMonthlySavings * 12 * 100) / 100
    );
  });

  it("holds when savings are positive — Claude Team downgrade for solo user", () => {
    // Claude Team = $30/mo, Claude Pro = $20/mo → $10/mo savings
    // Annual savings must be exactly $10 × 12 = $120
    const state: AuditState = {
      teamSize: 1,
      primaryUseCase: "writing",
      tools: [
        {
          id: "tool-claude-team",
          toolName: "Claude",
          planName: "Team",
          monthlySpend: 30,
          seats: 1,
        },
      ],
    };
    const result = runAudit(state);
    expect(result.totalMonthlySavings).toBe(10);
    expect(result.totalAnnualSavings).toBe(120);
    expect(result.totalAnnualSavings).toBe(result.totalMonthlySavings * 12);
  });

  it("holds for a fractional-dollar case — ChatGPT Team (5 seats, teamSize 1)", () => {
    // ChatGPT Team = $30/mo, ChatGPT Plus = $20/mo → $10/mo savings on 1 seat
    // monthlySpend input is per-seat ($30), seats = 1
    const state: AuditState = {
      teamSize: 1,
      primaryUseCase: "mixed",
      tools: [
        {
          id: "tool-chatgpt-team",
          toolName: "ChatGPT",
          planName: "Team",
          monthlySpend: 30,
          seats: 1,
        },
      ],
    };
    const result = runAudit(state);
    // Savings = $30 - $20 = $10/mo → $120/yr
    expect(result.totalAnnualSavings).toBe(result.totalMonthlySavings * 12);
    expect(result.totalAnnualSavings).toBe(120);
  });
});

// ---------------------------------------------------------------------------
// Test 6 — Bulk credit arbitrage advisory fires above $500/mo threshold
// Stack: ChatGPT Pro (1 seat × $200) + Claude Team (10 seats × $30 = $300)
//   Total = $500 — boundary check: must NOT fire at exactly $500.
//   Then $501 check to confirm it DOES fire above the threshold.
// ---------------------------------------------------------------------------
describe("Test 6: Bulk credit arbitrage advisory threshold behaviour", () => {
  it("does NOT inject advisory when total spend is exactly $500", () => {
    // 10 seats × Claude Team $30 = $300, ChatGPT Pro 1 seat $200 = $200 → total $500
    const state: AuditState = {
      teamSize: 10,
      primaryUseCase: "mixed",
      tools: [
        {
          id: "tool-chatgpt-pro",
          toolName: "ChatGPT",
          planName: "Pro",
          monthlySpend: 200,
          seats: 1,
        },
        {
          id: "tool-claude-team",
          toolName: "Claude",
          planName: "Team",
          monthlySpend: 30,
          seats: 10,
        },
      ],
    };
    const result = runAudit(state);
    expect(result.totalCurrentSpend).toBe(500);
    const advisory = result.breakdown.find(
      (r) => r.tool.id === "advisory-bulk-credits"
    );
    expect(advisory).toBeUndefined();
  });

  it("injects OPTIMIZE advisory when total spend exceeds $500", () => {
    // Add 1 extra Gemini Advanced seat ($21.99) to push over $500
    const state: AuditState = {
      teamSize: 10,
      primaryUseCase: "mixed",
      tools: [
        {
          id: "tool-chatgpt-pro",
          toolName: "ChatGPT",
          planName: "Pro",
          monthlySpend: 200,
          seats: 1,
        },
        {
          id: "tool-claude-team",
          toolName: "Claude",
          planName: "Team",
          monthlySpend: 30,
          seats: 10,
        },
        {
          id: "tool-gemini",
          toolName: "Gemini",
          planName: "Gemini Advanced",
          monthlySpend: 21.99,
          seats: 1,
        },
      ],
    };
    const result = runAudit(state);
    expect(result.totalCurrentSpend).toBeGreaterThan(500);
    const advisory = result.breakdown.find(
      (r) => r.tool.id === "advisory-bulk-credits"
    );
    expect(advisory).toBeDefined();
    expect(advisory!.recommendedAction).toBe("OPTIMIZE");
  });
});
