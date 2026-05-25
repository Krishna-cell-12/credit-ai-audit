# Agentic Architecture (The Executive Summary)

While the core math engine of this application is strictly deterministic (to prevent hallucinated financial advice), we utilize an AI Agent to synthesize the data into a human-readable Executive Summary.

## Implementation Details
* **Route:** `/api/summary/route.ts`
* **Model:** Claude 4.6 Sonnet (via Anthropic SDK)
* **Context Window:** The agent is fed a JSON payload containing the computed `auditState` (Total Savings, Actionable Tools, Redundancy Flags).

## Prompt Engineering Strategy
The system prompt restricts the agent from doing any actual math. Its sole purpose is **narrative generation**.
* **Directive:** *"Act as a fractional CFO. Read the provided JSON metrics. Write a strict, 3-sentence executive summary highlighting the actionable savings. Do not invent numbers. Use a professional, urgent tone."*

## Fallback Mechanism
Because external LLM APIs are inherently prone to latency spikes and rate limits, the agentic route is wrapped in a strict `try/catch` block. If the agent fails to respond within the timeout window, the server returns a templated string injecting the deterministic `$totalSavings` variable, ensuring the frontend UI never experiences a crash.