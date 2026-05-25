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

## Day 5: Data Persistence & The Viral Loop

**Prompt 8: Database Schema & Client Initialization**
> Act as a Lead Database Architect. Define our type-safe schema using `drizzle-orm/pg-core` inside `db/schema.ts` and initialize the serverless client in `db/index.ts`.
> 
> Requirements for `db/schema.ts`:
> 1. `leads` table: id (uuid, primary key), email (text, unique, serial), name (text), company (text, optional), createdAt (timestamp).
> 2. `audits` table: id (uuid), leadId (uuid, foreign key), totalCurrentSpend (numeric), totalMonthlySavings (numeric), totalAnnualSavings (numeric), primaryUseCase (text), toolsData (jsonb), shareToken (text, unique), createdAt (timestamp).
> 
> Requirements for `db/index.ts`:
> 1. Instantiate the Neon serverless connection pool using `@neondatabase/serverless`.
> 2. Export the `db` instance initialized with our strict schema.

**Prompt 9: The Lead Capture API Route**
> Act as a Principal Backend Engineer. I need a Next.js App Router POST API handler (`app/api/audit/save/route.ts`) that records a user's lead information and anchors their calculated audit results in Postgres using Drizzle.
> 
> Requirements:
> 1. Accept an inbound JSON payload: { name, email, company, auditState, metrics }.
> 2. Execute a database transaction:
>    - Check if the lead email exists. If not, insert into `leads` and extract the ID.
>    - Generate a secure random crypto token (`shareToken`) using native Node crypto.
>    - Store the audit metrics and `toolsData` (jsonb), linking it to the lead via foreign key.
> 3. Return a 201 Created status containing the `auditId` and `shareToken`.
> 4. Implement structured try/catch logging for connection state drop recovery (503 vs 500).

**Prompt 10: The Lead Gate UI Modal**
> Act as a Senior Conversion Rate UI Engineer. I need a beautiful, accessible modal dialogue component (`components/LeadGateModal.tsx`) built with Tailwind CSS and Lucide icons.
> 
> Requirements:
> 1. Properties: Accept `isOpen` (boolean), `onClose` (callback), and `onSuccess` (callback that passes back { name, email, company }).
> 2. Design Language: Render a fixed-overlay modal that looks like an elite enterprise financial application. Use a dark/glassmorphic backdrop.
> 3. Form Inputs: Full Name (required), Business Email (required), Company Name (optional). Use clean, minimal input borders with focus-ring states.
> 4. States: Handle a local `isSubmitting` state. When submitting, disable all inputs/background click-to-close, and render a loading spinner inside the submit button.
> 5. Accessibility: Ensure it can be closed via the 'Escape' key (unless submitting) and trap focus.

**Prompt 11: Hooking the Gate into the Application State**
> Act as a Senior React Engineer. I need to update my main `app/page.tsx` file to integrate the `LeadGateModal` and route the data to our `/api/audit/save` backend.
> 
> Requirements:
> 1. Add a local state boolean `isGateOpen` (default false).
> 2. Update the "Run Free Audit" handler: Instead of setting `showResults(true)`, set `isGateOpen(true)`.
> 3. Inside the modal's `onSuccess` handler:
>    - Run `runAudit(auditData)` synchronously to capture exact metrics.
>    - Execute a `fetch` POST to `/api/audit/save`.
>    - If successful (201), save the returned `shareToken` to state, close the gate, and toggle `showResults(true)`.

**Prompt 12: The Share Banner UI**
> Act as a Senior UI/UX Engineer. I need to update my `app/results.tsx` component to include a "Share Your Score" feature for our viral loop.
> 
> Requirements:
> 1. If the `shareToken` prop is provided, render a sleek, glassmorphic "Share Your Result" banner.
> 2. Display a read-only input containing the full absolute URL. Handle SSR hydration safely by checking `typeof window !== 'undefined'` before appending `window.location.origin`.
> 3. Include a "Copy Link" button with a clipboard cascade fallback (`navigator.clipboard.writeText` falling back to `document.execCommand`).
> 4. Implement an `isCopied` debounce guard to prevent state oscillation.

**Prompt 13: The Public Read-Only Server Component**
> Act as a Principal Full-Stack Engineer. I need a Next.js Server Component (`app/audit/[token]/page.tsx`) that renders a public, read-only view of a user's AI spend audit.
> 
> Requirements:
> 1. Accept `{ params: Promise<{ token: string }> }` from the dynamic route (Next.js 15+ spec).
> 2. Implement regex pre-validation `^[A-Za-z0-9_-]{10,}$` to reject invalid tokens before hitting the DB.
> 3. Query the Neon database via Drizzle to find the audit matching the `shareToken`. If not found, trigger `notFound()`.
> 4. Derive `teamSize` safely from `max(seats)` to prevent schema migration debt.
> 5. Implement Open Graph (OG) metadata generation targeting high click-through rates.
> 6. Reconstruct the `AuditState` and pass it directly into the `<ResultsViewport />`.

## Day 6: Business Strategy & Documentation

**Prompt 14: The Founder Docs (GTM, Economics, Metrics)**
> Act as a fractional Chief Marketing Officer and Head of Product. I have built "AI Spend Auditor," a Next.js/Neon SaaS tool that connects to a user's AI stack, calculates redundancies (like Cursor vs. GitHub Copilot), and generates a personalized savings report. It captures leads via an email gate and uses a viral share-link loop.
> 
> I need you to generate the structural skeletons for four business strategy documents. 
> 
> 1. `GTM.md` (Go-To-Market): Define a 3-phase launch strategy (e.g., Product Hunt, Developer Influencer outreach, Engineering Bootcamps).
> 2. `ECONOMICS.md` (Unit Economics): Draft a hypothetical breakdown of our CAC (Customer Acquisition Cost) via the viral loop vs paid ads, and the LTV (Lifetime Value) if we eventually take a 10% affiliate cut of the tools we recommend.
> 3. `METRICS.md`: Identify the 3 "North Star" metrics we must track (e.g., Lead Gate Conversion Rate, Viral K-Factor, Tool Redundancy Hit Rate).
> 4. `LANDING_COPY.md`: Write 3 variations of an aggressive, developer-focused H1 Header and Sub-headline for the landing page.
> 
> Output each document's content clearly separated by markdown headers. Use professional, startup-native terminology.