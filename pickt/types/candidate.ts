// Fields always visible — returned by candidates_public view
export type CandidatePublic = {
  id: string;
  role_applied_for: string;
  seniority_level: string;
  years_experience: number | null;
  skills: string[];
  employment_type: string | null;
  salary_expectation_min: number | null;
  salary_expectation_max: number | null;
  notice_period_days: number | null;
  available_from: string | null;
  location_city: string;
  location_state: string | null;
  location_country: string;
  residency_status: string | null;
  preferred_work_type: string;
  willing_to_relocate: boolean | null;
  interview_stage_reached: string;
  interviews_completed: number;
  why_not_hired: string;
  recommendation: string;
  strengths: string;
  gaps: string;
  feedback_summary: string | null;
  interview_notes: InterviewNote[] | null; // interviewer_name stripped
  skill_ratings: SkillRating[] | null;
  fee_percentage: number;
  pii_redacted: boolean;
  status: "available" | "unlocked" | "placed" | "withdrawn";
  uploaded_by_company_id: string;
  created_at: string;
  unlocked: false;
  // Computed fields added by API
  days_ago: number;
  role_score: number;
  seniority_score: number;
  interview_score: number;
  recency_score: number;
  total_score: number;
};

// Additional fields revealed after unlock
export type CandidateUnlocked = CandidatePublic & {
  unlocked: true;
  full_name: string;
  email: string;
  mobile_number: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  current_employer: string | null;
  current_job_title: string | null;
  // CV — signed URLs generated on demand, not stored here
  has_cv: boolean;
  has_cover_letter: boolean;
  cv_filename: string | null;
  additional_documents_count: number;
  // NEVER included — enforced by type system:
  // date_of_birth — omitted
  // gender — omitted
  // cv_file_url — omitted (use /cv-url endpoint)
  // cover_letter_url — omitted
  // additional_documents — raw paths omitted
};

export type InterviewNote = {
  round_number: number;
  // interviewer_name — OMITTED, stripped server-side
  interviewer_role: string | null;
  outcome: "passed" | "failed" | "withdrew";
  note_text: string | null;
  score: number | null;
  date: string | null;
};

export type SkillRating = {
  skill: string;
  rating: number;
  max: number;
};

export type CandidateResponse = CandidatePublic | CandidateUnlocked;

/** API response wrapper for /api/candidates/[id] */
export type CandidateApiResponse = {
  candidate: CandidateResponse;
  isOwner: boolean;
  referringCompanyName: string;
  hasAtsConnection: boolean;
};

/** API response for /api/unlocks POST */
export type UnlockResponse = {
  unlockId: string;
  candidateId: string;
  unlockedAt: string;
};

/** API response for /api/candidates/[id]/cv-url */
export type CvUrlResponse = {
  signedUrl: string;
  expiresAt: string;
  filename: string | null;
};
