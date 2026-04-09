/**
 * Client-side audit event endpoints.
 *
 * POST /api/audit/profile-viewed
 * Body: { candidate_id }
 * Logs profile_viewed event from the WarmingLayer mount.
 */

import { auditLog } from "../middleware/auditLog.js";

export async function logProfileViewedFromClient(req, { userId }) {
  const body = await req.json();
  const { candidate_id } = body;

  if (!candidate_id) {
    return { status: 400, body: { error: "candidate_id required" } };
  }

  // Fire and forget
  auditLog("profile_viewed", candidate_id, {
    ...req,
    user: { id: userId, company_id: null },
  });

  return { status: 200, body: { ok: true } };
}

/**
 * POST /api/audit/similar-clicked
 * Body: { source_candidate_id, clicked_candidate_id, position }
 */
export async function logSimilarClickedFromClient(req, { userId }) {
  const body = await req.json();
  const { source_candidate_id, clicked_candidate_id, position } = body;

  if (!clicked_candidate_id) {
    return { status: 400, body: { error: "clicked_candidate_id required" } };
  }

  auditLog("similar_candidate_clicked", clicked_candidate_id, {
    ...req,
    user: { id: userId, company_id: null },
  }, {
    source_candidate_id,
    clicked_candidate_id,
    position,
  });

  return { status: 200, body: { ok: true } };
}
