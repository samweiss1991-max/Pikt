You are the lead product designer and frontend engineer for pickt,
a two-sided talent marketplace. Your job is to redesign every page
and component in this codebase using the design system described
below. This is a FULL REPLACEMENT of the existing dark theme.
Delete all previous colour tokens, typography settings, and surface
styles. Nothing from the old system carries over unless explicitly
stated here.

Reference implementation is provided at the bottom of this prompt.
Treat it as the canonical source of truth for every visual decision.

───────────────────────────────────────
REFERENCE
───────────────────────────────────────

All color, shadow, radius, spacing, and animation decisions
live in DESIGN_TOKENS.md — do not redefine inline anywhere.

═══════════════════════════════════════════════════════════════════
PART 1 — DESIGN SYSTEM FOUNDATION
═══════════════════════════════════════════════════════════════════

INSTALL DEPENDENCIES:
npm install
npm install -D tailwindcss @tailwindcss/forms

Add to index.html:
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>

───────────────────────────────────────
COLOUR TOKENS — replace tokens.css entirely
───────────────────────────────────────

:root {
  /* Core surfaces */
  --bg:                      #fffcf1;
  --surface:                 #fffcf1;
  --surface-bright:          #fffcf1;
  --surface-container:       #f6f4e7;
  --surface-container-low:   #fcfaee;
  --surface-container-high:  #f0eee1;
  --surface-container-highest: #eae9db;
  --surface-container-lowest: #ffffff;
  --surface-dim:             #e4e3d4;
  --surface-variant:         #eae9db;

  /* Primary — forest green */
  --primary:                 #2d7235;
  --primary-dim:             #1f652a;
  --primary-fixed:           #aaf4a8;
  --primary-fixed-dim:       #9de69b;
  --on-primary:              #ffffff;
  --on-primary-fixed:        #004a15;
  --on-primary-fixed-variant: #23682d;
  --on-primary-container:    #175e24;
  --primary-container:       #aaf4a8;
  --inverse-primary:         #aaf4a8;
  --surface-tint:            #2d7235;

  /* Secondary — amber gold */
  --secondary:               #865c00;
  --secondary-dim:           #765100;
  --secondary-fixed:         #ffc96e;
  --secondary-fixed-dim:     #ffb622;
  --secondary-container:     #ffc96e;
  --on-secondary:            #ffffff;
  --on-secondary-fixed:      #483000;
  --on-secondary-fixed-variant: #6c4a00;
  --on-secondary-container:  #604100;

  /* Tertiary — sage */
  --tertiary:                #4b6c4c;
  --tertiary-dim:            #3f6041;
  --tertiary-fixed:          #d7fed5;
  --tertiary-fixed-dim:      #c9efc7;
  --tertiary-container:      #d7fed5;
  --on-tertiary:             #ffffff;
  --on-tertiary-fixed:       #315133;
  --on-tertiary-fixed-variant: #4d6e4e;
  --on-tertiary-container:   #426344;

  /* Neutral */
  --background:              #fffcf1;
  --on-background:           #383831;
  --on-surface:              #383831;
  --on-surface-variant:      #65655c;
  --outline:                 #818178;
  --outline-variant:         #bbbaaf;
  --inverse-surface:         #0e0f09;
  --inverse-on-surface:      #9e9d94;

  /* Error */
  --error:                   #be2d06;
  --error-dim:               #b92902;
  --error-container:         #f95630;
  --on-error:                #ffffff;
  --on-error-container:      #520c00;
}

───────────────────────────────────────
TYPOGRAPHY — replace global.css entirely
───────────────────────────────────────

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Manrope', sans-serif;
  background-color: var(--bg);
  color: var(--on-surface);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Scrollbar */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: var(--surface-container-highest);
  border-radius: 10px;
}

/* Text selection */
::selection {
  background: var(--secondary-container);
  color: var(--on-secondary-container);
}

/* Material Symbols */
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

───────────────────────────────────────
CARD SHAPE — the pikt-card asymmetric corner
───────────────────────────────────────

The signature card shape for pickt has an asymmetric corner radius:
top-left: 2rem, top-right: 0.5rem,
bottom-left: 0.5rem, bottom-right: 0

Apply this CSS class to ALL candidate cards, feature cards,
and content cards throughout the application:

.pikt-card {
  border-top-left-radius: 2rem;
  border-top-right-radius: 0.5rem;
  border-bottom-left-radius: 0.5rem;
  border-bottom-right-radius: 0;
}

Standard panel/container cards (stat cards, settings panels,
modals) use uniform border-radius: 1rem.
The sidebar uses border-radius: 2rem.

───────────────────────────────────────
TAILWIND CONFIG — tailwind.config.js
───────────────────────────────────────

module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,jsx,ts,tsx}', './index.html'],
  theme: {
    extend: {
      colors: {
        'primary':                  '#2d7235',
        'primary-dim':              '#1f652a',
        'primary-fixed':            '#aaf4a8',
        'primary-fixed-dim':        '#9de69b',
        'on-primary':               '#ffffff',
        'on-primary-fixed':         '#004a15',
        'on-primary-container':     '#175e24',
        'primary-container':        '#aaf4a8',
        'secondary':                '#865c00',
        'secondary-dim':            '#765100',
        'secondary-fixed':          '#ffc96e',
        'secondary-fixed-dim':      '#ffb622',
        'secondary-container':      '#ffc96e',
        'on-secondary':             '#ffffff',
        'on-secondary-container':   '#604100',
        'tertiary':                 '#4b6c4c',
        'tertiary-dim':             '#3f6041',
        'tertiary-container':       '#d7fed5',
        'on-tertiary':              '#ffffff',
        'on-tertiary-container':    '#426344',
        'background':               '#fffcf1',
        'surface':                  '#fffcf1',
        'surface-container':        '#f6f4e7',
        'surface-container-low':    '#fcfaee',
        'surface-container-high':   '#f0eee1',
        'surface-container-highest':'#eae9db',
        'surface-container-lowest': '#ffffff',
        'surface-dim':              '#e4e3d4',
        'on-surface':               '#383831',
        'on-surface-variant':       '#65655c',
        'outline':                  '#818178',
        'outline-variant':          '#bbbaaf',
        'error':                    '#be2d06',
        'error-container':          '#f95630',
        'on-error':                 '#ffffff',
      },
      borderRadius: {
        DEFAULT:  '1rem',
        lg:       '2rem',
        xl:       '3rem',
        full:     '9999px',
      },
      fontFamily: {
        sans:     ['Manrope', 'sans-serif'],
        headline: ['Manrope', 'sans-serif'],
        body:     ['Manrope', 'sans-serif'],
        label:    ['Manrope', 'sans-serif'],
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
}

═══════════════════════════════════════════════════════════════════
PART 2 — LAYOUT COMPONENTS
═══════════════════════════════════════════════════════════════════

───────────────────────────────────────
SIDEBAR (src/components/layout/Sidebar.jsx)
───────────────────────────────────────

The sidebar is a FLOATING panel, not flush to the edge.
It has a gap from all edges and rounded corners.

Positioning:
  position: fixed
  left: 1rem, top: 1rem, bottom: 1rem
  width: 18rem (288px)
  height: calc(100% - 2rem)
  border-radius: 2rem
  background: #f5f4ef  (stone-50 equivalent)
  border: 1px solid rgba(187,186,175,.15)
  z-index: 50
  display: flex, flex-direction: column

Do NOT use the old 214px fixed sidebar. Width is 18rem.

Responsive collapse:
  xl (1280px+): full sidebar (18rem, labels + icons visible)
  lg (1024px):  icon-only mode (w-16, labels hidden, tooltips on hover)
  md (768px):   sidebar hidden, hamburger menu trigger in topbar

LOGO AREA (top of sidebar, padding: 2rem):
  Logo text: "Pick" + "t"
  "Pick": font-family Manrope, font-weight 900 (black),
          font-style italic, color #1a4731 (green-800)
  "t": color var(--secondary-fixed) which is #ffc96e
  Font size: 1.5rem (24px)
  No tagline below the logo in this design.

NAV ITEMS:
  Each nav item is an <a> tag with:
    display: flex, align-items: center, gap: 0.75rem
    padding: 0.75rem 1rem
    font-size: 0.875rem (14px), font-weight: 600
    transition: all 0.3s

  INACTIVE state:
    color: stone-500 (#78716c)
    On hover: color green-700 (#15803d),
              background: rgba(214,211,209,.5) (stone-200/50)

  ACTIVE state (amber pill):
    background: var(--secondary-fixed-dim) #ffb622
    color: var(--on-secondary-fixed) #483000
    font-weight: 700 (bold)
    border-radius: 9999px
    padding: 0.625rem 1rem
    No border-right — the pill shape replaces it.

  Icons: Material Symbols Outlined, 24px
  Nav item order and icons:
    Dashboard        → icon: dashboard
    Pickt List       → icon: format_list_bulleted
    Marketplace      → icon: storefront
    Saved            → icon: bookmark
    My candidates    → icon: person_search
    Placements       → icon: handshake
    Earnings         → icon: payments
    Integrations     → icon: hub

  Nav items support an optional numeric badge prop:
    small rounded-full bg-primary text-on-primary text-[10px]
    positioned ml-auto in the nav item row

SIDEBAR FOOTER (mt-auto, padding: 1.5rem):
  1. Primary action button — full width:
     "Post New Role"
     background: var(--primary) #2d7235
     color: white
     padding: 1rem
     border-radius: 0.5rem
     font-weight: 700
     display flex, align-items center, justify-content center, gap 0.5rem
     Icon: add_circle (Material Symbols)
     On hover: scale(0.95), transition all

  2. User card below button (margin-top: 1.5rem):
     background: stone-100 (#f5f5f4)
     border-radius: 0.5rem
     padding: 1rem
     display flex, align-items center, gap 0.75rem

     Avatar: 40×40px, border-radius 9999px,
             background: var(--secondary-container) #ffc96e,
             color: var(--on-secondary-container) #604100,
             font-weight 700, initials "AC"

     Text:
       Company name: 12px, font-weight 700, color var(--on-surface)
       Role label: 10px, color var(--on-surface-variant),
             text-transform uppercase, letter-spacing wider
             Copy: "Admin Terminal" or "Premium Access"
             (matches user's plan tier)

───────────────────────────────────────
## Component Spec: Sidebar
───────────────────────────────────────

File: src/components/layout/Sidebar.tsx
'use client' — uses usePathname()

### Structure
<aside className="flex flex-col h-full p-6 gap-2 w-72
  rounded-r-[2rem] border-r border-outline-variant/10
  bg-surface-container-low z-20">

### Wordmark
<h1 className="text-2xl font-black text-[#2d7235]
  tracking-tighter">
  Pick<span className="text-[#ffc96e]">t</span>
</h1>
<p className="text-sm font-medium tracking-tight
  text-on-surface-variant">Marketplace</p>

### Nav Items (in order)
Dashboard      → icon: dashboard
Pickt List     → icon: list_alt
Marketplace    → icon: storefront (FILL 1 when active)
Saved          → icon: bookmark
My candidates  → icon: group
Placements     → icon: work_history
Earnings       → icon: payments
Integrations   → icon: extension

### Inactive nav item
className="flex items-center gap-3 px-4 py-3
  text-on-surface hover:bg-primary/10
  rounded-[2rem] transition-all text-sm font-medium
  tracking-tight"

### Active nav item (matched via usePathname())
className="flex items-center gap-3 px-4 py-3
  bg-secondary-container text-on-secondary-container
  rounded-[2rem] font-bold text-sm tracking-tight
  scale-95 duration-150 ease-in-out"
Active icon: font-variation-settings FILL 1

### Route → active item mapping
/              → Dashboard
/pickt-list    → Pickt List
/marketplace   → Marketplace
/saved         → Saved
/candidates    → My candidates
/placements    → Placements
/earnings      → Earnings
/integrations  → Integrations

### Optional badge prop per nav item
NavItem supports badge?: number
Renders: ml-auto min-w-[18px] h-[18px] rounded-full
  bg-primary text-on-primary text-[10px] font-black px-1
Hidden when count is 0

### Bottom user pill
Border: border-t border-outline-variant/10 pt-6 mt-auto
Container: flex items-center gap-3 px-4 py-3
  rounded-lg bg-surface-container-high
Avatar: w-10 h-10 rounded-full bg-primary/10
  account_circle Material Symbol text-primary
Name: text-xs font-bold text-on-surface "Admin Terminal"
Plan: text-[10px] text-on-surface-variant "Premium Access"

### Responsive
xl: full sidebar w-72, labels visible
lg: icon-only w-16, labels hidden
md and below: hidden, hamburger trigger in TopBar

───────────────────────────────────────
TOPBAR (src/components/layout/Topbar.jsx)
───────────────────────────────────────

Position: fixed, top 0
Left: 18rem (288px — sidebar width), right: 0
Height: 4rem (64px)
Padding: 0 2rem
Background: rgba(245,244,239,.8) with backdrop-filter: blur(12px)
Border: none (no bottom border in this design)
z-index: 40
Display: flex, align-items: center, justify-content: space-between

LEFT — Search field (max-width: 36rem):
  Container: position relative
  Icon: Material Symbol "search", position absolute left-4,
        top 50% translateY(-50%), color stone-400
  Input:
    width: 100%
    padding-left: 3rem, padding-right: 1rem, padding-y: 0.5rem
    background: stone-100 (#f5f5f4)
    border: none
    border-radius: 9999px
    font-size: 0.875rem
    font-family: Manrope
    On focus: ring-2, ring-color secondary-fixed/50, outline none
    Placeholder: "Search anonymized candidates by stack, efficiency
                  or referral..."

RIGHT — Actions:
  Notification bell: Material Symbol "notifications",
                     color stone-600, hover green-700
  Help button: Material Symbol "help_outline",
               color stone-600, hover green-700
  User avatar: 32×32px, border-radius 9999px,
               background var(--primary), color white,
               font-size 12px, font-weight 700, initials "JD"

───────────────────────────────────────
## Component Spec: TopBar
───────────────────────────────────────

File: src/components/layout/TopBar.tsx
'use client'

### Structure
<header className="flex justify-between items-center
  w-full h-16 px-8 sticky top-0 z-40
  bg-surface-container-low/80 backdrop-blur-md
  border-b border-outline-variant/10">

### Left: Search input
<div className="relative w-full max-w-2xl group">
  <span className="material-symbols-outlined absolute left-3
    top-1/2 -translate-y-1/2 text-on-surface-variant
    group-focus-within:text-primary transition-colors">
    search
  </span>
  <input className="w-full bg-surface-container-high/50
    border-none rounded-full py-2 pl-10 pr-4
    focus:ring-2 focus:ring-primary/20
    text-sm font-medium placeholder:text-on-surface-variant"
    placeholder="Search talent, roles, or stacks..." />
</div>

### Right: Actions
notifications icon → hover:text-primary transition-colors
help_outline icon  → hover:text-primary transition-colors
border-l border-outline-variant/20 divider
"Profile" label: text-sm font-bold text-[#2d7235]
Avatar: w-8 h-8 rounded-full bg-secondary-container
  person Material Symbol text-on-secondary-container
  hover:scale-110 transition-transform

───────────────────────────────────────
## Page Spec: Marketplace (/marketplace)
───────────────────────────────────────

File: src/app/marketplace/page.tsx
Composed of: MarketplaceHeader + bento grid

### Page header
<header className="flex justify-between items-end mb-12">

Left content (max-w-2xl):
  <h2 className="text-5xl font-black text-on-primary-fixed
    tracking-tighter mb-4">
    Discover <span className="italic font-light">Elite</span>
    Talent.
  </h2>
  <p className="text-lg text-on-surface-variant font-medium
    leading-relaxed">
    Access our vetted pool of pre-interviewed engineering
    specialists curated for high-growth ecosystems.
  </p>

Right buttons:
  Filter button:
    bg-surface-container-high px-6 py-3 rounded-lg font-bold
    text-on-surface hover:bg-surface-container-highest
    filter_list icon + "Filter" label

  New Search button:
    bg-primary text-on-primary px-8 py-3 rounded-lg font-bold
    shadow-lg hover:scale-[1.02] active:scale-95
    add icon (text-sm) + "New Search" label

### Bento grid layout
<div className="grid grid-cols-12 gap-6 pb-20">
  Left:  col-span-12 lg:col-span-8 space-y-6
         → CandidateCard list
  Right: col-span-12 lg:col-span-4 space-y-6
         → RightInsightsPanel

───────────────────────────────────────
## Component Spec: CandidateCard
───────────────────────────────────────

File: src/components/marketplace/CandidateCard.tsx

### Card wrapper
className="pikt-card-shape bg-surface-container-lowest p-8
  shadow-[0px_24px_48px_rgba(56,56,49,0.06)]
  relative overflow-hidden group"

### Referrer badge (absolute, top-right corner)
className="absolute top-0 right-0 px-6 py-2
  rounded-bl-lg font-black text-xs tracking-widest uppercase"

Variant amber: bg-secondary-container text-on-secondary-container
Variant green: bg-primary text-on-primary

### Inner layout
<div className="flex items-start gap-8">

Icon box (shrink-0):
  w-32 h-32 rounded-lg flex items-center justify-center
  bg-gradient-to-br {iconGradient}
  Material Symbol: text-5xl text-on-primary-container
  font-variation-settings: 'wght' 200

Content (flex-1):
  Title row: flex justify-between items-center mb-2
    Title: text-3xl font-extrabold text-on-surface tracking-tight
    Salary: text-primary font-bold text-lg

  Skills row: flex gap-2 mb-6
    Each pill: px-3 py-1 bg-tertiary-container
    text-on-tertiary-container text-xs font-bold
    rounded-full uppercase tracking-tighter

  Description: text-on-surface-variant leading-relaxed mb-6
    max-w-xl

  CTA row: flex items-center gap-6
    Primary: bg-primary px-6 py-2 rounded-lg text-on-primary
      font-bold text-sm hover:opacity-90
    Secondary: text-on-surface font-bold text-sm
      flex items-center gap-2 + arrow_forward icon

### Props interface (from lib/types/index.ts)
{
  role: string
  salary: string
  description: string
  skills: string[]
  iconSymbol: string
  iconGradient: string
  referrerBadge: { label: string; variant: 'green' | 'amber' }
  cta: { primary: string; secondary: string }
}

### Data (lib/data/candidates.ts)
Candidate 1:
  role: 'Staff Frontend Engineer'
  salary: '$190k - $240k'
  description: 'Specialist in high-concurrency architecture and
    design system scaling. Led a team of 12 at a Fortune 500
    fintech transition. 12+ years experience.'
  skills: ['React', 'Next.js', 'TypeScript']
  iconSymbol: 'architecture'
  iconGradient: 'from-primary-container to-secondary-container'
  referrerBadge: { label: 'Referred by Sarah J.',
    variant: 'amber' }
  cta: { primary: 'Request Interview',
    secondary: 'View Portfolio' }

Candidate 2:
  role: 'Lead Cloud Architect'
  salary: '$210k - $260k'
  description: 'Reduced infrastructure costs by 40% through
    serverless migration strategies. Expert in multi-cloud
    resilience and auto-scaling compliance.'
  skills: ['AWS', 'Kubernetes', 'Go']
  iconSymbol: 'database'
  iconGradient: 'from-tertiary-fixed to-primary-fixed-dim'
  referrerBadge: { label: 'Referred by CTO @ Flux',
    variant: 'green' }
  cta: { primary: 'Request Interview', secondary: 'Case Study' }

───────────────────────────────────────
## Component Spec: RightInsightsPanel
───────────────────────────────────────

File: src/components/marketplace/RightInsightsPanel.tsx
Composes: MarketPulseCard + TopReferrersCard + HiringCTACard

<div className="col-span-12 lg:col-span-4 space-y-6">
  <MarketPulseCard />
  <TopReferrersCard />
  <HiringCTACard />
</div>

### MarketPulseCard
File: src/components/marketplace/MarketPulseCard.tsx

className="rounded-lg bg-secondary-container p-6
  text-on-secondary-container"

Header row: flex items-center gap-2 mb-4
  trending_up icon + "Market Pulse" font-black text-sm
  uppercase tracking-widest

Stat: "+12%" text-3xl font-black mb-2
Subtitle: text-sm font-medium opacity-80 mb-6

Mini bar chart:
  h-24 w-full bg-white/20 rounded-lg
  flex items-end gap-1 p-3
  6 bars, each w-full rounded-t-sm:
  heights: 30%, 50%, 45%, 70%, 90%, 100%
  color: bg-white/40 for first 5, bg-white for last

### TopReferrersCard
File: src/components/marketplace/TopReferrersCard.tsx

className="rounded-lg bg-surface-container-high p-6"

Title: "Top Referrers" font-black text-sm uppercase
  tracking-widest mb-6

Referrer row (x3):
  flex items-center justify-between p-3
  bg-surface-container-lowest rounded-lg
  border border-outline-variant/10
  Left: avatar (w-8 h-8 rounded-full font-bold)
    + name (font-bold text-sm)
  Right: "{n} Picks" text-xs font-bold text-on-surface-variant

Referrer data:
  JD / Jane Doe / 24 Picks
    avatar: bg-primary/20 text-primary
  MK / Mike K.  / 18 Picks
    avatar: bg-secondary-container/30 text-secondary
  SL / Sam L.   / 15 Picks
    avatar: bg-tertiary-container/30 text-tertiary

"View Leaderboard" button:
  w-full mt-6 py-3 rounded-lg border border-outline-variant
  text-sm font-bold
  hover:bg-surface-container-highest transition-colors

### HiringCTACard
File: src/components/marketplace/HiringCTACard.tsx

className="rounded-lg bg-primary-container p-6
  relative overflow-hidden"

Decorative icon: absolute -right-4 -bottom-4 opacity-10
  rocket_launch text-[120px]

Title: "Hiring at scale?" font-black text-on-primary-container
  mb-2
Body: text-sm text-on-primary-container/80 font-medium mb-6
  "Unlock custom sourcing pipelines and dedicated
  account management."
CTA: bg-primary text-on-primary px-6 py-2 rounded-lg
  font-bold text-sm "Contact Sales"

───────────────────────────────────────
## Component Spec: LiquidBackground + Decorations
───────────────────────────────────────

### LiquidBackground
File: src/components/layout/LiquidBackground.tsx
Server component — no 'use client' needed.

Renders three fixed elements:

1. Liquid gradient overlay:
   className="fixed inset-0 -z-10 liquid-bg pointer-events-none"

2. Top-right blur orb:
   className="fixed top-[-10%] right-[-5%] w-96 h-96
     bg-primary-container/20 blur-[100px] rounded-full
     -z-10 pointer-events-none"

3. Bottom-left blur orb:
   className="fixed bottom-[-10%] left-[-5%] w-96 h-96
     bg-secondary-container/10 blur-[100px] rounded-full
     -z-10 pointer-events-none"

Add to globals.css:
.liquid-bg {
  background:
    radial-gradient(circle at 20% 30%,
      rgba(170,244,168,0.15) 0%, transparent 40%),
    radial-gradient(circle at 80% 70%,
      rgba(255,201,110,0.1) 0%, transparent 40%);
}

### Abstract corner decoration (rendered in root layout)
className="fixed bottom-10 right-10 flex gap-4
  pointer-events-none opacity-50"
  <div className="w-12 h-12 bg-primary-container
    rounded-full blur-xl" />
  <div className="w-8 h-8 bg-secondary-container
    rounded-full blur-lg mt-4" />

### FINAL CHECKS after all prompts run
- npm run dev — zero TS errors
- Sidebar amber pill active state renders correctly
- Sidebar hover is bg-primary/10 (not aaf4a8)
- pikt-card-shape TR and BL corners are 0.5rem
- Referrer badge clips to top-right corner of card
- Icon box gradient renders correctly per candidate
- MarketPulse bar chart last bar is full white
- HiringCTACard rocket icon is decorative only (no click)
- LiquidBackground renders behind all content (-z-10)
- Abstract corner decoration fixed bottom-right
- No hardcoded copy — all strings from lib/copy.ts
- All types imported from lib/types/index.ts

═══════════════════════════════════════════════════════════════════
PART 3 — PAGE DESIGNS
═══════════════════════════════════════════════════════════════════

All pages share this wrapper:
  margin-left: 18rem  (clears the floating sidebar)
  padding-top: 5rem   (clears the topbar)
  padding-x: 2rem
  padding-bottom: 3rem

───────────────────────────────────────
DASHBOARD / TALENT POOL PAGE
───────────────────────────────────────

PAGE HEADER:
  Heading: font-weight 800 (extrabold), font-size 2.25rem,
           color var(--on-primary-fixed), letter-spacing tight,
           margin-bottom 0.5rem
  Subheading: font-size 1.125rem, color var(--on-surface-variant)

STATS BENTO GRID (4 columns, gap 1.5rem, margin-bottom 2.5rem):

  Card 1 — Network Efficiency (spans 2 columns):
    background: var(--secondary-container) #ffc96e
    padding: 2rem, border-radius: 1rem
    position relative, overflow hidden
    Heading: font-weight 700, font-size 1.25rem,
             color var(--on-secondary-container)
    Value: font-weight 900, font-size 2.25rem,
           color var(--on-secondary-container)
           Text: "+$1.2M" with "Saved" at 1.125rem, opacity 70%
    Body: color on-secondary-container/80, font-size 14px, max-w xs
    Decorative blur circle: position absolute, -right-12, -bottom-12,
                            w-48 h-48, background white/20,
                            border-radius 9999px, blur-3xl
                            On group hover: scale 150%, transition 700ms

  Card 2 — Active Roles (1 column):
    background: var(--primary-container) #aaf4a8
    padding: 2rem, border-radius: 1rem
    Icon: "trending_up" Material Symbol, color on-primary-container
    Label: font-weight 700, color on-primary-container
    Value: font-weight 900, font-size 1.875rem,
           color on-primary-container
    Value: "42"

  Card 3 — Verified Referrals (1 column):
    background: var(--surface-container-highest) #eae9db
    padding: 2rem, border-radius: 1rem
    Icon: "verified_user" Material Symbol, color on-surface-variant
    Label: font-weight 700, color on-surface-variant
    Value: font-weight 900, font-size 1.875rem, color on-surface
    Value: "856"

FILTER BAR (flex, justify-between, margin-bottom 2rem):

  Left — Filter chips:
    Chip 1 (active): "All Tech Stacks" with dropdown arrow icon
      background: var(--tertiary-container) #d7fed5
      color: var(--on-tertiary-container) #426344
      font-weight 700, font-size 14px
      padding: 0.5rem 1rem, border-radius: 9999px

    Chip 2: "Remote Only"
    Chip 3: "High Pickt Efficiency"
      background: var(--surface-container-high) #f0eee1
      color: var(--on-surface-variant)
      font-weight 600, font-size 14px
      padding: 0.5rem 1rem, border-radius: 9999px

  Right — Sort control:
    font-size 14px, font-weight 700, color on-surface-variant
    "Sort by:" label + "Highest Savings" link in var(--primary)
    + swap_vert icon

CANDIDATE CARD GRID:
  grid-template-columns: repeat(1, 1fr) on mobile
                         repeat(2, 1fr) on lg
                         repeat(3, 1fr) on xl
  gap: 2rem

CANDIDATE CARD STRUCTURE (apply .pikt-card shape):
  background: var(--surface-container-lowest) #ffffff
  padding: 1.5rem
  border: 1px solid rgba(187,186,175,.15)
  On hover: box-shadow 0 24px 48px rgba(56,56,49,.06)
  transition: all
  display: flex, flex-direction: column

  CARD TOP ROW (flex, justify-between, align-start, mb 1.5rem):
    Left: Candidate avatar
      width/height: 4rem (64px)
      border-radius: 9999px
      background: gradient (varies per card — see below)
      color: white, font-weight 900, font-size 1.25rem
      Initials: first two letters of role or anonymous ID

    Right: Status badge
      Variants (pick appropriate per card):
        Efficiency: bg secondary-container, color on-secondary-container
                    Icon: "bolt", text "XX% Efficiency"
        Verified:   bg tertiary-container, color on-tertiary-container
                    Icon: "verified", text "Verified Dev"
        Top 5%:     bg surface-container-highest, color on-surface-variant
                    Icon: "star", text "Top 5%"
        Retention:  bg secondary-container, color on-secondary-container
                    Icon: "history", text "XX% Retention"
      All badges: padding 0.25rem 0.75rem, border-radius 9999px,
                  font-size 10px, font-weight 900, text-transform uppercase,
                  letter-spacing tighter, display flex, gap 0.25rem

  CARD TITLE AREA (mb 1rem):
    Role title: font-size 1.25rem, font-weight 800 (extrabold),
                color var(--on-surface)
    ID line: font-size 0.875rem, color var(--on-surface-variant)
             Format: "ID: PKT-XXXXX • X+ Years Experience"

  SKILLS ROW (flex wrap, gap 0.5rem):
    Each skill tag:
      background: var(--surface-container-high) #f0eee1
      padding: 0.25rem 0.75rem, border-radius: 9999px
      font-size: 11px, font-weight: 700, color: var(--on-surface)

  PICKT EFFICIENCY ANALYSIS PANEL:
    background: var(--surface-container-low) #fcfaee
    border-radius: 0.5rem
    padding: 1rem
    border-left: 4px solid (colour varies — see below)
    margin-top: 1rem

    Label: font-size 10px, font-weight 900, text-transform uppercase,
           letter-spacing widest
           Colour matches the left border colour
           Text: "Pickt Efficiency Analysis"
    Metric: font-size 14px, font-weight 700, color var(--on-surface)
    Description: font-size 11px, color var(--on-surface-variant)

    Border/label colour variants:
      Card 1: var(--secondary) #865c00
      Card 2: var(--primary) #2d7235
      Card 3: var(--on-surface-variant) #65655c
      Card 4: var(--secondary-dim) #765100

  CARD FOOTER (mt-auto, pt 1.5rem,
               border-top 1px solid rgba(187,186,175,.1),
               flex, align-center, justify-between):

    Left — Referral source:
      Small avatar: 24×24px, border-radius 9999px,
                    background stone-200, border 1px white,
                    font-size 10px, font-weight 700
      Label: font-size 12px, font-weight 600,
             color var(--on-surface-variant)
             Text: "Referral: [Source Name]"

    Right — CTA button:
      "View Dossier" (or context-appropriate label)
      background: var(--primary) #2d7235
      color: white
      padding: 0.5rem 1rem
      border-radius: 0.5rem
      font-size: 12px, font-weight: 700
      On hover: background var(--primary-dim) #1f652a
      transition: all

PROMO / CTA CARD (spans full width or 1 column depending on grid):
  Apply .pikt-card shape
  background: var(--primary) #2d7235
  color: white, padding: 2rem
  display flex, flex-direction column, justify-content center
  position relative, overflow hidden
  group hover behaviour

  Heading: font-size 1.875rem, font-weight 900, line-height tight
  Body: font-size 14px, opacity 90%, line-height relaxed
  Button:
    background: var(--secondary-container) #ffc96e
    color: var(--on-secondary-container) #604100
    padding: 0.75rem 1.5rem, border-radius 0.5rem
    font-weight 700, font-size 14px
    On hover: scale(1.05), transition all

  Decorative corner:
    position absolute, right 0, top 0
    width/height: 8rem (128px)
    background: white/10, border-radius 100% 0 0 0
    On group hover: width/height 10rem (160px)
    transition: all

LOAD MORE SECTION (mt 4rem, flex column, align-center, gap 1rem):
  Button: "Load More Talent"
    padding: 1rem 3rem, border-radius 9999px
    background var(--surface-container-high)
    border: 1px solid rgba(187,186,175,.2)
    font-weight 700, color var(--on-surface)
    On hover: background var(--surface-container-highest)
  Caption: font-size 12px, color on-surface-variant, font-weight 500

FLOATING ACTION BUTTONS (fixed, bottom 2rem, right 2rem,
                          flex column, gap 0.75rem):

  Button 1 — Auto Match:
    width/height: 3.5rem (56px), border-radius 9999px
    background: var(--secondary-container) #ffc96e
    color: var(--on-secondary-container)
    box-shadow: lg
    Icon: "bolt" Material Symbol
    On hover: scale(1.1), transition all
    On active: scale(0.95)
    Tooltip: position absolute, right 4rem
             background on-surface, color surface,
             font-size 10px, padding 0.25rem 0.5rem,
             border-radius 0.25rem, font-weight 700
             opacity 0 → 1 on group hover

  Button 2 — Advanced Filters:
    Same dimensions and behaviour
    background: var(--primary) #2d7235
    color: white
    Icon: "filter_list" Material Symbol

───────────────────────────────────────
MARKETPLACE PAGE
───────────────────────────────────────

Layout: bento grid-cols-12 gap-6.
Replace the bento stat cards with:
  - Total candidates: "40 candidates" as a large count
  - Filter chips replacing the bento grid:
    Row 1: All industries, Technology, Sales & Revenue,
            Finance & FinTech, Marketing & Growth,
            Product & Design, Operations
    Row 2: All levels, Junior (0–2 yrs), Mid-level (3–5 yrs),
            Senior (5–8 yrs), Lead/Principal, Head of/Director
    Row 3: All locations, Sydney, Melbourne, Brisbane, Perth, Adelaide

  Active chip: bg tertiary-container, color on-tertiary-container,
               font-weight 700
  Inactive chip: bg surface-container-high, color on-surface-variant,
                 font-weight 600

Candidate cards: same structure as Talent Pool cards above.
Remove the Pickt Efficiency Analysis panel on marketplace tiles —
replace with the career history dot list and skills tags
already established in the existing design.

───────────────────────────────────────
DASHBOARD (route: /)
───────────────────────────────────────

Landing page after login. Bento grid-cols-12 layout.
Stats row: Network Efficiency (col-span-6), Active Roles (col-span-3),
           Verified Referrals (col-span-3).
Below: filter bar + candidate card grid (see Talent Pool spec above).
Dev seed tool at bottom for populating test data.

───────────────────────────────────────
PICKT LIST (route: /shortlist)
───────────────────────────────────────

Page header: "Pickt List" heading + subheading
Tab strip:
  Three tabs: All / Unlocked / Locked
  Active tab: color var(--primary), border-bottom 2px var(--primary)
  Inactive: color on-surface-variant

View toggle: list / kanban / compare views
Search + sort bar: same pattern as topbar search field.

Candidate cards: same .pikt-card structure.
Locked cards: avatar shows initials replaced with lock icon,
              avatar background surface-container-high.
Unlock button: background var(--primary), color white.
Keep/Remove buttons:
  Keep: background var(--primary), color white
  Remove: background surface-container-high,
          color on-surface-variant, border outline-variant

Kanban view: 4-column grid (responsive to 2/1) with stage headers.
Compare view: auto-fit grid with stat comparison columns.

───────────────────────────────────────
MARKETPLACE (route: /marketplace/results)
───────────────────────────────────────

(Defined above — bento grid-cols-12 layout with view switcher,
 6 view modes, filter chips, candidate card grid.)

───────────────────────────────────────
SAVED (route: /saved)
───────────────────────────────────────

Page header: "Saved candidates" heading
Displays candidates saved via Tinder swipe-right or heart button.
Card grid: same .pikt-card structure, 1/2/3 columns responsive.
Each card shows: role, seniority, city, skills, fee, date saved.
Remove from saved: ghost button with X icon.
Empty state: "No saved candidates yet" + CTA to marketplace.

───────────────────────────────────────
MY CANDIDATES (route: /my-candidates)
───────────────────────────────────────

Page header: "My candidates" heading
For referrers who uploaded candidates. Shows their submitted pool.
Summary cards row: Total views, Total unlocks (dot indicators,
                   never raw numbers), Successful placements.
Performance table: paginated (10 per page).
  Columns: Role | Seniority | Referred date | Views | Unlocks (dots)
           | Status (Interviewing amber, Placed green, Not placed grey)
Pagination: "X–Y of Z" with Previous/Next buttons.

───────────────────────────────────────
PLACEMENTS (route: /placements)
───────────────────────────────────────

Page header: "Placements" heading
Tracks candidates who have been hired through the platform.
Table view with columns: Candidate role | Company | Placed date
  | Fee % | Fee amount | Status (Confirmed / Pending / Disputed)
Status pills: Confirmed (primary), Pending (secondary), Disputed (error).
Empty state: "No placements yet" + CTA.

───────────────────────────────────────
EARNINGS (route: /earnings)
───────────────────────────────────────

Page header: "Earnings" heading
Revenue dashboard for referrers.
Stats row: Total earned, Pending, Paid out.
Transaction table: Date | Candidate | Company | Amount | Status
Status pills: Paid (primary), Pending (secondary), Processing (muted).
Empty state: "No earnings yet" + CTA.

───────────────────────────────────────
INTEGRATIONS (route: /integrations)
───────────────────────────────────────

Page header: "Integrations" heading.
Section cards: uniform border-radius 1rem (not pikt-card asymmetric).
background: var(--surface-container-lowest) white.
border: 1px solid rgba(187,186,175,.15).
Integration cards: ATS connections (Greenhouse, Lever, Workable, Ashby).
Connected status dots:
  Connected: background var(--primary) #2d7235
  Disconnected: background var(--outline-variant) #bbbaaf
Primary buttons: var(--primary) background, white text.
Destructive buttons: var(--error) background, white text.

───────────────────────────────────────
MODALS (unlock, import, confirm hire)
───────────────────────────────────────

Backdrop: rgba(56,56,49,.55), backdrop-filter blur(8px)
Modal container:
  background: var(--surface-container-lowest) white
  border-radius: 1rem (uniform, NOT pikt-card asymmetric)
  border: 1px solid var(--outline-variant)
  padding: 1.5rem 2rem
  max-width: 32rem

Primary CTA: var(--primary) background, white text, border-radius 0.5rem
Secondary CTA: var(--surface-container-high) background,
               var(--on-surface) text, border-radius 0.5rem
Destructive: var(--error) background, white text

Checkbox accent: var(--primary)
Input fields:
  background: var(--surface-container-low)
  border: 1px solid var(--outline-variant)
  border-radius: 0.5rem
  On focus: border-color var(--primary), ring var(--primary)/20

═══════════════════════════════════════════════════════════════════
PART 4 — AVATAR GRADIENT PALETTE
═══════════════════════════════════════════════════════════════════

Candidate avatars use these gradient pairs in rotation.
Apply via inline style or a utility function:

  1. from #2d7235 to #1f652a  (primary greens)
  2. from #865c00 to #765100  (secondary ambers)
  3. from #78716c to #44403c  (stone greys)
  4. from #1f652a to #14532d  (deep greens)
  5. from #4b6c4c to #3f6041  (tertiary sages)
  6. from #a16207 to #854d0e  (warm ambers)

All avatars: border-radius 9999px (fully circular).
Initials: font-weight 900, color white.

═══════════════════════════════════════════════════════════════════
PART 5 — WHAT TO REMOVE COMPLETELY
═══════════════════════════════════════════════════════════════════

Delete or replace all of the following from the existing codebase:

1. All references to --bg: #0e0f11 and the dark surface chain
2. --accent: #c8f060 and all lime green references
3. The collapsible sidebar toggle button and collapse logic
4. The localStorage sidebar state persistence
5. The Instrument Serif font import and all serif headings —
   replace with Manrope at equivalent weights
6. All dark-mode-only CSS blocks
7. The background orb gradient (rgba coral/amber decoration) —
   replace with LiquidBackground (static radial gradients,
   see DESIGN_TOKENS.md .liquid-bg section, no animations)
8. The CSS variable --accent-bright: #c8f060
9. Interview dot colours referencing lime green — replace with
   var(--primary) #2d7235 for filled dots
10. Any hardcoded hex values from the dark palette

═══════════════════════════════════════════════════════════════════
PART 6 — REFERENCE IMPLEMENTATION
═══════════════════════════════════════════════════════════════════

The following HTML is the canonical visual reference for this
design system. Every component, colour, spacing decision, and
interactive state shown here is the source of truth. When in
doubt about any visual decision, refer back to this file.

[ATTACH THE STITCH HTML FILE HERE WHEN PASTING INTO CLAUDE CODE]

If you cannot attach a file, the reference implementation is the
Talent Pool page described in full in Part 3 above. Build that
page first, verify it matches the description precisely, then
apply the same system to every other page in the application.

---

## VIEW MODE SWITCHER

Add a view mode toggle bar between FiltersBar and CandidateList.
The current card design is the "Stack" view — all other views must
render the same candidate data in a different layout.

---

## ViewSwitcher.tsx

Pill-shaped toggle bar, glass-panel, inline with the results count.
Six modes with icons:

| Mode    | Icon (Material Symbol) | Label    |
|---------|------------------------|----------|
| Stack   | view_agenda            | Stack    |
| Carousel| view_carousel          | Carousel |
| Matrix  | grid_view              | Matrix   |
| Swipe   | swipe                  | Swipe    |
| Compact | density_small          | Compact  |
| Focus   | center_focus_strong    | Focus    |

Active mode: bg-primary text-on-primary rounded-full px-3 py-1.5
Inactive: text-on-surface-variant hover:text-primary hover:bg-primary/5
Container: glass-panel rounded-full p-1 flex items-center gap-1
  border border-white/40

State lives in MarketplacePage.tsx via useState<ViewMode>('stack').
Pass activeView + setView down to ViewSwitcher and CandidateList.

---

## VIEW LAYOUTS

### Stack (default)
Existing CandidateRow layout — full-width horizontal cards, grid-cols-1 gap-6.
No changes needed.

### Matrix
grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6
Condensed card — pikt-card p-6, no experience grid, no referral pill.
Show: icon box + badge, role title + verified icon, tags row (max 3),
stack pills (max 4), efficiency savings number, CTA button only.
Referral strip replaced by a single line:
  small avatar initial + referral name, font-size text-xs text-on-surface-variant

### Carousel
Single full-width card visible at a time, centered, max-w-2xl mx-auto.
Prev/next arrow buttons flanking the card (bg-primary text-on-primary
rounded-full w-12 h-12, shadow-md).
Full CandidateRow card content preserved.
Dot indicators below: active = bg-primary, inactive = bg-outline-variant/40.
Card transitions: translate-x with opacity fade, duration-500.
'use client' with useState for activeIndex.

### Swipe
Single card centered, max-w-lg mx-auto.
Condensed pikt-card p-8 — show role, tags, stack, efficiency panel.
No experience grid. No referral pill.
Two large action buttons below the card:
  Left: "Pass" — border-2 border-outline-variant rounded-full w-16 h-16
        close icon, hover:border-error hover:text-error
  Right: "Request" — bg-primary text-on-primary rounded-full w-16 h-16
         favorite icon, hover:scale-110
Small counter below: "2 of 856 candidates"
On action (pass/request), animate card out (translateX ±120% + opacity 0,
duration-300) then show next card.
'use client' with useState for index + direction.

### Compact
Dense table-style list. No cards, no glass.
Each row: flex items-center gap-4 py-3 px-4
  border-b border-outline-variant/20 hover:bg-primary/5 transition-colors
Columns: role (flex-1 font-bold text-sm) | tags (flex gap-1, max 2 pills,
  text-[10px]) | stack (flex gap-1, max 3 pills, text-[10px]) |
  savings (text-sm font-black text-secondary w-24 text-right) |
  CTA button (text-xs px-3 py-1.5 bg-primary text-on-primary rounded-lg)
Header row: text-[10px] uppercase tracking-widest text-on-surface-variant
  font-black, matching columns, border-b border-outline-variant/30

### Focus
One candidate fills the viewport — immersive single-candidate view.
Layout: two-column grid, grid-cols-5 gap-12
  Left col (col-span-3): full card content from Stack view
  Right col (col-span-2): expanded detail panel —
    - Large efficiency savings: text-5xl font-black text-secondary
    - "Why this candidate" section placeholder (bg-surface-container-low
      rounded-lg p-6, text-on-surface-variant text-sm)
    - Full referral strip (ReferralPill)
    - "Request Interview" CTA full-width, py-4
    - "Save for later" ghost button full-width, border border-primary
      text-primary py-3
Prev/next navigation: small text links bottom-right
  "← Previous" / "Next →" text-primary font-bold text-sm

---

## STATE MANAGEMENT

In MarketplacePage.tsx:

```ts
type ViewMode = 'stack' | 'carousel' | 'matrix' | 'swipe' | 'compact' | 'focus'
const [viewMode, setViewMode] = useState<ViewMode>('stack')
const [focusIndex, setFocusIndex] = useState(0)
const [carouselIndex, setCarouselIndex] = useState(0)
const [swipeIndex, setSwipeIndex] = useState(0)
const [swipeDirection, setSwipeDirection] = useState<'left'|'right'|null>(null)
```

CandidateList.tsx receives viewMode and renders the appropriate layout.
Swipe and Carousel views manage their own index internally via props + callbacks.

---

## TRANSITIONS BETWEEN VIEWS

When viewMode changes, wrap the results area in:
  <div className="transition-all duration-300 ...">
Fade out (opacity-0 scale-95) then fade in (opacity-100 scale-100).
Use a brief opacity:0 → opacity:1 cycle (150ms out, 300ms in) driven by
useEffect on viewMode change with a local 'rendering' boolean state.

---

## VIEW PERSISTENCE

Store active view in localStorage key 'pickt-view-mode' so it persists
on refresh. Initialise useState from localStorage with a fallback to 'stack'.
Use 'use client' on MarketplacePage.

---

## FINAL CHECKS (additions to existing list)

- All 6 view modes render without TypeScript errors
- "Tinder" label does NOT appear anywhere — it is "Swipe" throughout
- Swipe animation fires correctly on both Pass and Request actions
- Carousel arrow buttons and dot indicators update in sync
- Compact view columns align across all candidate rows
- Focus view right panel is scrollable if content overflows
- View mode preference persists on page refresh
- ViewSwitcher active state matches current viewMode at all times
- Matrix cards preserve pikt-card asymmetric border radius

═══════════════════════════════════════════════════════════════════
GLOBAL REQUIREMENTS
═══════════════════════════════════════════════════════════════════

SSR-SAFE LOCALSTORAGE:
  Never read localStorage during render. Initialise client-only
  state (view mode, theme, unlock records) inside useEffect only.
  Use suppressHydrationWarning where SSR/CSR mismatch is expected.

COPY:
  All user-facing copy lives in lib/copy.ts — no hardcoded strings
  in components. Import and reference from the central copy file.

TYPES:
  All shared TypeScript types live in lib/types/index.ts.
  Components import types from there, not inline definitions.

FOCUS RINGS:
  All interactive elements (buttons, links, inputs, cards) must have:
    ring-2 ring-primary/40 ring-offset-2
  Applied via :focus-visible pseudo-class.

INTERACTION STATES:
  Every data-driven component must handle all three states:
    Loading: animate-pulse skeleton, same dimensions as loaded state
    Empty:   centered text-on-surface-variant message + CTA button
    Error:   surface-container-high banner + retry button

RESPONSIVE BREAKPOINTS:
  xl (1280px+): full sidebar + content, multi-column grids
  lg (1024px):  sidebar icon-only (w-16, labels hidden)
  md (768px):   sidebar hidden, hamburger menu trigger, reduced grids
  sm (640px):   single column layouts, stacked cards

