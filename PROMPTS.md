# AI Spend Auditor - LLM Prompting Log

This document tracks the system prompts and architectural directions fed to Claude 4.6 Sonnet throughout the development lifecycle of the AI Spend Auditor. 

**Engineering Strategy:** AI was leveraged strictly for boilerplate generation, UI component scaffolding (Tailwind), and writing repetitive unit tests. Core mathematical logic and system architecture rules were strictly defined in the prompts to prevent LLM hallucinations.

---

## Day 1: Foundation & Data Models

**Prompt 1: Defining the Type Architecture**
> Act as a Senior TypeScript Engineer. I am building a Next.js application called "AI Spend Auditor". I need a strict, scalable type definition file (`types/index.ts`). 
> 
> Please generate the following interfaces:
> 1. `ToolSpend`: An object representing a single AI tool subscription (id, name, monthlyCost, planType, seats).
> 2. `AuditState`: The global state object containing an array of `tools`, a `teamSize` (number), and a `primaryUseCase` (string).
> 3. `ToolAuditResult`: The output shape for our math engine, including `currentSpend`, `recommendedSpend`, `savings`, `recommendedAction` (KEEP, DROP, DOWNGRADE, OPTIMIZE), and a `reason` (string).
> 
> Export all types cleanly.

---

## Day 2: The Input Form & Persistence

**Prompt 2: Building the Hydration-Safe Form**
> Act as a Frontend React Engineer. Build the main input form for our AI Spend Auditor in `app/page.tsx` using Tailwind CSS. 
> 
> Requirements:
> 1. Import `AuditState` and `ToolSpend` from `@/types`.
> 2. Create a dynamic form where users can add/remove multiple AI tools.
> 3. Inputs needed per tool: Tool Name (select dropdown: Cursor, Copilot, ChatGPT, Claude, Gemini, Other), Monthly Cost (number), Plan Tier (select), and Seats (number).
> 4. CRITICAL: Implement `localStorage` to persist the form data so the user doesn't lose their inputs on page refresh. Ensure the `useEffect` handles hydration safely to prevent Next.js server/client mismatch errors.

---

## Day 3: Deterministic Math Engine & Testing

**Prompt 3: The Core Audit Engine Logic**
> Act as a Principal Software Engineer and Financial Analyst. I need a robust, deterministic mathematical engine written in TypeScript for our AI Spend Auditor (`lib/auditEngine.ts`). 
>
> Requirements for the engine function `runAudit(state: AuditState)`:
> 1. Calculate a per-tool breakdown: currentSpend, recommendedAction, recommendedSpend, savings, and a 1-sentence defensible reason.
> 2. Calculate aggregates: totalCurrentSpend, totalRecommendedSpend, totalMonthlySavings, totalAnnualSavings.
> 3. Implement hardcoded rules:
>    - CROSS-TOOL REDUNDANCY: If a user has BOTH "Cursor" and "GitHub Copilot", flag Copilot as a 100% redundancy. Recommend DROP.
>    - SEAT OVER-ALLOCATION: If a tool plan is Team/Business but `teamSize` is 1, recommend DOWNGRADE to Pro. Calculate exact dollar difference based on standard retail pricing.
>    - RETAIL MARKUP: If total spend > $500/mo, flag for bulk software credit arbitrage (OPTIMIZE).
> 4. Output only clean, pure calculation code. No LLM inferences for the math.

**Prompt 4: The Automated Test Suite**
> Act as a QA Engineer specializing in TypeScript testing. Write an automated test suite using Vitest for our audit engine inside `lib/auditEngine.test.ts`.
> 
> Write a minimum of 5 distinct unit tests covering edge-case configurations of `runAudit`.
> Test cases must include:
> 1. A completely optimized stack with 0 savings.
> 2. The Cursor + GitHub Copilot redundancy trap.
> 3. Seat over-allocation (team size 1 on Business tier).
> 4. Accumulation of multiple rules simultaneously.
> 5. Annual projection calculation validation.

---

## Day 4: Visual Dashboard & AI Server Route

**Prompt 5: Secure API Server Route**
> Act as a Principal Backend Engineer. I need a Next.js App Router API Route (`app/api/summary/route.ts`) that handles a POST request to generate an AI spend audit summary paragraph using the Anthropic API.
> 
> Requirements:
> 1. Securely initialize the client using `process.env.ANTHROPIC_API_KEY` at module scope for serverless warm starts.
> 2. Accept a JSON payload containing the computed audit aggregates.
> 3. CRITICAL: Handle API execution errors and rate limits (429) gracefully. Wrap in a try/catch. If the Anthropic request fails, return a 200 OK status with a highly polished, template-fallback string using `Intl.NumberFormat`. The frontend must never crash due to an API timeout.

**Prompt 6: The Results Viewport UI**
> Act as a Senior UI/UX Engineer. I need a modular React component for our results viewport (`app/results.tsx`). Use `lucide-react` and Tailwind CSS.
> 
> Requirements:
> 1. Accept an `auditData` prop and compute statistics via `runAudit` (wrap in `useMemo`).
> 2. Hero Header: Visually prioritize Total Monthly/Annual Savings.
> 3. Dynamic Banners: If monthly savings > $500, render a Credex lead-gen CTA. If savings <= $0, render a green "optimally balanced" success container.
> 4. Per-Tool Line Matrix: Map over tool results rendering semantic badges (KEEP, DROP, DOWNGRADE, OPTIMIZE). Use smooth CSS transitions (`max-h`) for row expansion.
> 5. AI Insights Block: Use an async `fetch` inside a `useEffect` (guarded with a `useRef` to prevent React 18 strict mode double-firing) calling `/api/summary`. Render a skeleton loader while pending.

**Prompt 7: Resolving TypeScript Technical Debt**
> Act as a Senior React Developer. Here is my `app/page.tsx` file. Fix the remaining TypeScript warnings:
> 1. Change relative `../../types` imports to absolute `@/types`.
> 2. Explicitly type all inline event handlers (e.g., `React.ChangeEvent<HTMLInputElement>`, `React.FormEvent<HTMLFormElement>`) to prevent implicit `any` cascades caused by generic state inference failures.