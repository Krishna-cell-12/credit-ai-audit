# ARCHITECTURE.md — AI Spend Auditor

> **Document Type:** System Design RFC  
> **Status:** Canonical  
> **Audience:** Engineering, Technical Reviewers  
> **Last Updated:** May 2026

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [The Data Layer — Neon + Drizzle ORM](#2-the-data-layer--neon--drizzle-orm)
3. [The Deterministic Math Engine](#3-the-deterministic-math-engine)
4. [Resilience & External APIs](#4-resilience--external-apis)
5. [The Viral Loop & Dynamic Routing](#5-the-viral-loop--dynamic-routing)

---

## 1. System Architecture Overview

### Pattern: Backend for Frontend (BFF)

AI Spend Auditor is architected as a **single deployable unit** using the Next.js 15 App Router. Rather than maintaining a separate REST or GraphQL API service, the Next.js runtime serves as both the client-rendering layer and the authoritative backend, fulfilling the **Backend for Frontend (BFF)** pattern.

This is a deliberate consolidation decision. In a BFF architecture, the server layer is purpose-built for exactly one frontend consumer — eliminating the impedance mismatch that arises when a generic API must serve multiple clients with divergent data requirements. React Server Components handle data-fetching and server-side rendering directly against the database. Route Handlers (`app/api/*`) expose narrow, task-specific endpoints for browser-initiated interactions — specifically, the AI enrichment call that must be deferred to client-trigger to avoid blocking the initial page render.

The system has exactly two external dependencies at runtime: **Neon Serverless Postgres** as the persistence layer, and the **Anthropic API** as an optional enrichment layer. Both are consumed exclusively from server-side execution contexts — no database credentials or API keys are ever transmitted to or readable from the browser.

### Request Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT (Browser)                           │
│                                                                     │
│   React Client Components  ──── fetch() ──►  /api/summary          │
│   (Audit Form, Share Card)                   (Route Handler)        │
└────────────────────────┬────────────────────────────────────────────┘
                         │  RSC render / Server Action invocation
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     NEXT.JS 15 APP ROUTER                           │
│                  (Node.js / Vercel Edge Runtime)                    │
│                                                                     │
│  ┌─────────────────────┐      ┌──────────────────────────────────┐  │
│  │  React Server       │      │  Route Handlers                  │  │
│  │  Components (RSC)   │      │  POST /api/summary               │  │
│  │                     │      │  POST /api/leads                 │  │
│  │  • page.tsx         │      │                                  │  │
│  │  • audit/[token]/   │      │  Server Actions                  │  │
│  │    page.tsx         │      │  • submitAudit()                 │  │
│  └──────────┬──────────┘      └──────────────┬───────────────────┘  │
│             │                                │                      │
└─────────────┼────────────────────────────────┼──────────────────────┘
              │  Drizzle ORM (WebSocket pool)  │  Anthropic SDK
              ▼                                ▼
┌─────────────────────────┐      ┌─────────────────────────────────┐
│   NEON SERVERLESS       │      │   ANTHROPIC API                 │
│   POSTGRES              │      │   claude-sonnet-4-5             │
│                         │      │                                 │
│   • audits              │      │   Enriches pre-computed         │
│   • leads               │      │   savings data with            │
│                         │      │   qualitative recommendations   │
└─────────────────────────┘      └─────────────────────────────────┘
```

### Why Not a Separate API Service?

The alternative — a standalone Express or Fastify service fronted by this Next.js app — would introduce network latency on every server-rendered request, a second deployment artifact to manage, a second set of secrets to rotate, and an additional failure domain. At the current scale and use case, that complexity is unjustified. The BFF consolidation gives us co-located type safety between the frontend and the data layer (enforced by Drizzle's inferred TypeScript types), a single deployment boundary, and zero cross-origin request complexity.

---

## 2. The Data Layer — Neon + Drizzle ORM

### Connection Strategy: WebSocket Pooling for Edge Compatibility

Traditional Postgres drivers (e.g., `node-postgres`) establish stateful TCP connections — a model that is fundamentally incompatible with serverless and edge execution environments, where function instances are ephemeral, do not persist between invocations, and may be terminated with no warning. Each cold-start would attempt a fresh TCP handshake to Postgres, pushing connection establishment time into the critical path of every request.

`@neondatabase/serverless` resolves this by tunneling the Postgres wire protocol over **WebSockets**, which are negotiable from HTTP/1.1 upgrade requests and are therefore usable in edge runtimes where raw TCP sockets are not available. Neon's managed connection pooler (built on PgBouncer) sits in front of the primary instance, ensuring that bursts of concurrent serverless invocations do not exhaust the database's `max_connections` ceiling. The connection string is configured with `?sslmode=require` to enforce TLS on every connection — a non-negotiable baseline for any production Postgres deployment.

### Schema Design

```typescript
// db/schema.ts (Drizzle schema — canonical definition)

export const audits = pgTable("audits", {
  id:            uuid("id").primaryKey().defaultRandom(),
  token:         text("token").notNull().unique(),
  email:         text("email").notNull(),
  toolsSnapshot: jsonb("tools_snapshot").notNull(),
  teamSize:      integer("team_size").notNull(),
  monthlySavings: numeric("monthly_savings", { precision: 12, scale: 2 }).notNull(),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
});
```

Each schema decision is deliberate:

**UUIDv4 Primary Keys (`uuid().defaultRandom()`)**  
Sequential integer primary keys are operationally convenient but leak business intelligence: an enumerable `id=1042` tells a competitor exactly how many audit records exist. UUIDv4 keys generated at the database level are non-enumerable, non-guessable, and globally unique — suitable for use in any distributed context where records may eventually be replicated or merged across database instances without collision. The `defaultRandom()` directive pushes generation into the Postgres `gen_random_uuid()` function, keeping it in the transaction boundary and out of application memory.

**JSONB Columns for Immutable Tool State Snapshots (`toolsSnapshot jsonb`)**  
The user's tool selections — names, categories, per-seat prices, and seat quantities — are stored as a verbatim JSONB snapshot of the array that was submitted at the time the audit was created. This is a temporal immutability contract. Normalizing tool data into a foreign-keyed `tools` table would create a live reference: if a tool's price is updated in that table later, every historical audit that references it would silently produce a different savings figure when reconstructed. With the JSONB snapshot, the database record is self-contained and temporally stable. An audit record from twelve months ago will reconstruct the same math output today as it did when it was written, regardless of how the pricing registry has evolved. The `jsonb` type (binary JSON) is preferred over `json` (text JSON) because Neon indexes and processes `jsonb` more efficiently, and it supports GIN indexes for complex JSON path queries if needed in future reporting features.

**`numeric(12, 2)` for Currency — Not `float` or `real`**  
IEEE 754 floating-point types (`float4`, `float8`, `real`, JavaScript `number`) are approximations. They cannot represent most decimal fractions exactly in binary, which means arithmetic operations on them accumulate representational errors. For a product whose core value proposition is precise dollar calculations, this is unacceptable. A computed savings figure of `$127.999999999998` is not the same as `$128.00` — and the difference, while imperceptible in isolation, compounds across aggregations and undermines trust in the output. `numeric(12, 2)` is an exact arbitrary-precision decimal type in Postgres. It stores and operates on the number `128.00` as precisely that value. The `precision: 12, scale: 2` parameters allow values up to `$9,999,999,999.99` — sufficient headroom for even the largest enterprise AI budgets — while constraining all values to exactly two decimal places at the storage layer.

---

## 3. The Deterministic Math Engine

### File: `lib/auditEngine.ts`

The core savings calculation is implemented as a **pure TypeScript module** — a collection of stateless functions with no React imports, no database calls, no network I/O, and no side effects. It takes a typed input, runs arithmetic, and returns a typed output. This is not an accident of implementation; it is the primary architectural constraint of this layer.

```
lib/
└── auditEngine.ts       ← Pure functions. No framework dependencies.
    ├── computeMonthlySpend(tools, teamSize) → number
    ├── detectRedundantPairs(tools) → RedundantPair[]
    └── computeSavings(pairs, teamSize) → SavingsReport
```

### Why Separation of Concerns Here?

A naive implementation would compute savings inside a Server Component or a Server Action — reading from the request, doing the math, and writing to the database in one monolithic function. This is expedient but creates several failure modes:

**Testing becomes integration testing by default.** If the math logic lives inside a Server Action, exercising it in a test requires either mocking the Next.js server runtime or running a full end-to-end test. Both approaches are slow, brittle, and provide poor signal — a test failure tells you the system failed, not which calculation is wrong.

By isolating the math engine into plain TypeScript functions, the unit test surface becomes trivial:

```typescript
// auditEngine.test.ts (Vitest)
import { computeSavings } from "@/lib/auditEngine";

it("correctly identifies Cursor + Copilot as a redundant pair", () => {
  const tools = [
    { name: "Cursor", category: "AI_CODE_EDITOR", seats: 3, pricePerSeat: 20 },
    { name: "GitHub Copilot", category: "AI_CODE_EDITOR", seats: 3, pricePerSeat: 19 },
  ];
  const report = computeSavings(detectRedundantPairs(tools), 3);
  expect(report.totalMonthlySavings).toBe(57); // 3 seats × $19 (cheapest pair member)
});
```

This test runs in under 10ms with no database, no network, and no Next.js runtime. Vitest is chosen over Jest because it shares the same module resolution configuration as the application's `tsconfig.json` — path aliases like `@/lib/*` resolve identically in tests and in production, eliminating a class of test-environment-only bugs.

**Type safety as a correctness guarantee.** The engine's input and output types are defined in `types/audit.ts` and shared across the entire application. The database schema's inferred Drizzle types, the engine's function signatures, and the React component props all reference the same TypeScript interfaces. A change to the tool data structure that is not reflected in the engine's type signature produces a compile-time error — the type system enforces the contract before any test is run or any code is deployed.

### The Redundancy Graph

Tool overlap detection is not a fuzzy LLM decision — it is a deterministic lookup against a hand-curated adjacency list keyed by tool category. Tools in the same category are considered potential redundancies; the engine surfaces the lower-cost tool as the recommended keep and treats the higher-cost tool as the cut candidate. This explicit, auditable approach means that the product's core recommendation logic is reviewable in a code review, testable in a unit test, and not subject to LLM hallucination or non-determinism.

---

## 4. Resilience & External APIs

### File: `app/api/summary/route.ts`

The Anthropic API enriches an already-complete savings report with a qualitative, plain-language recommendations summary. It is an **additive enhancement** — not a prerequisite for the core user experience. The architecture enforces this hierarchy at the API boundary.

### Fault-Tolerant Design: The 200-Always Contract

```typescript
// app/api/summary/route.ts

export async function POST(req: Request) {
  const { tools, monthlySavings } = await req.json();

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: buildPrompt(tools, monthlySavings),
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") throw new Error("Unexpected response type");

    return Response.json({ summary: content.text });

  } catch (err) {
    // Fault isolation boundary: upstream failure does not propagate to client
    const formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(monthlySavings);

    return Response.json({
      summary: `Based on your selections, you could save approximately ${formatted} per month by consolidating your AI toolchain. Review the redundant pairs above for specific recommendations.`,
    });
  }
}
```

The `try/catch` block here is not defensive boilerplate — it is an explicit architectural decision with a documented rationale:

**Why `200 OK` instead of propagating the error?**  
A `500 Internal Server Error` response from this endpoint would require the client to implement an error state, a retry mechanism, a fallback UI, and graceful degradation logic. Every one of those client-side branches is a surface for inconsistency and a source of layout shift. More critically, it would mean that an Anthropic rate limit event — which is an operational concern of the AI enrichment layer — would visually degrade a core product feature (the savings report) for the end user.

The fallback string is not a generic error message. It is constructed using `Intl.NumberFormat` against the `monthlySavings` value from the request body — a value that was computed deterministically by the math engine before the API call was made. The fallback therefore carries the same numerical accuracy as the successful response path; only the qualitative prose is reduced in specificity. The frontend's data contract is unconditional: it always receives `{ summary: string }`, never an error shape. This eliminates the client-side error state entirely.

**Timeout and retry posture**  
The Anthropic SDK is called with the default timeout. A future hardening pass should configure an explicit `timeout` option on the client instantiation (e.g., `8000ms`) to prevent edge function time-limit exhaustion on slow Anthropic responses, and add structured logging on the `catch` branch to surface rate limit frequency in observability tooling.

---

## 5. The Viral Loop & Dynamic Routing

### File: `app/audit/[token]/page.tsx`

The public shareable report is a dynamic route rendered as a **React Server Component**. Its architecture addresses three concurrent concerns: security (untrusted token input), performance (server-rendered open graph metadata for social crawlers), and user experience (zero-loading-state initial render).

### Input Validation: Regex Pre-screening Before ORM

The `[token]` path segment is user-controlled input originating from an external URL — it must be treated as untrusted. While Drizzle ORM parameterizes all queries and is itself safe against SQL injection by construction, relying on ORM parameterization as the sole validation layer is insufficient for production systems. A deeply malformed token string can trigger unexpected behavior in middleware, logging pipelines, or any string processing that occurs before the query is built.

The route therefore applies a regex guard at the top of the Server Component, before any database interaction:

```typescript
// app/audit/[token]/page.tsx

const TOKEN_REGEX = /^[A-Za-z0-9_-]{10,}$/;

export default async function AuditPage({
  params,
}: {
  params: { token: string };
}) {
  if (!TOKEN_REGEX.test(params.token)) {
    notFound(); // Next.js 404 — no DB call made
  }

  const audit = await db.query.audits.findFirst({
    where: eq(audits.token, params.token),
  });

  if (!audit) notFound();

  // ... render
}
```

The regex `^[A-Za-z0-9_-]{10,}$` is an allowlist, not a denylist. It passes alphanumeric characters, hyphens, and underscores of minimum length 10 — the character set of a URL-safe token generated by `nanoid`. Any input outside this set — including SQL metacharacters (`'`, `"`, `;`, `--`), path traversal sequences (`../`), and null bytes — is rejected with an immediate `notFound()` call. The database is never reached. This provides defense-in-depth: the ORM's parameterization handles SQL-layer safety, and the regex handles upstream string-handling safety.

The minimum length of 10 also provides probabilistic brute-force resistance: a nanoid alphabet of 64 characters at length 10 yields `64^10 ≈ 1.15 × 10^18` possible tokens. At 1,000 guesses per second, exhaustive enumeration would take approximately 36 million years.

### React Server Components for Open Graph Metadata

Social sharing is a primary growth mechanic. When a user shares their report URL on Twitter/X or LinkedIn, the platform's link crawler fetches the URL to render a preview card. That crawler is not a browser — it does not execute JavaScript. Any metadata generated client-side is invisible to it.

Because `app/audit/[token]/page.tsx` is a Server Component, Next.js allows it to export a dynamic `generateMetadata` function that runs on the server, fetches the audit record, and injects fully personalized Open Graph tags into the `<head>` of the server-rendered HTML:

```typescript
export async function generateMetadata({
  params,
}: {
  params: { token: string };
}): Promise<Metadata> {
  if (!TOKEN_REGEX.test(params.token)) return {};

  const audit = await db.query.audits.findFirst({
    where: eq(audits.token, params.token),
  });

  if (!audit) return {};

  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(audit.monthlySavings));

  return {
    title: `I'm saving ${formatted}/month by cutting redundant AI tools`,
    description:
      "AI Spend Auditor found the overlap in my developer toolchain. Run your free audit.",
    openGraph: {
      title: `I'm saving ${formatted}/month on AI tools`,
      description: "Find out what your stack is costing you. Free audit in 60 seconds.",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `I'm saving ${formatted}/month on AI tools`,
    },
  };
}
```

The database query in `generateMetadata` and the database query in the page component itself are deduplicated by React's built-in `cache()` primitive — a single DB round-trip serves both. The resulting HTML delivered to the social crawler contains a personalized savings figure in every `og:title` and `twitter:title` tag, maximizing click-through rate on shared links without any client-side rendering.

This is the closed loop of the viral architecture: a user generates a report → shares a URL → the server renders a personalized OG card with their savings figure → a follower clicks → they land on the read-only report with a prominent email-gate CTA → they submit their email and enter the funnel.

---

## Appendix: Key Dependency Rationale

| Dependency | Chosen | Considered Alternatives | Rationale |
|---|---|---|---|
| ORM | Drizzle | Prisma, Kysely | Drizzle's schema-as-code approach generates zero abstraction overhead at query time; inferred TypeScript types without a code-generation step |
| Database | Neon Serverless Postgres | PlanetScale, Supabase | WebSocket driver is edge-compatible without additional adapter; branching-native for staging environments |
| AI SDK | Anthropic SDK | OpenAI SDK, Vercel AI SDK | Direct SDK keeps the integration surface minimal; no streaming required for this use case |
| Test Runner | Vitest | Jest | Shares Vite/tsconfig module resolution; path aliases work identically in test and production contexts |
| Auth (future) | Clerk | NextAuth, Auth.js | Fully managed; handles email magic links for report ownership without custom session infrastructure |

---

*This document reflects the system design as of the current version. Architectural decisions should be revisited as traffic patterns, team size, and feature scope evolve.*
