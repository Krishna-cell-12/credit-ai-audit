# Unit Economics — AI Spend Auditor

> **Version:** 1.0 | **Status:** Hypothetical Model (Pre-Revenue Baseline)  
> **Assumptions:** All figures are modeled estimates based on comparable B2D (Business-to-Developer) SaaS benchmarks. Update with actuals post-launch.

---

## Executive Summary

AI Spend Auditor operates a **viral-first, affiliate-monetized** business model with two distinct acquisition paths — organic/viral (near-zero marginal CAC) and paid acquisition (channel-dependent CAC). The long-term unit economics are underpinned by an affiliate revenue layer, where every tool recommendation is a monetized exit. At scale, this creates a model where **the product pays for itself through the recommendations it makes.**

---

## Part 1 — Customer Acquisition Cost (CAC)

### 1.1 The Viral Loop (Organic CAC)

The core growth mechanism is the **report share loop**: a user generates their audit report → the report contains a watermarked share link → their network clicks through → new users enter the email gate.

**Viral Loop Economics Model:**

| Variable | Value | Notes |
|---|---|---|
| K-Factor (Viral Coefficient) | 0.4 initial → 0.7 target | Each user refers 0.4–0.7 new users organically |
| Avg. visitors from 1 share | ~3.2 | Based on avg. developer Twitter/LinkedIn follower count × click-through rate |
| Share rate (users who share) | 25% | Incentivized by gated full-report feature |
| Email gate conversion (visitor → lead) | 40–55% | High intent; visitors self-selected via shared report |
| **Effective Viral CAC** | **$0.80 – $3.50** | Hosting + infra cost per new lead generated virally |

**Viral CAC Breakdown:**
```
Viral CAC = (Monthly Infrastructure Cost) / (New Leads from Viral Channel)

Scenario A (Month 3, 500 organic leads/month):
  Infra cost: $150/month (Neon DB + Vercel + email)
  Viral leads: 400
  Viral CAC = $150 / 400 = $0.38 per lead

Scenario B (Month 6, 2,000 organic leads/month):
  Infra cost: $400/month (scaled)
  Viral leads: 1,800
  Viral CAC = $400 / 1,800 = $0.22 per lead
```

> **Key Insight:** Viral CAC *decreases* as scale increases — the opposite of paid channels. This is the moat.

---

### 1.2 Paid Acquisition CAC

For phases where we need to accelerate past organic ceiling, we model three paid channels:

| Channel | Avg. CPC/CPM | Lead Conv. Rate | Estimated CAC | Fit Score |
|---|---|---|---|---|
| **Reddit Ads** (r/devtools, r/webdev) | $0.80–$1.20 CPC | 12–18% | **$5–$10** | ★★★★★ |
| **Twitter/X Promoted Posts** | $1.50–$3.00 CPC | 8–14% | **$12–$25** | ★★★★☆ |
| **Google Search** (high-intent keywords) | $3–$8 CPC | 20–30% | **$12–$30** | ★★★☆☆ |
| **Newsletter Sponsorships** (TLDR Tech, ByteByteGo) | $2,000–$5,000 flat | 0.5–1.5% CTR | **$30–$80** | ★★★☆☆ |
| **LinkedIn Ads** (targeting CTOs/EMs) | $8–$15 CPC | 5–10% | **$90–$250** | ★★☆☆☆ |

**Target blended paid CAC:** < $20/lead  
**Acceptable paid CAC ceiling (with LTV model below):** < $75/converted customer

---

### 1.3 Blended CAC Model (Steady State — Month 12)

| Channel Mix | % of New Leads | CAC | Weighted CAC |
|---|---|---|---|
| Viral / Organic Share Loop | 65% | $0.50 | $0.33 |
| SEO / Content | 15% | $2.00 | $0.30 |
| Reddit / Twitter Paid | 12% | $15.00 | $1.80 |
| Influencer / Partnerships | 8% | $8.00 | $0.64 |
| **Blended CAC (Lead)** | | | **~$3.07** |

**Lead → Paid Customer Conversion Rate:** 5–12% (industry benchmark for dev tools with freemium)

```
Blended CAC (Customer) = Blended CAC (Lead) / Conversion Rate
= $3.07 / 0.08 (8% midpoint)
= ~$38 per paying customer
```

---

## Part 2 — Lifetime Value (LTV)

AI Spend Auditor has **two LTV streams** that compound: subscription revenue and affiliate commission revenue.

### 2.1 Subscription LTV

| Tier | Price | Avg. Retention | LTV (Subscription) |
|---|---|---|---|
| Pro (Individual) | $24/month | 14 months | **$336** |
| Team | $149/month | 18 months | **$2,682** |
| Enterprise (future) | $499+/month | 24+ months | **$11,976+** |

**Weighted average subscription LTV (Year 1 cohort mix: 80% Pro, 20% Team):**
```
Weighted Sub LTV = (0.80 × $336) + (0.20 × $2,682)
= $268.80 + $536.40
= ~$805
```

---

### 2.2 Affiliate LTV — The 10% Cut Model

This is the asymmetric upside of the business model.

**How it works:**
1. User audit reveals they should switch from Tool A (keep) + Tool B (redundant) → recommend Tool C (better fit)
2. User clicks the recommendation link (affiliate link to Tool C)
3. If they convert, we earn 10% of Tool C's subscription for as long as they remain a customer

**Affiliate LTV Model:**

| Assumption | Value |
|---|---|
| Avg. AI tool subscription value (our referral target) | $20–$50/month |
| % of audited users who act on at least 1 recommendation | 35% |
| Avg. affiliate commission per converted tool switch | $3–$5/month |
| Avg. affiliate relationship duration | 8–12 months |
| **Affiliate LTV per active user** | **$24–$60** |

```
Conservative Affiliate LTV per Customer:
= 35% action rate × $3.50/month avg. commission × 10 months avg. duration
= 0.35 × $35
= $12.25 per customer (conservative)

Optimistic Affiliate LTV per Customer (at scale, 3+ recommendations acted on):
= 60% action rate × $4.50/month × 10 months
= $27 per customer
```

---

### 2.3 Combined LTV

| Scenario | Sub LTV | Affiliate LTV | **Total LTV** |
|---|---|---|---|
| Conservative | $336 | $12 | **$348** |
| Base Case | $805 | $27 | **$832** |
| Optimistic (Team + high affiliate) | $2,682 | $120 | **$2,802** |

---

## Part 3 — LTV:CAC Ratio & Payback Period

| Scenario | LTV | CAC (Customer) | **LTV:CAC** | Payback Period |
|---|---|---|---|---|
| Conservative | $348 | $38 | **9.2x** | ~1.8 months |
| Base Case | $832 | $38 | **21.9x** | ~0.7 months |
| Optimistic | $2,802 | $38 | **73.7x** | ~0.2 months |

> **Benchmark:** Healthy SaaS targets LTV:CAC > 3x with < 12-month payback.  
> **Our model:** Even the conservative case at **9.2x** is exceptional for a developer tool.

---

## Part 4 — Path to $1M ARR

| Milestone | Customers | Avg. MRR/Customer | MRR | ARR |
|---|---|---|---|---|
| Seed signal | 100 | $24 | $2,400 | $28,800 |
| Early traction | 500 | $28 | $14,000 | $168,000 |
| PMF proof | 1,500 | $32 | $48,000 | $576,000 |
| **$1M ARR** | **~2,600** | **$32** | **$83,300** | **$1,000,000** |

*Note: $1M ARR excludes affiliate revenue, which could contribute an additional 15–30% at scale.*

---

## Key Economic Risks & Mitigants

| Risk | Probability | Impact | Mitigant |
|---|---|---|---|
| Viral K-Factor < 0.3 (loop doesn't compound) | Medium | High | Improve share incentive; add leaderboard/social proof |
| Affiliate programs revoke or cut commissions | Low-Medium | Medium | Diversify across 10+ affiliate partners; negotiate direct deals |
| Tool vendors block API access | Low | High | Use public pricing data + manual input as fallback |
| Churn > 10%/month | Medium | High | Focus on reporting value (monthly spend saves) not one-time audit |

---

*Document Owner: Head of Product / Fractional CMO | Next Review: 90 Days Post-Launch*
