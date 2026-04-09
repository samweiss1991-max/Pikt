import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { sanitizeCandidate } from "@/lib/sanitize-candidate";

export async function GET(request: Request) {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "";

  if (!q) {
    return NextResponse.json({ candidates: [] });
  }

  // Search candidates_public by role, skills, industry, location
  const { data, error } = await supabase
    .from("candidates_public")
    .select("*")
    .or(
      `role_applied_for.ilike.%${q}%,industry.ilike.%${q}%,location_city.ilike.%${q}%,seniority_level.ilike.%${q}%`
    )
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Sanitize each candidate before returning
  const sanitized = (data || []).map(sanitizeCandidate);

  return NextResponse.json({ candidates: sanitized });
}
