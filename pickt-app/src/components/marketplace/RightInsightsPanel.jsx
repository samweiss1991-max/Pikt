import MarketPulseCard from './MarketPulseCard'
import TopReferrersCard from './TopReferrersCard'
import HiringCTACard from './HiringCTACard'

export default function RightInsightsPanel() {
  return (
    <div className="ri-panel">
      <MarketPulseCard />
      <TopReferrersCard />
      <HiringCTACard />
    </div>
  )
}
