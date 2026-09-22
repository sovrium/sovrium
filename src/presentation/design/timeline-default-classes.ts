/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prestyled-by-default class computers for the `timeline` data view (wave R-D).
 *
 * A timeline is a Gantt read: one horizontal axis, optional swimlanes, and a
 * bar or a diamond per record. This module owns every class those parts paint
 * so the SSR skeleton and the hydrated island are drawn from ONE source and
 * cannot drift apart on hydration.
 *
 * ## Why it lives in `presentation/utils/recipes`
 * The view is drawn TWICE: once by the SSR placeholder in
 * `ui/sections/rendering/component-registry/island-data-components.tsx` (a
 * `presentation-component`) and once by the hydrated island in
 * `islands/timeline/timeline-view.tsx` (a `presentation-island`).
 * `[internal ref]` forbids BOTH directions across that seam, so a
 * recipe both sides need can only live in `presentation-util` — the same
 * reasoning and the same directory as `kpi-default-classes.ts`,
 * `list-default-classes.ts` and `button-default-classes.ts`.
 *
 * ## Safelist
 * `src/presentation/utils/recipes` is registered in `RECIPE_DIRS`
 * (`src/infrastructure/css/arbitrary-var-safelist.ts`), and the generator
 * matches `*-default-classes.ts` by NAME, so every `v(…)` template literal
 * below is resolved at build time into the compiler's `@source inline(...)`
 * safelist. The compiler is scan-free at runtime: a recipe whose arbitrary
 * classes are NOT safelisted emits no rule at all and paints nothing while
 * reading correctly in source and passing both typecheck and lint.
 *
 * ## Colour / layout split
 * Colour and radius go through {@link withVarFallback} so an `app.design.*`
 * override still wins at the CSS cascade layer; layout, spacing and type steps
 * stay raw Tailwind because they encode structure, not colour.
 *
 * ## Type steps
 * Every size is a rung of the platform ladder (`PLATFORM_TYPE_LADDER`,
 * `inherited-tokens.generated.ts`). The canvas draws the timeline's chrome at
 * **9px**, which has NO rung; R-D takes the nearest, `text-2xs` (10/14), and
 * records the +1px as a named divergence — the same call
 * `chart-default-classes.ts` made for its tick labels. No `text-[Npx]`
 * anywhere.
 *
 * Parts covered (each maps 1:1 to an element the view already emits, so no
 * `data-*` attribute moves):
 *
 *   - SHELL       — the `data-component="data-timeline"` surface
 *   - LANE        — the `data-testid="timeline-swimlane"` group
 *   - LANE TITLE  — the band naming that lane
 *   - ROW         — the per-record track a bar or a marker is positioned in
 *   - BAR         — the `data-testid="timeline-bar"` span box
 *   - BAR LABEL   — the record label printed INSIDE the bar
 *   - MARKER      — the diamond an end-less record renders instead of a bar
 *   - MARKER LABEL— the record label printed beside that diamond
 *   - SCALE AXIS  — the `data-testid="time-axis"` tick row
 *   - TODAY       — the dashed rule at the current date, and the tag naming it
 *   - DEPENDENCY  — the connector joining a record to a predecessor
 *
 * ## What this view deliberately does NOT converge
 * The canvas draws a Gantt **SVG** (480 viewBox, 104px label gutter, 26px
 * rows, 18px lane bands, 14px bars, elbow dependency connectors, a dashed
 * Today rule, resize handles). The shipped island is a percentage-positioned
 * DOM composition, so R-D converges the VALUES of the parts rather than the
 * drawing.
 *
 * `today` and `dependency` DO have markup now, and their tones are declared
 * below. Their geometry still departs from the canvas twice, both times because
 * the DOM composition is laid out differently: the canvas puts its axis at the
 * TOP and hangs the rule beneath it, where this view closes with the axis at the
 * bottom; and the canvas' four connector types (FS / SS / FF / SF) are a
 * vocabulary no shipped config can express, so a link is drawn as the band
 * between the two records' anchor points and nothing finer is invented.
 *
 * The RESIZE HANDLES remain absent, and remain a capability rather than a
 * restyle: a draggable handle has to commit a new end date back through the
 * records API, which is a write path, an optimistic update and a permission
 * gate — none of which a class computer can supply.
 *
 * Canvas oracle: `spec-data.mjs:266-300` (`gantt`).
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'

// ──────────────────────────────────────────────────────────────────────────────
// SHELL — the outer `data-component="data-timeline"` surface
// ──────────────────────────────────────────────────────────────────────────────

// Canvas: 1px `hair` border · 6px radius · `raised` fill.
//
// One value changes: the radius drops from `rounded-lg` (8px) to `radius-md`
// (6px), which is the radius every other R-D surface — list shell, gallery
// card, kanban column, KPI card, chart shell — now carries. A view that rounds
// harder than the table beside it reads as a different system.
//
// The `p-4` that shipped is KEPT. The canvas states no padding for the gantt
// frame (its 104px label gutter is SVG geometry, not a box inset), so there is
// nothing to converge toward and a change here would be invention.
//
// `border-[…sv-border…]` is not a re-spelling of the `border-border` that
// shipped, and it is not a behaviour change either: `--color-border` is
// registered as `var(--sv-border)`, and an author `design.colors.border`
// reaches `--sv-border` directly through `generateAuthorSvBridge`
// (`COLOR_TO_SV_TOKEN.border === 'border'`). Both spellings resolve to the same
// value in zero-config AND under an author override, which is what keeps
// `[internal ref]` — asserting the author's `#cccccc`
// lands on this element's border — green across the swap.
const TIMELINE_SHELL = [
  'w-full p-4',
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `rounded-[${v('radius-md', T.radiusMd)}]`,
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
].join(' ')

/**
 * Compute the default className for the outer timeline surface — the element
 * that carries `data-component="data-timeline"`.
 *
 * Bordered and raised on `radius-md`, with no elevation: the canvas separates a
 * data view from the page by layer and hairline, never by a lift.
 *
 * Consumed by the populated view, by the loading state, and by the SSR
 * skeleton, so the frame is byte-identical across hydration and the chrome
 * never re-draws under the records as they arrive.
 */
export const computeTimelineShellClasses = (): string => TIMELINE_SHELL

// ──────────────────────────────────────────────────────────────────────────────
// LANE — the `data-testid="timeline-swimlane"` group
// ──────────────────────────────────────────────────────────────────────────────

// Canvas: the lane is a flat BAND, not a card. What shipped was a bordered
// `bg-background-subtle` box with `p-2` — a second surface nested inside the
// timeline's own raised one, which is one layer too many for what is really
// just a heading over a group of rows.
//
// So the lane keeps NO chrome of its own. Its `well` fill moves to the title
// band (below), which is the only part of it the canvas actually paints, and
// the rows underneath sit flush on the shell. Removing chrome is the point of
// this pass.
const TIMELINE_LANE = ''

/**
 * Compute the default className for a swimlane group
 * (`data-testid="timeline-swimlane"`).
 *
 * Deliberately EMPTY: the lane is a grouping element with no box. It ships as
 * a `compute*` export rather than being dropped from the call site because the
 * lane IS a part of the vocabulary — a future retune that wants to give it
 * chrome back has one place to do it, and the `data-testid` the specs assert on
 * keeps a named owner.
 *
 * The element itself is still rendered: it carries `data-testid` and
 * `data-timeline-lane`, both of which specs select.
 */
export const computeTimelineLaneClasses = (): string => TIMELINE_LANE

// ──────────────────────────────────────────────────────────────────────────────
// LANE TITLE — the band naming a swimlane
// ──────────────────────────────────────────────────────────────────────────────

// Canvas: an 18px `well` band carrying a 9px / weight 500 / uppercase title
// tracked at 0.04em, in `prose`. What shipped was `text-sm font-semibold` on
// the raised surface — a heading, competing with the record labels below it.
//
// The 18px band height is built from the type ladder rather than asserted:
// `text-2xs` is 10/14, so `py-0.5` (2px + 2px) sums to exactly 18. There is no
// `h-[18px]` rung and the class is not in the compiled candidate corpus, so
// deriving the height from leading + padding is both the emitted route and the
// one that survives a user's font-size preference.
//
// `px-2` is carried over from the `p-2` of the box that was removed: a label
// flush against the edge of a filled band is the one thing worse than the box.
//
// The 0.04em tracking is `--letter-spacing-caps`, which the theme layer emits
// at exactly the canvas value. Spelled through `v()` rather than as
// `tracking-wide` (0.025em) or `tracking-wider` (0.05em) because neither rung
// is the drawn value and the token IS.
const TIMELINE_LANE_TITLE = [
  'px-2 py-0.5',
  'text-2xs font-medium uppercase',
  `tracking-[${v('letter-spacing-caps', T.letterSpacingCaps)}]`,
  `text-[${v('sv-fg-muted', T.fgMuted)}]`,
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
].join(' ')

/**
 * Compute the default className for a swimlane's title band.
 *
 * A flat `well` strip, 18px tall, carrying the lane name as tracked uppercase
 * micro-type. Uppercase + tracking is what lets a 10px label read as a GROUP
 * KEY rather than as content — which is the job the `font-semibold` heading it
 * replaces was doing by shouting instead.
 *
 * Canvas `prose` (#565656) maps EXACTLY to `sv-fg-muted` (.453 vs .445 OkLab
 * lightness), so this is a value-exact mapping rather than the wave-level
 * role-over-value one the caption tones use.
 */
export const computeTimelineLaneTitleClasses = (): string => TIMELINE_LANE_TITLE

// ──────────────────────────────────────────────────────────────────────────────
// ROW — the per-record track
// ──────────────────────────────────────────────────────────────────────────────

// Canvas: a 1px `#f4f4f4` rule under each row.
//
// `#f4f4f4` is `well` — `sv-bg-subtle`, NOT `sv-border`. The two weights are
// used deliberately across this wave: `hair` (`sv-border`) delimits a SURFACE,
// `well` rules a GRID. A grid ruled at border weight reads as a table of boxes;
// this is the same two-weight discipline the calendar's outer separators and
// inner cell rules encode, and collapsing them is the single most visible way
// to get a data view wrong.
//
// The rule replaces the `space-y-1` that shipped. Contiguous rows separated by
// a hairline is what makes a Gantt scan horizontally; 4px of air between
// floating bars does not.
//
// `last:border-b-0` mirrors `computeListDividerClasses`: the trailing rule
// would otherwise sit 8px above the axis' own `border-t` and read as a doubled
// edge. Inside a lane it is also unnecessary — the next lane's filled title
// band is already the separator.
//
// `h-8` (32px) is KEPT. The canvas row is 26px, but the bar inside it stays at
// 28px (see BAR), so 26 cannot hold it; the target table states no row-height
// action for exactly this reason.
const TIMELINE_ROW = [
  'relative h-8',
  'border-b',
  `border-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  'last:border-b-0',
].join(' ')

/**
 * Compute the default className for one record's track — the positioning
 * context a bar or a marker is placed into.
 *
 * `relative` is load-bearing rather than decorative: both the bar and the
 * marker are absolutely positioned from a percentage of the time axis, so this
 * element is what those percentages are a percentage OF.
 *
 * The colour is set with `border-[…]` (all sides) rather than `border-b-[…]`
 * on purpose. Tailwind infers width-vs-colour from an arbitrary value, and a
 * `var()` whose fallback it cannot classify is ambiguous; only the bottom edge
 * has a width, so an all-sides colour paints exactly one rule. Same shape as
 * `computeListDividerClasses`.
 */
export const computeTimelineRowClasses = (): string => TIMELINE_ROW

// ──────────────────────────────────────────────────────────────────────────────
// BAR — the `data-testid="timeline-bar"` span box
// ──────────────────────────────────────────────────────────────────────────────

// Canvas: a 14px bar at radius 3, with its label printed OUTSIDE it at 9px in
// `muted`.
//
// **The bar keeps its label, and therefore its height.** Two shipped specs
// forbid the canvas' split, and both were read before this was decided:
//
//   - `basic-timeline-view.spec.ts:213` asserts `toContainText` on
//     `[data-testid="timeline-bar"]` — the label is INSIDE that element.
//   - `option-colors.spec.ts:1096` reads the BACKGROUND of that same element
//     and asserts it equals the author's declared option hex, and `-010`
//     asserts the label meets WCAG AA **against that fill**.
//
// So the fill and the label are one element by contract. A 14px box cannot
// carry a 10px label, so the height stays `h-7` (28px) and only the type comes
// down — from `text-sm` (12) to `text-2xs` (10).
//
// `font-medium` is KEPT, and this is the one place in the recipe that diverges
// from the wave's usual "drop an unstated weight". The canvas states no weight
// for the bar label because it draws that label on the page ground, not on a
// saturated fill; 10px regular on an arbitrary author hue is thinner than the
// AA floor the platform is contractually deriving for it.
//
// `text-[…sv-fg-inverse…]` replaces the `text-white` literal (and the standing
// `no-restricted-syntax` disable that justified it). It applies to the DEFAULT
// fill only — a bar carrying a resolved `colorField` colour overrides it with
// an inline `color` derived to meet AA against THAT fill, and an inline style
// beats any class.
const TIMELINE_BAR = [
  'absolute flex h-7 items-center overflow-hidden px-2',
  'rounded-[3px]',
  'text-2xs font-medium',
  `text-[${v('sv-fg-inverse', T.fgInverse)}]`,
].join(' ')

/**
 * Compute the default className for a bar (`data-testid="timeline-bar"`).
 *
 * Geometry and the DEFAULT-fill label tone only. The fill itself, the derived
 * AA foreground, and the `left`/`width` percentages are inline styles the
 * island computes per record — they are genuinely dynamic and cannot be
 * classes.
 *
 * The 3px radius is spelled as an arbitrary value rather than a token because
 * the radius ladder has no 3px rung (`radius-sm` 2px · `radius-base` 4px) and
 * the canvas is unambiguous. It is NOT in the compiled candidate corpus yet:
 * `bun run build:css-assets` must regenerate before this paints, or the bar
 * renders square-cornered while every check stays green.
 */
export const computeTimelineBarClasses = (): string => TIMELINE_BAR

/**
 * Compute the default className for the label INSIDE a bar.
 *
 * `truncate` and nothing else. The type step, the weight and the tone are set
 * on the bar and inherited, so the label cannot disagree with the box it sits
 * in — and the bar's derived inline `color` reaches it for the same reason.
 *
 * Truncation is not optional here: the label is `$record` data whose length no
 * author controls, and the bar's width is a percentage of the time axis, so a
 * short task with a long name would otherwise overflow its own duration.
 */
export const computeTimelineBarLabelClasses = (): string => 'truncate'

// ──────────────────────────────────────────────────────────────────────────────
// MARKER — the diamond an end-less record renders instead of a bar
// ──────────────────────────────────────────────────────────────────────────────

// Canvas: a 12px diamond (a rotated square) in the author's colour. `h-4 w-4`
// (16px) shipped, which is a third larger than drawn and made a milestone
// outweigh the bars it punctuates.
//
// `size-3` is 12px — the canvas value exactly, and already in the compiled
// candidate corpus (unlike `size-2` / `size-2.5`, which are not).
const TIMELINE_MARKER = 'inline-block size-3 rotate-45'

/**
 * Compute the default className for a milestone diamond.
 *
 * The glyph is a square rotated 45 degrees rather than a clip-path or an SVG:
 * it is `aria-hidden`, it carries the record's colour as an inline
 * `background-color`, and a rotated box is the one shape that inherits that
 * fill with no extra element.
 *
 * Its bounding box is therefore ~17px, not 12 — which is why the marker's row
 * centres its content vertically rather than offsetting it by a fixed top.
 */
export const computeTimelineMarkerClasses = (): string => TIMELINE_MARKER

/**
 * The marker's positioning wrapper — the element carrying
 * `data-testid="timeline-point"`.
 *
 * Ships as a constant rather than a `compute*` export because it is the
 * marker's placement, not a part of its own.
 *
 * `inset-y-0` + `items-center` replaces the `top-1` that shipped. A fixed 4px
 * offset centred the OLD 16px diamond by coincidence; shrinking it to 12 left
 * the milestone visibly riding high in its row. Stretching the wrapper to the
 * row and centring is offset-free and stays correct if either the row or the
 * glyph is retuned again.
 */
export const TIMELINE_MARKER_WRAPPER_CLASSES = 'absolute inset-y-0 flex items-center gap-2'

const TIMELINE_MARKER_LABEL = ['text-2xs', `text-[${v('sv-fg', T.fg)}]`].join(' ')

/**
 * Compute the default className for the label beside a milestone diamond.
 *
 * The canvas' row label: 10px on `ink`. `text-sm` (12) `font-medium` shipped —
 * a marker label read louder than a bar label for no reason, since they name
 * the same kind of thing.
 *
 * The weight is dropped because the canvas states none for a row label, and
 * unlike the bar label this one sits on the shell's own raised surface at full
 * `sv-fg` contrast, so it needs no compensation.
 */
export const computeTimelineMarkerLabelClasses = (): string => TIMELINE_MARKER_LABEL

// ──────────────────────────────────────────────────────────────────────────────
// SCALE AXIS — the `data-testid="time-axis"` tick row
// ──────────────────────────────────────────────────────────────────────────────

// Canvas: 9px ticks in `subtle`, over a 1px `hair` rule.
//
// Two changes from what shipped: the step comes down from `text-sm` (12) to
// `text-2xs`, and the tone from `sv-fg-muted` to `sv-fg-subtle`. The axis is
// the quietest thing on the view — it is a ruler, read only when a bar's
// position is in question — and at 12px muted it competed with the record
// labels it exists to measure.
//
// The rule stays at `hair` weight (`sv-border`), NOT the `well` the row rules
// use: this one closes the surface rather than dividing a grid.
const TIMELINE_SCALE_AXIS = [
  'mt-2 flex justify-between pt-1',
  'border-t',
  `border-[${v('sv-border', T.border)}]`,
  'text-2xs',
  `text-[${v('sv-fg-subtle', T.fgSubtle)}]`,
].join(' ')

/**
 * Compute the default className for the time axis (`data-testid="time-axis"`).
 *
 * `justify-between` over evenly spaced ticks is what makes the axis
 * self-scaling: no measurement, and the labels land on the positions the bars'
 * percentages are computed against. How MANY ticks is the caller's business —
 * it follows the declared zoom — so the recipe stays a row of equal gaps and
 * holds at any count.
 *
 * Canvas `subtle` maps to `sv-fg-subtle` under the wave-level role mapping
 * rather than to the value-exact `sv-fg-disabled` — painting a live axis with
 * the disabled-STATE token would collide with every disabled affordance and
 * with the contrast arguments built on it. The ticks render ~0.17 OkLab
 * lightness darker than the drawing; a named, accepted divergence.
 */
export const computeTimelineScaleAxisClasses = (): string => TIMELINE_SCALE_AXIS

// ──────────────────────────────────────────────────────────────────────────────
// TODAY — the rule at the current date, and the tag naming it
// ──────────────────────────────────────────────────────────────────────────────

// Canvas: a DASHED vertical hairline running the height of the plot, with a
// small rounded tag reading `Today` pinned at the axis end of it.
//
// Dashed rather than solid is the whole point: a solid rule at this weight is
// indistinguishable from a grid line, and the marker is not part of the ruler —
// it is one instant called out on it. `subtle` is the axis' own tone, so the
// rule reads as chrome; the TAG carries the contrast instead, which is why it
// takes the primary solid pair. One saturated 20px chip is enough to find the
// date at a glance without a coloured line cutting the bars in half.
//
// `pointer-events-none` because the overlay spans every row: a rule that
// swallowed a click on the bar behind it would be a regression in a view whose
// bars carry a `title`.
const TIMELINE_TODAY = [
  'pointer-events-none absolute inset-y-0 z-10 w-px',
  'border-l border-dashed',
  `border-[${v('sv-fg-subtle', T.fgSubtle)}]`,
].join(' ')

/**
 * Compute the default className for the today rule (`data-timeline-today`).
 *
 * The element is one pixel wide and stretches the full height of the plotted
 * rows; its `left` is a percentage of the time axis the island computes with
 * the same {@link toPercent}-style mapping the bars use, so the rule lands on
 * the same scale as the data rather than on a second, parallel one.
 *
 * It is only ever rendered for a date the axis actually covers — see
 * `isWithinBounds` in `timeline-compute.ts`.
 */
export const computeTimelineTodayClasses = (): string => TIMELINE_TODAY

// The tag hangs off the top of the rule and is centred on it (`-translate-x-1/2`
// against a 1px parent). `text-2xs` is the same micro-type rung the lane title
// and the axis spend, so the chip does not read as content.
const TIMELINE_TODAY_TAG = [
  'absolute top-0 left-0 -translate-x-1/2 px-1',
  'text-2xs leading-4 font-medium whitespace-nowrap',
  `rounded-[${v('radius-sm', T.radiusSm)}]`,
  `bg-[${v('sv-primary', T.primary)}]`,
  `text-[${v('sv-primary-fg', T.primaryFg)}]`,
].join(' ')

/**
 * Compute the default className for the tag naming the today rule.
 *
 * The primary SOLID pair (`sv-primary` on `sv-primary-fg`), because this is the
 * one element on the view that is neither chrome nor a record: it answers "where
 * am I now" and has to be findable without being hunted for.
 */
export const computeTimelineTodayTagClasses = (): string => TIMELINE_TODAY_TAG

// ──────────────────────────────────────────────────────────────────────────────
// DEPENDENCY — the connector joining a record to a declared predecessor
// ──────────────────────────────────────────────────────────────────────────────

// The connector spans the band between the predecessor's finish and the
// successor's start, drawn in the SUCCESSOR's row. Three hairlines: a vertical
// tick at each end of the band and a horizontal run joining them along the
// bottom, i.e. a bracket. That shape is direction-agnostic, which the data is
// not guaranteed to be — a successor may begin before its predecessor ends, and
// an arrowhead pointing the wrong way would be worse than none.
//
// `sv-fg-subtle`, the axis tone: a dependency is a reading aid drawn over the
// records, and drawn at record weight it would compete with the bars it links.
//
// `min-w-px` is load-bearing rather than defensive. The band's width is a
// percentage of the axis, and a zero-length dependency — a successor starting
// exactly when its predecessor finishes, which is the textbook finish-to-start
// case — would otherwise render as a box of no width and paint nothing at all.
const TIMELINE_DEPENDENCY = [
  'pointer-events-none absolute top-0 h-1/2 min-w-px',
  'border-r border-b border-l',
  `border-[${v('sv-fg-subtle', T.fgSubtle)}]`,
].join(' ')

/**
 * Compute the default className for a dependency connector
 * (`data-timeline-dependency`).
 *
 * `h-1/2` puts the bracket in the upper half of the successor's row, above the
 * bar rather than through it, so the link and the record it belongs to stay
 * separately readable. The `left`/`width` percentages are inline styles the
 * island computes per link.
 */
export const computeTimelineDependencyClasses = (): string => TIMELINE_DEPENDENCY
