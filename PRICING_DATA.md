# AI Tool Pricing Data

Reference sheet for the AI Spend Auditor.  
All prices are **per user / per month** (billed monthly unless noted).  
Replace placeholder values and verify URLs before shipping to production.

---

## 1. Cursor

| Tier       | Price / User / Mo | Notes                          |
| ---------- | ----------------: | ------------------------------ |
| Hobby      | $0.00             | Free tier, limited completions |
| Pro        | $20.00            | Unlimited completions          |
| Business   | $40.00            | Team management + SSO          |
| Enterprise | TBD               | Custom quote — contact sales   |

**Source:** [https://www.cursor.com/pricing](https://www.cursor.com/pricing) ← _verify link_  
**Verified:** 2026-05-21

---

## 2. GitHub Copilot

| Tier             | Price / User / Mo | Notes                                  |
| ---------------- | ----------------: | -------------------------------------- |
| Individual       | $10.00            | Billed monthly; $100/yr if annual      |
| Business         | $19.00            | Policy controls, audit logs            |
| Enterprise       | $39.00            | Fine-tuning on private repos, SAML SSO |

**Source:** [https://github.com/features/copilot#pricing](https://github.com/features/copilot#pricing) ← _verify link_  
**Verified:** 2026-05-21

---

## 3. Claude (Anthropic)

| Tier       | Price / User / Mo | Notes                                      |
| ---------- | ----------------: | ------------------------------------------ |
| Free       | $0.00             | Limited messages on Claude.ai              |
| Pro        | $20.00            | 5× more usage, priority access             |
| Team       | $30.00            | Collaborative workspace, central billing   |
| Enterprise | TBD               | Custom usage limits + custom pricing       |

> **Note:** API usage (Anthropic API) is billed separately per token — see `Anthropic API` section below.

**Source:** [https://www.anthropic.com/pricing](https://www.anthropic.com/pricing) ← _verify link_  
**Verified:** 2026-05-21

---

## 4. ChatGPT (OpenAI)

| Tier       | Price / User / Mo | Notes                                        |
| ---------- | ----------------: | -------------------------------------------- |
| Free       | $0.00             | GPT-4o with limits                           |
| Plus       | $20.00            | Higher limits, DALL·E, advanced voice mode   |
| Pro        | $200.00           | Unlimited o1 access, extended thinking       |
| Team       | $30.00            | Workspace admin, data excluded from training |
| Enterprise | TBD               | Custom pricing, SAML SSO, advanced security  |

> **Note:** OpenAI API usage is billed separately per token — see `OpenAI API` section in the app's tool list.

**Source:** [https://openai.com/chatgpt/pricing](https://openai.com/chatgpt/pricing) ← _verify link_  
**Verified:** 2026-05-21

---

## 5. Gemini (Google)

| Tier            | Price / User / Mo | Notes                                          |
| --------------- | ----------------: | ---------------------------------------------- |
| Gemini Free     | $0.00             | Access to Gemini 1.5 Flash with limits         |
| Gemini Advanced | $21.99            | Gemini 1.5 Pro, 2 TB Drive, included in AI Pro |
| Google AI Pro   | $21.99            | Full Google One AI Premium bundle              |
| Workspace (Business Standard + AI) | $22.00 | Per-seat add-on, varies by Workspace plan |
| Enterprise      | TBD               | Contact Google Cloud Sales                     |

**Source:** [https://gemini.google.com/advanced](https://gemini.google.com/advanced) ← _verify link_  
**Verified:** 2026-05-21

---

## Appendix — API-Only Pricing Placeholders

These tools appear in the auditor's dropdown as API products billed by consumption, not per seat.  
Add actual token rates once confirmed.

### Anthropic API

| Model            | Input (per 1M tokens) | Output (per 1M tokens) |
| ---------------- | --------------------: | ---------------------: |
| Claude Haiku 3.5 | $0.80                 | $4.00                  |
| Claude Sonnet 4  | $3.00                 | $15.00                 |
| Claude Opus 4    | TBD                   | TBD                    |

**Source:** [https://www.anthropic.com/api](https://www.anthropic.com/api) ← _verify link_  
**Verified:** 2026-05-21

---

### OpenAI API

| Model        | Input (per 1M tokens) | Output (per 1M tokens) |
| ------------ | --------------------: | ---------------------: |
| GPT-4o mini  | $0.15                 | $0.60                  |
| GPT-4o       | $2.50                 | $10.00                 |
| o3           | TBD                   | TBD                    |

**Source:** [https://openai.com/api/pricing](https://openai.com/api/pricing) ← _verify link_  
**Verified:** 2026-05-21

---

_Last updated: 2026-05-21 · All prices in USD · Subject to change — always verify against official pricing pages before using in reports._
