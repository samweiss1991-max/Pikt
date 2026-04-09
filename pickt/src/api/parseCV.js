/**
 * CV Parser Proxy — server-side Anthropic API calls.
 *
 * POST /api/parse-cv
 * Accepts: multipart/form-data (file) OR JSON { text }
 * Returns: structured candidate JSON
 *
 * Never exposes API key or raw Anthropic response to browser.
 * Rate limited: 10/hour per user.
 * Quota checked: per company plan limits.
 */

import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { parseCvLimiter } from "../middleware/rateLimiter.js";
import { checkAndIncrementQuota } from "../lib/quotas.js";
import { scoreParseConfidence, getConfidenceBand } from "../lib/cvParser.js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);
const SCANNED_THRESHOLD = 100; // chars — below this, treat as scanned PDF

const PARSE_PROMPT = `Extract structured candidate information from this CV/resume. Return a JSON object with:
{
  "full_name": string,
  "email": string | null,
  "phone": string | null,
  "linkedin_url": string | null,
  "location_city": string | null,
  "current_company": string | null,
  "current_role": string | null,
  "years_experience": number | null,
  "seniority_level": "Junior" | "Mid-level" | "Senior" | "Staff/Lead" | "Principal" | "Director+" | "Manager",
  "skills": string[],
  "work_history": [{ "company": string, "role": string, "dates": string, "tenure": string, "achievement": string }],
  "top_skills": [{ "name": string, "depth": string, "tags": string[] }],
  "education": [{ "institution": string, "degree": string, "year": string }],
  "summary": string
}
Return ONLY valid JSON, no markdown.`;

// ── Helpers ─────────────────────────────────────────────────

async function getCompanyId(userId) {
  const { data } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", userId)
    .single();
  return data?.company_id || null;
}

async function extractTextFromPdf(buffer) {
  // Dynamic import for pdf-parse
  const pdfParse = (await import("pdf-parse")).default;
  const result = await pdfParse(buffer);
  return result.text || "";
}

async function extractTextFromDocx(buffer) {
  // Dynamic import for mammoth
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value || "";
}

async function callAnthropicText(text) {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      { role: "user", content: `${PARSE_PROMPT}\n\n---\n\n${text}` },
    ],
  });

  const content = response.content[0]?.text || "";
  // Extract JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Failed to parse structured data");
  return JSON.parse(jsonMatch[0]);
}

async function callAnthropicDocument(base64, mediaType) {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: mediaType, data: base64 },
          },
          { type: "text", text: PARSE_PROMPT },
        ],
      },
    ],
  });

  const content = response.content[0]?.text || "";
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Failed to parse structured data");
  return JSON.parse(jsonMatch[0]);
}

// ── Main handler ────────────────────────────────────────────

export async function parseCv(req, { userId }) {
  // 1. Rate limit
  const limitResult = parseCvLimiter(req);
  if (!limitResult.allowed) {
    return { status: 429, body: limitResult.body, headers: limitResult.headers };
  }

  // 2. Quota check
  const companyId = await getCompanyId(userId);
  if (!companyId) return { status: 401, body: { error: "Unauthorized" } };

  const quota = await checkAndIncrementQuota(companyId, "cv_parse");
  if (!quota.allowed) {
    return { status: 402, body: { error: quota.error, upgrade_url: quota.upgrade_url } };
  }

  // 3. Parse input
  const contentType = req.headers.get?.("content-type") || req.headers["content-type"] || "";

  let parsed;

  if (contentType.includes("application/json")) {
    // Text input mode
    const body = await req.json();
    if (!body.text || typeof body.text !== "string" || body.text.trim().length < 50) {
      return { status: 400, body: { error: "Text must be at least 50 characters" } };
    }

    try {
      parsed = await callAnthropicText(body.text.slice(0, 50000));
    } catch (err) {
      console.error("[parse-cv] Anthropic error:", err.message);
      return { status: 500, body: { error: "Failed to parse CV content" } };
    }
  } else if (contentType.includes("multipart/form-data")) {
    // File upload mode
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return { status: 400, body: { error: "No file provided" } };
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      return { status: 400, body: { error: "File exceeds 10MB limit" } };
    }

    // Validate type
    const mimeType = file.type || "";
    if (!ALLOWED_TYPES.has(mimeType) && !file.name?.endsWith(".txt")) {
      return { status: 400, body: { error: "Unsupported file type. Upload PDF, DOCX, or TXT." } };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let text = "";

    try {
      if (mimeType === "application/pdf" || file.name?.endsWith(".pdf")) {
        text = await extractTextFromPdf(buffer);

        // Scanned PDF fallback: send as document to Anthropic
        if (text.trim().length < SCANNED_THRESHOLD) {
          const base64 = buffer.toString("base64");
          parsed = await callAnthropicDocument(base64, "application/pdf");
          const scannedConf = scoreParseConfidence(parsed);
          return {
            status: 200,
            body: {
              candidate: parsed,
              source: "scanned_pdf",
              remaining: quota.remaining,
              confidence: scannedConf,
              confidence_band: getConfidenceBand(scannedConf.score),
            },
          };
        }
      } else if (
        mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        file.name?.endsWith(".docx")
      ) {
        text = await extractTextFromDocx(buffer);
      } else {
        // Plain text
        text = buffer.toString("utf-8");
      }
    } catch (err) {
      console.error("[parse-cv] Extraction error:", err.message);
      return { status: 400, body: { error: "Failed to read file content" } };
    }

    if (text.trim().length < 50) {
      return { status: 400, body: { error: "Could not extract enough text from file" } };
    }

    try {
      parsed = await callAnthropicText(text.slice(0, 50000));
    } catch (err) {
      console.error("[parse-cv] Anthropic error:", err.message);
      return { status: 500, body: { error: "Failed to parse CV content" } };
    }
  } else {
    return { status: 400, body: { error: "Send multipart/form-data with file or JSON with { text }" } };
  }

  const confidence = scoreParseConfidence(parsed);

  return {
    status: 200,
    body: {
      candidate: parsed,
      source: "text_extraction",
      remaining: quota.remaining,
      confidence,
      confidence_band: getConfidenceBand(confidence.score),
    },
  };
}
