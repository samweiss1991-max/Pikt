/**
 * Bulk ATS Import with Job Queue.
 *
 * POST /api/ats/import-bulk — queues multiple CV parse jobs
 * GET /api/ats/import-bulk/:jobId/status — poll job progress
 *
 * Uses an in-process queue with concurrency 3.
 * For production: replace with BullMQ + Redis.
 */

import { createClient } from "@supabase/supabase-js";
import { checkAndIncrementQuota } from "../lib/quotas.js";
import { randomUUID } from "node:crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── In-process job queue ────────────────────────────────────

const jobs = new Map();
const CONCURRENCY = 3;
let activeCount = 0;
const pending = [];

function enqueueJob(jobId, tasks) {
  jobs.set(jobId, {
    id: jobId,
    status: "processing",
    total: tasks.length,
    completed: 0,
    failed: 0,
    results: [],
    errors: [],
    created_at: new Date().toISOString(),
  });

  for (const task of tasks) {
    pending.push({ jobId, task });
  }

  processQueue();
}

async function processQueue() {
  while (activeCount < CONCURRENCY && pending.length > 0) {
    activeCount++;
    const { jobId, task } = pending.shift();

    processTask(jobId, task)
      .then(() => { activeCount--; processQueue(); })
      .catch(() => { activeCount--; processQueue(); });
  }
}

async function processTask(jobId, task) {
  const job = jobs.get(jobId);
  if (!job) return;

  try {
    // Call the parse-cv endpoint internally
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/parse-cv`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: task.cvText }),
    });

    if (res.ok) {
      const data = await res.json();
      job.completed++;
      job.results.push({
        index: task.index,
        candidate: data.candidate,
        ats_candidate_id: task.atsCandidateId,
      });
    } else {
      job.failed++;
      job.errors.push({
        index: task.index,
        error: "Parse failed",
        ats_candidate_id: task.atsCandidateId,
      });
    }
  } catch (err) {
    job.failed++;
    job.errors.push({
      index: task.index,
      error: err.message,
      ats_candidate_id: task.atsCandidateId,
    });
  }

  // Check if job is complete
  if (job.completed + job.failed >= job.total) {
    job.status = job.failed > 0 ? "completed_with_errors" : "completed";
  }
}

// ── Helpers ─────────────────────────────────────────────────

async function getCompanyId(userId) {
  const { data } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", userId)
    .single();
  return data?.company_id || null;
}

// ── POST /api/ats/import-bulk ───────────────────────────────

export async function startBulkImport(req, { userId }) {
  const companyId = await getCompanyId(userId);
  if (!companyId) return { status: 401, body: { error: "Unauthorized" } };

  const body = await req.json();
  const { candidates } = body;

  if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
    return { status: 400, body: { error: "candidates array required" } };
  }

  if (candidates.length > 50) {
    return { status: 400, body: { error: "Maximum 50 candidates per bulk import" } };
  }

  // Check quota for all candidates
  for (let i = 0; i < candidates.length; i++) {
    const quota = await checkAndIncrementQuota(companyId, "ats_import");
    if (!quota.allowed) {
      return {
        status: 402,
        body: {
          error: `Import quota exceeded at candidate ${i + 1}. ${quota.error}`,
          upgrade_url: quota.upgrade_url,
        },
      };
    }
  }

  // Create job
  const jobId = randomUUID();
  const tasks = candidates.map((c, i) => ({
    index: i,
    cvText: c.cv_text || c.resume_text || "",
    atsCandidateId: c.ats_candidate_id || null,
  }));

  enqueueJob(jobId, tasks);

  return {
    status: 202,
    body: {
      job_id: jobId,
      total: candidates.length,
      status_url: `/api/ats/import-bulk/${jobId}/status`,
    },
  };
}

// ── GET /api/ats/import-bulk/:jobId/status ───────────────────

export async function getBulkImportStatus(req, { jobId }) {
  const job = jobs.get(jobId);

  if (!job) {
    return { status: 404, body: { error: "Job not found" } };
  }

  return {
    status: 200,
    body: {
      id: job.id,
      status: job.status,
      total: job.total,
      completed: job.completed,
      failed: job.failed,
      progress: job.total > 0 ? Math.round(((job.completed + job.failed) / job.total) * 100) : 0,
      results: job.status.startsWith("completed") ? job.results : undefined,
      errors: job.status.startsWith("completed") ? job.errors : undefined,
    },
  };
}
