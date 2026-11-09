import './InterviewNotesCard.css'

const GOOD_AT = 150
const GREAT_AT = 300

const QUESTIONS = [
  {
    field: 'note_impressed',
    label: 'What impressed you most?',
    required: true,
    placeholder: 'e.g. Walked us through how she cut onboarding time by 30% – clear, structured and backed by data.',
  },
  {
    field: 'note_why_not_offer',
    label: "Why didn't they get the offer?",
    required: true,
    placeholder: 'e.g. We chose someone with more fintech experience – it was very close.',
  },
  {
    field: 'note_best_fit',
    label: 'What kind of role or team would suit them best?',
    required: false,
    placeholder: 'e.g. A product role in a fast-moving scale-up where she can own a roadmap.',
  },
]

function quality(total) {
  if (total >= GREAT_AT) return { label: 'Great – this will really help', level: 'great' }
  if (total >= GOOD_AT) return { label: 'Good', level: 'good' }
  return { label: 'Add a bit more detail', level: 'low' }
}

/** Plain props so it keeps focus while typing: values and an onChange(field, text). */
export default function InterviewNotesCard({ values, onChange }) {
  const total = QUESTIONS.reduce((n, q) => n + String(values[q.field] || '').trim().length, 0)
  const { label, level } = quality(total)

  return (
    <div>
      <section className="in-card" aria-labelledby="in-heading">
        <span className="in-badge">Important</span>
        <h3 className="in-heading" id="in-heading">Interview notes</h3>
        <p className="in-lead">These notes are what employers read first. The more specific you are, the more likely this candidate gets picked.</p>

        {QUESTIONS.map(q => (
          <div key={q.field} className="in-question">
            <label className="rf-label" htmlFor={`in-${q.field}`}>{q.label}{q.required && ' *'}</label>
            <textarea
              id={`in-${q.field}`}
              className="rf-textarea"
              required={q.required}
              aria-required={q.required || undefined}
              placeholder={q.placeholder}
              value={values[q.field] || ''}
              onChange={e => onChange(q.field, e.target.value)}
            />
          </div>
        ))}
      </section>

      <div className="in-meter-wrap">
        <div
          className={`in-meter in-meter--${level}`}
          role="meter"
          aria-label="Interview notes detail"
          aria-valuemin={0}
          aria-valuemax={GREAT_AT}
          aria-valuenow={Math.min(total, GREAT_AT)}
          aria-valuetext={label}
        >
          <span className="in-meter-fill" style={{ width: `${Math.min(100, (total / GREAT_AT) * 100)}%` }} />
        </div>
        <p className={`in-meter-label in-meter-label--${level}`} role="status">{label}</p>
      </div>

      <p className="in-note">
        The first sentence of your answer to 'What impressed you most?' is shown as a preview on the candidate's card. The rest is only visible to employers who unlock the profile.
      </p>
      <p className="in-fairness">
        <span className="material-symbols-outlined" aria-hidden="true">info</span>
        Please don't mention age, health, family, religion, ethnicity or other personal characteristics – focus on skills and performance.
      </p>
    </div>
  )
}
