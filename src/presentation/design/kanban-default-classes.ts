/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prestyled-by-default class computers for the `kanban` data view (wave R-D).
 *
 * A kanban board is a row of grouped, filled wells, each holding a stack of
 * draggable record cards. This module owns every class that board paints so the
 * SSR skeleton and the hydrated island are drawn from ONE source and cannot
 * drift apart on hydration — which matters more here than anywhere else in the
 * wave, because the kanban SSR skeleton renders three real column shells rather
 * than a grey rectangle.
 *
 * ## Why it lives in `presentation/utils/recipes`
 * The board is drawn TWICE: once by the SSR placeholder in
 * `ui/sections/rendering/component-registry/island-data-components.tsx` (a
 * `presentation-component`) and once by the hydrated island in
 * `islands/kanban/*` (a `presentation-island`). `[internal ref]`
 * forbids BOTH directions across that seam, so a recipe both sides need can
 * only live in `presentation-util`.
 *
 * This module SUPERSEDES `computeKanbanColumnClasses` and
 * `computeKanbanCardClasses` in
 * `ui/sections/renderers/element-renderers/recipes/data-default-classes.ts`.
 * Those live in a `presentation-component` and are therefore unreachable from
 * the island side, which is exactly why the hydrated board carried its own
 * hand-written literals and drifted from the skeleton. They are left in place
 * (the design-system reference-app fixture still renders them) rather than
 * deleted — removing a still-referenced export is a refactor call, not a design
 * one.
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
 * The one exception is the author's own hue — the column dot and the card
 * stripe carry it INLINE, because `kanbanGroupBy` option colours and
 * `card.colorField` values are record data and cannot be enumerated as
 * candidates by a scan-free compiler.
 *
 * ## Type steps
 * Every size is a rung of the platform ladder (`PLATFORM_TYPE_LADDER`) —
 * 12px is `text-sm`, 11px is `text-xs`. No arbitrary `text-[Npx]` anywhere.
 *
 * Parts covered:
 *
 *   - BOARD           — the horizontal scroller holding the columns
 *   - COLUMN          — the `data-column` well
 *   - COLUMN HEADER   — its single header line
 *   - COLUMN DOT      — the `data-column-accent` status swatch
 *   - COLUMN COUNT    — the record-count badge, right-aligned
 *   - CARD            — the `data-card` surface
 *   - CARD COVER      — the card's leading image
 *   - CARD STRIPE     — the 3px author-coloured leading edge
 *   - CARD FOOTER CHIP— one `data-footer-format` item
 *   - DRAG GHOST      — the card while it is being dragged
 *   - PLACEHOLDER     — the drop target reserved during a drag
 *   - EMPTY COLUMN    — the message shown by a column with no records
 *
 * Canvas oracle: `spec-data.mjs:31-35` (`kcard`, `kcol`, `kboard`).
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'
import { computeBadgeClasses } from '@/presentation/design/navbar-default-classes'

// ──────────────────────────────────────────────────────────────────────────────
// BOARD — the horizontal scroller holding the columns
// ──────────────────────────────────────────────────────────────────────────────

// Canvas `kboard`: a 10px gutter. `gap-4` (16px) put more space between two
// columns than the column's own 8px padding puts inside one, which inverts the
// visual grouping — the cards read as closer to the column edge than to each
// other.
const KANBAN_BOARD = 'flex w-full gap-2.5 overflow-x-auto p-2'

/**
 * Compute the default className for the board — the horizontal scroller that
 * lays the columns out in a row.
 *
 * `overflow-x-auto` rather than wrapping: a kanban's columns are a fixed,
 * ordered pipeline and a board that reflowed to two rows would put "Done"
 * above "To do".
 */
export const computeKanbanBoardClasses = (): string => KANBAN_BOARD

// ──────────────────────────────────────────────────────────────────────────────
// COLUMN — the `data-column` well
// ──────────────────────────────────────────────────────────────────────────────

// Canvas `kcol`: `well` fill · 6px radius · 8px padding · flex column on a 6px
// gap · NO border.
//
// The border comes OFF, and that is the point of this part rather than an
// oversight. A column is a filled WELL: it recedes behind the cards it holds,
// and it is legible as a region because its `bg-subtle` fill is a layer below
// the cards' `bg-raised`. Adding a hairline on top of that layer difference
// states the boundary twice, and on a four-column board the four outlines
// compete with the card outlines inside them for the same attention.
//
// Padding drops from `p-3` (12px) to the canvas' 8px for the reason the gutter
// did: the space inside a column must read as tighter than the space between
// columns, or the grouping inverts.
const KANBAN_COLUMN_BASE = [
  'flex flex-col gap-1.5 p-2 transition-colors',
  `rounded-[${v('radius-md', T.radiusMd)}]`,
].join(' ')

const KANBAN_COLUMN_DEFAULT = `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`

// The drop-target state was `border-primary bg-primary-subtle`. With the border
// gone the fill alone has to carry it, which it does — and arguably better: a
// whole-well tint is visible from the far side of a wide board where a 1px edge
// is not.
const KANBAN_COLUMN_OVER = `bg-[${v('sv-primary-subtle', T.primarySubtle)}]`

/**
 * Compute the default className for a kanban column — the element carrying
 * `data-column="<group value>"`.
 *
 * Chrome and INNER layout only. The column's WIDTH (`w-72 shrink-0`) stays with
 * the caller: width is a placement concern owned by whatever composes the
 * board, and the SSR skeleton and the island already append it identically.
 *
 * The `state` axis paints the dnd-kit droppable hover: `'over'` swaps the well's
 * neutral fill for the primary tint, which is now the only signal that a drop
 * would land here.
 */
export const computeKanbanColumnClasses = ({
  state = 'default',
}: {
  readonly state?: 'default' | 'over'
} = {}): string =>
  [KANBAN_COLUMN_BASE, state === 'over' ? KANBAN_COLUMN_OVER : KANBAN_COLUMN_DEFAULT].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// COLUMN HEADER — the single header line
// ──────────────────────────────────────────────────────────────────────────────

// Canvas: 11px weight 500 in `prose`, flex on a 6px gap, title truncating, the
// count pushed right by `margin-left:auto`.
//
// Two things come off. The `border-b pb-2` RULE goes: the canvas separates the
// header from the stack by weight and by the column's own 6px gap, and a rule
// inside an already-filled well is a third boundary in a box that has two. And
// the `justify-between` goes with it — `ml-auto` on the count is what the
// canvas draws, and it differs in the case that matters: with
// `justify-between`, a truncating title and a right-aligned count leave the dot
// stranded in the middle of the row.
//
// `prose` maps EXACTLY to `sv-fg-muted` (.453 vs .445) under the wave-level
// mapping in the R-D target table, so the header sits a step below the card
// titles under it — which is correct: the group name is the key to the stack,
// not a heading over it. The `text-md font-semibold` that shipped made every
// column label compete with its own cards.
const KANBAN_COLUMN_HEADER = [
  'flex items-center gap-1.5',
  'text-xs font-medium',
  `text-[${v('sv-fg-muted', T.fgMuted)}]`,
].join(' ')

/**
 * Compute the default className for the column header row.
 *
 * ONE flex line holding the accent dot, the group label and the count — where
 * the shipped header was a `justify-between` row wrapping a nested flex pair.
 * The wrapper is gone; nothing selects it, and the canvas draws one line.
 *
 * The label element itself stays an `<h3>`: `data-kanban` specs resolve it with
 * `getByRole('heading', { name })`, so the heading semantics are a contract and
 * only the type step moves.
 */
export const computeKanbanColumnHeaderClasses = (): string => KANBAN_COLUMN_HEADER

/**
 * The group label inside the header row.
 *
 * `min-w-0` is what makes `truncate` engage at all: a flex child defaults to
 * `min-width: auto` and would push the count off the column's right edge rather
 * than ellipsing.
 *
 * ## `text-xs font-medium` RESTATES the parent, and must not be removed
 * The header row already declares both, so this reads as redundant — and is
 * not. The element is an `<h3>`, and the platform's generated base layer emits
 * `h3 { @apply text-2xl }` plus a heading weight
 * (`theme-layer-generators.ts:236`). A base ELEMENT rule SETS the property, so
 * the property is never inherited: the parent's `text-xs` cannot reach a
 * heading, and only a utility ON the heading outranks the base layer.
 *
 * Measured live on 2026-09-09 with the class absent: `[data-column] h3`
 * computed `font-size: 20px; font-weight: 600` — nearly twice the canvas'
 * 11px/500 — while every neighbour in the same row rendered correctly. It is
 * invisible to typecheck, to lint and to a source read; only a browser shows
 * it.
 *
 * The `<h3>` stays an `<h3>` because `data-kanban` specs resolve it with
 * `getByRole('heading', { name })`. So the tag is a contract and the type step
 * has to be applied over it rather than avoided by picking a different element.
 *
 * Ships as a constant rather than a `compute*` export because it is not one of
 * the view's published parts.
 */
export const KANBAN_COLUMN_TITLE_CLASSES = 'min-w-0 truncate text-xs font-medium'

// ──────────────────────────────────────────────────────────────────────────────
// COLUMN DOT — the `data-column-accent` status swatch
// ──────────────────────────────────────────────────────────────────────────────

// Canvas: an 8px round swatch in the author's colour. Down from `size-3`
// (12px), which at the header's new 11px type was taller than the cap height of
// the word beside it and read as a bullet rather than as a status accent.
//
// `h-2 w-2` rather than `size-2`: both spell 8px, but only the pair is in the
// committed candidate corpus (measured 2026-09-09) and the compiler is
// SCAN-FREE, so `size-2` would emit no rule until the corpus is regenerated —
// collapsing the dot to 0x0 and failing the `toBeVisible()` in
// `data-kanban/colored-select-group-by.spec.ts`. The pair costs nothing and
// cannot fail that way.
const KANBAN_COLUMN_DOT = 'inline-block h-2 w-2 shrink-0 rounded-full'

/**
 * Compute the default className for the header's status swatch — the element
 * carrying `data-column-accent`.
 *
 * Geometry only. The FILL is the author's declared option colour and is applied
 * inline by the caller, because `kanbanGroupBy` option colours are record data:
 * a scan-free compiler cannot mint `bg-[#3B82F6]` for a hex it has never seen.
 * `colored-select-group-by.spec.ts` reads that inline value back off
 * `getComputedStyle`, so the inline application is a contract, not a shortcut.
 */
export const computeKanbanColumnDotClasses = (): string => KANBAN_COLUMN_DOT

// ──────────────────────────────────────────────────────────────────────────────
// COLUMN COUNT — the record-count badge
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute the default className for the record-count badge in the column
 * header.
 *
 * DELEGATES to {@link computeBadgeClasses} in the `outline` tone rather than
 * minting another chip. What shipped was a bespoke `rounded-full px-2 py-0.5`
 * pill — a PILL, which the badge recipe deliberately retired on the argument
 * that a fully-rounded chip reads as a control affordance a label does not
 * have. A record count is the most purely-read thing on the board.
 *
 * `outline` is the canvas' `b-out`: transparent fill on a `border-strong`
 * ring. It is right here because the badge sits ON the column's filled well —
 * the `secondary` tone's own `bg-subtle` fill is the same layer as the well and
 * the chip would dissolve into it.
 *
 * `ml-auto` is the canvas' `margin-left:auto`, and it is what replaces the
 * header's former `justify-between`. `shrink-0` keeps the count intact when a
 * long group label squeezes the row — a half-clipped number is worse than a
 * truncated label.
 */
export const computeKanbanColumnCountClasses = (): string =>
  [computeBadgeClasses({ variant: 'outline' }), 'ml-auto shrink-0'].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// CARD — the `data-card` surface
// ──────────────────────────────────────────────────────────────────────────────

// Canvas `kcard`: 1px `hair` border · 4px radius · `raised` fill · relative ·
// flex column · `overflow-hidden` · min-w-0 · NO shadow.
//
// `shadow-sm` comes off for the same reason it comes off the KPI and the
// gallery card, plus one that is specific to this view: a card at rest and a
// card being dragged were BOTH `shadow-sm`, so the drag had no elevation change
// to signal with. Flattening the resting state is what gives
// {@link computeKanbanDragGhostClasses} something to say.
//
// The radius is `radius-base` (4px), one step tighter than the column's 6px.
// A child that rounds as hard as its container reads as floating loose inside
// it; the step down is what seats the card in the well.
//
// `relative` is load-bearing: the stripe below is `absolute inset-y-0 left-0`
// and needs a positioned ancestor or it pins itself to the page.
const KANBAN_CARD = [
  'relative flex min-w-0 flex-col overflow-hidden transition-colors',
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `rounded-[${v('radius-base', T.radiusBase)}]`,
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
].join(' ')

/**
 * Compute the default className for a kanban card — the element carrying
 * `data-card`, `data-color` and, when clickable, `data-clickable="true"`.
 *
 * Chrome only. The clickable and draggable affordances (`cursor-pointer`,
 * `cursor-grab active:cursor-grabbing`, `hover:border-primary`) are conditional
 * on config and are appended by the caller, and so is the drag-ghost lift.
 *
 * The card's SURFACE may be repainted inline when `card.colorField` resolves a
 * hue — `bg-raised` here is the default the author's declared fill overrides,
 * A7 ruling 3. Nothing in this recipe fights that: an inline
 * `backgroundColor` outranks a class.
 */
export const computeKanbanCardClasses = (): string => KANBAN_CARD

/**
 * The card body — the stack holding the author's `card.children`.
 *
 * Canvas: 8px padding on a 3px gap, down from `p-3` (12px) / `gap-1` (4px). A
 * kanban card is the densest surface in the view; a card holding a title and
 * two metadata lines was over half padding.
 *
 * `text-sm` sets the INHERITED step at the canvas' 12px. That is as far as a
 * recipe reaches into this element: `card.children[]` are author-declared
 * elements carrying author-declared `className`s (`renderCardChild` in
 * `card-template.ts`), so the canvas' title/subtitle split is the author's to
 * make.
 *
 * And inheritance only reaches the children that have no base rule of their
 * own. `<span>`, `<div>`, `<strong>`, `<em>` and `<small>` take the 12px; a
 * bare `<p>` renders at the base layer's `text-md` (14px) and a bare `<h1>`–
 * `<h6>` at its heading rung, because a base ELEMENT rule sets the property
 * rather than leaving it inherited. An author who wants the canvas' step on a
 * `<p>` states it in that child's own `props.className` — see
 * {@link KANBAN_COLUMN_TITLE_CLASSES}, which is this same trap paid for in the
 * one place the recipe owns the element.
 *
 * `gap-[3px]` is an arbitrary value rather than `gap-0.5` (2px) because the
 * canvas value is 3 and the ladder has no 3px step. It is a literal in this
 * file, so the oxide candidate scan picks it up on the next
 * `bun run build:css-assets`; until that regen it emits nothing and the gap
 * collapses to 0, which is cosmetic and breaks no assertion.
 */
export const KANBAN_CARD_BODY_CLASSES = 'flex min-w-0 flex-col gap-[3px] p-2 text-sm'

/**
 * The default title rendered when a card declares no `children` template.
 *
 * 12px medium, truncated — the canvas' card-title spec. `truncate` is not
 * optional: the string is a `$record.<field>` value of unbounded length, and a
 * column is 288px wide.
 */
export const KANBAN_CARD_DEFAULT_TITLE_CLASSES = 'truncate text-sm font-medium'

// ──────────────────────────────────────────────────────────────────────────────
// CARD COVER — the card's leading image
// ──────────────────────────────────────────────────────────────────────────────

// Canvas: 44px tall, square corners (the card's `overflow-hidden` clips the top
// two). `h-24` (96px) was more than twice that, which on a card whose body is
// now 8px of padding around two lines made the image the card and the record an
// afterthought.
const KANBAN_CARD_COVER = 'h-11 w-full shrink-0 object-cover'

/**
 * Compute the default className for a card's cover image.
 *
 * A fixed 44px band, not a ratio box — a kanban cover is a visual tag on a
 * dense card rather than the card's subject, so every card in a column must
 * present the same height or the stack loses its rhythm. That is the opposite
 * of the gallery, where the cover IS the content and takes its ratio from
 * config.
 *
 * `shrink-0` keeps that band at 44px inside the card's flex column when a long
 * body would otherwise compress it.
 */
export const computeKanbanCardCoverClasses = (): string => KANBAN_CARD_COVER

// ──────────────────────────────────────────────────────────────────────────────
// CARD STRIPE — the author-coloured leading edge
// ──────────────────────────────────────────────────────────────────────────────

// Canvas: absolutely positioned at the card's leading edge, 3px wide, full
// height, in the author's colour. There was no markup for this at all.
//
// `w-[3px]` is an arbitrary value: the spacing scale's neighbours are 2px
// (`w-0.5`) and 4px (`w-1`), and a 3px rule is the canvas value. Like
// `gap-[3px]` above it is a literal in this file and reaches the compiled CSS
// through the oxide candidate scan on the next `bun run build:css-assets`.
//
// `pointer-events-none` is not optional. The stripe covers the card's leading
// 3px, which on a `cursor-grab` card is inside the drag handle's hit area; a
// hit-testable overlay there would swallow the pointerdown that starts a drag
// on precisely the edge a user reaches for.
const KANBAN_CARD_STRIPE = 'pointer-events-none absolute inset-y-0 left-0 w-[3px]'

/**
 * Compute the default className for the card's leading colour stripe.
 *
 * Geometry only — the FILL is applied inline by the caller from the SAME
 * resolved trio the card already computes for its surface
 * (`resolveCardColors` -> `OptionChipColors`). It takes the trio's `border`
 * rather than its `fill`: `fill` is the author's hex verbatim and is what the
 * card's own background is painted with, so a stripe in `fill` would be
 * invisible against the card it is supposed to mark. `border` is `fill` mixed
 * toward its own contrasting foreground, which is guaranteed to read against
 * it.
 *
 * A card whose config declares no `colorField`, or whose value resolves no
 * colour, renders NO stripe — the recipe never invents a hue. That is [internal ref]
 * A7 ruling 5 applied to a new element: declared colour is opt-in, and an
 * opt-in that repaints the boards which declined it is not one.
 */
export const computeKanbanCardStripeClasses = (): string => KANBAN_CARD_STRIPE

// ──────────────────────────────────────────────────────────────────────────────
// CARD FOOTER — the rule and its chips
// ──────────────────────────────────────────────────────────────────────────────

// Canvas: a `hair` top rule with 6px/8px padding, holding 11px `muted` chips on
// a 6px gap.
//
// `mt-2` is dropped: the footer is the last child of a body that now owns its
// vertical rhythm through `gap-[3px]`, and a margin on top of that gap
// double-counts. The rule itself stays — it is what separates metadata from
// content, and unlike the column header's rule it divides two DIFFERENT kinds
// of thing rather than restating a boundary the layout already draws.
const KANBAN_CARD_FOOTER = [
  'flex flex-wrap items-center gap-1.5 px-2 py-1.5',
  'border-t',
  `border-[${v('sv-border', T.border)}]`,
].join(' ')

/**
 * Compute the default className for the card's footer row.
 *
 * The footer is NOT inside the body's padding box — it spans the card's full
 * width so its top rule runs edge to edge, which is what makes it read as a
 * division of the card rather than as a boxed-in strip. Its own `px-2` restores
 * the horizontal inset for the chips.
 */
export const computeKanbanCardFooterClasses = (): string => KANBAN_CARD_FOOTER

const KANBAN_FOOTER_CHIP = [
  'inline-flex items-center gap-1.5 text-xs',
  `text-[${v('sv-fg-muted', T.fgMuted)}]`,
].join(' ')

/**
 * Compute the default className for one footer item — an element carrying
 * `data-footer-format="relative-date" | "short-date" | "avatar" | "text"`.
 *
 * 11px on the muted tone at the canvas' 6px inner gap, down from `text-sm`
 * (12px). Footer metadata is the card's quietest content and was rendering at
 * the same step as its title.
 *
 * The `'badge'` format is deliberately NOT drawn by this computer — it routes
 * to {@link computeKanbanFooterBadgeClasses} instead.
 */
export const computeKanbanCardFooterChipClasses = (): string => KANBAN_FOOTER_CHIP

/**
 * Compute the default className for a `data-footer-format="badge"` item.
 *
 * DELEGATES to the shared badge recipe in the `secondary` tone. What shipped
 * was a third bespoke pill on this board (`rounded-full px-2 py-0.5 text-sm
 * font-medium`), which the badge recipe retired for the same reason it retired
 * the column count's. `secondary` rather than `outline` here because the chip
 * sits on the card's `raised` surface, a layer above the well, so the
 * `bg-subtle` fill reads as a chip against it.
 *
 * The R-D target table does not spell this row out; it is drawn in under the
 * table's standing "do NOT mint an eighth badge" instruction for the list
 * badge, which applies to any chip in the wave. Reported rather than silent.
 */
export const computeKanbanFooterBadgeClasses = (): string =>
  computeBadgeClasses({ variant: 'secondary' })

/**
 * The circular initials swatch inside a `data-footer-format="avatar"` item.
 *
 * Keeps `rounded-full` — an avatar IS a circle, and the argument that retired
 * the pill (a fully-rounded chip reads as a control) does not apply to a
 * portrait stand-in. Only its type step moves, to sit with the chip it is part
 * of.
 */
export const KANBAN_FOOTER_AVATAR_CLASSES = [
  'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-2xs font-medium',
  `bg-[${v('sv-primary-subtle', T.primarySubtle)}]`,
  `text-[${v('sv-primary-subtle-fg', T.primarySubtleFg)}]`,
].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// DRAG GHOST — the card while it is being dragged
// ──────────────────────────────────────────────────────────────────────────────

// Canvas: `0 10px 28px rgba(0,0,0,.16)` lift, `rotate(-1.5deg)`, a `subtle`
// border. The island applied NONE of it — only dnd-kit's translate and a 0.6
// opacity, so a dragged card looked like a faded card rather than a lifted one.
//
// The shadow spends `shadow-lg` (`0 8px 24px rgb(0 0 0 / 0.12)`) rather than
// the canvas' literal: it is the platform's own largest lift, within 2px and
// 0.04 alpha of the drawing, and spending a token is what lets a tenant's
// `app.design.shadows` reach the drag.
//
// The border goes to `sv-fg-subtle` — canvas `subtle` under the wave-level
// role-over-value mapping. It is markedly stronger than the card's resting
// `sv-border`, which is the point: the ghost has to be separable from the eight
// cards it is passing over.
const KANBAN_DRAG_GHOST = [
  `shadow-[${v('shadow-lg', T.shadowLg)}]`,
  `border-[${v('sv-fg-subtle', T.fgSubtle)}]`,
].join(' ')

/**
 * Compute the extra className a card carries while it is being dragged.
 *
 * APPENDED to {@link computeKanbanCardClasses}, never used alone — it supplies
 * the lift and the stronger edge and nothing else.
 *
 * The ROTATION is not here, and cannot be. dnd-kit writes the drag offset into
 * the card's inline `style.transform`, and an inline `transform` outranks any
 * Tailwind `rotate-*` class outright — the class would be dead. The tilt is
 * therefore composed into that same inline transform via
 * {@link KANBAN_DRAG_GHOST_TRANSFORM}, which is also the only way the two
 * survive together: a second `transform` declaration REPLACES the first rather
 * than adding to it.
 */
export const computeKanbanDragGhostClasses = (): string => KANBAN_DRAG_GHOST

/**
 * The tilt appended to a dragged card's inline `transform`, after dnd-kit's
 * translate.
 *
 * Order matters and is not cosmetic. `translate(...) rotate(...)` rotates the
 * card about its own centre at the pointer; `rotate(...) translate(...)` rotates
 * the translation VECTOR too, so the card drifts off the cursor by a distance
 * that grows with how far it has been dragged.
 */
export const KANBAN_DRAG_GHOST_TRANSFORM = 'rotate(-1.5deg)'

// ──────────────────────────────────────────────────────────────────────────────
// PLACEHOLDER — the drop target reserved during a drag
// ──────────────────────────────────────────────────────────────────────────────

// Canvas: `1px dashed subtle`, 4px radius, 44px min-height, `inset` fill. No
// markup existed for it.
//
// It is a dashed OUTLINE on a recessed fill because it must read as an absence
// — a slot, not a card. A solid-bordered box on `raised` would be a card with
// no content, which is what an empty column already looks like.
//
// `min-h-11` (44px) matches the card cover's band, so the reserved slot is
// roughly the height of the thing that will land in it and the column does not
// visibly jump at the moment of the drop.
const KANBAN_PLACEHOLDER = [
  'min-h-11 border border-dashed',
  `rounded-[${v('radius-base', T.radiusBase)}]`,
  `border-[${v('sv-fg-subtle', T.fgSubtle)}]`,
  `bg-[${v('sv-bg-inset', T.bgInset)}]`,
].join(' ')

/**
 * Compute the default className for the drop placeholder.
 *
 * Rendered at the END of a column's stack while that column is the active
 * droppable, and nowhere else — it exists only mid-drag and carries no text, so
 * it is invisible to the `[data-card]` counts and the `toContainText` assertions
 * the kanban specs run after a drop settles.
 *
 * KNOWN LIMITATION, stated rather than hidden: it marks the END of the target
 * column, not the exact insertion index. dnd-kit's sortable strategy expresses
 * the index by translating the cards around the gap, and reading it out to
 * position a placeholder precisely is a behavioural change rather than a design
 * one. For a cross-column drop — which is what a kanban drag overwhelmingly is
 * — "this column" is the information the user needs; for a same-column reorder
 * a trailing slot also appears, which is the case this simplification gets
 * wrong.
 */
export const computeKanbanPlaceholderClasses = (): string => KANBAN_PLACEHOLDER

// ──────────────────────────────────────────────────────────────────────────────
// EMPTY COLUMN — the message shown by a column with no records
// ──────────────────────────────────────────────────────────────────────────────

// Canvas: 11px `subtle`, centred, 14px/4px padding. NO box.
//
// The dashed bordered card that shipped was an empty-CARD affordance standing
// in for an empty COLUMN, and it read as a phantom record: on a board with one
// populated column and three empty ones, three of the four looked like they
// held something. The canvas states the emptiness in words on the well's own
// fill and draws nothing.
//
// This is the one part in the wave that lands on `sv-fg-subtle` rather than
// `sv-fg-muted`: canvas `subtle` maps there under the R-D mapping, and an
// empty-state message is the quietest text on the board — a step below the
// column header that labels it.
const KANBAN_EMPTY_COLUMN = [
  'px-1 py-3.5 text-center text-xs',
  `text-[${v('sv-fg-subtle', T.fgSubtle)}]`,
].join(' ')

/**
 * Compute the default className for a column's empty-state message.
 *
 * Text on the well, with no border and no box. The message itself is the
 * author's `emptyColumnMessage` (or the `'No records'` default), and specs
 * assert on that string — only its chrome moves.
 */
export const computeKanbanEmptyColumnClasses = (): string => KANBAN_EMPTY_COLUMN

// ──────────────────────────────────────────────────────────────────────────────
// GRID — the board when a SECOND axis is declared
// ──────────────────────────────────────────────────────────────────────────────

// A one-axis board is a ROW of columns; a two-axis board is a STACK of lanes,
// each of which is a row of cells. So the scroller changes direction: the outer
// element still owns `overflow-x-auto` (the columns are still a fixed, ordered
// pipeline that must not reflow) but lays its children out downward.
//
// `gap-3` between lanes against the columns' `gap-2.5` inside one: a lane
// boundary has to read as a bigger break than a column boundary, or the grid
// reads as one undifferentiated field of wells.
const KANBAN_GRID = 'flex w-full flex-col gap-3 overflow-x-auto p-2'

/**
 * Compute the default className for the two-axis board — the vertical stack of
 * swimlanes that replaces {@link computeKanbanBoardClasses}'s row of columns.
 *
 * Both are `overflow-x-auto`, and only one of them is ever rendered: a board
 * declares `swimlanes` or it does not.
 */
export const computeKanbanGridClasses = (): string => KANBAN_GRID

// A lane and the shared column-header row above it are laid out on the SAME
// gutter and the same `w-72` cell width, which is what makes a column readable
// top-to-bottom across lanes — the vertical read the whole second axis exists
// for. `min-w-max` is load-bearing: a flex column stretches its children to the
// VISIBLE width, so without it each row would clip its own overflow instead of
// letting the outer scroller carry the whole grid.
const KANBAN_LANE_ROW = 'flex min-w-max gap-2.5'

/**
 * Compute the default className for a row of cells inside one lane — and for
 * the shared column-header row that sits above every lane.
 *
 * ONE export for both on purpose: they must stay on the same gutter, and two
 * constants is how they stop being.
 */
export const computeKanbanLaneRowClasses = (): string => KANBAN_LANE_ROW

/** The `data-swimlane` element: its header band, then its row of cells. */
const KANBAN_LANE = 'flex min-w-max flex-col gap-1.5'

/**
 * Compute the default className for a lane — the element carrying
 * `data-swimlane="<lane value>"`.
 */
export const computeKanbanSwimlaneClasses = (): string => KANBAN_LANE

// Canvas: a 10px uppercase label on the left, then a hairline rule running out
// to the board's right edge. The rule is what makes a lane read as a BAND
// crossing every column rather than as a title sitting over the first one.
const KANBAN_LANE_HEADER = 'flex items-center gap-2 px-0.5'

/** Compute the default className for a lane's header band. */
export const computeKanbanSwimlaneHeaderClasses = (): string => KANBAN_LANE_HEADER

// The disclosure control. It is the whole label, not a separate chevron: a lane
// title is small text, and a 10px hit target beside it fails SC 2.5.8 while the
// obvious place to click is the word itself.
//
// `text-[10px] font-medium uppercase` restates nothing inherited — the label
// lives inside an `<h3>`, and the base layer's `h3 { @apply text-2xl }` SETS the
// property, so only a utility on the element itself outranks it. This is the
// same trap {@link KANBAN_COLUMN_TITLE_CLASSES} documents at length.
const KANBAN_LANE_TOGGLE = [
  'flex shrink-0 items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide',
  `text-[${v('sv-fg-muted', T.fgMuted)}]`,
  `rounded-[${v('radius-sm', T.radiusSm)}] px-1 py-0.5`,
  `hover:text-[${v('sv-fg', T.fg)}]`,
  `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[${v('sv-focus-ring', T.focusRing)}]`,
].join(' ')

/**
 * Compute the default className for a lane's disclosure button.
 *
 * It carries `aria-expanded` and names the lane, so it is BOTH the lane's title
 * text and its collapse control — one element, one accessible name, one hit
 * target.
 */
export const computeKanbanSwimlaneToggleClasses = (): string => KANBAN_LANE_TOGGLE

// The hairline that runs from the label out to the right edge of the board.
const KANBAN_LANE_RULE = ['h-px flex-1', `bg-[${v('sv-border', T.border)}]`].join(' ')

/**
 * Compute the default className for the rule trailing a lane's label.
 *
 * `aria-hidden` at the call site: it states visually what the lane's heading
 * already states in text, and a screen reader that announced it would announce
 * a separator per lane for no gain.
 */
export const computeKanbanSwimlaneRuleClasses = (): string => KANBAN_LANE_RULE

// The chevron. `transition-transform` plus a rotation is the whole affordance —
// the same glyph in two positions rather than two glyphs, so the control's
// state is legible as a MOVEMENT when the reader operates it.
const KANBAN_LANE_CHEVRON = 'inline-block h-2 w-2 shrink-0 transition-transform'

/**
 * Compute the default className for a lane toggle's chevron.
 *
 * Geometry only; the caller rotates it from the lane's open state and hides it
 * from assistive technology, which reads `aria-expanded` instead.
 */
export const computeKanbanSwimlaneChevronClasses = (): string => KANBAN_LANE_CHEVRON
