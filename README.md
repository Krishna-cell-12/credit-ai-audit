# AI Spend Auditor

> **Stop paying for your AI tools twice.**

AI Spend Auditor is a full-stack SaaS application that connects to a developer's AI toolchain, runs a deterministic overlap analysis to surface wasted monthly spend, and delivers a personalized savings report — gated behind an email capture that feeds a viral, share-link growth loop. Built as a production-grade Next.js 15 App Router application with a Neon Serverless Postgres backend.

---

## Tech Stack

- **Framework:** [Next.js 15](https://nextjs.org/) (App Router, React Server Components, Server Actions)
- **Language:** [TypeScript](https://www.typescriptlang.org/) — strict mode throughout
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) with a custom design system
- **Database:** [Neon Serverless Postgres](https://neon.tech/) — edge-compatible, branching-native
- **ORM:** [Drizzle ORM](https://orm.drizzle.team/) — type-safe schema, zero-overhead query builder
- **AI Layer:** [Anthropic SDK](https://docs.anthropic.com/) (`claude-sonnet`) for contextual savings recommendations
- **Runtime:** Node.js 20 / Vercel Edge-compatible API routes

---

## Core Features & Business Logic

### 🔬 Deterministic Math Engine
The savings calculation is intentionally **not** delegated to an LLM. A pure TypeScript function ingests the user's declared tool stack and team size, cross-references a versioned internal pricing registry, and computes per-seat monthly costs. Overlap pairs (e.g., Cursor + GitHub Copilot, ChatGPT + Claude Pro) are identified by a predefined redundancy graph, and the wasted spend is calculated arithmetically — deterministically reproducible every time against the same inputs. The Anthropic API is called *after* the math is complete, enriching the report with qualitative recommendations rather than generating the numbers themselves.

### 📧 Lead Capture Gate
The full savings report is not rendered until the user provides a verified email address. On submission, a Server Action writes the lead record — including the JSONB payload of the user's tool selections — atomically to Neon Postgres before the report page is revealed. This ensures zero leads are lost to client-side rendering failures and gives us a complete, queryable audit trail of every session.

### 🔗 Viral Share Loop
Every generated report is assigned a unique, stable public URL (`/report/[id]`). The report UI surfaces a pre-composed share card with the user's computed savings figure, designed for one-click sharing to Twitter/X and LinkedIn. Inbound visitors arriving via a share link land on a read-only version of the report with a prominent CTA that drives them into the same email-gate funnel — completing the acquisition loop.

---

## Key Architectural Decisions

### The 200-Always API Guarantee

The Anthropic recommendation endpoint (`POST /api/analyze`) is wrapped in a top-level `try/catch` that intercepts every possible failure mode — rate limit exhaustion (`429`), upstream timeouts, and malformed SDK responses alike. On any caught exception, the route does **not** propagate a 4xx or 5xx status to the client. Instead, it immediately constructs a graceful fallback string using `Intl.NumberFormat` to format the pre-computed savings figure from the request body, and returns it as a valid `200 OK` JSON response indistinguishable in shape from a successful AI call. The frontend's data contract is therefore unconditional: it always receives a renderable recommendation string, never an error state. This eliminates an entire class of loading/error UI complexity on the client and ensures the report is never blocked by third-party API instability.

### Hydration-Safe Viral Loop

The shareable report URL is an absolute URL — it must include the protocol and hostname to be useful in a share card or a clipboard copy. Generating it naively with `window.location.href` would cause a React hydration mismatch: the Server-Side Rendered HTML would contain an empty or mismatched string while the client's `window` object resolves the real origin. To prevent this, the share link component guards its URL construction behind a `typeof window !== 'undefined'` check, ensuring the absolute URL string is only computed and injected during the client-side hydration pass. The SSR pass renders a skeleton placeholder for the link slot, which is atomically replaced on mount — zero hydration warnings, zero flicker, and a valid URL in every browser environment including those behind custom domains or Vercel preview deployments.

### Database Payload Immutability

When a user's audit is persisted to Neon Postgres, the exact array of selected tool objects — including their names, categories, per-seat prices, and seat counts as they existed *at the time of submission* — is stored verbatim as a `jsonb` column snapshot alongside the computed `monthlySavings` figure. This is a deliberate immutability contract: the stored record reflects the precise state of the world when the audit ran, not a normalized foreign-key reference into a live pricing table. The practical consequence is that if the internal pricing registry is updated six months from now (a tool raises its price, a tier is discontinued), every historical audit report continues to reconstruct and display the mathematically correct figure it showed on the day it was generated. The database is the source of truth for *what was calculated*, not a pointer to *what the calculation would be today*.

### Zero-Migration Reconstructions

The public report page (`/report/[id]`) is a React Server Component that fetches the stored audit record and re-derives display values server-side before rendering. Critically, `teamSize` is not stored as an explicit column. Rather than adding a new field to the schema — which would require a migration and would leave all pre-migration records with a `null` gap — `teamSize` is reconstructed at query time by computing `max(seats)` across the tool objects in the stored JSONB payload using a Drizzle-native JSON path expression. This produces the same integer the math engine used at calculation time, allowing the server component to fully reconstruct the engine's output and verify the displayed savings figure without touching the database schema. The pattern generalizes: derived display values that can be computed from the immutable snapshot are never stored redundantly, keeping the schema minimal and migration-free.

---

## Local Setup

**Prerequisites:** Node.js ≥ 20, a [Neon](https://neon.tech) database, and an [Anthropic](https://console.anthropic.com) API key.

**1. Clone and install dependencies**
```bash
git clone https://github.com/your-username/ai-spend-auditor.git
cd ai-spend-auditor
npm install
```

**2. Configure environment variables**

Copy the example env file and populate it with your credentials (see [Environment Variables](#environment-variables) below):
```bash
cp .env.example .env.local
```

**3. Push the database schema**

Drizzle will introspect your schema and apply it directly to your Neon database — no migration files required:
```bash
npx drizzle-kit push
```

**4. Start the development server**
```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

The application requires the following environment variables. Set these in `.env.local` for local development or in your deployment platform's secrets manager for production.

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | Neon Serverless Postgres connection string (pooled endpoint recommended) | `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require` |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude recommendations (`sk-ant-...` prefix) | `sk-ant-api03-...` |

> **Security note:** Never commit `.env.local` to version control. The `.gitignore` generated by `create-next-app` excludes it by default. Rotate your `ANTHROPIC_API_KEY` immediately if it is ever exposed in a public commit.

---

## Project Structure

```
.
├── app/
│   ├── api/
│   │   └── analyze/        # Anthropic route — 200-Always guarantee
│   ├── report/
│   │   └── [id]/           # Public RSC — Zero-migration reconstruction
│   ├── layout.tsx
│   └── page.tsx            # Lead gate + math engine entry point
├── components/
│   └── ShareCard.tsx       # Hydration-safe viral share component
├── db/
│   ├── schema.ts           # Drizzle schema — JSONB immutability contract
│   └── index.ts            # Neon serverless client
├── lib/
│   └── engine.ts           # Deterministic savings math engine
├── drizzle.config.ts
└── .env.local              # (gitignored)
```

---

## License

MIT — see [LICENSE](./LICENSE) for details.
