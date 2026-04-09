export interface Candidate {
  id: string
  role: string
  salary: string
  description: string
  skills: string[]
  iconSymbol: string
  iconGradient: string
  referrerBadge: { label: string; variant: 'green' | 'amber' }
  cta: { primary: string; secondary: string }
}

export interface Referrer {
  id: string
  initials: string
  name: string
  pickCount: number
  avatarBgClass: string
  avatarTextClass: string
}

export interface NavItem {
  label: string
  route: string
  icon: string
  badge?: number
  fillOnActive?: boolean
}

export type ViewMode =
  'stack' | 'carousel' | 'matrix' | 'fickt' | 'compact' | 'focus'

export type PageState = 'loading' | 'loaded' | 'empty' | 'error'

export interface PlacementRecord {
  id: string
  candidateRole: string
  company: string
  placementDate: string
  feeAmount: number
  status: 'pending' | 'confirmed' | 'paid'
}

export interface EarningRecord {
  id: string
  placementId: string
  amount: number
  month: number
  year: number
  status: 'pending' | 'paid'
}

export interface Integration {
  id: string
  name: string
  category: string
  logoSymbol: string
  status: 'connected' | 'available' | 'coming_soon'
}

export interface BadgeProps {
  count: number
  variant?: 'primary' | 'error'
}

export interface PageShellProps {
  children: React.ReactNode
  activeRoute: string
}
