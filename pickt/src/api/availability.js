/**
 * Availability confirmation endpoint.
 *
 * GET /api/availability/confirm?token=<uuid>
 * One-click link from email — confirms or removes a candidate.
 * No auth required (token is the proof of authority).
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handleAvailabilityConfirm(req) {
  const { searchParams } = new URL(req.url);
  const tokenId = searchParams.get("token");

  if (!tokenId) {
    return { status: 400, body: { error: "Missing token" } };
  }

  // Fetch token
  const { data: token, error } = await supabase
    .from("availability_token")
    .select("*")
    .eq("id", tokenId)
    .single();

  if (error || !token) {
    return { status: 404, body: { error: "Invalid or expired link" } };
  }

  // Check not already used
  if (token.used_at) {
    return {
      status: 200,
      body: { message: "This link has already been used.", action: token.action },
    };
  }

  // Check not expired
  if (new Date(token.expires_at) < new Date()) {
    return { status: 410, body: { error: "This link has expired" } };
  }

  // Mark token as used
  await supabase
    .from("availability_token")
    .update({ used_at: new Date().toISOString() })
    .eq("id", tokenId);

  // Apply action
  if (token.action === "confirm") {
    await supabase
      .from("candidate_public")
      .update({
        availability_status: "available",
        last_availability_confirmed_at: new Date().toISOString(),
      })
      .eq("id", token.candidate_public_id);

    return {
      status: 200,
      body: {
        message: "Candidate availability confirmed. Thank you!",
        action: "confirm",
      },
    };
  }

  if (token.action === "remove") {
    await supabase
      .from("candidate_public")
      .update({
        availability_status: "withdrawn",
        status: "withdrawn",
      })
      .eq("id", token.candidate_public_id);

    return {
      status: 200,
      body: {
        message: "Candidate has been removed from the marketplace.",
        action: "remove",
      },
    };
  }

  return { status: 400, body: { error: "Unknown action" } };
}
