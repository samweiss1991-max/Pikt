// Interview snapshot for the back of the candidate card.
// Each row: employer description, furthest stage, interview count and a short
// teaser — never the employer's name, full feedback or outcome reason.
//
// Real candidates: comes from the candidates_public view (migration 027).
// Demo candidates: derived from the demo interview data with the same rules.

import { demoInterviews } from '../data/demoInterviews'
import { isDemoCandidateId } from './candidateProfile'
import { CARD_TEASER_LENGTH, feedbackTeaser, stageRank } from '../../supabase/functions/_shared/profileShape.js'
import { SILVER_MEDALLIST } from '../../supabase/functions/_shared/candidateFields.js'

export function getInterviewSnapshot(c) {
  if (!c) return []
  if (Array.isArray(c.interviewSnapshot)) {
    return c.interviewSnapshot.map(r => ({
      description: r.description || 'Employer',
      stage: r.stage,
      stageRank: r.stage_rank ?? stageRank(r.stage),
      interviews: r.interviews ?? 0,
      teaser: r.teaser || null,
    }))
  }
  if (!isDemoCandidateId(c.id)) return []
  return demoInterviews(c)
    .map(iv => ({
      description: [iv.employer_industry, iv.employer_location].filter(Boolean).join(' · ') || 'Employer',
      stage: iv.stage_reached,
      stageRank: stageRank(iv.stage_reached),
      interviews: iv.interviews_completed || 0,
      teaser: feedbackTeaser(iv.note_impressed || iv.feedback, CARD_TEASER_LENGTH),
    }))
    .sort((a, b) => b.stageRank - a.stageRank || b.interviews - a.interviews)
}

/** A positive signal shown before unlocking. Real candidates: from candidates_public. */
export function isSilverMedallist(c) {
  if (!c) return false
  if (typeof c.is_silver_medallist === 'boolean') return c.is_silver_medallist
  if (!isDemoCandidateId(c.id)) return false
  return demoInterviews(c).some(iv => iv.outcome === SILVER_MEDALLIST)
}
