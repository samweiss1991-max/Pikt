// How a candidate is recognised across referrals: email and mobile.
// Only keyed hashes are stored for matching, so the raw values can't be looked
// up or compared from the database alone.
//
// Env: IDENTITY_HASH_SECRET — secret key for hashing email/mobile.

export function normaliseEmail(email: unknown): string | null {
  const e = String(email ?? "").trim().toLowerCase();
  return e.includes("@") ? e : null;
}

// Digits only; Australian numbers compared by their last 9 digits so
// "+61 412 345 678", "0412 345 678" and "412345678" all match.
export function normaliseMobile(mobile: unknown): string | null {
  const digits = String(mobile ?? "").replace(/\D/g, "");
  if (digits.length < 8) return null;
  return digits.length >= 9 ? digits.slice(-9) : digits;
}

export async function identityHash(kind: "email" | "mobile", value: string | null): Promise<string | null> {
  if (!value) return null;
  const secret = Deno.env.get("IDENTITY_HASH_SECRET");
  if (!secret) throw new Error("IDENTITY_HASH_SECRET is not configured");
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${kind}:${value}`));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
