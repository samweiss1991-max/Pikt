// Interview snapshot for the back of the candidate card.
// Each row: employer description, furthest stage, interview count and a short
// teaser — never the employer's name, full feedback or outcome reason.
//
// Real candidates: comes from the candidates_public view (migration 027).
// Demo candidates: derived from the demo interview data with the same rules.

import { demoInterviews } from '../data/demoInterviews'
import { isDemoCandidateId } from './candidateProfile'
import { feedbackTeaser, stageRank } from '../../supabase/functions/_shared/profileShape.js'

export const CARD_TEASER_LENGTH = 55

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
      teaser: feedbackTeaser(iv.feedback, CARD_TEASER_LENGTH),
    }))
    .sort((a, b) => b.stageRank - a.stageRank || b.interviews - a.interviews)
}
