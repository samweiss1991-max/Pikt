import { useState } from 'react'
import './ReferralPanel.css'

const money = n => `$${Math.round(n).toLocaleString('en-AU')}`

function initials(name) {
  return String(name).split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

/**
 * The three referral states. Figures come from the server (referral-status), and
 * it only ever sends the rate for this company's position.
 * `action` is the button for the open state, if this screen has one.
 */
export default function ReferralPanel({ status, salaryLow, salaryHigh, action }) {
  const [testimonialNote, setTestimonialNote] = useState(false)
  if (!status) return null

  if (status.state === 'full') {
    return (
      <section className="rp rp--full" aria-label="Referral status">
        <h2 className="rp-title">Referrals are full</h2>
        <p className="rp-text">This candidate already has the maximum of two referrers, so new referrals can't earn commission.</p>
        <button type="button" className="rp-btn rp-btn--secondary press-scale" onClick={() => setTestimonialNote(true)}>
          Write a testimonial
        </button>
        {testimonialNote && <p className="rp-text rp-note" role="status">Testimonials are being added to Pickt, and this button will open the form once they're ready.</p>}
      </section>
    )
  }

  if (status.state === 'yours') {
    return (
      <section className="rp rp--info" aria-label="Referral status">
        <h2 className="rp-title">You've already referred this candidate</h2>
        <p className="rp-text">
          You're the {status.position === 1 ? '1st' : '2nd'} referrer, and you'll earn {Number(status.rate)}% of their first-year salary if they're hired.
        </p>
        <a className="rp-link" href="/my-candidates">Go to my candidates</a>
      </section>
    )
  }

  if (status.state === 'hired') {
    return (
      <section className="rp rp--full" aria-label="Referral status">
        <h2 className="rp-title">This candidate has been hired</h2>
        <p className="rp-text">They can't be referred any more.</p>
      </section>
    )
  }

  if (status.state === 'review') {
    return (
      <section className="rp rp--full" aria-label="Referral status">
        <h2 className="rp-title">We need to check these details</h2>
        <p className="rp-text">This email and mobile number match different candidates on Pickt. Please check they're correct. If they are, you can submit the referral and the Pickt team will review it.</p>
      </section>
    )
  }

  const low = salaryLow ?? status.salaryLow
  const high = salaryHigh ?? status.salaryHigh
  const rate = Number(status.rate)
  const hasEstimate = low > 0 && high > 0
  const isFirst = status.position === 1

  return (
    <section className="rp rp--open" aria-label="Referral status">
      {!isFirst && status.referrers?.length > 0 && (
        <div className="rp-chips">
          {status.referrers.map(name => (
            <span key={name} className="rp-chip">
              <span className="rp-chip-logo" aria-hidden="true">{initials(name)}</span>
              {name}
            </span>
          ))}
        </div>
      )}
      <h2 className="rp-title">{isFirst ? 'Be the first referrer' : 'Be the second referrer'}</h2>
      <p className="rp-big">{rate}%</p>
      <p className="rp-text">of their first-year salary if they're hired</p>
      {hasEstimate ? (
        <p className="rp-estimate">Estimated earnings {money(low * rate / 100)} – {money(high * rate / 100)}</p>
      ) : (
        <p className="rp-text rp-note">You'll see estimated earnings once a salary range has been added.</p>
      )}
      {!isFirst && (
        <p className="rp-spots">{status.spotsLeft} referral {status.spotsLeft === 1 ? 'spot' : 'spots'} left</p>
      )}
      {action}
    </section>
  )
}
