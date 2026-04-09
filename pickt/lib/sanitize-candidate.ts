/**
 * Server-side sanitization for candidate data before sending to client.
 * Ensures PII/compliance fields never leak regardless of DB query.
 */

// Fields that must NEVER be sent to any client
const NEVER_EXPOSE = [
  "date_of_birth",
  "gender",
  "cv_file_url",       // raw Supabase Storage path
  "cv_file_path",      // internal storage path
  "cover_letter_url",  // raw path
] as const;

type InterviewNote = {
  interviewer_name?: string;
  interviewer_role?: string;
  [key: string]: unknown;
};

/**
 * Strip interviewer_name from each interview_notes element.
 */
function stripInterviewerNames(
  notes: InterviewNote[] | null | undefined
): InterviewNote[] | null {
  if (!notes || !Array.isArray(notes)) return null;
  return notes.map(({ interviewer_name: _, ...rest }) => rest);
}

/**
 * Remove write-only / internal fields and strip interviewer_name.
 * Call this on every candidate object before returning from an API route.
 */
export function sanitizeCandidate<T extends Record<string, unknown>>(
  candidate: T
): Omit<T, (typeof NEVER_EXPOSE)[number]> {
  const sanitized = { ...candidate };

  // Remove never-expose fields
  for (const field of NEVER_EXPOSE) {
    delete sanitized[field];
  }

  // Strip interviewer_name from interview_notes
  if ("interview_notes" in sanitized) {
    (sanitized as Record<string, unknown>).interview_notes =
      stripInterviewerNames(
        (sanitized as Record<string, unknown>).interview_notes as
          | InterviewNote[]
          | null
      );
  }

  // Indicate whether CV / cover letter exist (boolean) without exposing paths
  const raw = candidate as Record<string, unknown>;
  (sanitized as Record<string, unknown>).has_cv =
    !!raw.cv_file_url || !!raw.cv_file_path;
  (sanitized as Record<string, unknown>).has_cover_letter =
    !!raw.cover_letter_url;

  // Count additional documents without exposing paths
  const additionalDocs = raw.additional_documents;
  (sanitized as Record<string, unknown>).additional_documents_count =
    Array.isArray(additionalDocs) ? additionalDocs.length : 0;
  delete (sanitized as Record<string, unknown>).additional_documents;

  return sanitized as Omit<T, (typeof NEVER_EXPOSE)[number]>;
}
