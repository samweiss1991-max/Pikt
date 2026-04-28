import { useNavigate } from 'react-router-dom'
import { useScrollReveal, useStaggerReveal } from '../hooks/useScrollReveal'
import './Marketplace.css'

export default function Marketplace() {
  const navigate = useNavigate()
  const headerRef = useScrollReveal()
  const cardsRef = useStaggerReveal({ staggerMs: 120 })

  const headingWords = 'How would you like to find candidates?'.split(' ')

  return (
    <div className="gw-page">
      <div className="gw-header" ref={headerRef} data-parallax-speed="0.06">
        <h1 className="gw-heading text-reveal">
          {headingWords.map((word, i) => (
            <span
              key={i}
              className="text-reveal-word"
              style={{ animationDelay: `${i * 80 + 100}ms` }}
            >
              {word}{i < headingWords.length - 1 ? ' ' : ''}
            </span>
          ))}
        </h1>
        <p
          className="gw-subheading text-reveal-word"
          style={{ animationDelay: `${headingWords.length * 80 + 200}ms` }}
        >
          Browse the full marketplace, or let AI match candidates from a job description.
        </p>
      </div>

      <div className="gw-card-grid" ref={cardsRef}>
        <button
          type="button"
          className="gw-card-option hover-lift press-scale"
          onClick={() => navigate('/marketplace/discover')}
          data-reveal
        >
          <div className="gw-card-icon">
            <span className="material-symbols-outlined">search</span>
          </div>
          <div className="gw-card-title">Search marketplace</div>
          <div className="gw-card-desc">
            Browse and filter the full network of pre-vetted candidates by role, skills, location, salary, and more.
          </div>
          <div className="gw-card-cta">
            <span>Open marketplace</span>
            <span className="material-symbols-outlined">arrow_forward</span>
          </div>
        </button>

        <button
          type="button"
          className="gw-card-option gw-card-option--ai hover-lift press-scale"
          onClick={() => navigate('/marketplace/upload')}
          data-reveal
        >
          <div className="gw-card-badge">AI-powered</div>
          <div className="gw-card-icon gw-card-icon--ai">
            <span className="material-symbols-outlined">auto_awesome</span>
          </div>
          <div className="gw-card-title">Upload job description</div>
          <div className="gw-card-desc">
            Drop a PDF, DOCX, or paste a job spec. We&rsquo;ll extract the role, skills, and requirements, then surface the best-matching candidates.
          </div>
          <div className="gw-card-cta">
            <span>Upload &amp; match</span>
            <span className="material-symbols-outlined">arrow_forward</span>
          </div>
        </button>
      </div>
    </div>
  )
}
