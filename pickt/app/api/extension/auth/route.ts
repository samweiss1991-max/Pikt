import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const body = await request.json();
  const { access_token } = body;

  if (!access_token) {
    return NextResponse.json(
      { error: "access_token is required" },
      { status: 400 }
    );
  }

  // Validate the token by fetching the user it belongs to
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${access_token}` } } }
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(access_token);

  if (authError || !user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // Get company info
  const { data: userData } = await supabase
    .from("users")
    .select("company_id, full_name, companies(name, plan)")
    .eq("id", user.id)
    .single();

  if (!userData) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const company = userData.companies as unknown as {
    name: string;
    plan: string;
  } | null;

  return NextResponse.json({
    user_id: user.id,
    email: user.email,
    full_name: userData.full_name,
    company_id: userData.company_id,
    company_name: company?.name || "Unknown",
    plan: company?.plan || "free",
  });
}
