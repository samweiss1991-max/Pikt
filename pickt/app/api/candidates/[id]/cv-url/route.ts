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

  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single();

  if (!userData) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const candidateId = params.id;

  // Fetch only the fields needed — never return raw storage path to client
  const { data: candidate } = await supabase
    .from("candidates")
    .select("id, uploaded_by_company_id, cv_file_url, cv_filename")
    .eq("id", candidateId)
    .single();

  if (!candidate) {
    return NextResponse.json(
      { error: "Candidate not found" },
      { status: 404 }
    );
  }

  // Must be owner or have an unlock record
  const isOwner = candidate.uploaded_by_company_id === userData.company_id;

  if (!isOwner) {
    const { data: unlock } = await supabase
      .from("candidate_unlocks")
      .select("id")
      .eq("candidate_id", candidateId)
      .eq("requesting_company_id", userData.company_id)
      .eq("status", "approved")
      .single();

    if (!unlock) {
      return NextResponse.json(
        { error: "Unlock this candidate before accessing their CV." },
        { status: 403 }
      );
    }
  }

  if (!candidate.cv_file_url) {
    return NextResponse.json(
      { error: "No CV available" },
      { status: 404 }
    );
  }

  // Generate signed URL (1 hour expiry) — never expose raw path
  const { data: signedUrl, error } = await supabase.storage
    .from("candidate-files")
    .createSignedUrl(candidate.cv_file_url, 3600);

  if (error || !signedUrl) {
    return NextResponse.json(
      { error: "Failed to generate download URL" },
      { status: 500 }
    );
  }

  const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

  return NextResponse.json({
    signedUrl: signedUrl.signedUrl,
    expiresAt,
    filename: candidate.cv_filename || null,
  });
}
