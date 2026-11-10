export const ROLE_TO_CATEGORY = {
  // Engineering
  'Backend Engineer': 'Engineering',
  'Frontend Engineer': 'Engineering',
  'DevOps Engineer': 'Engineering',
  'DevOps/Cloud Engineer': 'Engineering',
  'Solutions Architect': 'Engineering',
  'ML / AI Engineer': 'Engineering',
  'ML/AI Engineer': 'Engineering',
  'Mobile Engineer': 'Engineering',
  'Platform Engineer': 'Engineering',
  'QA Engineer': 'Engineering',
  'QA/Test Engineer': 'Engineering',
  'Software Engineer': 'Engineering',
  'Security Engineer': 'Engineering',
  'Senior Backend Engineer': 'Engineering',
  'Staff Frontend Engineer': 'Engineering',

  // Sales
  'Account Executive': 'Sales',
  'SDR / BDR': 'Sales',
  'SDR/BDR': 'Sales',
  'Head of Sales': 'Sales',
  'Enterprise Sales': 'Sales',
  'Sales Operations': 'Sales',
  'Revenue Operations': 'Sales',
  'Partnerships Manager': 'Sales',

  // Product
  'Product Manager': 'Product',
  'Head of Product': 'Product',
  'UX / UI Designer': 'Product',
  'UX/UI Designer': 'Product',
  'Product Designer': 'Product',
  'UX Researcher': 'Product',
  'Design Lead': 'Product',

  // Data
  'Data Analyst': 'Data',
  'Data Scientist': 'Data',
  'Data Engineer': 'Data',
  'Analytics Engineer': 'Data',
  'BI Developer': 'Data',
  'Head of Data': 'Data',
  'ML Engineer': 'Data',

  // Operations
  'Operations Manager': 'Operations',
  'COO': 'Operations',
  'Project Manager': 'Operations',
  'Supply Chain': 'Operations',
  'Logistics': 'Operations',
  'Process Improvement': 'Operations',

  // Finance
  'CFO / Finance Director': 'Finance',
  'CFO/Finance Director': 'Finance',
  'Finance Manager': 'Finance',
  'FP&A': 'Finance',
  'Financial Analyst': 'Finance',
  'Accountant': 'Finance',
  'Risk & Compliance': 'Finance',
  'FinTech Product': 'Finance',
}

export function computeCategoryCounts(candidates) {
  const counts = {}
  let total = 0

  for (const c of candidates) {
    total++
    const role = c.role_applied_for || c.role
    const category = ROLE_TO_CATEGORY[role]
    if (category) {
      counts[category] = (counts[category] || 0) + 1
    }
  }

  counts['Final round'] = candidates.filter((c) =>
    (c.interview_stage_reached || '').toLowerCase().includes('final')
  ).length

  counts['Remote'] = candidates.filter((c) => {
    const w = (c.preferred_work_type || '').toLowerCase()
    return w === 'remote'
  }).length

  return { totalCount: total, categoryCounts: counts }
}
