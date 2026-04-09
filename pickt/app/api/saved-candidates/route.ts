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

  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single();

  if (!userData) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await request.json();
  const { candidate_id } = body;

  if (!candidate_id) {
    return NextResponse.json(
      { error: "candidate_id is required" },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("saved_candidates").upsert(
    {
      candidate_id,
      company_id: userData.company_id,
      user_id: user.id,
    },
    { onConflict: "candidate_id,company_id,user_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}

export async function GET() {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single();

  if (!userData) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { data: saves, error } = await supabase
    .from("saved_candidates")
    .select("candidate_id, created_at")
    .eq("company_id", userData.company_id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch candidate details from public view
  const candidateIds = (saves || []).map((s) => s.candidate_id);

  if (candidateIds.length === 0) {
    return NextResponse.json({ candidates: [] });
  }

  const { data: candidates } = await supabase
    .from("candidates_public")
    .select("*")
    .in("id", candidateIds);

  return NextResponse.json({ candidates: candidates || [] });
}

export async function DELETE(request: Request) {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const candidateId = searchParams.get("candidate_id");

  if (!candidateId) {
    return NextResponse.json(
      { error: "candidate_id is required" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("saved_candidates")
    .delete()
    .eq("candidate_id", candidateId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
