@AGENTS.md
# AI Pair Programming Log

This project was built utilizing Claude 3.5 Sonnet as a strategic pair-programmer. To ensure code quality and prevent technical debt, AI was utilized within strict, predefined boundaries.

## How AI Was Leveraged
1. **Boilerplate & Scaffolding:** Claude was used to generate repetitive Tailwind CSS layouts (e.g., the glassmorphic Lead Gate modal) and basic Next.js page routing structures.
2. **Schema Generation:** Provided with a strict text-based description of the database relationships, Claude generated the Drizzle ORM schema syntax.
3. **Drafting Strategy Docs:** Claude generated the structural skeletons for the GTM and unit economics documents, which were then manually refined with the specific product data.

## Where AI Was Strictly Excluded
1. **The Math Engine (`lib/auditEngine.ts`):** LLMs struggle with deterministic logic. The core financial calculation engine and its specific redundancy rules were written and verified manually.
2. **Architecture Decisions:** The decision to use Neon serverless pools, to decouple the math engine, and to use JSONB snapshots for immutable database payloads were human-led architectural choices. AI was simply instructed to execute those specific design patterns.