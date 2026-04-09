/**
 * Referrer pending actions API.
 *
 * GET /api/referrer/pending-actions
 * Returns counts of items needing attention for reputation tips.
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function getPendingActions(req, { userId }) {
  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", userId)
    .single();

  if (!userData) return { status: 401, body: { error: "Unauthorized" } };

  const companyId = userData.company_id;

  // Unanswered enquiries (pending responses past or near SLA)
  const { count: unanswered } = await supabase
    .from("pending_response")
    .select("id", { count: "exact", head: true })
    .eq("referrer_company_id", companyId)
    .eq("status", "pending");

  // Candidates needing availability confirmation
  const { count: unconfirmed } = await supabase
    .from("candidate_public")
    .select("id", { count: "exact", head: true })
    .eq("uploaded_by_company_id", companyId)
    .eq("availability_status", "unconfirmed");

  return {
    status: 200,
    body: {
      unanswered: unanswered || 0,
      unconfirmed: unconfirmed || 0,
    },
  };
}
