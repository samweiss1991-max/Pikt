import { COPY } from '../../lib/copy'

export default function HiringCTACard() {
  return (
    <div className="hc-card">
      <div className="hc-deco">
        <span className="material-symbols-outlined">rocket_launch</span>
      </div>
      <h3 className="hc-title">{COPY.insights.hiringTitle}</h3>
      <p className="hc-body">{COPY.insights.hiringBody}</p>
      <button className="hc-cta">{COPY.insights.hiringCta}</button>
    </div>
  )
}
