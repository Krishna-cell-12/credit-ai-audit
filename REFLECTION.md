# Project Reflection & Post-Mortem

Building the "AI Spend Auditor" over a compressed timeframe required strict prioritization between engineering purity and product velocity. Here is a reflection on the architectural choices and lessons learned.

## What Went Well
1. **Decoupling the Math Engine:** Extracting `runAudit` into a pure TypeScript function outside the React tree was the best decision of the project. It allowed for deterministic testing via Vitest without needing to mock DOM elements or React state, ensuring our core business logic is bulletproof.
2. **Serverless Database Strategy:** Using Neon with Drizzle ORM was perfectly suited for this Next.js edge-friendly environment. The WebSocket pool handled connections gracefully without the heavy overhead of traditional connection pooling.

## Trade-offs & Technical Debt
1. **Zod Validation:** Currently, the API routes use manual type-guards (e.g., `typeof body.email === 'string'`). In a longer timeframe, I would implement Zod for rigorous, schema-based inbound payload validation.
2. **Rate Limiting:** The `/api/summary` route lacks a Redis-backed rate limiter (like Upstash). While the Anthropic API try/catch fallback prevents the app from crashing, a malicious actor could still spam the route and exhaust the API quota.

## What I Learned
The most profound lesson was the integration of **Product-Led Growth (PLG) mechanics directly into the code**. Building the `shareToken` viral loop wasn't just a UI task; it required careful database schema planning (immutable JSONB snapshots) to ensure the shared link remains historically accurate even if our application's pricing models change in the future.