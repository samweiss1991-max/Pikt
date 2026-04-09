/**
 * ATS Import API.
 *
 * POST /api/ats/import — push candidates to connected ATS
 * GET /api/ats/jobs — fetch jobs from connected ATS
 * GET /api/ats/import-csv — generate CSV download
 */

import { createClient } from "@supabase/supabase-js";
import { decryptPii } from "../lib/encryption.js";
import { auditLog } from "../middleware/auditLog.js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getCompanyId(userId) {
  const { data } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", userId)
    .single();
  return data?.company_id || null;
}

// POST /api/ats/import
export async function importToAts(req, { userId }) {
  const companyId = await getCompanyId(userId);
  if (!companyId) return { status: 401, body: { error: "Unauthorized" } };

  const { ats_provider, job_id, candidate_ids } = await req.json();

  if (!ats_provider || !candidate_ids?.length) {
    return { status: 400, body: { error: "ats_provider and candidate_ids required" } };
  }

  // Verify ATS connection
  const { data: atsConfig } = await supabase
    .from("ats_webhook_config")
    .select("id, webhook_secret, status")
    .eq("company_id", companyId)
    .eq("ats_provider", ats_provider)
    .eq("status", "active")
    .single();

  if (!atsConfig) {
    return { status: 400, body: { error: `${ats_provider} is not connected` } };
  }

  // Verify all candidates are unlocked by this company
  const { data: unlocks } = await supabase
    .from("candidate_unlock")
    .select("id, candidate_public_id, ats_synced_at")
    .eq("company_id", companyId)
    .eq("status", "confirmed")
    .in("candidate_public_id", candidate_ids);

  const unlockMap = Object.fromEntries(
    (unlocks || []).map((u) => [u.candidate_public_id, u])
  );

  const toImport = [];
  const skipped = [];

  for (const cid of candidate_ids) {
    const unlock = unlockMap[cid];
    if (!unlock) {
      skipped.push({ id: cid, reason: "not_unlocked" });
      continue;
    }
    if (unlock.ats_synced_at) {
      skipped.push({ id: cid, reason: "already_synced" });
      continue;
    }
    toImport.push({ candidateId: cid, unlockId: unlock.id });
  }

  // Create import log
  const { data: importLog } = await supabase
    .from("ats_import_log")
    .insert({
      company_id: companyId,
      ats_provider,
      job_id_in_ats: job_id || null,
      candidate_ids,
      status: "pending",
      triggered_by_user_id: userId,
    })
    .select("id")
    .single();

  let importedCount = 0;
  const errors = [];

  // Process each candidate
  for (const item of toImport) {
    try {
      // Fetch public data
      const { data: candidate } = await supabase
        .from("candidate_public")
        .select("role_applied_for, seniority_level, location_city, skills, interview_count, interview_stage_reached, strengths")
        .eq("id", item.candidateId)
        .single();

      // Fetch and decrypt PII
      const { data: piiRow } = await supabase
        .from("candidate_pii")
        .select("*")
        .eq("candidate_public_id", item.candidateId)
        .single();

      if (!piiRow) {
        errors.push({ id: item.candidateId, error: "PII not found" });
        continue;
      }

      const pii = decryptPii(piiRow);

      // Build ATS payload (provider-specific)
      const atsPayload = buildAtsPayload(ats_provider, {
        ...candidate,
        ...pii,
        candidate_id: item.candidateId,
        job_id,
      });

      // Push to ATS (placeholder — actual API call per provider)
      const atsResult = await pushToAts(ats_provider, atsPayload, atsConfig);

      // Update unlock with ATS sync timestamp + external ID
      await supabase
        .from("candidate_unlock")
        .update({
          ats_synced_at: new Date().toISOString(),
          ats_candidate_id_external: atsResult?.candidateId || null,
        })
        .eq("id", item.unlockId);

      importedCount++;
    } catch (err) {
      errors.push({ id: item.candidateId, error: err.message });
    }
  }

  // Update import log
  const finalStatus = errors.length > 0 && importedCount === 0 ? "failed" : "success";
  await supabase
    .from("ats_import_log")
    .update({
      status: finalStatus,
      imported_count: importedCount,
      skipped_count: skipped.length,
      error_message: errors.length > 0 ? JSON.stringify(errors) : null,
    })
    .eq("id", importLog.id);

  auditLog("ats_import_triggered", null, req, {
    provider: ats_provider,
    imported: importedCount,
    skipped: skipped.length,
    failed: errors.length,
  });

  return {
    status: 200,
    body: {
      imported: importedCount,
      skipped: skipped.length,
      skipped_details: skipped,
      errors: errors.length > 0 ? errors : undefined,
      import_log_id: importLog.id,
    },
  };
}

// Build provider-specific payload
function buildAtsPayload(provider, data) {
  const base = {
    first_name: data.full_name?.split(" ")[0] || "",
    last_name: data.full_name?.split(" ").slice(1).join(" ") || "",
    email: data.email,
    phone: data.phone,
    linkedin_url: data.linkedin_url,
    current_title: data.role_applied_for,
    skills: data.skills || [],
    notes: [
      `Sourced via pickt (ID: ${data.candidate_id})`,
      data.strengths ? `Strengths: ${data.strengths}` : null,
      `Interview stage: ${data.interview_stage_reached || "Unknown"}`,
      `Interviews completed: ${data.interview_count || 0}`,
    ].filter(Boolean).join("\n"),
    external_id: data.candidate_id,
    source: "pickt",
  };

  switch (provider) {
    case "greenhouse":
      return {
        first_name: base.first_name,
        last_name: base.last_name,
        email_addresses: [{ value: base.email, type: "personal" }],
        phone_numbers: base.phone ? [{ value: base.phone, type: "mobile" }] : [],
        social_media_addresses: base.linkedin_url ? [{ value: base.linkedin_url }] : [],
        tags: base.skills.slice(0, 20),
        notes: [{ body: base.notes, visibility: "public" }],
        external_id: base.external_id,
        applications: data.job_id ? [{ job_id: data.job_id }] : [],
      };
    case "lever":
      return {
        name: data.full_name,
        email: base.email,
        phone: { value: base.phone },
        links: base.linkedin_url ? [base.linkedin_url] : [],
        tags: base.skills.slice(0, 20),
        notes: [{ value: base.notes }],
        origin: "sourced",
        sources: ["pickt"],
        postingId: data.job_id || undefined,
      };
    case "workday":
      return {
        candidate: {
          name: data.full_name,
          email: base.email,
          phone: base.phone,
          externalId: base.external_id,
        },
        requisitionId: data.job_id,
        source: "pickt",
        notes: base.notes,
      };
    default:
      return base;
  }
}

// Push to ATS (placeholder — implement actual HTTP calls per provider)
async function pushToAts(provider, payload, config) {
  // In production: make HTTP POST to provider's candidate creation API
  // Greenhouse: POST https://harvest.greenhouse.io/v1/candidates
  // Lever: POST https://api.lever.co/v1/candidates
  // Workday: POST to configured endpoint

  console.log(`[ats-import] Would push to ${provider}:`, JSON.stringify(payload).slice(0, 200));

  // Return mock result
  return {
    candidateId: `${provider}_${Date.now()}`,
    success: true,
  };
}

// GET /api/ats/jobs
export async function getAtsJobs(req, { userId }) {
  const companyId = await getCompanyId(userId);
  if (!companyId) return { status: 401, body: { error: "Unauthorized" } };

  const { searchParams } = new URL(req.url);
  const provider = searchParams.get("provider");

  if (!provider) return { status: 400, body: { error: "provider required" } };

  // Placeholder — fetch from ATS API in production
  const mockJobs = [
    { id: "job_1", title: "Senior Frontend Engineer", department: "Engineering", status: "open" },
    { id: "job_2", title: "Product Manager", department: "Product", status: "open" },
    { id: "job_3", title: "Data Engineer", department: "Data", status: "open" },
  ];

  return { status: 200, body: { jobs: mockJobs } };
}

// GET /api/ats/import-csv
export async function exportCsv(req, { userId }) {
  const companyId = await getCompanyId(userId);
  if (!companyId) return { status: 401, body: { error: "Unauthorized" } };

  const { searchParams } = new URL(req.url);
  const candidateIds = searchParams.get("ids")?.split(",").filter(Boolean) || [];

  if (candidateIds.length === 0) {
    return { status: 400, body: { error: "ids required" } };
  }

  // Verify unlocks
  const { data: unlocks } = await supabase
    .from("candidate_unlock")
    .select("candidate_public_id")
    .eq("company_id", companyId)
    .eq("status", "confirmed")
    .in("candidate_public_id", candidateIds);

  const unlockedIds = (unlocks || []).map((u) => u.candidate_public_id);

  // Fetch public data
  const { data: candidates } = await supabase
    .from("candidate_public")
    .select("id, role_applied_for, seniority_level, location_city, skills, interview_count, interview_stage_reached, strengths")
    .in("id", unlockedIds);

  // Fetch + decrypt PII
  const rows = [];
  for (const c of candidates || []) {
    const { data: piiRow } = await supabase
      .from("candidate_pii")
      .select("*")
      .eq("candidate_public_id", c.id)
      .single();

    const pii = piiRow ? decryptPii(piiRow) : {};

    rows.push({
      name: pii.full_name || "",
      email: pii.email || "",
      phone: pii.phone || "",
      linkedin: pii.linkedin_url || "",
      role: c.role_applied_for || "",
      seniority: c.seniority_level || "",
      location: c.location_city || "",
      skills: (c.skills || []).join("; "),
      interview_count: c.interview_count || 0,
      interview_stage: c.interview_stage_reached || "",
      strengths: c.strengths || "",
      pickt_url: `https://pickt.com/candidates/${c.id}`,
    });
  }

  // Build CSV
  const header = "Name,Email,Phone,LinkedIn,Role,Seniority,Location,Skills,Interview Count,Interview Stage,Strengths,pickt Profile URL\n";
  const csvRows = rows.map((r) =>
    [r.name, r.email, r.phone, r.linkedin, r.role, r.seniority, r.location, r.skills, r.interview_count, r.interview_stage, r.strengths, r.pickt_url]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  ).join("\n");

  return {
    status: 200,
    body: header + csvRows,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="pickt_candidates_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  };
}
