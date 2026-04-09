/**
 * Audit logging middleware.
 *
 * Writes append-only records to the audit_log table.
 * All writes are fire-and-forget to avoid blocking the request.
 * Failures are logged to stderr but never surface to the client.
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Write an audit event.
 *
 * @param {string} eventType - One of the audit_event_type enum values
 * @param {string|null} candidateId - candidate_public.id (nullable for non-candidate events)
 * @param {Request|object} req - The incoming request (or object with user/headers/ip)
 * @param {object} metadata - Arbitrary JSON metadata for the event
 */
export async function auditLog(eventType, candidateId, req, metadata = {}) {
  try {
    const user = req.user || {};
    const headers =
      req.headers instanceof Headers
        ? Object.fromEntries(req.headers.entries())
        : req.headers || {};

    const ip =
      headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      headers["x-real-ip"] ||
      req.ip ||
      null;

    const userAgent = headers["user-agent"] || null;

    await supabase.from("audit_log").insert({
      event_type: eventType,
      actor_company_id: user.company_id,
      actor_user_id: user.id,
      candidate_id: candidateId || null,
      ip_address: ip,
      user_agent: userAgent,
      session_id: req.session?.id || null,
      metadata: metadata,
    });
  } catch (err) {
    // Never block the request — log and move on
    console.error("[audit] Failed to write audit event:", eventType, err.message);
  }
}

/**
 * Convenience wrappers for common events.
 */

export function logProfileViewed(candidateId, req, meta = {}) {
  return auditLog("profile_viewed", candidateId, req, meta);
}

export function logProfileUnlocked(candidateId, req, meta = {}) {
  return auditLog("profile_unlocked", candidateId, req, meta);
}

export function logPiiAccessed(candidateId, req, meta = {}) {
  return auditLog("pii_accessed", candidateId, req, meta);
}

export function logCvDownloaded(candidateId, req, meta = {}) {
  return auditLog("cv_downloaded", candidateId, req, meta);
}

export function logPlacementConfirmed(candidateId, req, meta = {}) {
  return auditLog("placement_confirmed", candidateId, req, meta);
}

export function logFeeDisputed(candidateId, req, meta = {}) {
  return auditLog("fee_disputed", candidateId, req, meta);
}

export function logShortlistAdded(candidateId, req, meta = {}) {
  return auditLog("shortlist_added", candidateId, req, meta);
}

export function logShortlistRemoved(candidateId, req, meta = {}) {
  return auditLog("shortlist_removed", candidateId, req, meta);
}
