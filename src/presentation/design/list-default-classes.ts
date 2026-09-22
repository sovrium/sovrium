/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prestyled-by-default class computers for the `list` data view (wave R-D).
 *
 * The list island rendered **zero** classes before this wave: it emitted a bare
 * `<ul>` of bare `<li data-list-item>` holding bare `<span data-list-title>`,
 * so a table-bound list painted as the browser's default bulleted list. This
 * module is that view's entire visual vocabulary — pure addition, and the
 * reason every part below is described against the canvas rather than against
 * "what shipped".
 *
 * ## Why it lives in `presentation/utils/recipes`
 * The list is drawn TWICE: once by the SSR host in
 * `ui/sections/rendering/component-registry/special-components.tsx` (a
 * `presentation-component`) and once by the hydrated island in
 * `islands/search/search-list-renderers.tsx` (a `presentation-island`).
 * `[internal ref]` forbids BOTH directions across that seam, so a
 * recipe both sides need can only live in `presentation-util`. Same reasoning
 * and same directory as `button-default-classes.ts` — the F1 precedent.
 *
 * ## Safelist
 * The directory `src/presentation/utils/recipes` is registered in `RECIPE_DIRS`
 * (`src/infrastructure/css/arbitrary-var-safelist.ts`), so the `v(…)` template
 * literals below are resolved at build time and emitted into the compiler's
 * `@source inline(...)` safelist. A recipe whose arbitrary classes are NOT
 * safelisted emits no CSS rule at all and paints nothing.
 *
 * ## Colour / layout split
 * Colour, radius and shadow go through {@link withVarFallback} so an
 * `app.design.*` override still wins at the CSS cascade layer; layout, spacing
 * and type steps stay raw Tailwind because they encode structure, not colour.
 *
 * ## Type steps
 * Every size is a rung of the platform ladder (`PLATFORM_TYPE_LADDER`) —
 * 13px is `text-base`, 12px is `text-sm`, 11px is `text-xs`. No arbitrary
 * `text-[Npx]` anywhere.
 *
 * Parts covered:
 *
 *   - SHELL     — the `<ul>` surface: bordered, raised, clipped
 *   - ITEM      — the `<li data-list-item>` row: flex, gapped, padded
 *   - DIVIDER   — the hairline between rows, suppressed on the last
 *   - THUMB     — the leading 36px `<img>`
 *   - TEXT COL  — the flex column stacking title over subtitle
 *   - TITLE     — `data-list-title`, the row's focal line
 *   - SUBTITLE  — `data-list-subtitle`, its supporting line
 *   - BADGE     — `data-list-badge`; DELEGATES to the shared badge recipe
 *   - META      — the trailing `data-list-meta` row
 *   - HIGHLIGHT — the `<mark>` around a matched search term
 *   - EMPTY     — `data-list-empty`, the no-results message
 *   - LOAD MORE — the footer holding the "Load More" control
 *
 * Canvas oracle: `spec-data.mjs:343-346` (`litem`, `list`, `frame`).
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'
import { computeBadgeClasses } from '@/presentation/design/navbar-default-classes'

// ──────────────────────────────────────────────────────────────────────────────
// SHELL — the `<ul>` surface
// ──────────────────────────────────────────────────────────────────────────────

// Canvas `frame`: 1px `hair` border · 6px radius · `raised` fill ·
// `overflow-hidden`.
//
// `overflow-hidden` is not decoration. Each row draws a flat `border-b`
// separator running the full width of the shell; without clipping, the last
// visible separator and the row backgrounds square off the rounded corners and
// the whole surface reads as a rectangle with four grey nicks. Same argument,
// and the same class, as `computeDataTableShellClasses`.
//
// `list-none` and the reset of the browser's default list padding are part of
// the recipe because this element is a real `<ul>`: without them every row is
// indented ~40px behind a bullet, which is precisely how the unstyled list
// rendered before this wave.
const LIST_SHELL = [
  'm-0 list-none overflow-hidden p-0',
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `rounded-[${v('radius-md', T.radiusMd)}]`,
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
].join(' ')

/**
 * Compute the default className for the `<ul>` that wraps the rows.
 *
 * Bordered and raised on `radius-md`, clipped, with the browser's list
 * affordances reset. `radius-md` is the shared R-D surface radius: the list
 * shell, the data-table shell, the gallery card, the kanban column and the
 * chart shell all round identically, so a page composing several of them reads
 * as one system.
 */
export const computeListShellClasses = (): string => LIST_SHELL

// ──────────────────────────────────────────────────────────────────────────────
// ITEM — the `<li data-list-item>` row
// ──────────────────────────────────────────────────────────────────────────────

// Canvas `litem`: flex, items-center, 10px gap, 8px/12px padding, min-w-0.
//
// `min-w-0` is load-bearing rather than defensive. A flex item defaults to
// `min-width: auto`, so a long unbroken title would refuse to shrink below its
// intrinsic width and would push the badge and the metadata off the right edge
// of the shell instead of ellipsing. It is what makes `truncate` on the title
// actually truncate.
const LIST_ITEM = ['flex min-w-0 items-center gap-2.5', 'px-3 py-2'].join(' ')

/**
 * Compute the default className for a single `<li data-list-item>` row.
 *
 * Layout and padding only — the separator is a separate concern, see
 * {@link computeListDividerClasses}, because a consumer that renders rows
 * inside an already-divided container (the search results body) needs the row
 * geometry without a second hairline.
 */
export const computeListItemClasses = (): string => LIST_ITEM

// ──────────────────────────────────────────────────────────────────────────────
// DIVIDER — the hairline between rows
// ──────────────────────────────────────────────────────────────────────────────

// `last:border-b-0` rather than `divide-y` on the parent: `divide-y` sets the
// border on every child but the FIRST, which puts the rule above each row.
// That is indistinguishable here — except that it also suppresses the rule on
// the first row's top edge, which is the edge the shell's own border already
// draws. The `last:` form keeps the rule on the natural edge (below the row)
// and drops it where the shell's bottom border takes over.
const LIST_DIVIDER = ['border-b', `border-[${v('sv-border', T.border)}]`, 'last:border-b-0'].join(
  ' '
)

/**
 * Compute the default className for the rule separating one row from the next.
 *
 * Applied to the row itself (as its bottom edge) rather than to the shell,
 * and suppressed on the last row so the separator does not double up with the
 * shell's own bottom border — which would read as a 2px rule on exactly one
 * edge of the surface.
 */
export const computeListDividerClasses = (): string => LIST_DIVIDER

// ──────────────────────────────────────────────────────────────────────────────
// THUMB — the leading `<img>`
// ──────────────────────────────────────────────────────────────────────────────

// Canvas: 36 x 36, `hair` fill, 4px radius, flex-none, object-cover.
//
// The `hair` fill is the PLACEHOLDER: it is what the box shows while the image
// is in flight, or forever if the URL 404s. Without it a broken thumbnail
// collapses the row's leading column to nothing and every row below it shifts
// left relative to the ones that loaded.
//
// `shrink-0` (the canvas' `flex-none`) is what stops a wide image from being
// squeezed by a long title; `object-cover` is what stops a non-square source
// from being distorted into the square box.
const LIST_THUMB = [
  'size-9 shrink-0 object-cover',
  `rounded-[${v('radius-base', T.radiusBase)}]`,
  `bg-[${v('sv-border', T.border)}]`,
].join(' ')

/**
 * Compute the default className for the row's leading thumbnail.
 *
 * A fixed 36px square on `radius-base` (4px) — one step tighter than the
 * shell's 6px, because a thumbnail nested inside a rounded surface reads
 * wrong when it rounds as hard as its container.
 */
export const computeListThumbClasses = (): string => LIST_THUMB

// ──────────────────────────────────────────────────────────────────────────────
// TEXT COLUMN — the stack holding title over subtitle
// ──────────────────────────────────────────────────────────────────────────────

/**
 * The flex column that stacks the title over the subtitle, on the canvas' 2px
 * gap.
 *
 * This is the one element R-D ADDS to the list item's DOM. Without it the
 * title and the subtitle are siblings of the row's own `flex` and lay out
 * side by side; the canvas stacks them, and there is no way to stack two
 * children of a row-direction flex container without a wrapper.
 *
 * `flex-1 min-w-0` is what makes the column absorb the row's free width and
 * still allow `truncate` on the title to engage — see the note on
 * {@link computeListItemClasses}.
 *
 * Ships as a constant rather than a `compute*` export because it carries no
 * `data-*` attribute and is not a part of the published vocabulary — it is
 * structure in service of the title and subtitle parts.
 */
export const LIST_TEXT_COLUMN_CLASSES = 'flex min-w-0 flex-1 flex-col gap-0.5'

// ──────────────────────────────────────────────────────────────────────────────
// TITLE / SUBTITLE — the two lines of the text column
// ──────────────────────────────────────────────────────────────────────────────

// Canvas: title 13px weight 500, nowrap + ellipsis; subtitle 11px `muted`.
//
// The title carries NO explicit colour so it inherits the surface foreground —
// which is what lets a row rendered inside an inverted or tinted container
// stay legible without the recipe knowing about it. The subtitle DOES set its
// tone, because "one step quieter than the title" is the whole point of the
// second line and inheriting would make the pair indistinguishable.
const LIST_TITLE = 'truncate text-base font-medium'

const LIST_SUBTITLE = ['truncate text-xs', `text-[${v('sv-fg-muted', T.fgMuted)}]`].join(' ')

/**
 * Compute the default className for `data-list-title` — the row's focal line.
 *
 * 13px medium, truncated. `truncate` is not optional on a data-bound list: the
 * title is `$record.<field>` and its length is the database's business, not
 * the author's, so an unbounded title is how one long row breaks the width of
 * every row beside it.
 */
export const computeListTitleClasses = (): string => LIST_TITLE

/**
 * Compute the default className for `data-list-subtitle` — the supporting line
 * under the title.
 *
 * 11px on the muted tone, truncated for the same reason the title is. Canvas
 * `muted` maps to `sv-fg-muted` under the wave-level role-over-value mapping
 * recorded in the R-D target table (following R-B's table header), so it
 * renders ~0.10 OkLab lightness darker than the drawing — a named, accepted
 * divergence.
 */
export const computeListSubtitleClasses = (): string => LIST_SUBTITLE

// ──────────────────────────────────────────────────────────────────────────────
// BADGE — `data-list-badge`
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute the default className for `data-list-badge`.
 *
 * DELEGATES to {@link computeBadgeClasses}, the shared badge recipe, rather
 * than minting an eighth badge. That recipe already lives in this directory
 * (`navbar-default-classes.ts`), which is why the delegation is possible at
 * all: the R-B status badge in
 * `ui/sections/renderers/element-renderers/recipes/data-default-classes.ts` is
 * a `presentation-component` and unreachable from the island side, but it is
 * itself built on `BADGE_RADIUS` and `BADGE_VARIANT_CLASS` from here. So this
 * import reaches the SAME recipe root R-B uses — one badge, three consumers.
 *
 * The `secondary` variant is the right tone for a list: a row badge states a
 * record's status (`Brewing`, `Archived`) and is READ, never actioned, so the
 * neutral `bg-subtle` chip is correct where the solid primary `default`
 * variant would make every row look like it had a call to action.
 *
 * `shrink-0` is appended because the badge sits in the row's flex line: at its
 * natural `min-width: auto` a long status would still be squeezed by a long
 * title, and a half-clipped status chip is worse than a truncated title.
 */
export const computeListBadgeClasses = (): string =>
  [computeBadgeClasses({ variant: 'secondary' }), 'shrink-0'].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// META — the trailing `data-list-meta` row
// ──────────────────────────────────────────────────────────────────────────────

// Canvas: flex, items-center, 6px gap, 11px, `muted`.
//
// The gap is 6px rather than the row's own 10px because the metadata values
// are one group (`4 items · 2 days ago`), not four peers of the title and the
// badge. `shrink-0` keeps that group intact when the title is long — metadata
// is the row's most compressible content by width and the least useful when
// half of it is missing.
const LIST_META = [
  'flex shrink-0 items-center gap-1.5',
  'text-xs',
  `text-[${v('sv-fg-muted', T.fgMuted)}]`,
].join(' ')

/**
 * Compute the default className for the trailing metadata row.
 *
 * Applied to the WRAPPER, not to each `data-list-meta` span: the spans inherit
 * the type step and the tone, so the attribute specs assert on stays a bare
 * `<span>` and nothing about the existing selector contract moves.
 *
 * The canvas additionally sets an amount-shaped value in mono. That is NOT
 * implemented: `metadata[].field` names a column, and nothing in the item
 * template declares which of them is a quantity — inferring it from the value
 * would mono-space a postcode. It needs a schema affordance, and is reported
 * rather than guessed.
 */
export const computeListMetaClasses = (): string => LIST_META

// ──────────────────────────────────────────────────────────────────────────────
// HIGHLIGHT — the `<mark>` around a matched search term
// ──────────────────────────────────────────────────────────────────────────────

// Canvas: `well` background, 2px radius, 0/2px padding.
//
// `bg-transparent`-free by design: a `<mark>` carries a UA default background
// (bright yellow in every browser) and a UA default `color`, and BOTH have to
// be displaced or the highlight reads as a marker pen on a themed surface.
// Hence the explicit foreground alongside the fill.
const LIST_HIGHLIGHT = [
  'px-0.5',
  `rounded-[${v('radius-sm', T.radiusSm)}]`,
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
].join(' ')

/**
 * Compute the default className for the `<mark>` wrapping a matched search
 * term inside a row.
 *
 * NOTE — no consumer paints this yet. `search-list-island.tsx` accepts a
 * `highlight?: boolean` prop and the renderers never act on it, so term
 * marking is unimplemented. The recipe ships now so that the canvas value is
 * recorded in the one place a future implementation will look, rather than
 * being re-derived from the drawing later; it is inert until then, and that is
 * reported rather than hidden.
 */
export const computeListHighlightClasses = (): string => LIST_HIGHLIGHT

// ──────────────────────────────────────────────────────────────────────────────
// EMPTY — `data-list-empty`
// ──────────────────────────────────────────────────────────────────────────────

// Canvas: centred, 12px, `muted`, 96px min-height.
//
// The min-height is the point of this part. An empty list whose message is one
// line collapses to ~18px, which is shorter than a single populated row — so
// the surface visibly SHRINKS at the moment it has nothing to show, and a page
// composed of several lists reflows as each one resolves. Reserving 96px keeps
// the empty state the size of a small list.
const LIST_EMPTY = [
  'flex min-h-24 items-center justify-center',
  'm-0 px-3 py-2 text-center text-sm',
  `text-[${v('sv-fg-muted', T.fgMuted)}]`,
].join(' ')

/**
 * Compute the default className for the `data-list-empty` no-results message.
 *
 * Centred on the muted tone at 12px, with a 96px floor so the surface does not
 * collapse when the query returns nothing. `m-0` resets the UA margin on the
 * `<p>` this is applied to, which would otherwise push the centred text off
 * the vertical middle of the reserved box.
 */
export const computeListEmptyClasses = (): string => LIST_EMPTY

// ──────────────────────────────────────────────────────────────────────────────
// LOAD MORE — the pagination footer
// ──────────────────────────────────────────────────────────────────────────────

// Canvas: flex centre, 8px padding, `border-top 1px hair`, secondary button.
//
// The top rule is what attaches the footer to the list above it rather than
// leaving the control floating under a gap. The button itself is NOT styled
// here — the caller reaches for the shared button recipe, so a "Load More"
// looks like every other secondary button in the app.
const LIST_LOAD_MORE = [
  'flex items-center justify-center p-2',
  'border-t',
  `border-[${v('sv-border', T.border)}]`,
].join(' ')

/**
 * Compute the default className for the footer that holds the "Load More"
 * control.
 *
 * Footer chrome only. The control inside it is drawn by
 * `computeButtonDefaultClasses({ variant: 'secondary', size: 'sm' })` from
 * `button-default-classes.ts` — reusing the F1 button recipe rather than
 * restating a button here is what keeps the list's pagination control and the
 * gallery's identical, which the canvas draws them as.
 */
export const computeListLoadMoreClasses = (): string => LIST_LOAD_MORE
