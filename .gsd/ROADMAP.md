---
milestone: Client Engagement - 5 Features
version: 1.0.0
updated: 2026-06-30T11:32:00+05:30
---

# Roadmap

> **Current Phase:** 1 - Foundation & Local UI Implementation
> **Status:** executing

## Must-Haves (from SPEC)

- [ ] Plant/Garden SVG widget on client overview (Phase 1)
- [ ] Timeline Slider component for transformation photos (Phase 1)
- [ ] Mentor Badges & Tier calculation logic (Phase 1)
- [ ] Center Wall UI widgets (Phase 1)
- [ ] Database columns and interactions table migration (Phase 2)
- [ ] Client log syncing (Water, Mood, Waves) to DB (Phase 2)
- [ ] Center Wall database queries (leaderboard, group check-in count) (Phase 2)
- [ ] Coach dashboard panels for Nudges, Mood details, and Water logs (Phase 3)
- [ ] Verification, styling, and offline fallbacks (Phase 4)

---

## Phases

### Phase 1: Foundation (Frontend UI & Layouts)
**Status:** 🔄 In Progress
**Objective:** Add all visual elements to `client.html` (SVG Garden, Timeline Slider, Mentor Tiers, Center Wall UI).

**Plans:**
- [ ] Plan 1.1: Insert Visual Wellness Garden SVG card in Overview.
- [ ] Plan 1.2: Design and add UI layout for Center Wall tab.
- [ ] Plan 1.3: Add slider controls and styles to Transformation photos section.
- [ ] Plan 1.4: Code Mentor Rank indicators and descriptions below user profile badge.

---

### Phase 2: Client Portal Supabase Integration
**Status:** ⬜ Not Started
**Objective:** Connect frontend UI inputs to actual PostgreSQL table writes/reads.
**Depends on:** Phase 1

**Plans:**
- [ ] Plan 2.1: Write client check-in list, streak leaderboard, and monthly group count queries.
- [ ] Plan 2.2: Implement `saveWater()` & `saveMood()` upserts to attendance table.
- [ ] Plan 2.3: Implement timeline image uploading appending to `photo_history` JSON column.
- [ ] Plan 2.4: Poll/read `client_interactions` for coach cheers/sparks.

---

### Phase 3: Coach Dashboard Integration
**Status:** ⬜ Not Started
**Objective:** Create coach control interfaces in `coach.html` to send sparks, nudge clients, and view center stats.
**Depends on:** Phase 2

**Plans:**
- [ ] Plan 3.1: Add "Send Nudge/Cheer" actions next to active center clients.
- [ ] Plan 3.2: Display today's mood and water metrics of check-ins.

---

### Phase 4: Polish & Verify
**Status:** ⬜ Not Started
**Objective:** End-to-end testing, styling touch-ups, verification against success criteria.
**Depends on:** Phase 3

**Plans:**
- [ ] Plan 4.1: Perform verification and log screenshot/API outputs.
- [ ] Plan 4.2: Ensure robust LocalStorage fallbacks work for all features if columns are missing.

---

## Progress Summary

| Phase | Status | Plans | Complete |
|-------|--------|-------|----------|
| 1 | 🔄 | 0/4 | — |
| 2 | ⬜ | 0/4 | — |
| 3 | ⬜ | 0/2 | — |
| 4 | ⬜ | 0/2 | — |

---

## Timeline

| Phase | Started | Completed | Duration |
|-------|---------|-----------|----------|
| 1 | 2026-06-30 | — | — |
| 2 | — | — | — |
| 3 | — | — | — |
| 4 | — | — | — |
