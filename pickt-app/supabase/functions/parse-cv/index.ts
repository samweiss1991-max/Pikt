// Supabase Edge Function: parse-cv
// Extracts text from a candidate CV (PDF or DOCX) stored in candidate-documents
// and uses Claude Haiku 4.5 (with tool use + prompt caching) to return structured
// candidate data. Falls back to a heuristic regex parser if ANTHROPIC_API_KEY is
// unset or the API call errors, so a misconfigured key never breaks uploads.
//
// Deploy: supabase functions deploy parse-cv
// Required secret: ANTHROPIC_API_KEY (see https://console.anthropic.com/settings/keys)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.30.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

// ── Claude prompt + schema (frozen — must not vary per request to keep cache warm) ──

const SYSTEM_PROMPT = `You are extracting structured candidate data from CV text for Pickt, an Australian recruitment marketplace.

Rules:
- Be conservative. If a field is not clearly stated in the text, return null. Do not guess.
- "skills" must be specific tools, technologies, frameworks, programming languages, or platforms — not soft skills.
  GOOD examples: "React", "PostgreSQL", "Kubernetes", "Salesforce", "Figma", "Python", "AWS".
  BAD examples: "Communication", "Team player", "Problem-solving", "Leadership", "Detail-oriented".
- "years_experience" is total professional years across all roles, not just the current job.
- "seniority_level" must be your best estimate from titles, scope, and years. Use exactly one of:
  "Junior", "Mid", "Senior", "Lead", "Director", "VP/C-suite", or null.
- For Australian candidates, common cities are Sydney, Melbourne, Brisbane, Perth, Adelaide, Canberra, Hobart, Darwin, Gold Coast.
  If you see a clearly international city, use that and set country accordingly.
- "current_employer" and "current_job_title" should be the candidate's most recent / current role, not historical roles.
- "confidence" reflects how much of the CV you could parse: "high" if name, contact, role, skills, and experience were all clearly extractable; "medium" if some were unclear; "low" if the text is sparse or noisy.

You must call the record_candidate tool exactly once. Do not respond with prose.`;

const candidateToolSchema = {
  type: "object",
  properties: {
    name: {
      type: ["string", "null"],
      description: "Candidate's full name, or null if not clearly stated.",
    },
    email: {
      type: ["string", "null"],
      description: "Email address, or null.",
    },
    phone: {
      type: ["string", "null"],
      description: "Phone or mobile number, including country code if present, or null.",
    },
    linkedin_url: {
      type: ["string", "null"],
      description: "Full LinkedIn profile URL, or null.",
    },
    skills: {
      type: "array",
      items: { type: "string" },
      description: "Up to 20 specific tools/technologies/platforms. Empty array if none found.",
    },
    location_city: { type: ["string", "null"] },
    location_state: { type: ["string", "null"] },
    location_country: { type: ["string", "null"] },
    current_job_title: { type: ["string", "null"] },
    current_employer: { type: ["string", "null"] },
    years_experience: {
      type: ["integer", "null"],
      description: "Total professional years of experience.",
    },
    seniority_level: {
      type: ["string", "null"],
      enum: ["Junior", "Mid", "Senior", "Lead", "Director", "VP/C-suite", null],
    },
    confidence: {
      type: "string",
      enum: ["high", "medium", "low"],
    },
  },
  required: ["skills", "confidence"],
};

// ── DOCX extractor (unchanged from original) ──

async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  const { default: JSZip } = await import("https://esm.sh/jszip@3.10.1");
  const zip = await JSZip.loadAsync(buffer);
  const docXml = await zip.file("word/document.xml")?.async("string");
  if (!docXml) return "";
  return docXml
    .replace(/<w:p[^>]*>/g, "\n")
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── PDF extractor — unpdf works in Deno, no native deps ──

async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("https://esm.sh/unpdf@0.12.1");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const result = await extractText(pdf, { mergePages: true });
  // unpdf returns either { text: string } or { text: string[] } depending on options
  return Array.isArray(result.text) ? result.text.join("\n\n") : result.text;
}

// ── Heuristic fallback (used when ANTHROPIC_API_KEY is unset or Claude errors) ──

const COMMON_SKILLS = [
  "JavaScript", "TypeScript", "Python", "Java", "Go", "Rust", "C#", "C++", "Ruby", "PHP", "Swift", "Kotlin",
  "React", "Vue", "Angular", "Next.js", "Node.js", "Express", "Django", "Flask", "Spring", "Rails",
  "PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch", "DynamoDB",
  "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Terraform", "CI/CD",
  "GraphQL", "REST", "gRPC", "Kafka", "RabbitMQ",
  "Machine Learning", "Deep Learning", "NLP", "Computer Vision", "PyTorch", "TensorFlow",
  "Figma", "Sketch", "Adobe XD",
  "SQL", "Excel", "Tableau", "Power BI", "Salesforce", "HubSpot",
  "Agile", "Scrum", "Jira", "Confluence",
  "Data Analysis", "Data Engineering", "ETL", "dbt", "Airflow", "Spark",
];

const AU_CITIES = ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Canberra", "Hobart", "Darwin", "Gold Coast"];

function heuristicParse(text: string) {
  const lower = text.toLowerCase();
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0] || null;
  const phone = text.match(/(\+?\d[\d\s\-().]{7,}\d)/)?.[1]?.trim() || null;
  const linkedin = text.match(/https?:\/\/(www\.)?linkedin\.com\/in\/[\w-]+\/?/i)?.[0] || null;

  let name: string | null = null;
  for (const line of lines.slice(0, 5)) {
    if (line.includes("@") || /^\+?\d/.test(line) || line.includes("http")) continue;
    if (line.length > 3 && line.length < 60) { name = line; break; }
  }

  const skills: string[] = [];
  for (const skill of COMMON_SKILLS) {
    if (lower.includes(skill.toLowerCase()) && !skills.includes(skill)) skills.push(skill);
  }

  let city: string | null = null;
  let country: string | null = null;
  for (const c of AU_CITIES) {
    if (lower.includes(c.toLowerCase())) { city = c; country = "Australia"; break; }
  }

  const yearsMatch = text.match(/(\d+)\+?\s*years?\s*(?:of\s*)?(?:experience|exp)/i);
  const years = yearsMatch ? parseInt(yearsMatch[1]) : null;

  const fieldsFound = [name, email, phone, skills.length > 0, city, years].filter(Boolean).length;
  const confidence = fieldsFound >= 4 ? "medium" : "low";

  return {
    name,
    email,
    phone,
    linkedin_url: linkedin,
    skills: skills.slice(0, 20),
    location_city: city,
    location_state: null,
    location_country: country,
    current_job_title: null,
    current_employer: null,
    years_experience: years,
    seniority_level: null,
    confidence,
  };
}

// ── Claude path ──

async function parseWithClaude(text: string, apiKey: string) {
  const client = new Anthropic({ apiKey });

  // Cap CV text to ~24KB to stay safely under context limits and keep tokens predictable
  const cvText = text.length > 24000 ? text.slice(0, 24000) + "\n\n[truncated]" : text;

  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        // Cache the system prompt + tool definitions (renders before messages).
        // Min cacheable prefix on Haiku 4.5 is 4096 tokens — this prompt + tool
        // schema is borderline; if too small, no cost penalty, just no discount.
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [
      {
        name: "record_candidate",
        description: "Record extracted candidate information from a CV.",
        input_schema: candidateToolSchema as unknown as Anthropic.Tool["input_schema"],
      },
    ],
    tool_choice: { type: "tool", name: "record_candidate" },
    messages: [
      { role: "user", content: `CV text:\n\n${cvText}` },
    ],
  });

  const block = response.content.find(
    (b: { type: string }) => b.type === "tool_use",
  ) as Anthropic.ToolUseBlock | undefined;

  if (!block) {
    throw new Error("Claude response had no tool_use block");
  }

  console.log(
    "[parse-cv] cache:",
    JSON.stringify({
      created: response.usage.cache_creation_input_tokens,
      read: response.usage.cache_read_input_tokens,
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
    }),
  );

  return block.input;
}

// ── Main handler ──

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { storagePath, filename } = await req.json();

    if (!storagePath) {
      return new Response(JSON.stringify({ error: "storagePath is required" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const { data: fileData, error: downloadError } = await adminClient.storage
      .from("candidate-documents")
      .download(storagePath);

    if (downloadError || !fileData) {
      return new Response(
        JSON.stringify({ error: `Download failed: ${downloadError?.message}` }),
        { status: 500, headers: jsonHeaders },
      );
    }

    // Extract text
    const lowerName = (filename || storagePath).toLowerCase();
    const buffer = await fileData.arrayBuffer();
    let text = "";

    if (lowerName.endsWith(".docx")) {
      text = await extractDocxText(buffer);
    } else if (lowerName.endsWith(".pdf")) {
      try {
        text = await extractPdfText(buffer);
      } catch (err) {
        console.error("[parse-cv] PDF extraction failed:", err);
        return new Response(
          JSON.stringify({
            error: "Could not extract text from this PDF. It may be image-based or corrupted.",
            parsed: null,
            confidence: "none",
          }),
          { status: 200, headers: jsonHeaders },
        );
      }
    } else {
      return new Response(JSON.stringify({ error: "Unsupported file type" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    if (!text || text.trim().length < 20) {
      return new Response(
        JSON.stringify({
          error: "Could not extract text from this file. It may be image-based.",
          parsed: null,
          confidence: "none",
        }),
        { status: 200, headers: jsonHeaders },
      );
    }

    // Try Claude; fall back to heuristic on any error
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    let parsed;

    if (apiKey) {
      try {
        parsed = await parseWithClaude(text, apiKey);
      } catch (err) {
        console.error("[parse-cv] Claude parse failed, using heuristic fallback:", err);
        parsed = heuristicParse(text);
      }
    } else {
      console.warn("[parse-cv] ANTHROPIC_API_KEY not set — using heuristic fallback");
      parsed = heuristicParse(text);
    }

    return new Response(JSON.stringify({ parsed, confidence: parsed.confidence }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
