import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: company } = await supabase
    .from("companies")
    .select("id, name")
    .eq("id", params.id)
    .single();

  if (!company) {
    return NextResponse.json(
      { error: "Company not found" },
      { status: 404 }
    );
  }

  // Count successful placements for rep score
  const { count: placementCount } = await supabase
    .from("placements")
    .select("id", { count: "exact", head: true })
    .in(
      "unlock_id",
      // Subquery: unlocks where this company uploaded the candidate
      (
        await supabase
          .from("candidate_unlocks")
          .select("id")
          .in(
            "candidate_id",
            (
              await supabase
                .from("candidates")
                .select("id")
                .eq("uploaded_by_company_id", params.id)
            ).data?.map((c) => c.id) || []
          )
      ).data?.map((u) => u.id) || []
    );

  const count = placementCount || 0;

  // Simple rep score: based on placement count
  const repScore = Math.min(100, count * 10 + 50);

  return NextResponse.json({
    name: company.name,
    rep_score: repScore,
    placement_count: count,
  });
}
