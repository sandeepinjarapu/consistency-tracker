---
name: Consistency Tracker
description: A calm, private habit tracker built around evidence of showing up, not scoring.
colors:
  ink: "#0a0a0a"
  canvas: "#ffffff"
  muted: "#6b7280"
  border: "#e5e7eb"
  category-green: "#22c55e"
  heatmap-empty: "#f3f4f6"
  heatmap-missed: "#e5e7eb"
  heatmap-skipped: "#fde68a"
  uncategorized: "#bd8a9c"
typography:
  display:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 300
    lineHeight: 1.375
    letterSpacing: "-0.01em"
  title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 300
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.05em"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.muted}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
  pill-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.full}"
    padding: "0 16px"
    height: "44px"
  input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  card:
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
---

# Design System: Consistency Tracker

## 1. Overview

**Creative North Star: "The Quiet Logbook"**

Consistency Tracker looks like a well-kept paper logbook, not a dashboard. The
surface is near-white, the ink is near-black, and almost everything in between
is one of two greys. Color is rationed: each goal carries a single category
hue, and that hue only appears where it means something (a done day, this
week's progress, a category dot). The result is calm and legible, a place you
can glance at and feel seen rather than scored.

It explicitly rejects the habit-tracker genre's defaults: no gamified streak
celebrations, no activity-ring fitness aesthetic, no neon-on-dark, no
hero-metric cards with gradient numbers, no confetti, and no red "you failed"
states. Restraint is the point. The interface should disappear into the act of
showing up.

**Key Characteristics:**
- Monochrome structure, one category accent at a time.
- Flat by default; depth only where an element genuinely floats (menus).
- Generous whitespace, a single centered reading column.
- Distinct visual languages per concept (chips, rail, heatmap, rows).
- Plain, humane, second-person copy.

## 2. Colors

A two-grey monochrome base with a single per-goal accent and a small set of
fixed status hues for the heatmap.

### Primary
- **Category Accent** (per goal; default green `#22c55e`): the goal's chosen
  category color. The *only* saturated color on most screens. Used for the
  category dot, the Today card's left rail, a "done" heatmap cell, this week's
  filled progress (chips / quota rail / weekly strip), and the Catch Up "Log"
  action. Uncategorized falls back to a quiet dusty rose `#bd8a9c` (its own
  muted hue, not a category color and distinct from the missed grey, so an
  uncategorized goal still reads as a live row). Centralized in
  `src/lib/colors.ts` as `UNCATEGORIZED_COLOR`.

### Neutral
- **Ink** (`#0a0a0a`): all primary text and the primary-button fill.
- **Canvas** (`#ffffff`): the page and card background.
- **Muted** (`#6b7280`): secondary text, labels, helper copy, section headers.
- **Border** (`#e5e7eb`): hairline dividers, card and input strokes, section
  separators.

### Tertiary (status hues — heatmap and check-in state only)
- **Skipped Amber** (`#fde68a`): a skipped day (a deliberate, guilt-free skip),
  paired with a soft amber wash (`bg-amber-50/60`) on the Today card.
- **Done Green wash** (`bg-green-50/60`): a logged Today card's tint.
- **Heatmap Empty** (`#f3f4f6`) and **Missed** (`#e5e7eb`): unlogged days. The
  all-goals summary heatmap uses a GitHub-style green ramp
  (`#ebedf0 → #9be9a8 → #40c463 → #30a14e → #216e39`) to encode intensity.

### Named Rules
**The Rationed-Color Rule.** Monochrome carries the structure; the category
accent carries meaning. Color never decorates. If an element is colored, it is
because that color *says something* (which goal, done vs not, this week's
progress).

**The No-Verdict-Red Rule.** There is no error-red for a missed habit. A missed
day is grey (`#e5e7eb`), never red. Red is reserved strictly for genuine form
errors (`text-red-600`).

## 3. Typography

**Display / Body / Label Font:** one system sans stack
(`ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`).

**Character:** native and invisible. A single well-tuned system sans carries
everything from the reflective hero line to the smallest meta label. No display
face, no pairing — the restraint is deliberate.

### Hierarchy
- **Display / Hero** (300, 1.5rem, leading-snug): the Reflections weekly
  narrative ("You showed up 4 times this week…") and goal-detail headlines.
  Capped to `max-w-prose`.
- **Title** (300, 1.25rem, tracking-tight): page headings ("Goals",
  "Partners").
- **Body** (400, 0.875rem / `text-sm`): the default for content, list items,
  inputs. Prose capped at 65–75ch (`max-w-prose`).
- **Label** (500, 0.75rem / `text-xs`): field labels, metadata, button text.
- **Section header** (500, 0.75rem, `uppercase tracking-wider`, muted): the
  divider label that opens each section ("DETAILS", "CATCH UP", "THIS WEEK").
- **Fine print** (0.625–0.6875rem / `text-[10px]`/`text-[11px]`): legends,
  counters, timestamps.

### Named Rules
**The Light-Headline Rule.** Headlines are `font-light` (300), never bold. Size
and whitespace carry hierarchy; weight stays quiet. Emphasis within body text
uses `font-medium` (500) at most.

## 4. Elevation

Flat by default. Cards, inputs, and sections are defined by a 1px `#e5e7eb`
border or a hairline divider, never by a shadow. Depth appears only on elements
that genuinely float above the page.

### Shadow Vocabulary
- **Menu lift** (`box-shadow: shadow-sm` / `shadow-md`): the only shadow in the
  system — dropdowns (the Skip-reason menu, the goal `⋯` overflow menu) and the
  near-instant heatmap tooltip (a near-opaque ink chip).

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. If something has a
shadow, it is a transient overlay (a menu, a tooltip). Resting cards use a
border, full stop.

## 5. Components

### Buttons
- **Shape:** `rounded-md` (6px); selectable filters and toggles are
  `rounded-full` pills.
- **Primary:** ink fill (`#0a0a0a`), white text, 44px tall, `px-4`. Used for
  the single most important action on a surface (Mark done, Save reflection,
  Create goal, Send invite).
- **Secondary / Ghost:** white with a `#e5e7eb` border or borderless muted
  text; `hover:border-black` / `hover:text-black`. Used for Skip, Undo, Cancel,
  Manage.
- **Hover / Focus:** quiet — border or background shifts toward ink; no lift,
  no glow. Transitions are short (`transition`, ~150ms).

### Chips (this week's schedule, specific-day goals)
- **Style:** small `rounded-md` weekday markers ("Mon", "Tue") whose own fill
  encodes state — **done** fills with the category accent (white text),
  **today** is a category-color ring, **missed** is a quiet grey fill,
  **upcoming** is a faint outline.
- Each chip carries an `aria-label` ("Monday: done"). No separate status dot.

### Quota Rail (this week's progress, frequency goals)
- A thin segmented horizontal bar of N segments (the weekly target); filled
  segments use the category accent, the rest are `#e5e7eb`. Reads as "2 of 5",
  not a calendar.

### Cards / Containers
- **Corner Style:** `rounded-lg` (8px).
- **Background:** white. **Border:** 1px `#e5e7eb`. **Shadow:** none.
- **Today card signature:** a thin vertical category-color rail on the left
  edge (a functional identity marker, not a decorative stripe) plus a soft
  per-state wash (green / amber) once acted on.
- **Internal padding:** `px-4 py-3` (cards), `pt-6` above a bordered section.

### Inputs / Fields
- **Style:** white, 1px `#e5e7eb` border, `rounded-md`. Interactive pickers
  (select, time) are 44px tall.
- **Focus:** `focus:border-black`, no glow or ring.
- **Error:** surfaced as `text-red-600` helper text below the form, not a red
  field.

### Navigation
- Top tab bar (Today / Goals / Reflections / Partners). Active tab: ink text
  with a 2px underline; inactive: muted, `hover:text-black`. The wordmark
  ("Consistency Tracker") sits left and links home.

### Sections (signature layout pattern)
- A surface is divided into sections by a hairline (`pt-6 border-t
  border-[#e5e7eb]`) plus an uppercase-muted header. The goal form
  (Details / How often / Reminder) and the goal-detail page (This week /
  Catch up / Recent activity) both use this single rhythm, so a page reads as
  one coherent set of sections.

### Heatmap (signature component)
- A GitHub-style 7×N SVG grid, Monday-on-top, small rounded cells. **Read-only
  everywhere** — it is the record of showing up, not an editor. Editing recent
  days lives in the separate "Catch up" list of 44px dated rows.

## 6. Do's and Don'ts

### Do:
- **Do** keep the page monochrome and let one category accent carry meaning per
  goal (`#22c55e` default, or the user's category hue).
- **Do** give every interactive control a 44px minimum target via the shared
  `tapTarget` convention (`src/lib/ui.ts`).
- **Do** open every section with the hairline-divider + uppercase-muted-header
  pattern, so new sections match Details / How often / Reminder / Sharing.
- **Do** keep headlines `font-light`; carry hierarchy with size and whitespace.
- **Do** keep copy plain, second-person, and encouraging. A blank week says
  "still time" or "fresh week".
- **Do** reserve any completion **percentage** for surfaces that score a
  finished week (Reflections, the weekly email). Never on Today or Partner.

### Don't:
- **Don't** gamify: no streak-shaming, confetti, badges, XP, or leaderboards.
- **Don't** reach for the fitness-dashboard / quantified-self look: no activity
  rings, no neon-on-dark, no hero-metric cards with gradient numbers.
- **Don't** color a missed day red. Missed is grey; red is for form errors
  only.
- **Don't** add a decorative `border-left` stripe to callouts or list items.
  (The Today card's left rail is the one sanctioned use — a functional category
  marker, not decoration.)
- **Don't** reuse the heatmap's square grid for current-week progress — chips
  are the schedule, the rail is the quota, the heatmap is history. One shape per
  job.
- **Don't** make the heatmap clickable; editing is the Catch up list.
- **Don't** use em dashes in copy; use periods, colons, or parentheses.
