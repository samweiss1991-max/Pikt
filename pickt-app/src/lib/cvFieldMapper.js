/**
 * Maps parsed CV or ATS candidate data to the Refer form shape.
 * Accepts partial data — only overrides fields that have values.
 */
export function mapParsedDataToForm(parsed, initial) {
  return {
    ...initial,
    role_applied_for: parsed.current_job_title || parsed.role_applied_for || initial.role_applied_for,
    location_city: parsed.location_city || initial.location_city,
    location_state: parsed.location_state || initial.location_state,
    location_country: parsed.location_country || initial.location_country,
    skills: (parsed.skills && parsed.skills.length > 0) ? parsed.skills : initial.skills,
    current_employer: parsed.current_employer || initial.current_employer,
    current_job_title: parsed.current_job_title || initial.current_job_title,
    mobile_number: parsed.phone || parsed.mobile_number || initial.mobile_number,
    linkedin_url: parsed.linkedin_url || initial.linkedin_url,
    portfolio_url: parsed.portfolio_url || initial.portfolio_url,
    years_experience: parsed.years_experience || initial.years_experience,
    seniority_level: parsed.seniority_level || initial.seniority_level,
    industry: parsed.industry || initial.industry,
    interview_stage_reached: parsed.interview_stage_reached || initial.interview_stage_reached,
    interviews_completed: parsed.interviews_completed || initial.interviews_completed,
    why_not_hired: parsed.why_not_hired || initial.why_not_hired,
    strengths: parsed.strengths || initial.strengths,
    gaps: parsed.gaps || initial.gaps,
    feedback_summary: parsed.feedback_summary || initial.feedback_summary,
    recommendation: parsed.recommendation || initial.recommendation,
  }
}
