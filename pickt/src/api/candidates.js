/**
 * Candidate API routes.
 *
 * All marketplace endpoints query CANDIDATE_PUBLIC only.
 * PII is accessed exclusively through /api/candidates/:id/pii
 * after validating a confirmed CANDIDATE_UNLOCK record.
 */

import { createClient } from "@supabase/supabase-js";
import { encryptPii, decryptPii } from "../lib/encryption.js";
import {
  logProfileViewed,
  logProfileUnlocked,
  logPiiAccessed,
} from "../middleware/auditLog.js";
import { notifyCompany } from "../lib/notifications.js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Helpers ─────────────────────────────────────────────────

async function getCompanyId(userId) {
  const { data } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", userId)
    .single();
  return data?.company_id || null;
}

async function hasConfirmedUnlock(candidatePublicId, companyId) {
  const { data } = await supabase
    .from("candidate_unlock")
    .select("id, session_token, session_expires_at")
    .eq("candidate_public_id", candidatePublicId)
    .eq("company_id", companyId)
    .eq("status", "confirmed")
    .single();
  return data || null;
}

// ── GET /api/candidates — marketplace listing ───────────────

export async function listCandidates(req) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");
  const status = searchParams.get("status") || "listed";
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  let q = supabase
    .from("candidate_public")
    .select(
      `id, role_applied_for, seniority_level, location_city,
       current_company_name, skills, interview_stage_reached,
       interview_count, reason_not_hired, feedback_summary,
       strengths, gaps, status, salary_band_low, salary_band_high,
       years_experience, work_history, top_skills, referred_at,
       availability_status, parse_confidence_score, created_at`,
      { count: "exact" }
    )
    .eq("status", status)
    .order("referred_at", { ascending: false })
    .range(offset, offset + limit - 1);

  // Full-text search
  if (query) {
    q = q.textSearch("search_vector", query, { type: "websearch" });
  }

  const { data, count, error } = await q;

  if (error) {
    return { status: 500, body: { error: error.message } };
  }

  return {
    status: 200,
    body: { candidates: data, total: count },
  };
}

// ── GET /api/candidates/:id — single public profile ─────────

export async function getCandidate(req, { id }) {
  const { data, error } = await supabase
    .from("candidate_public")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return { status: 404, body: { error: "Candidate not found" } };
  }

  // Strip search_vector from response (internal field)
  const { search_vector: _, ...candidate } = data;

  // Fetch engagement stats (materialised view, best-effort)
  const { data: stats } = await supabase
    .from("candidate_engagement_stats")
    .select("views_this_week, views_total, saves_count, reviewing_count, unlock_count, days_since_last_unlock, is_popular")
    .eq("candidate_id", id)
    .single();

  // Fetch referrer reputation
  const { data: referrerCompany } = await supabase
    .from("companies")
    .select("name")
    .eq("id", data.uploaded_by_company_id)
    .single();

  let referrerRep = null;
  if (referrerCompany) {
    // Count placements by this referring company
    const { count: placementCount } = await supabase
      .from("placement")
      .select("id", { count: "exact", head: true })
      .in("candidate_public_id",
        (await supabase
          .from("candidate_public")
          .select("id")
          .eq("uploaded_by_company_id", data.uploaded_by_company_id)
        ).data?.map((c) => c.id) || []
      );

    const count = placementCount || 0;
    referrerRep = {
      name: referrerCompany.name,
      rep_score: Math.min(5.0, (3.5 + count * 0.2)).toFixed(1),
      placement_count: count,
    };
  }

  // Audit: profile viewed
  logProfileViewed(id, req);

  return {
    status: 200,
    body: {
      candidate,
      engagement: stats || {
        views_this_week: 0, views_total: 0, saves_count: 0,
        reviewing_count: 0, unlock_count: 0, days_since_last_unlock: null,
        is_popular: false,
      },
      referrer: referrerRep,
    },
  };
}

// ── GET /api/candidates/:id/pii — encrypted PII (post-unlock) ─

export async function getCandidatePii(req, { id, userId }) {
  const companyId = await getCompanyId(userId);
  if (!companyId) {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  // Validate confirmed unlock exists
  const unlock = await hasConfirmedUnlock(id, companyId);
  if (!unlock) {
    return { status: 403, body: { error: "Profile not unlocked" } };
  }

  // Check session expiry
  if (
    unlock.session_expires_at &&
    new Date(unlock.session_expires_at) < new Date()
  ) {
    return {
      status: 403,
      body: { error: "Unlock session expired. Please re-authenticate." },
    };
  }

  // Fetch PII using service role (bypasses RLS deny-all policy)
  const { data: piiRow, error } = await supabase
    .from("candidate_pii")
    .select("*")
    .eq("candidate_public_id", id)
    .single();

  if (error || !piiRow) {
    return { status: 404, body: { error: "PII record not found" } };
  }

  // Decrypt PII server-side
  const decrypted = decryptPii(piiRow);

  // Audit: PII accessed
  logPiiAccessed(id, req, { unlock_id: unlock.id });

  return {
    status: 200,
    body: {
      pii: {
        full_name: decrypted.full_name,
        email: decrypted.email,
        phone: decrypted.phone,
        linkedin_url: decrypted.linkedin_url,
        // full_cv_text and cv_parsed_json NOT returned here —
        // use /api/candidates/:id/cv for CV access
      },
      unlock_id: unlock.id,
    },
  };
}

// ── POST /api/candidates/:id/unlock — create unlock record ──

export async function unlockCandidate(req, { id, userId }) {
  const companyId = await getCompanyId(userId);
  if (!companyId) {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  // Check candidate exists
  const { data: candidate } = await supabase
    .from("candidate_public")
    .select("id, uploaded_by_company_id")
    .eq("id", id)
    .single();

  if (!candidate) {
    return { status: 404, body: { error: "Candidate not found" } };
  }

  // Can't unlock your own candidate
  if (candidate.uploaded_by_company_id === companyId) {
    return {
      status: 400,
      body: { error: "Cannot unlock your own candidate" },
    };
  }

  // Create unlock record (upsert — idempotent)
  const { data: unlock, error } = await supabase
    .from("candidate_unlock")
    .upsert(
      {
        candidate_public_id: id,
        company_id: companyId,
        user_id: userId,
        status: "confirmed",
        unlocked_at: new Date().toISOString(),
      },
      { onConflict: "candidate_public_id,company_id" }
    )
    .select("id, session_token, session_expires_at")
    .single();

  if (error) {
    return { status: 500, body: { error: error.message } };
  }

  // Audit: profile unlocked
  logProfileUnlocked(id, req, { unlock_id: unlock.id });

  // Notify referring company
  const { data: candidateFull } = await supabase
    .from("candidate_public")
    .select("role_applied_for, uploaded_by_company_id")
    .eq("id", id)
    .single();

  if (candidateFull) {
    notifyCompany(candidateFull.uploaded_by_company_id, "candidate_unlocked", {
      title: "A candidate you referred was unlocked",
      body: `Your ${candidateFull.role_applied_for} candidate has been unlocked by a hiring company.`,
      actionUrl: `/candidates/${id}`,
      actionLabel: "View candidate",
      candidateRole: candidateFull.role_applied_for,
    });
  }

  return {
    status: 201,
    body: {
      unlock_id: unlock.id,
      session_token: unlock.session_token,
      session_expires_at: unlock.session_expires_at,
    },
  };
}

// ── POST /api/candidates — create new candidate (referral) ──

export async function createCandidate(req, { userId }) {
  const companyId = await getCompanyId(userId);
  if (!companyId) {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  const body = await req.json();
  const { publicData, piiData } = body;

  if (!publicData?.role_applied_for || !piiData?.full_name || !piiData?.email) {
    return {
      status: 400,
      body: { error: "Missing required fields: role_applied_for, full_name, email" },
    };
  }

  // 1. Insert public record
  const { data: candidate, error: pubError } = await supabase
    .from("candidate_public")
    .insert({
      uploaded_by_company_id: companyId,
      role_applied_for: publicData.role_applied_for,
      seniority_level: publicData.seniority_level || "Mid-level",
      location_city: publicData.location_city,
      current_company_name: publicData.current_company_name,
      skills: publicData.skills || [],
      interview_stage_reached: publicData.interview_stage_reached,
      interview_count: publicData.interview_count || 0,
      reason_not_hired: publicData.reason_not_hired,
      feedback_summary: publicData.feedback_summary,
      strengths: publicData.strengths,
      gaps: publicData.gaps,
      salary_band_low: publicData.salary_band_low,
      salary_band_high: publicData.salary_band_high,
      years_experience: publicData.years_experience,
      work_history: publicData.work_history,
      top_skills: publicData.top_skills,
    })
    .select("id")
    .single();

  if (pubError) {
    return { status: 500, body: { error: pubError.message } };
  }

  // 2. Encrypt and insert PII
  const encrypted = encryptPii({
    full_name: piiData.full_name,
    email: piiData.email,
    phone: piiData.phone || null,
    linkedin_url: piiData.linkedin_url || null,
    full_cv_text: piiData.full_cv_text || "",
    cv_parsed_json: piiData.cv_parsed_json || null,
  });

  const { error: piiError } = await supabase
    .from("candidate_pii")
    .insert({
      candidate_public_id: candidate.id,
      ...encrypted,
      encryption_key_version: 1,
    });

  if (piiError) {
    // Rollback public record on PII failure
    await supabase.from("candidate_public").delete().eq("id", candidate.id);
    return { status: 500, body: { error: "Failed to store candidate PII" } };
  }

  return {
    status: 201,
    body: { id: candidate.id },
  };
}
