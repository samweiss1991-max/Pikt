-- ============================================================
-- Strip interviewer_name from interview_notes in public view
-- and ensure date_of_birth/gender are never exposed
-- ============================================================

-- Helper function: strips interviewer_name from each element
-- in the interview_notes jsonb array
create or replace function strip_interviewer_name(notes jsonb)
returns jsonb as $$
  select case
    when notes is null then null
    else (
      select jsonb_agg(elem - 'interviewer_name')
      from jsonb_array_elements(notes) as elem
    )
  end;
$$ language sql immutable;

-- Recreate the candidates_public view with interviewer_name stripped
create or replace view candidates_public
  with (security_invoker = false)
as
select
  id,
  uploaded_by_company_id,

  -- Industry & role (visible)
  industry,
  role_applied_for,
  seniority_level,
  years_experience,
  skills,
  employment_type,
  salary_expectation_min,
  salary_expectation_max,
  notice_period_days,
  available_from,

  -- Location (visible, except PII)
  location_city,
  location_state,
  location_country,
  residency_status,
  visa_type,
  nationality,
  work_rights_verified,
  preferred_work_type,
  willing_to_relocate,
  null::text    as gender,
  null::date    as date_of_birth,

  -- Application data (visible)
  date_of_application,
  source_of_application,
  ats_candidate_id,
  ats_platform,
  interview_stage_reached,
  interviews_completed,
  why_not_hired,
  recommendation,

  -- Interview feedback (visible, interviewer_name stripped)
  strengths,
  gaps,
  feedback_summary,
  strip_interviewer_name(interview_notes) as interview_notes,
  skill_ratings,

  -- PII fields → nulled
  null::text    as full_name,
  null::text    as email,
  null::text    as mobile_number,
  null::text    as linkedin_url,
  null::text    as portfolio_url,
  null::text    as current_employer,
  null::text    as current_job_title,

  -- CV & documents → nulled
  null::text    as cv_file_url,
  null::text    as cv_filename,
  null::text    as cover_letter_url,
  null::jsonb   as additional_documents,

  -- Referral metadata (visible)
  referred_at,
  referring_company,

  -- pickt metadata (visible)
  fee_percentage,
  pii_redacted,
  status,
  source,
  consent_given,
  created_at

from candidates
where status = 'available';

-- Re-grant access after view recreation
grant select on candidates_public to authenticated;
