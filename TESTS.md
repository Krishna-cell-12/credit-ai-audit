# Test Suite Documentation

## Overview

The audit engine is covered by a deterministic unit test suite built with **[Vitest](https://vitest.dev/)** — a fast, Vite-native test runner with first-class TypeScript support. Tests are co-located with the source at `lib/auditEngine.test.ts` and run in a Node environment against the pure `runAudit()` function, with no mocking of external dependencies.

| Metric | Value |
|---|---|
| Test runner | Vitest v4.1.7 |
| Test file | `lib/auditEngine.test.ts` |
| Test blocks (`describe`) | 6 |
| Total assertions (`it`) | **25 passing** |
| Execution time | ~536 ms (cold start) |

---

## Running the Suite

```bash
npm run test
```

Expected output:

```
 RUN  v4.1.7

 ✓ lib/auditEngine.test.ts (25 tests) 16ms

 Test Files  1 passed (1)
      Tests  25 passed (25)
   Duration  536ms
```

---

## Test Blocks

### Block 1 — Fully Optimised Stack
**Scenario:** A solo developer on Cursor Pro (`$20/mo`, 1 seat). No redundancies, correctly sized plan.

**Purpose:** Verifies the zero-savings code path — when a stack is already right-sized, the engine must not manufacture phantom waste and must surface the *"You're spending well"* message.

| Assertion | Expected |
|---|---|
| `totalMonthlySavings` | `0` |
| `totalAnnualSavings` | `0` |
| `summaryMessage` contains | `"You're spending well"` |
| Cursor entry `recommendedAction` | `KEEP` |

---

### Block 2 — Cursor + GitHub Copilot Redundancy Trap
**Scenario:** Cursor Pro (`$20/mo`) + GitHub Copilot Individual (`$10/mo`) active simultaneously on a 1-person team.

**Purpose:** Validates Rule 1 — cross-tool redundancy detection. Cursor ships native LLM code-completion; Copilot is therefore 100% redundant. The engine must flag Copilot as `DROP` and recover its entire spend as savings without penalising Cursor.

| Assertion | Expected |
|---|---|
| Copilot `recommendedAction` | `DROP` |
| Copilot `savings` | `$10` (100% of spend) |
| Copilot `recommendedSpend` | `$0` |
| Cursor `recommendedAction` | `KEEP` |
| `totalMonthlySavings` | `$10` |

---

### Block 3 — Seat Over-Allocation
**Scenario:** A single developer incorrectly subscribed to Cursor Business (`$40/mo`, 1 seat) instead of Cursor Pro (`$20/mo`).

**Purpose:** Validates Rule 2 — plan tier over-allocation for `teamSize === 1`. The engine must recommend a `DOWNGRADE` and calculate the exact dollar delta using retail pricing data.

| Assertion | Expected |
|---|---|
| Cursor `recommendedAction` | `DOWNGRADE` |
| Cursor `savings` | `$20` (`$40 − $20`) |
| Cursor `recommendedSpend` | `$20` |
| `totalMonthlySavings` | `$20` |
| `totalCurrentSpend` | `$40` |

---

### Block 4 — Multi-Rule Accumulation
**Scenario:** Solo user with Cursor Business (`$40/mo`) **and** GitHub Copilot Business (`$19/mo`) — triggering both the over-allocation rule (Cursor) and the redundancy rule (Copilot) simultaneously.

**Purpose:** Confirms rules compose correctly. The redundancy rule takes precedence for Copilot (flagged `DROP`), while the over-allocation rule independently fires for Cursor (flagged `DOWNGRADE`). Combined savings must equal the arithmetic sum of both remediations.

| Assertion | Expected |
|---|---|
| Cursor `recommendedAction` | `DOWNGRADE` |
| Copilot `recommendedAction` | `DROP` |
| `totalCurrentSpend` | `$59` |
| `totalRecommendedSpend` | `$20` |
| `totalMonthlySavings` | `$39` (`$20 + $19`) |
| `summaryMessage` contains | `"$39"` — not `"spending well"` |

---

### Block 5 — Annual Projection Math
**Scenario:** Three independent inputs — an optimised zero-savings stack, a Claude Team → Pro downgrade (`$10/mo` savings), and a ChatGPT Team → Plus downgrade (`$10/mo` savings).

**Purpose:** Asserts the invariant `totalAnnualSavings === totalMonthlySavings × 12` holds across all code paths, including zero, positive integer, and fractional-dollar cases. This guards against rounding drift in the `round2()` utility.

| Assertion | Expected |
|---|---|
| Zero-savings case: annual = monthly × 12 | `0 === 0 × 12` |
| Claude downgrade: `totalMonthlySavings` | `$10` |
| Claude downgrade: `totalAnnualSavings` | `$120` |
| ChatGPT downgrade: `totalAnnualSavings` | `$120` |

---

### Block 6 — Bulk Arbitrage Threshold Boundary
**Scenario A:** ChatGPT Pro (`$200`) + Claude Team × 10 seats (`$300`) = exactly `$500/mo`.  
**Scenario B:** Same stack plus one Gemini Advanced seat (`$21.99`) = `$521.99/mo`.

**Purpose:** Validates Rule 3 — the bulk credit arbitrage advisory fires **only when spend strictly exceeds `$500`**. The boundary case (exactly `$500`) must produce no advisory entry; the above-threshold case must inject the `OPTIMIZE` advisory item.

| Assertion | Expected |
|---|---|
| `totalCurrentSpend` at boundary | `$500` (no advisory injected) |
| Advisory entry at `$500` | `undefined` |
| `totalCurrentSpend` above threshold | `> $500` |
| Advisory `recommendedAction` | `OPTIMIZE` |

---

## File Structure

```
credit-ai-audit/
├── lib/
│   ├── auditEngine.ts          # Source — pure calculation engine
│   └── auditEngine.test.ts     # Test suite (this document)
├── types/
│   └── index.ts                # Shared TypeScript types (AuditState, ToolSpend)
└── vitest.config.ts            # Vitest config — resolves @/ alias to project root
```

---

## Design Decisions

**Deterministic inputs, no mocks.** Every test constructs a concrete `AuditState` object and calls `runAudit()` directly. There are no mocked timers, no stubbed APIs, and no external I/O — the engine is a pure function, so tests are reproducible across all environments.

**Boundary testing over happy paths.** The threshold test (Block 6) deliberately asserts the `$500` exact-boundary case separately from the above-threshold case. Off-by-one errors in financial logic are silent until they hit production; explicit boundary assertions catch them at commit time.

**Arithmetic invariant assertion (Block 5).** Rather than hardcoding `expect(result.totalAnnualSavings).toBe(120)` alone, each annual test also asserts `result.totalAnnualSavings === result.totalMonthlySavings * 12`. This means the test will continue to catch rounding inconsistencies even if the underlying monthly savings value changes in the future.
