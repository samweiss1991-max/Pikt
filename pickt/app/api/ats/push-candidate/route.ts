import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { candidate_id } = body;

  if (!candidate_id) {
    return NextResponse.json(
      { error: "candidate_id is required" },
      { status: 400 }
    );
  }

  // TODO: Implement ATS integration (Greenhouse, Lever, Workable, Ashby)
  // For now, return success as a stub
  return NextResponse.json({ success: true, pushed: false, reason: "no_ats_connected" });
}
