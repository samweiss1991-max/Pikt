import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { resend } from "@/lib/resend";

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

  // Check candidate exists
  const { data: candidate } = await supabase
    .from("candidates_public")
    .select("id, uploaded_by_company_id")
    .eq("id", candidate_id)
    .single();

  if (!candidate) {
    return NextResponse.json(
      { error: "Candidate not found" },
      { status: 404 }
    );
  }

  // Can't unlock your own candidate
  if (candidate.uploaded_by_company_id === userData.company_id) {
    return NextResponse.json(
      { error: "You cannot unlock your own candidate" },
      { status: 400 }
    );
  }

  // Create unlock record
  const unlockedAt = new Date().toISOString();
  const { data: unlock, error } = await supabase
    .from("candidate_unlocks")
    .insert({
      candidate_id,
      requesting_company_id: userData.company_id,
      status: "approved",
      unlocked_at: unlockedAt,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Already unlocked" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // ── Post-unlock side effects (best-effort, don't block response) ──

  // 1. Push full unredacted candidate data to ATS
  //    This is the ONLY place full PII leaves pickt to an external ATS.
  (async () => {
    try {
      const { data: fullCandidate } = await supabase
        .from("candidates")
        .select("*")
        .eq("id", candidate_id)
        .single();

      if (fullCandidate) {
        const origin =
          request.headers.get("origin") ||
          process.env.NEXT_PUBLIC_BASE_URL ||
          "http://localhost:3000";
        await fetch(`${origin}/api/ats/push-candidate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            candidate_id,
            candidate_data: fullCandidate,
          }),
        });
      }
    } catch {
      // ATS push is best-effort
    }
  })();

  // 2. Send Resend notification to referring company (Company A)
  (async () => {
    try {
      // Get referring company details
      const { data: referringCompany } = await supabase
        .from("companies")
        .select("name")
        .eq("id", candidate.uploaded_by_company_id)
        .single();

      // Get referring company admin email
      const { data: referringAdmin } = await supabase
        .from("users")
        .select("email, full_name")
        .eq("company_id", candidate.uploaded_by_company_id)
        .eq("role", "admin")
        .limit(1)
        .single();

      // Get requesting company name
      const { data: requestingCompany } = await supabase
        .from("companies")
        .select("name")
        .eq("id", userData.company_id)
        .single();

      if (referringAdmin?.email) {
        await resend.emails.send({
          from: "pickt <notifications@pickt.com>",
          to: referringAdmin.email,
          subject: "A candidate you referred has been unlocked",
          html: `
            <p>Hi ${referringAdmin.full_name || referringCompany?.name || "there"},</p>
            <p><strong>${requestingCompany?.name || "A company"}</strong> has unlocked one of your referred candidates on pickt.</p>
            <p>If they make a successful hire, you'll earn your placement fee automatically.</p>
            <p>— The pickt team</p>
          `,
        });
      }
    } catch {
      // Notification is best-effort
    }
  })();

  return NextResponse.json({
    unlockId: unlock.id,
    candidateId: candidate_id,
    unlockedAt,
  });
}
