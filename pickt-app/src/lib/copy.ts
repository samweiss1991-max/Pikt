export const COPY = {
  brand: {
    name: 'Pickt',
    namePrefix: 'Pick',
    nameSuffix: 't',
    subtitle: 'Marketplace',
    tagline: "don't get flikt, get pikt",
  },
  nav: {
    dashboard: 'Dashboard',
    picktList: 'Pickt List',
    marketplace: 'Marketplace',
    candidates: 'My candidates',
    placements: 'Placements',
    earnings: 'Earnings',
    integrations: 'Integrations',
    refer: 'Refer a candidate',
  },
  user: {
    name: 'Admin Terminal',
    plan: 'Premium Access',
  },
  marketplace: {
    headingStart: 'Discover ',
    headingItalic: 'Elite',
    headingEnd: ' Talent.',
    subtitle: 'Access our vetted pool of pre-interviewed engineering ' +
      'specialists curated for high-growth ecosystems.',
    filterBtn: 'Filter',
    newSearchBtn: 'New Search',
    candidateCount: (n: number) =>
      `Discovering ${n.toLocaleString()} vetted candidates ` +
      `ready for their next chapter.`,
    requestInterview: 'Request Interview',
    referredBy: 'Referred by',
  },
  insights: {
    marketPulseTitle: 'Market Pulse',
    marketPulseStat: '+12%',
    marketPulseSubtitle:
      'Average salary increase for Senior Engineering ' +
      'roles this quarter.',
    topReferrersTitle: 'Top Referrers',
    viewLeaderboard: 'View Leaderboard',
    hiringTitle: 'Hiring at scale?',
    hiringBody:
      'Unlock custom sourcing pipelines and dedicated ' +
      'account management.',
    hiringCta: 'Contact Sales',
  },
  emptyStates: {
    picktList: 'Your Pickt list is empty.',
    picktListCta: 'Browse Marketplace',
    candidates: 'No active candidates.',
    candidatesCta: 'Go to Marketplace',
    placements: 'No placements yet.',
    placementsCta: 'Start hiring',
    earnings: 'No earnings recorded yet.',
    earningsCta: 'View Placements',
    marketplace: 'No candidates match your filters.',
    marketplaceCta: 'Clear filters',
    integrations: 'No integrations connected.',
    integrationsCta: 'Browse available integrations',
  },
  errors: {
    generic: 'Something went wrong.',
    retry: 'Try again',
    loadFailed: 'Failed to load data.',
  },
  viewModes: {
    stack: 'Stack',
    carousel: 'Carousel',
    matrix: 'Matrix',
    fickt: 'Fickt',
    compact: 'Compact',
    focus: 'Focus',
  },
  actions: {
    save: 'Save',
    unsave: 'Unsave',
    connect: 'Connect',
    disconnect: 'Disconnect',
    viewPortfolio: 'View Portfolio',
    caseStudy: 'Case Study',
    contactSales: 'Contact Sales',
    newSearch: 'New Search',
    filter: 'Filter',
    loadMore: 'Load more',
    postRole: 'Post New Role',
  },
}
