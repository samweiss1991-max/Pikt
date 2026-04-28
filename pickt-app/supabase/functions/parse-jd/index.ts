// Supabase Edge Function: parse-jd
// Accepts raw job-description text (extracted client-side from PDF/DOCX/TXT or
// pasted) and uses Claude Haiku 4.5 to extract structured hiring criteria. Then
// queries candidates_public with matching filters and returns the top N
// candidates ranked by a deterministic relevance score.
//
// Falls back to a heuristic parser if ANTHROPIC_API_KEY is unset or Claude
// errors, mirroring the parse-cv pattern.
//
// Deploy: supabase functions deploy parse-jd
// Required secret: ANTHROPIC_API_KEY (already set for parse-cv).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.30.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

// ── Claude prompt + tool schema (frozen for prompt-cache reuse) ──

const SYSTEM_PROMPT = `You are extracting structured hiring criteria from a job description for Pickt, an Australian recruitment marketplace.

Rules:
- Be conservative. If a field is not clearly stated, return null.
- "skills" must be specific tools, technologies, frameworks, languages, or platforms.
  GOOD: "React", "PostgreSQL", "Salesforce", "Figma", "AWS".
  BAD: "Communication", "Team player", "Leadership".
- "role_title" is the canonical role being hired for (e.g. "Senior Backend Engineer", "Product Manager").
- "seniority_level" must be exactly one of:
  "Junior", "Mid", "Senior", "Lead", "Director", "VP/C-suite", or null.
- "preferred_work_type" must be exactly one of: "Remote", "Hybrid", "On-site", or null.
- "industry" should be one of: "Technology", "Product & Design", "Data & Analytics", "Sales & Revenue", "Marketing & Growth", "Finance & FinTech", "People & HR", "Operations", "Customer Success", "Legal & Compliance", or null.
- For Australian roles, common cities are Sydney, Melbourne, Brisbane, Perth, Adelaide, Canberra, Hobart, Darwin, Gold Coast.
- "salary_min" and "salary_max" are annual AUD figures if stated. If only a single number is given, set both to that value.
- "years_experience_min" and "years_experience_max" are total years of experience required, if stated.
- "summary" is a one-sentence plain-English description of the role for display.

You must call the record_job_criteria tool exactly once. Do not respond with prose.`;

const criteriaToolSchema = {
  type: "object",
  properties: {
    role_title: { type: ["string", "null"] },
    seniority_level: {
      type: ["string", "null"],
      enum: ["Junior", "Mid", "Senior", "Lead", "Director", "VP/C-suite", null],
    },
    industry: { type: ["string", "null"] },
    skills: {
      type: "array",
      items: { type: "string" },
      description: "Up to 20 specific tools/technologies/platforms.",
    },
    location_city: { type: ["string", "null"] },
    location_country: { type: ["string", "null"] },
    preferred_work_type: {
      type: ["string", "null"],
      enum: ["Remote", "Hybrid", "On-site", null],
    },
    salary_min: { type: ["integer", "null"] },
    salary_max: { type: ["integer", "null"] },
    years_experience_min: { type: ["integer", "null"] },
    years_experience_max: { type: ["integer", "null"] },
    summary: { type: ["string", "null"] },
  },
  required: ["skills"],
};

// ── Heuristic fallback (when no API key or Claude errors) ──

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

const AU_CITIES = [
  "Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide",
  "Canberra", "Hobart", "Darwin", "Gold Coast",
];

const SENIORITY_PATTERNS: Array<[RegExp, string]> = [
  [/\b(c[-\s]?suite|cto|cfo|ceo|coo|chief)\b/i, "VP/C-suite"],
  [/\b(vp|vice president|head of)\b/i, "VP/C-suite"],
  [/\b(director)\b/i, "Director"],
  [/\b(staff|principal|lead)\b/i, "Lead"],
  [/\b(senior|sr\.?)\b/i, "Senior"],
  [/\b(mid[-\s]?level|intermediate)\b/i, "Mid"],
  [/\b(junior|jr\.?|graduate|entry[-\s]?level)\b/i, "Junior"],
];

function heuristicParseJd(text: string) {
  const lower = text.toLowerCase();

  let seniority: string | null = null;
  for (const [re, level] of SENIORITY_PATTERNS) {
    if (re.test(text)) { seniority = level; break; }
  }

  const skills: string[] = [];
  for (const skill of COMMON_SKILLS) {
    if (lower.includes(skill.toLowerCase()) && !skills.includes(skill)) {
      skills.push(skill);
    }
  }

  let city: string | null = null;
  let country: string | null = null;
  for (const c of AU_CITIES) {
    if (lower.includes(c.toLowerCase())) { city = c; country = "Australia"; break; }
  }

  let workType: string | null = null;
  if (/\bremote\b/i.test(text)) workType = "Remote";
  else if (/\bhybrid\b/i.test(text)) workType = "Hybrid";
  else if (/\b(on[-\s]?site|in[-\s]?office)\b/i.test(text)) workType = "On-site";

  // First non-empty line as a heuristic role title
  const firstLine = text.split("\n").map((l) => l.trim()).find((l) => l.length > 3 && l.length < 100) || null;

  const salaryMatch = text.match(/\$?(\d{2,3}),?(\d{3})(?:\s*[-–to]+\s*\$?(\d{2,3}),?(\d{3}))?/);
  let salaryMin: number | null = null;
  let salaryMax: number | null = null;
  if (salaryMatch) {
    salaryMin = parseInt(salaryMatch[1] + salaryMatch[2]);
    salaryMax = salaryMatch[3] ? parseInt(salaryMatch[3] + salaryMatch[4]) : salaryMin;
  }

  const yearsMatch = text.match(/(\d+)\+?\s*(?:to\s*)?(\d+)?\s*\+?\s*years?/i);
  const yearsMin = yearsMatch ? parseInt(yearsMatch[1]) : null;
  const yearsMax = yearsMatch && yearsMatch[2] ? parseInt(yearsMatch[2]) : null;

  return {
    role_title: firstLine,
    seniority_level: seniority,
    industry: null,
    skills: skills.slice(0, 20),
    location_city: city,
    location_country: country,
    preferred_work_type: workType,
    salary_min: salaryMin,
    salary_max: salaryMax,
    years_experience_min: yearsMin,
    years_experience_max: yearsMax,
    summary: null,
  };
}

// ── Claude path ──

interface JdCriteria {
  role_title: string | null;
  seniority_level: string | null;
  industry: string | null;
  skills: string[];
  location_city: string | null;
  location_country: string | null;
  preferred_work_type: string | null;
  salary_min: number | null;
  salary_max: number | null;
  years_experience_min: number | null;
  years_experience_max: number | null;
  summary: string | null;
}

async function parseWithClaude(text: string, apiKey: string): Promise<JdCriteria> {
  const client = new Anthropic({ apiKey });
  const jdText = text.length > 24000 ? text.slice(0, 24000) + "\n\n[truncated]" : text;

  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [
      {
        name: "record_job_criteria",
        description: "Record extracted hiring criteria from a job description.",
        input_schema: criteriaToolSchema as unknown as Anthropic.Tool["input_schema"],
      },
    ],
    tool_choice: { type: "tool", name: "record_job_criteria" },
    messages: [
      { role: "user", content: `Job description:\n\n${jdText}` },
    ],
  });

  const block = response.content.find(
    (b: { type: string }) => b.type === "tool_use",
  ) as Anthropic.ToolUseBlock | undefined;

  if (!block) throw new Error("Claude response had no tool_use block");

  console.log("[parse-jd] cache:", JSON.stringify({
    created: response.usage.cache_creation_input_tokens,
    read: response.usage.cache_read_input_tokens,
    input: response.usage.input_tokens,
    output: response.usage.output_tokens,
  }));

  return block.input as JdCriteria;
}

// ── Candidate ranking ──

interface CandidateRow {
  id: string;
  role_applied_for: string | null;
  seniority_level: string | null;
  industry: string | null;
  skills: string[] | null;
  location_city: string | null;
  preferred_work_type: string | null;
  salary_expectation_min: number | null;
  salary_expectation_max: number | null;
  years_experience: number | null;
  status: string | null;
}

function scoreCandidate(c: CandidateRow, j: JdCriteria): { score: number; matched: string[] } {
  let score = 0;
  const matched: string[] = [];

  if (j.role_title && c.role_applied_for) {
    const role = j.role_title.toLowerCase();
    const candRole = c.role_applied_for.toLowerCase();
    if (candRole.includes(role) || role.includes(candRole)) {
      score += 30;
      matched.push("role");
    } else {
      // Partial token overlap
      const tokens = role.split(/\s+/).filter((t) => t.length > 3);
      const overlap = tokens.filter((t) => candRole.includes(t)).length;
      if (overlap > 0) score += Math.min(15, overlap * 5);
    }
  }

  if (j.seniority_level && c.seniority_level) {
    if (c.seniority_level.toLowerCase().includes(j.seniority_level.toLowerCase().split(/[\s\/]/)[0])) {
      score += 20;
      matched.push("seniority");
    }
  }

  if (j.skills && j.skills.length > 0 && Array.isArray(c.skills)) {
    const candSkillsLower = c.skills.map((s) => s.toLowerCase());
    const overlap = j.skills.filter((s) => candSkillsLower.includes(s.toLowerCase())).length;
    if (overlap > 0) {
      score += Math.min(30, overlap * 6);
      matched.push(`${overlap} skill${overlap > 1 ? "s" : ""}`);
    }
  }

  if (j.location_city && c.location_city) {
    if (c.location_city.toLowerCase() === j.location_city.toLowerCase()) {
      score += 10;
      matched.push("location");
    }
  }

  if (j.preferred_work_type && c.preferred_work_type === j.preferred_work_type) {
    score += 10;
    matched.push("work type");
  }

  if (j.salary_max && c.salary_expectation_min && c.salary_expectation_min <= j.salary_max) {
    score += 5;
    matched.push("salary fit");
  }

  if (j.years_experience_min && c.years_experience && c.years_experience >= j.years_experience_min) {
    score += 5;
  }

  return { score, matched };
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
    const { text } = await req.json();

    if (!text || typeof text !== "string" || text.trim().length < 30) {
      return new Response(
        JSON.stringify({ error: "Job description text is required (min 30 chars)" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    // Parse JD with Claude (fallback to heuristic on error or missing key)
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    let parsed: JdCriteria;

    if (apiKey) {
      try {
        parsed = await parseWithClaude(text, apiKey);
      } catch (err) {
        console.error("[parse-jd] Claude parse failed, using heuristic fallback:", err);
        parsed = heuristicParseJd(text);
      }
    } else {
      console.warn("[parse-jd] ANTHROPIC_API_KEY not set — using heuristic fallback");
      parsed = heuristicParseJd(text);
    }

    // Query candidates_public with broad filters from parsed criteria
    let query = adminClient.from("candidates_public").select("*").eq("status", "available");
    if (parsed.industry) query = query.eq("industry", parsed.industry);
    if (parsed.location_city) query = query.ilike("location_city", `%${parsed.location_city}%`);

    const { data: rows, error: queryError } = await query.limit(200);
    if (queryError) {
      return new Response(JSON.stringify({ error: queryError.message }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    // Score and rank
    const ranked = (rows ?? [])
      .map((r) => {
        const { score, matched } = scoreCandidate(r as CandidateRow, parsed);
        return { ...r, _score: score, _matched: matched };
      })
      .filter((r) => r._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, 30);

    return new Response(
      JSON.stringify({
        parsed,
        candidates: ranked,
        total_considered: rows?.length ?? 0,
      }),
      { status: 200, headers: jsonHeaders },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
