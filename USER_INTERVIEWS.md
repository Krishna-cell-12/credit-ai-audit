# User Discovery Interviews

**Objective:** Validate assumptions regarding how developers currently track and manage their AI tool subscriptions, and identify friction points in cross-vendor redundancies.

---

## Interview 1: Arihant
* **Profile:** Engineering Student / Developer
* **Current AI Stack:** ChatGPT Plus, GitHub Copilot, Vercel Pro
* **Key Quotes:** * *"I honestly forget I'm paying for Copilot until the $10 hits my account. I don't even track it in a spreadsheet, it's just a background tax at this point."*
  * *"If I found out my stack was cheaper or more optimized than my friend's, I'd definitely flex that in our group chat."*
* **Surprising Insight:** The emotional driver isn't just saving money; it's the "gamification" of having a perfectly optimized, leaner stack than their peers.

## Interview 2: Varun
* **Profile:** Engineering Student / Developer
* **Current AI Stack:** Cursor Pro, GitHub Copilot, Claude Pro
* **Key Quotes:** * *"I bought Cursor Pro because everyone on Twitter said it was the best, but I left my Copilot active because I thought I still needed it for the background IDE integration. Am I paying twice for the same thing?"*
* **Surprising Insight:** Developers often don't fully understand the underlying architecture of the wrappers they buy. The assumption that Cursor and Copilot are complementary, rather than strictly redundant, is a widespread misconception.

## Interview 3: Sarika
* **Profile:** Engineering Student / Developer
* **Current AI Stack:** ChatGPT Team, Midjourney
* **Key Quotes:** * *"I upgraded to the Team tier on ChatGPT because I thought it gave me higher message limits for coding. It's just me using it, but I think I'm paying for two seats automatically?"*
* **Surprising Insight:** SaaS tier naming (Pro vs. Team vs. Business) is highly misleading for solo developers or indie hackers, leading to accidental seat over-provisioning.

---

## Synthesis: What This Changed About My Design
* **The "Cursor vs. Copilot" Hard Rule:** Varun's feedback directly validated the need for aggressive redundancy flagging. I hardcoded a deterministic rule in `lib/auditEngine.ts` that if a user inputs both Cursor and Copilot, the engine flags a 100% redundancy and recommends dropping Copilot.
* **The Seat Over-Allocation Logic:** Sarika's situation proved that users often buy "Team" plans for solo use. I built a specific rule in the math engine: if `teamSize === 1` but the plan type is 'Team/Business', the engine calculates the exact dollar difference to downgrade them to a standard 'Pro' tier.
* **The Viral Share Architecture:** Arihant's desire to "flex" his optimized stack to his peers directly inspired the Day 5 feature: the tokenized, read-only public Server Component route (`app/audit/[token]/page.tsx`). By adding a shareable link, we converted a single-player utility into a viral acquisition loop.