// Icon symbol based on role keywords
export function getIconForRole(role) {
  const r = (role || '').toLowerCase()
  if (r.includes('frontend') || r.includes('react') || r.includes('design')) return 'architecture'
  if (r.includes('cloud') || r.includes('devops') || r.includes('platform')) return 'cloud'
  if (r.includes('data') || r.includes('analytics') || r.includes('ml')) return 'database'
  if (r.includes('security')) return 'shield'
  if (r.includes('mobile')) return 'smartphone'
  if (r.includes('product')) return 'category'
  if (r.includes('sales') || r.includes('account') || r.includes('revenue')) return 'trending_up'
  if (r.includes('marketing') || r.includes('growth') || r.includes('seo')) return 'campaign'
  if (r.includes('hr') || r.includes('people') || r.includes('talent')) return 'groups'
  if (r.includes('finance') || r.includes('cfo')) return 'account_balance'
  if (r.includes('legal') || r.includes('compliance') || r.includes('privacy')) return 'gavel'
  if (r.includes('operations') || r.includes('coo') || r.includes('project')) return 'settings'
  if (r.includes('customer') || r.includes('success')) return 'support_agent'
  return 'code'
}

// Gradient class based on index
const GRADIENTS = [
  'from-primary-container to-secondary-container',
  'from-tertiary-fixed to-primary-fixed-dim',
  'from-secondary-container to-primary-container',
  'from-primary-fixed-dim to-tertiary-container',
  'from-tertiary-container to-secondary-container',
  'from-secondary-fixed to-primary-container',
]

export function getGradientClass(index) {
  return GRADIENTS[index % GRADIENTS.length]
}
