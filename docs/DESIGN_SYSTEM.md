# PulseIQ — UI/UX Design System Specification

## Overview & Vision
PulseIQ is a premium, modern, startup-quality SaaS application comparable in visual excellence and interaction polish to Linear, Stripe Dashboard, Vercel, Clerk, Notion, Raycast, and YC-backed startups.

---

## Primary Design References & Libraries
Study and adapt component patterns from:
- **Aceternity UI**: https://ui.aceternity.com/components
- **Componentry**: https://componentry.dev/
- **Motion Primitives**: https://motion-primitives.com/

---

## Overall Design Philosophy
Target characteristics:
- **Clean & Elegant**: Generous spacing, refined typography, and logical visual hierarchy.
- **Minimal & Premium**: Depth over clutter; subtle layered glass effects and blurred backdrops.
- **Highly Interactive**: Micro-interactions under 300ms, animated focus states, responsive hover states.
- **Anti-Patterns**: Avoid Bootstrap defaults, flat/boring CRUD templates, heavy dark borders, oversized cards, and unnecessary visual clutter.

---

## Visual Style & Tokens

### Color Palette
- **Primary Green**: `#27AE60`
- **Primary Blue**: `#2563EB`
- **Accents**: Emerald, Sky Blue, Indigo
- **Neutrals**: Tailwind Zinc scale
  - Light mode background: `zinc-50`
  - Dark mode background: `zinc-950` (avoid pure `#000000`)

### Elevation & Surfaces
- **Borders & Radii**: `rounded-xl` to `rounded-2xl`
- **Shadows**: Soft, multi-layered shadows (`shadow-sm`, `shadow-md`, `shadow-xl`)
- **Glassmorphism**: Tasteful use of backdrop blur (`backdrop-blur-md bg-white/70` or `bg-zinc-900/70`)

### Typography
- **Font Family**: Inter, Geist, or modern sans-serif stack
- Clear hierarchy: Bold high-contrast headings, comfortable line-height for body text, legible small metadata labels.

### Icons
- **Icon Set**: Lucide Icons exclusively across all views.

---

## Animation & Motion
- Built with Motion Primitives / CSS transitions.
- **Duration**: Target transitions under 300ms.
- Respect `prefers-reduced-motion`.
- Applied to: Page transitions, modal drawers, hover cards, skeleton loaders, and interactive charts.

---

## Component Guidelines

### Navigation & Layout
- Modern collapsible left sidebar with floating header bar.
- Global command palette (`Cmd/Ctrl + K`), breadcrumbs, notification panel, and quick search.
- Responsive mobile & tablet layouts (no horizontal scroll leaks).

### Form Controls
- Large touch-friendly input targets.
- Real-time inline validation, clear helper text, distinct error & success feedback states.

### Data Tables & Displays
- Sticky headers, column sorting, search filters, pagination, bulk actions, and row hover triggers.

### Empty & Loading States
- **Skeleton Loaders**: Prefer animated pulse skeletons over generic spinners.
- **Empty States**: Must feature a subtle vector/icon graphic, expressive title, contextual description, and clear CTA buttons.

---

## Verification & Polish Checklist
Before considering any UI feature complete, verify:
- [ ] Responsive across Desktop, Tablet, and Mobile
- [ ] Accessible (WCAG AA contrast, keyboard nav, ARIA labels, focus rings)
- [ ] Visual consistency (reuses existing button, card, and spacing tokens)
- [ ] Modern aesthetic with soft shadows and rounded corners
- [ ] Smooth motion transitions (<300ms) with reduced-motion support
- [ ] Light & Dark Mode support
- [ ] No visual regressions or pixel misalignment
