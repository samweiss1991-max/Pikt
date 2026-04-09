import { NextResponse } from "next/server";
import { CANDIDATES } from "@/lib/candidates-seed";

export function GET() {
  return NextResponse.json({ count: CANDIDATES.length });
}
