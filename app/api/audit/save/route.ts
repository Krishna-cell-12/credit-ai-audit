import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db } from "@/db";
import { leads, audits } from "@/db/schema";
import type { AuditState, ToolSpend } from "@/types";

// ---------------------------------------------------------------------------
// Request / Response contract types
// ---------------------------------------------------------------------------

/** Calculated metric totals produced by the client-side audit engine. */
interface AuditMetrics {
  totalCurrentSpend: number;
  totalMonthlySavings: number;
  totalAnnualSavings: number;
}

interface SaveAuditRequestBody {
  name: string;
  email: string;
  company?: string;
  /** Full wizard state: teamSize, primaryUseCase, tools[] */
  auditState: AuditState;
  /** Pre-calculated summary figures from the client engine. */
  metrics: AuditMetrics;
}

interface SaveAuditSuccessResponse {
  auditId: string;
  shareToken: string;
}

interface SaveAuditErrorResponse {
  error: string;
  code: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generates a URL-safe, cryptographically random share token.
 * 18 raw bytes → 24 base64url chars — short enough for a URL segment,
 * with ~144 bits of entropy (astronomically collision-resistant).
 */
function generateShareToken(): string {
  return randomBytes(18).toString("base64url");
}

/**
 * Validates that every required field is present and has the correct shape.
 * Returns a human-readable error string on failure, or null on success.
 */
function validateBody(body: unknown): body is SaveAuditRequestBody {
  if (!body || typeof body !== "object") return false;

  const b = body as Record<string, unknown>;

  if (typeof b.name !== "string" || b.name.trim() === "") return false;
  if (typeof b.email !== "string" || !b.email.includes("@")) return false;
  if (b.company !== undefined && typeof b.company !== "string") return false;

  // auditState
  const s = b.auditState as Record<string, unknown> | undefined;
  if (!s || typeof s !== "object") return false;
  if (typeof s.teamSize !== "number" || s.teamSize < 1) return false;
  if (typeof s.primaryUseCase !== "string") return false;
  if (!Array.isArray(s.tools)) return false;

  // metrics
  const m = b.metrics as Record<string, unknown> | undefined;
  if (!m || typeof m !== "object") return false;
  if (typeof m.totalCurrentSpend !== "number") return false;
  if (typeof m.totalMonthlySavings !== "number") return false;
  if (typeof m.totalAnnualSavings !== "number") return false;

  return true;
}

// ---------------------------------------------------------------------------
// POST /api/audit/save
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest
): Promise<NextResponse<SaveAuditSuccessResponse | SaveAuditErrorResponse>> {
  // ── 1. Parse & validate the incoming payload ────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON.", code: "INVALID_JSON" },
      { status: 400 }
    );
  }

  if (!validateBody(body)) {
    return NextResponse.json(
      {
        error:
          "Missing or malformed fields. Required: name, email, auditState (teamSize, primaryUseCase, tools[]), metrics (totalCurrentSpend, totalMonthlySavings, totalAnnualSavings).",
        code: "VALIDATION_ERROR",
      },
      { status: 422 }
    );
  }

  const { name, email, company, auditState, metrics } = body;

  // ── 2. Execute the transactional write ──────────────────────────────────
  let auditId: string;
  let shareToken: string;

  try {
    const result = await db.transaction(async (tx) => {
      // ── 2a. Upsert lead ───────────────────────────────────────────────
      // Check for an existing lead by email first to preserve the original
      // createdAt and avoid a pointless write on return visits.
      const existingLeads = await tx
        .select({ id: leads.id })
        .from(leads)
        .where(eq(leads.email, email.toLowerCase().trim()))
        .limit(1);

      let leadId: string;

      if (existingLeads.length > 0) {
        leadId = existingLeads[0].id;
      } else {
        const inserted = await tx
          .insert(leads)
          .values({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            company: company?.trim() || null,
          })
          .returning({ id: leads.id });

        if (inserted.length === 0) {
          throw new Error("Lead insert returned no rows — DB may be unhealthy.");
        }

        leadId = inserted[0].id;
      }

      // ── 2b. Generate unique share token (collision retry loop) ────────
      // Probability of a collision with 18 bytes of entropy is negligible,
      // but we guard against it anyway to satisfy the UNIQUE constraint.
      let token: string = "";
      const MAX_TOKEN_ATTEMPTS = 3;

      for (let attempt = 0; attempt < MAX_TOKEN_ATTEMPTS; attempt++) {
        token = generateShareToken();

        const collision = await tx
          .select({ id: audits.id })
          .from(audits)
          .where(eq(audits.shareToken, token))
          .limit(1);

        if (collision.length === 0) break;

        if (attempt === MAX_TOKEN_ATTEMPTS - 1) {
          throw new Error(
            "Could not generate a unique share token after multiple attempts."
          );
        }
      }

      // ── 2c. Insert audit record ───────────────────────────────────────
      // toolsData stores the full ToolSpend[] array as JSONB for auditability.
      const toolsSnapshot: ToolSpend[] = auditState.tools;

      const insertedAudit = await tx
        .insert(audits)
        .values({
          leadId,
          totalCurrentSpend: metrics.totalCurrentSpend.toFixed(2),
          totalMonthlySavings: metrics.totalMonthlySavings.toFixed(2),
          totalAnnualSavings: metrics.totalAnnualSavings.toFixed(2),
          primaryUseCase: auditState.primaryUseCase,
          toolsData: toolsSnapshot,
          shareToken: token,
        })
        .returning({ id: audits.id, shareToken: audits.shareToken });

      if (insertedAudit.length === 0) {
        throw new Error("Audit insert returned no rows — DB may be unhealthy.");
      }

      return {
        auditId: insertedAudit[0].id,
        shareToken: insertedAudit[0].shareToken,
      };
    });

    auditId = result.auditId;
    shareToken = result.shareToken;
  } catch (err) {
    // ── Connection / constraint error recovery ────────────────────────────
    const isDbError =
      err instanceof Error &&
      (err.message.includes("connect") ||
        err.message.includes("connection") ||
        err.message.includes("ECONNREFUSED") ||
        err.message.includes("timeout"));

    if (isDbError) {
      console.error("[audit/save] Database connection error:", {
        message: (err as Error).message,
        timestamp: new Date().toISOString(),
        email,
      });

      return NextResponse.json(
        {
          error:
            "A database connection error occurred. Please retry in a moment.",
          code: "DB_CONNECTION_ERROR",
        },
        { status: 503 }
      );
    }

    console.error("[audit/save] Transaction failed:", {
      message: err instanceof Error ? err.message : String(err),
      timestamp: new Date().toISOString(),
      email,
    });

    return NextResponse.json(
      {
        error: "Failed to persist audit results. Please try again.",
        code: "TRANSACTION_ERROR",
      },
      { status: 500 }
    );
  }

  // ── 3. Return 201 Created with the new resource identifiers ─────────────
  return NextResponse.json<SaveAuditSuccessResponse>(
    { auditId, shareToken },
    { status: 201 }
  );
}
