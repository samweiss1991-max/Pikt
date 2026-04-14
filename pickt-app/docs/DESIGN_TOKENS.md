# DESIGN_TOKENS.md

Single source of truth for all design decisions in the Pickt web app.

---

## Brand

- **Primary**: `#2d7235` (forest green)
- **Amber**: `#ffb622` / `#ffc96e` (sparingly — wordmark "t", active nav pill, efficiency figures, amber referrer badge only)
- **Surface base**: `#fffcf1` (cream)
- **Font**: Manrope only (200–800 weights)
- **Tone**: warm, direct, human, slightly playful

---

## Color Tokens

| Token | Hex | Usage |
|---|---|---|
| `primary` | `#2d7235` | Primary actions, filled buttons, links, active states |
| `primary-dim` | `#1f652a` | Hover state for primary buttons |
| `primary-fixed` | `#aaf4a8` | Light primary tint for badges, highlights |
| `primary-fixed-dim` | `#9de69b` | Dimmed primary tint |
| `on-primary` | `#ffffff` | Text/icons on primary-colored backgrounds |
| `on-primary-fixed` | `#004a15` | Text on primary-fixed backgrounds |
| `on-primary-container` | `#175e24` | Text on primary-container backgrounds |
| `primary-container` | `#aaf4a8` | Primary tinted containers, rank badges, score pills |
| `secondary` | `#865c00` | Amber accent text, referrer stars, salary labels |
| `secondary-dim` | `#765100` | Hover state for secondary elements |
| `secondary-fixed` | `#ffc96e` | Warm amber tint |
| `secondary-fixed-dim` | `#ffb622` | Wordmark "t", active nav pill, efficiency figures |
| `secondary-container` | `#ffc96e` | Amber tinted containers, urgency badges |
| `on-secondary` | `#ffffff` | Text/icons on secondary-colored backgrounds |
| `on-secondary-container` | `#604100` | Text on secondary-container backgrounds |
| `tertiary` | `#4b6c4c` | Sage green accent, strengths borders, savings text |
| `tertiary-dim` | `#3f6041` | Hover state for tertiary elements |
| `tertiary-container` | `#d7fed5` | Sage tinted containers, savings boxes, active chips |
| `on-tertiary` | `#ffffff` | Text/icons on tertiary-colored backgrounds |
| `on-tertiary-container` | `#426344` | Text on tertiary-container backgrounds |
| `background` | `#fffcf1` | Page background |
| `surface` | `#fffcf1` | Base surface color |
| `surface-container` | `#f6f4e7` | Card backgrounds, section bands |
| `surface-container-low` | `#fcfaee` | Subtle surface variation |
| `surface-container-high` | `#f0eee1` | Elevated surfaces, filter chips, skeleton bars |
| `surface-container-highest` | `#eae9db` | Highest elevation surfaces |
| `surface-container-lowest` | `#ffffff` | Cards, modals, lowest elevation |
| `surface-dim` | `#e4e3d4` | Dimmed surface for disabled states |
| `on-surface` | `#383831` | Primary text color |
| `on-surface-variant` | `#65655c` | Muted text, labels, secondary text |
| `outline` | `#818178` | Borders on hover/focus |
| `outline-variant` | `#bbbaaf` | Default borders, dividers, separators |
| `error` | `#be2d06` | Error text, destructive actions, skip buttons |
| `error-container` | `#f95630` | Error backgrounds, skip button containers |
| `on-error` | `#ffffff` | Text/icons on error-colored backgrounds |

---

## Shadows

| Element | Value |
|---|---|
| Card | `0px 24px 48px rgba(56,56,49,0.06)` |
| Sidebar | `0px 24px 48px rgba(56,56,49,0.06)` |
| Button (green only) | `shadow-primary/20` |

---

## Border Radius Scale

| Size | Value | Usage |
|---|---|---|
| `0.5rem` | 8px | Subtle (card TR, BL corners) |
| `1rem` | 16px | Default (buttons, inputs, small elements) |
| `2rem` | 32px | Prominent (card TL corner, nav items) |
| `2.5rem` | 40px | Sidebar right edge |
| `full` | 9999px | Pills, avatars, active nav pill |

---

## pikt-card-shape

```
border-top-left-radius: 2rem;
border-top-right-radius: 0.5rem;
border-bottom-left-radius: 0.5rem;
border-bottom-right-radius: 0;
```

---

## Typography Scale

| Role | Size | Weight | Token |
|---|---|---|---|
| Page title | 5xl | 900 | `text-on-primary-fixed` |
| Section h2 | 3xl | 800 | `text-on-surface` |
| Card title | 2xl | 800 | `text-on-surface` |
| Body | base | 400 | `text-on-surface` |
| Muted body | sm | 500 | `text-on-surface-variant` |
| Label | xs | 700 | `text-on-surface-variant` |
| Micro label | 10px | 800 | `text-on-surface-variant` |

---

## Spacing Rhythm

| Context | Value |
|---|---|
| Section gap | `gap-8` (2rem) |
| Card internal padding | `p-8` |
| Sidebar padding | `p-6` |
| Component gap | `gap-6` |
| Element gap | `gap-4` / `gap-3` / `gap-2` |

---

## Animation

| Effect | Value |
|---|---|
| Page fade-in | `opacity-0` -> `opacity-100`, 200ms ease |
| Button hover scale | `hover:scale-[1.02]` |
| Button active | `active:scale-95` |
| Transition default | `transition-all duration-300` |
| Background | No blob animations — static `liquid-bg` only |

---

## Background

```css
.liquid-bg {
  background:
    radial-gradient(circle at 20% 30%,
      rgba(170,244,168,0.15) 0%, transparent 40%),
    radial-gradient(circle at 80% 70%,
      rgba(255,201,110,0.1) 0%, transparent 40%);
}
```

Static blur orbs:
- **Top-right**: `w-96 h-96 bg-primary-container/20 blur-[100px]`
- **Bottom-left**: `w-96 h-96 bg-secondary-container/10 blur-[100px]`

---

## Interaction States

Required on every data component:

| State | Treatment |
|---|---|
| Loading | `animate-pulse` skeleton, same dimensions as loaded state |
| Empty | Centered `text-on-surface-variant` message + CTA |
| Error | `surface-container-high` banner + retry button |

---

## Responsive Breakpoints

| Breakpoint | Width | Layout |
|---|---|---|
| `xl` | 1280px+ | Full sidebar + content |
| `lg` | 1024px | Sidebar icon-only (`w-16`, labels hidden) |
| `md` | 768px | Sidebar hidden, hamburger menu trigger |
| `sm` | 640px | Single column layouts |

---

## Navigation Badges

Sidebar nav items support optional numeric badge:

```
small rounded-full bg-primary text-on-primary text-[10px]
positioned ml-auto in the nav item row
```

---

## Focus Rings

All interactive elements:

```
ring-2 ring-primary/40 ring-offset-2
```

---

## SSR Safety

- Never read `localStorage` during render
- Initialise client-only state (view mode, theme) in `useEffect` only
- Use `suppressHydrationWarning` where needed
