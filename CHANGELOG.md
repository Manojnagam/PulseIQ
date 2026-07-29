# 📝 PulseIQ Changelog

All notable changes to the PulseIQ project are documented in this file.

---

## [2.0.0] - 2026-07-29

### Added — Modern UI/UX Foundation Infrastructure
- **Design System Integration**: Integrated approved `DESIGN_SYSTEM.md` specification with unified color palette (`#27AE60` Pulse Green, `#2563EB` Pulse Blue, Tailwind Zinc neutrals).
- **Vite + React + TypeScript Pipeline**: Configured modern build pipeline with strict TypeScript typing, Tailwind CSS 4 theme integration (`@theme`), and zero hardcoded styling.
- **30+ Reusable UI Components**:
  - `Button` (Primary, Secondary, Outline, Ghost, Danger, Success, Shimmer)
  - `Input` & `Textarea` (with error states & icon adornments)
  - `Select` & `Checkbox` & `Switch` (Radix UI primitives)
  - `Badge` (Custom variants: default, secondary, destructive, sky, indigo)
  - `Avatar` (User initials fallback & border styling)
  - `Card` & `MetricCard` (Stat tile with trend badges & icons)
  - `Dialog` & `Drawer` (Radix primitives with smooth motion transitions)
  - `Sidebar` & `Navbar` (Collapsible left sidebar + floating header)
  - `Breadcrumb` & `Tabs` & `Accordion` & `Tooltip` & `Toast`
  - `DataTable` wrapper (Sorting, live search, status filtering, pagination)
  - `Skeleton` & `LoadingScreen` & `EmptyState`
  - `CommandPalette` (`Cmd/Ctrl + K` shortcut listener)
  - `SearchBar` & `PageHeader` & `SectionHeader` & `StatTile` & `ChartCard`
- **Aceternity UI Components**: `Spotlight`, `ShimmerButton`, `BentoGrid`
- **Motion Primitives**: `PageTransition`, `ExpandablePanel`, `MotionHoverCard`
- **Application Master Layout**: Collapsible responsive sidebar, top bar with command search, theme toggle, notifications drawer, toast provider, responsive max-width container, and system status footer.

### Changed
- `index.html`: Updated to mount the modern React + Vite application shell while preserving legacy backup in `deploy/index.html`.
- `package.json`: Configured production dependencies (`react`, `react-dom`, `lucide-react`, `framer-motion`, `recharts`, `@radix-ui/*`, `cmdk`, `clsx`, `tailwind-merge`, `class-variance-authority`).
