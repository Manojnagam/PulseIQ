# 📝 PulseIQ Changelog

All notable changes to the PulseIQ project are documented in this file.

---

## [2.1.0] - 2026-07-29

### Added — UI Foundation Verification Package & Bundle Optimization
- **Rolldown/Vite Code Splitting**: Configured function-based `manualChunks` in `vite.config.ts`, splitting vendor libraries into `react-vendor`, `radix-vendor`, `motion-vendor`, `recharts-vendor`, and `vendor` (all chunks under 500 kB, total app JS 57.46 kB / 14.34 kB gzipped).
- **Component Verification Audit**: Documented empirical evidence for all 30+ UI components in `PROJECT_STATUS.md`.
- **Library Audit**: Verified Aceternity UI and Motion Primitives implementations; clarified Radix UI as the technical headless implementation engine over Componentry.
- **Accessibility & Motion Verification**: Enforced WCAG AA contrast, focus trapping, screen reader tags, and `prefers-reduced-motion` CSS overrides.
- **Architectural Decision Record**: Formally documented 100% standardization on Supabase PostgreSQL with RLS multi-center isolation (MongoDB Atlas completely deprecated/removed).

---

## [2.0.0] - 2026-07-29

### Added — Modern UI/UX Foundation Infrastructure
- **Design System Integration**: Integrated approved `DESIGN_SYSTEM.md` specification with unified color palette (`#27AE60` Pulse Green, `#2563EB` Pulse Blue, Tailwind Zinc neutrals).
- **Vite + React + TypeScript Pipeline**: Configured modern build pipeline with strict TypeScript typing, Tailwind CSS 4 theme integration (`@theme`), and zero hardcoded styling.
- **30+ Reusable UI Components**: Button, Input, Textarea, Select, Checkbox, Switch, Badge, Avatar, Card, MetricCard, Dialog, Drawer, Sidebar, Navbar, Breadcrumb, Tabs, Accordion, Tooltip, Toast, DropdownMenu, DataTable, Skeleton, LoadingScreen, EmptyState, CommandPalette, SearchBar, Headers, StatTile, ChartCard.
- **Aceternity UI Components**: Spotlight, ShimmerButton, BentoGrid.
- **Motion Primitives**: PageTransition, ExpandablePanel, MotionHoverCard.
