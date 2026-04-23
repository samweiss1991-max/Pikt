// Supabase Edge Function: parse-cv
// Accepts a file path in candidate-documents storage,
// downloads the file, extracts text, and returns structured candidate data.
//
// Deploy: supabase functions deploy parse-cv

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Heuristic text parsers ────────────────────────────────────

function extractEmail(text: string): string | null {
  const match = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  return match ? match[0] : null;
}

function extractPhone(text: string): string | null {
  const match = text.match(/(\+?\d[\d\s\-().]{7,}\d)/);
  return match ? match[1].trim() : null;
}

function extractLinkedIn(text: string): string | null {
  const match = text.match(/https?:\/\/(www\.)?linkedin\.com\/in\/[\w-]+\/?/i);
  return match ? match[0] : null;
}

function extractName(text: string): string | null {
  // First non-empty line that isn't an email/phone/url
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 5)) {
    if (line.includes("@") || line.match(/^\+?\d/) || line.includes("http")) continue;
    if (line.length > 3 && line.length < 60) return line;
  }
  return null;
}

const COMMON_SKILLS = [
  // Tech
  "JavaScript", "TypeScript", "Python", "Java", "Go", "Rust", "C#", "C++", "Ruby", "PHP", "Swift", "Kotlin",
  "React", "Vue", "Angular", "Next.js", "Node.js", "Express", "Django", "Flask", "Spring", "Rails",
  "PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch", "DynamoDB",
  "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Terraform", "CI/CD",
  "GraphQL", "REST", "gRPC", "Kafka", "RabbitMQ",
  "Machine Learning", "Deep Learning", "NLP", "Computer Vision", "PyTorch", "TensorFlow",
  "Figma", "Sketch", "Adobe XD",
  // Business
  "SQL", "Excel", "Tableau", "Power BI", "Salesforce", "HubSpot",
  "Agile", "Scrum", "Jira", "Confluence",
  "Product Management", "Product Strategy", "User Research", "A/B Testing",
  "Account Management", "Business Development", "Pipeline Management",
  "Financial Modeling", "FP&A", "Budgeting",
  "Data Analysis", "Data Engineering", "ETL", "dbt", "Airflow", "Spark",
];

function extractSkills(text: string): string[] {
  const found: string[] = [];
  const lower = text.toLowerCase();
  for (const skill of COMMON_SKILLS) {
    if (lower.includes(skill.toLowerCase()) && !found.includes(skill)) {
      found.push(skill);
    }
  }
  return found.slice(0, 15);
}

function extractLocation(text: string): { city: string; state: string; country: string } | null {
  // Common AU cities
  const cities = ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Canberra", "Hobart", "Darwin", "Gold Coast"];
  const lower = text.toLowerCase();
  for (const city of cities) {
    if (lower.includes(city.toLowerCase())) {
      return { city, state: "", country: "Australia" };
    }
  }
  // Try common international cities
  const intl: Record<string, string> = {
    "London": "United Kingdom", "New York": "United States", "San Francisco": "United States",
    "Berlin": "Germany", "Amsterdam": "Netherlands", "Singapore": "Singapore", "Toronto": "Canada",
  };
  for (const [city, country] of Object.entries(intl)) {
    if (lower.includes(city.toLowerCase())) {
      return { city, state: "", country };
    }
  }
  return null;
}

function extractCurrentRole(text: string): { title: string; company: string } | null {
  // Look for patterns like "Senior Engineer at Company" or "Role | Company"
  const patterns = [
    /(?:^|\n)\s*(.+?)\s+at\s+(.+?)(?:\n|$)/i,
    /(?:^|\n)\s*(.+?)\s*[|–—]\s*(.+?)(?:\n|$)/i,
  ];
  // Search near top section or after "Experience" heading
  const sections = text.split(/\n(?:experience|work\s*history|employment)/i);
  const searchText = sections.length > 1 ? sections[1].slice(0, 500) : text.slice(0, 1500);

  for (const pattern of patterns) {
    const match = searchText.match(pattern);
    if (match && match[1].length < 60 && match[2].length < 60) {
      return { title: match[1].trim(), company: match[2].trim() };
    }
  }
  return null;
}

function extractYearsExperience(text: string): number | null {
  const match = text.match(/(\d+)\+?\s*years?\s*(?:of\s*)?(?:experience|exp)/i);
  return match ? parseInt(match[1]) : null;
}

// ── Simple DOCX text extractor ────────────────────────────────
// DOCX = ZIP of XML files. We extract text from word/document.xml.

async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  // Use the DecompressionStream API available in Deno
  const { default: JSZip } = await import("https://esm.sh/jszip@3.10.1");
  const zip = await JSZip.loadAsync(buffer);
  const docXml = await zip.file("word/document.xml")?.async("string");
  if (!docXml) return "";
  // Strip XML tags, keep text content
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

// ── Main handler ──────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { storagePath, filename } = await req.json();

    if (!storagePath) {
      return new Response(JSON.stringify({ error: "storagePath is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download file from storage
    const { data: fileData, error: downloadError } = await adminClient.storage
      .from("candidate-documents")
      .download(storagePath);

    if (downloadError || !fileData) {
      return new Response(
        JSON.stringify({ error: `Download failed: ${downloadError?.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract text based on file type
    let text = "";
    const lowerName = (filename || storagePath).toLowerCase();

    if (lowerName.endsWith(".docx")) {
      const buffer = await fileData.arrayBuffer();
      text = await extractDocxText(buffer);
    } else if (lowerName.endsWith(".pdf")) {
      // For PDF: attempt to read as text (works for text-based PDFs)
      // Full PDF parsing would require pdf-parse or pdfjs — for MVP, extract raw text
      text = await fileData.text();
      // Clean up binary PDF artifacts
      text = text.replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s{3,}/g, " ");
    } else {
      return new Response(JSON.stringify({ error: "Unsupported file type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!text || text.trim().length < 20) {
      return new Response(
        JSON.stringify({
          error: "Could not extract text from this file. It may be image-based.",
          parsed: null,
          confidence: "none",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse structured data from text
    const name = extractName(text);
    const email = extractEmail(text);
    const phone = extractPhone(text);
    const linkedin = extractLinkedIn(text);
    const skills = extractSkills(text);
    const location = extractLocation(text);
    const currentRole = extractCurrentRole(text);
    const years = extractYearsExperience(text);

    const fieldsFound = [name, email, phone, skills.length > 0, location, currentRole, years]
      .filter(Boolean).length;
    const confidence = fieldsFound >= 5 ? "high" : fieldsFound >= 3 ? "medium" : "low";

    const parsed = {
      name: name || null,
      email: email || null,
      phone: phone || null,
      linkedin_url: linkedin || null,
      skills,
      location_city: location?.city || null,
      location_state: location?.state || null,
      location_country: location?.country || null,
      current_job_title: currentRole?.title || null,
      current_employer: currentRole?.company || null,
      years_experience: years || null,
      confidence,
    };

    return new Response(JSON.stringify({ parsed, confidence }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
