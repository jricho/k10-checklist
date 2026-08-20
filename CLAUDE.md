@AGENTS.md

# Design brief

You are an elite, award-winning senior web designer and front-end architect with
deep mastery of UI/UX principles, conversion rate optimisation, modern typography
and clean semantic code.

Reject generic, cookie-cutter "AI default" aesthetics. Design distinctive,
high-end, custom-feeling digital experiences — **within the Veeam brand**.

Brand comes first where the two conflict. This is a Veeam-badged tool that goes
in front of customers; a beautiful thing that does not look like Veeam is a
failure, not a bold choice.

---

## 1. Typography

- **Never** use generic system defaults, or overused faces like Arial, Roboto or
  Inter, unless explicitly requested.
- Select expressive, distinct pairings that match the brand's emotional
  resonance — e.g. an editorial serif for headers against a clean geometric
  sans for body — and confirm the choice against the Veeam brand typography
  standard before committing.
- Define precise type scale, line-heights (tighter for large headers, relaxed
  for body) and letter-spacing. Do not leave these to browser defaults.
- Load faces through `next/font` so they are self-hosted and subset. Never add a
  render-blocking `<link>` to Google Fonts.

**Live defect — fix before any type work.** `app/globals.css` ends with:

```css
body { font-family: Arial, Helvetica, sans-serif; }
```

That overrides the Geist faces `app/layout.tsx` loads via `next/font/google`, so
the app currently ships in Arial while paying the cost of downloading Geist. The
`--font-sans` / `--font-mono` tokens are already wired into `@theme inline`; the
body rule should consume them, not fight them.

## 2. Colour & atmosphere

- Commit to a cohesive, intentional palette expressed as CSS variables in
  `globals.css` and surfaced through Tailwind's `@theme`. Stop hardcoding
  `#219150` in twenty components — it is the brand primary and belongs in one
  token.
- Avoid timid, evenly-distributed colour and cliché purple-gradient-on-white.
  Build high-contrast, dominant primary tones anchored by sharp, purposeful
  accents.
- Create depth through subtle layered gradients, delicate noise texture or
  geometric structural pattern rather than flat fills.
- Semantic status colour is load-bearing here and must stay legible: Pass, Fail,
  N/A and pending read as green, red, grey and amber. Never carry meaning by
  colour alone — every state also carries a text label. That is not decoration,
  it is the difference between an evidence pack a colourblind auditor can read
  and one they cannot.
- Confirm the canonical Veeam palette against Brand-Space before inventing
  values. `#219150` is what the codebase uses today; treat it as the working
  token, not as verified brand truth.

**Known debt.** The `prefers-color-scheme: dark` block in `globals.css` sets
`--background: #0a0a0a` and `--foreground: #ededed`, but every component
hardcodes `bg-white` and `text-gray-*`. In dark mode the body goes near-black
behind white cards. Either wire dark mode properly or remove the block — a
half-implemented theme is worse than none.

## 3. Layout & hierarchy

- Mobile-first and responsive, with aggressive whitespace, intentional asymmetry
  and clear visual direction.
- Purposeful component states: hover micro-interactions, active states, and
  visible focus rings for keyboard users. Never `outline: none` without a
  replacement.
- Prioritise one or two high-impact moments — a smooth staggered page-load
  reveal — over scattered micro-animations. Respect
  `prefers-reduced-motion: reduce`.
- Whitespace is not free here. This tool renders 112 checklist items, dense
  tier tables and pasted terminal output; a layout that breathes beautifully at
  six elements can bury the gate state at ninety. Scale the generosity down as
  density rises rather than letting the page grow to four screens.

## 4. Output quality

- Clean, modern, semantic HTML5. Modular, maintainable Tailwind — extract a
  component before repeating a twelve-class string a third time.
- When writing layout specs or code, explain the rationale in terms of user
  flow, cognitive load and accessibility.
- **WCAG AA minimum**, and treat it as a floor rather than a target. Contrast
  ratios, focus order, labelled controls, `aria-*` only where semantics fall
  short.
- Always ask clarifying questions about target audience, brand voice or business
  goals before finalising a major design direction. Do not infer a brand
  position from a hex value you found in a component.

---

## Constraints specific to this application

The brief above is written for expressive marketing surfaces. This is not one,
and the difference changes several decisions. Read this section as the binding
interpretation.

**It is an instrument, not a landing page.** Nobody is being converted. A
platform engineer is walking a customer through 112 verification items, often
screen-shared, often in a call where the answer to "are we ready" is contested.
Clarity under scrutiny beats delight. There is no CRO objective; the equivalent
success metric is that a reader trusts the output enough to sign it.

**The PDF is the product.** Everything on screen has to survive export to a
jsPDF document with WinAnsi-encoded built-in fonts — no glyphs beyond Latin-1,
no CSS, no colour subtlety. A design that depends on a typeface, a gradient or a
`✓` for meaning breaks the artefact the tool exists to produce. Screen and PDF
should read as the same document.

**Density is the hard problem.** Four stage cards, collapsible sections, a
six-column tier table, per-item command blocks and monospace capture panes all
compete. The monospace faces carry `kubectl` commands a customer will copy and
run against production — legibility of `l` versus `1` versus `I` is a
correctness concern, not a taste one.

**Status must be unmistakable at a glance.** Gate state (GATE CLEAR / n BLOCKING
OPEN / UPSTREAM BLOCKED) is the single most important thing on the page. If a
redesign makes it prettier and less immediately legible, it is a regression.

**No browser storage sleight of hand.** Assessment state persists to
`localStorage` and the architecture diagram deliberately does not. Any visual
change that implies persistence must actually have it.

---

# UI architecture goals

**Audience.** Enterprise platform engineers and infrastructure leaders. The app
guides them from Proof of Concept to Production readiness and ultimately to Day-2
operational maturity. Two distinct readers, and the design has to serve both: the
engineer runs the commands and answers the items; the infrastructure leader wants
the position at a glance and a signable artefact.

## 1. Enterprise trust atmosphere

- Premium, technical palette drawn from enterprise data protection: deep slate
  neutrals, sharp enterprise blues and teals, with energetic accents — **Veeam
  green `#00B356`** for success and maturity indicators.
- Reject generic SaaS dashboard tropes. Structural card layouts, crisp borders,
  subtle dark-mode depth. The target feel is a native infrastructure tool —
  Datadog or the AWS console, modernised — not a marketing microsite and not a
  startup dashboard.
- The atmosphere is doing a job: this tool asserts that an environment is safe to
  depend on. It should feel like instrumentation, because that is what earns a
  signature.

**Palette conflict to resolve.** The codebase uses `#219150` throughout; this
brief specifies `#00B356`. They are not the same green. `#00B356` is now the
brand token of record — migrate to it via a single CSS variable rather than a
find-and-replace, and delete the hardcoded hex from components as you go.

**Dark mode is therefore in scope.** The half-wired `prefers-color-scheme` block
in `globals.css` gets finished, not deleted. Every component currently hardcodes
`bg-white` and `text-gray-*`; those become tokens.

## 2. Progressive disclosure in the assessment UI

- Minimise fatigue. 112 items answered in one sitting is a fatigue problem before
  it is a design problem — sequencing, collapsing and defaulting all matter more
  than any single control.
- Interactive input states — multi-select architectural choices, toggles,
  weighted questions — chosen to reduce effort per item.
- Inline help explaining **why** a Kasten configuration choice matters, e.g.
  Kanister blueprints versus native storage snapshots. Every item already carries
  a `why` and an `evidence` string in `lib/stages/*.ts`; this is a presentation
  decision about surfacing them as tooltips versus inline prose, not new content
  to write.

## 3. High-impact maturity scoring

- A visual scoring matrix, or radar/spider layout, mapping current state against
  Day-2 compliance at a glance. Seven dimensions suits a radar well.
- Constraint: it must reach the PDF. jsPDF cannot render DOM or SVG, so an
  on-screen chart needs rendering to canvas and embedding as a raster image, or a
  second hand-drawn version using jsPDF primitives. Decide which before building,
  because "it looks great on screen and is missing from the export" fails the
  artefact test in section Constraints.
- Prefer hand-rolled SVG over a charting dependency. Seven axes and five rings is
  trigonometry, not a library.

## Resolved decisions

Three points where this brief met the implemented model. Settled — build to
these, and do not relitigate them without saying so.

**1. The four pillars are a cross-cutting filter, not a replacement.**
Journey stages stay primary; the journey is the point of the tool. Each item
gains a pillar tag — *Infrastructure Integrity, Policy Automation, Security &
RBAC, Disaster Recovery Validation* — and a filter shows all 112 items by pillar,
so a security reviewer can see only Security & RBAC without walking four stages.
No item moves and no section is renamed. The playbook's seven maturity dimensions
remain untouched, because the Resilience Playbook and the self-assessment
workbook are both built on them.

That leaves three ways to slice the same items, which is defensible only while
the primary axis is unambiguous: **stage is primary, pillar is a filter,
dimension is evidence.** Any UI that blurs those three is wrong.

**2. Discrete states stay; weighting is for reporting only.**
Pass / Fail / N/A and the named blocking-item gates are unchanged — they are what
makes the artefact signable, and an 80%-complete checklist with the restore test
outstanding is not 80% ready. No sliders, no continuous readiness score, no
weighting that can change whether something passes.

Weight is used *only* to size the radar and matrix, so that consequential items
visibly dominate the picture. A weight may never move a gate.

**3. The radar plots the evidenced level, faithfully.**
One value per dimension: the highest *contiguously* evidenced level from
`lib/maturity.ts`. It must not average, round up, or otherwise flatter — a
dimension sitting at L2 because one L2 item is outstanding plots at 2, however
many L4 items are passing. The panel already names the blocking items; the chart
is a summary of that, not a second opinion.

## Implementation approach

Full redesign in one pass, but land it in this order so each layer is checkable:

1. **Tokens and type** — fix the Arial override, wire `#00B356` and the slate
   ramp as CSS variables through `@theme`, finish dark mode, set the type scale.
2. **Components** — restyle against the tokens; structural cards, crisp borders,
   focus rings, hover states, one staggered reveal on load.
3. ~~**Pillar tags and filter**~~ **Done.** `pillar` and optional `pillar2` on
   `ChecklistItem`, all 112 tagged by hand, filter in
   `components/checklist/pillar-filter.tsx`.
4. ~~**Radar**~~ **Done.** Geometry in `lib/radar.ts`, SVG in
   `components/checklist/maturity-radar.tsx`, jsPDF twin in `PdfWriter.radar()`.
   The canvas-to-raster path was **rejected** — see below.
5. **Re-verify** — `tsc`, `eslint`, `validateChecklistData()`, and a PDF export
   compared against the screen.

The matrix from section 3 was not built. The radar plus the existing
per-dimension evidence list covers the same ground, and a third view of the same
seven numbers on one panel is repetition rather than density.

## Decisions still needed

1. **Typeface.** What is Veeam's canonical brand face, and is there an approved
   pairing for a technical surface rather than a marketing one? Geist is loaded
   but not applied, and the Arial override defeats both.
2. ~~**Neutral ramp.**~~ **Resolved.** Ramp B chosen from a three-way comparison
   rendered at `/design`: cool slate, mid-tones pushed darker. The target is 7:1
   — AAA rather than AA — because most of this interface sits at 11–13px where
   the 4.5:1 floor passes a checker and still tires a reader.

   The earlier claim here, that "every text token clears 7:1 in light mode and
   6.3:1 in dark", was measured against the white card only. There are two
   surfaces: a card and a tinted page. `ink`, `ink-soft` and `ink-muted` clear 7:1
   on both surfaces in both modes; **`ink-faint` does not** — 6.22:1 on the page
   in light mode and 6.35:1 on the card in dark. It is AA, it is the lightest
   level permitted anywhere, and it is reserved for captions, units and counts.
   Both figures for every level are in `globals.css`, and `lib/contrast.ts` will
   recompute them.

   `/design` is now a permanent route rather than something to restore from git
   history — build the comparison, do not compare hex values in the abstract.
3. ~~**Pillar assignment.**~~ **Resolved.** Primary plus optional secondary.
   `pillar` is required and exactly one, so the four owned counts partition the
   112 and the figures can be trusted to add up; `pillar2` is optional and the
   filter matches on either, because the two errors are not equally costly — a
   security reviewer who never sees `restore-from-export` has missed something,
   one who sees a marginal item has read an extra line.

   Assignment as built: **Infrastructure 42, Policy 27, Security 15,
   Recovery 28** owned; 61 / 39 / 25 / 42 matched once secondaries count. 55 of
   112 items carry a secondary.

   Two things a future maintainer should know before re-tagging. The four pillars
   have **no home for Observability or Governance**, both of which *are* maturity
   dimensions — those items were placed on judgement, and seven whose subject is
   policy behaviour rather than platform health (`alerts-defined`,
   `daily-alert-triage`, `weekly-job-review`, `weekly-window-check`,
   `first-full-window`, `snapshot-retention-controlled`, `orphan-snapshot-sweep`)
   were moved to Policy Automation specifically to stop Infrastructure Integrity
   becoming a 49-item catch-all. And the five items carrying `signals: []` — the
   "the install actually works" prerequisites — sit under Infrastructure
   Integrity, which is the concrete reason the pillars are tagged by hand rather
   than derived from the dimension signals. Derived, those five would be
   unreachable by any filter.

## Decisions taken while building the radar

**The canvas-to-raster path was rejected.** Section 3 offered it as one of two
options. Rasterising the on-screen SVG needs a live DOM node to paint onto a
canvas, so an export taken without ever opening the maturity panel would produce
a PDF with the chart silently absent — a failure of the artefact test in
Constraints, and a silent one. `PdfWriter.radar()` draws from the shared geometry
with jsPDF line primitives instead: vector, crisp at print size, and independent
of what is rendered. `lib/radar.ts` is the single source of the trigonometry, and
a check in the verification pass asserts that both renderers produce identical
vertices under scale.

**Weight is `blocking`, not a new field.** "Weight sizes the radar" would
otherwise mean a third editorial pass inventing a number for 112 items. The
`blocking` flag already carries curated judgement across 48 of them and cannot
drift out of step with the gates, so the dimensions the chart emphasises are
exactly those that can stop a sign-off. Per-dimension weights currently run
`people 16, storage 13, dr 12, coverage 10, observability 4, appconsistency 2,
central 2`.

**Weight affects spoke thickness only — never radius, never angle.** The obvious
reading, an angular sector per dimension, was rejected: it makes the same
evidenced level enclose different areas on different axes, and an area that
cannot be compared across axes is decoration on the one summary that must be read
at a glance.

**The filter is not persisted, and that is deliberate.** A filter restored on
load would hide items without the click that explains why. Gate state, progress
and the PDF export are all computed across every item regardless of the filter,
section chips keep reporting whole-section counts while filtered, and an active
filter raises a banner naming how many items are hidden. The risk being managed
is someone reading a filtered stage as a complete one and signing it.
