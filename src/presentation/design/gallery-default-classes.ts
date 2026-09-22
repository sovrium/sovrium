/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prestyled-by-default class computers for the `gallery` data view (wave R-D).
 *
 * A gallery is a grid of record cards, each optionally led by a cover image and
 * optionally covered by a hover overlay. This module owns every class those
 * cards paint so the SSR skeleton and the hydrated island are drawn from ONE
 * source and cannot drift apart on hydration.
 *
 * ## Why it lives in `presentation/utils/recipes`
 * The gallery is drawn TWICE: once by the SSR placeholder in
 * `ui/sections/rendering/component-registry/island-data-components.tsx` (a
 * `presentation-component`) and once by the hydrated island in
 * `islands/gallery/*` (a `presentation-island`). `[internal ref]`
 * forbids BOTH directions across that seam, so a recipe both sides need can
 * only live in `presentation-util`. Same reasoning and same directory as
 * `button-default-classes.ts` and `kpi-default-classes.ts` — the F1 precedent.
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
 * 12px is `text-sm`, 11px is `text-xs`. No arbitrary `text-[Npx]` anywhere.
 *
 * Parts covered:
 *
 *   - GRID    — the `data-component="gallery"` container: grid or masonry
 *   - CARD    — the `data-role="gallery-card"` surface: bordered, raised, flat
 *   - IMAGE   — the cover box carrying `data-aspect-ratio`, and its `<img>`
 *   - OVERLAY — the `data-role="gallery-card-overlay"` hover scrim
 *   - PAGER   — the pagination footer and its numbered page chips
 *
 * Canvas oracle: `spec-data.mjs:382-386` (`gcard`, `ggrid`, `pager`).
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'

// ──────────────────────────────────────────────────────────────────────────────
// GRID — the `data-component="gallery"` container
// ──────────────────────────────────────────────────────────────────────────────

// Canvas `ggrid`: a 10px gutter. The `gap-4` (16px) that shipped separated the
// cards enough that a dense gallery read as a scatter of unrelated tiles rather
// than as one collection; the canvas' 10px is what makes the grid legible AS a
// grid.
//
// The per-breakpoint `grid-cols-*` classes are NOT built here. They come from
// `islands/gallery/grid-class-builder.ts`, which spells all thirty of them out
// as string literals precisely so the candidate scanner sees them — a computed
// `lg:grid-cols-${n}` would be invisible to the scan-free compiler and would
// silently collapse every gallery to one column. The caller appends that
// string to what this returns; nothing about it moves.
const GALLERY_GRID = 'grid w-full gap-2.5 p-2'

// Masonry approximates variable-height cards with CSS columns rather than CSS
// grid, so it takes the SAME gutter through a different property. The column
// counts stay literal here for the same scanner reason as above.
const GALLERY_MASONRY = 'columns-1 gap-2.5 p-2 sm:columns-2 lg:columns-3 xl:columns-4'

/**
 * Compute the default className for the gallery container — the element that
 * carries `data-component="gallery"`, `data-columns` and `data-layout`.
 *
 * The `layout` axis picks the mechanism: `'grid'` returns a CSS-grid shell to
 * which the caller appends the responsive `grid-cols-*` string from
 * `grid-class-builder.ts`, and `'masonry'` returns a self-contained CSS-columns
 * shell that needs no such append. Both carry the canvas' 10px gutter, so a
 * gallery does not re-space itself when an author flips `layout`.
 */
export const computeGalleryGridClasses = ({
  layout = 'grid',
}: {
  readonly layout?: 'grid' | 'masonry'
} = {}): string => (layout === 'masonry' ? GALLERY_MASONRY : GALLERY_GRID)

// ──────────────────────────────────────────────────────────────────────────────
// CARD — the `data-role="gallery-card"` surface
// ──────────────────────────────────────────────────────────────────────────────

// Canvas `gcard`: 1px `hair` border · 6px radius · `raised` fill · flex column
// on a 6px gap · min-w-0 · `overflow-hidden` · NO shadow.
//
// Three departures from what shipped:
//
//   - the radius drops from `rounded-lg` (8px) to `radius-md` (6px), the shared
//     R-D surface radius. The list shell, the data-table shell, the kanban
//     column and the chart shell all round identically; a gallery card that
//     rounded harder read as a different system on a page composing two of them.
//   - `shadow-sm` is REMOVED. The card is separated from the page ground by its
//     border and its `raised` fill — a layer difference, not a lift. Removing
//     chrome is the point of this pass, not an oversight: a grid of twelve
//     shadowed tiles is twelve competing elevations and no hierarchy at all.
//   - the card becomes a real `flex flex-col gap-1.5`. Before, the cover and the
//     body were siblings in normal flow and the body carried a uniform `p-3`
//     that put 12px between the image and the title. The canvas puts 6px there
//     and NO padding above the body, which only a container gap can express.
//
// `relative` is load-bearing rather than defensive: the hover overlay is
// `absolute inset-0`, and without a positioned ancestor it would size itself
// against the page rather than the card.
//
// `group` is the Tailwind marker the overlay's `group-hover:` variants resolve
// against. It lives here rather than at the call site because the overlay
// recipe below is unusable without it — keeping the pair in one module is what
// makes the coupling visible.
const GALLERY_CARD = [
  'group relative flex min-w-0 flex-col gap-1.5 overflow-hidden transition-colors',
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `rounded-[${v('radius-md', T.radiusMd)}]`,
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
].join(' ')

/**
 * Compute the default className for a single card — the element that carries
 * `data-role="gallery-card"` and, when the card declares a navigate action,
 * `data-clickable="true"`.
 *
 * Bordered and raised on `radius-md`, clipped, flat. The clickable affordance
 * (`cursor-pointer hover:border-primary`) is NOT included: it is conditional on
 * the card's `onClick` config and is appended by the caller, exactly as the
 * threshold tone is appended to the KPI value.
 */
export const computeGalleryCardClasses = (): string => GALLERY_CARD

/**
 * The card body — the stack holding the author's `card.children` under the
 * cover image.
 *
 * Canvas: `0 8px 8px` padding and a 2px gap. There is no top padding because
 * the card's own 6px gap already separates the body from the cover above it;
 * adding one would double-count and only under the combination that has a
 * cover.
 *
 * `text-sm` sets the INHERITED step at the canvas' 12px. That is as far as a
 * recipe can reach into this element: `card.children[]` are author-declared
 * elements carrying author-declared `className`s (see `renderCardChild` in
 * `islands/kanban/card-template.ts`), so the canvas' "title 12px/500, caption
 * 11px muted" split is the author's to make.
 *
 * And inheritance only reaches the children that have no base rule of their
 * own. `<span>`, `<div>`, `<strong>`, `<em>` and `<small>` take the 12px; a
 * bare `<p>` renders at the base layer's `text-md` (14px) and a bare `<h1>`–
 * `<h6>` at its heading rung (`theme-layer-generators.ts:236-239`), because a
 * base ELEMENT rule sets the property rather than leaving it inherited. An
 * author who wants the canvas' step on a `<p>` states it in that child's own
 * `props.className`. The default title below does exactly that, which is why
 * it names its step instead of relying on this one.
 *
 * Ships as a constant rather than a `compute*` export because it carries no
 * `data-*` attribute and is not one of the view's five published parts.
 */
export const GALLERY_CARD_BODY_CLASSES = 'flex min-w-0 flex-col gap-0.5 px-2 pb-2 text-sm'

/**
 * The card body when the card has NO cover image.
 *
 * The canvas' `0 8px 8px` assumes something above the body to be flush against.
 * With no cover the body IS the card's content, so the top padding comes back
 * and the box is uniformly 8px — otherwise the first line of text sits against
 * the card's top border.
 */
export const GALLERY_CARD_BODY_NO_COVER_CLASSES = `${GALLERY_CARD_BODY_CLASSES} pt-2`

/**
 * The default title rendered when a card declares no `children` template.
 *
 * 12px medium, truncated — the canvas' title spec. `truncate` is not optional:
 * this string is a `$record.<field>` value whose length is the database's
 * business, and one long title in a grid stretches the column every card in it
 * shares.
 */
export const GALLERY_CARD_DEFAULT_TITLE_CLASSES = 'truncate text-sm font-medium'

// ──────────────────────────────────────────────────────────────────────────────
// IMAGE — the cover box and its `<img>`
// ──────────────────────────────────────────────────────────────────────────────

// Canvas: the box takes its aspect ratio from `galleryCard.aspectRatio`
// (4/3 by drawing) over a `hair` placeholder fill; the image covers it.
//
// The `hair` fill is the PLACEHOLDER. It is what the box shows while the image
// is in flight, or forever if the URL 404s — without it a broken cover leaves a
// transparent hole the exact shape of the card's top, which reads as a
// rendering fault rather than as a missing image.
const GALLERY_IMAGE_BOX = [
  'relative w-full overflow-hidden',
  `bg-[${v('sv-border', T.border)}]`,
].join(' ')

// `h-full` rather than a fixed height: the BOX owns the geometry (either an
// `aspect-ratio` or the fallback height below) and the image fills whatever the
// box resolved to. A height on the image would fight the box's ratio and win,
// which is exactly the defect this part exists to fix.
const GALLERY_IMAGE_IMG = 'h-full w-full object-cover'

/**
 * The fixed height the cover box falls back to when `aspectRatio` is absent or
 * unparseable.
 *
 * This is the `h-40` that shipped, kept deliberately. A box with neither a
 * ratio nor a height collapses to zero and the cover disappears — so the
 * fallback for an unparseable value must be the OLD behaviour, never "no
 * geometry at all". Exported so the caller and the test name the same thing.
 */
export const GALLERY_COVER_FALLBACK_HEIGHT_CLASS = 'h-40'

/**
 * Compute the default className for the cover box (`part: 'box'`, the element
 * carrying `data-aspect-ratio`) or for the `<img>` inside it (`part: 'img'`).
 *
 * The split is what makes the aspect ratio work. The box is the sized element —
 * it receives either `style={{ aspectRatio }}` or, failing that, the fallback
 * height class — and the image simply fills it. Sizing the image instead is how
 * the shipped card ended up with a hard-coded 160px cover at every card width.
 */
export const computeGalleryImageClasses = ({
  part = 'box',
}: {
  readonly part?: 'box' | 'img'
} = {}): string => (part === 'img' ? GALLERY_IMAGE_IMG : GALLERY_IMAGE_BOX)

/**
 * Parse an author-supplied `galleryCard.aspectRatio` into a CSS `aspect-ratio`
 * value, or `undefined` when it cannot be read as one.
 *
 * ## Why this is a runtime parse and not a Tailwind class
 * `aspectRatio` is `Schema.String` with no enum — `'4:3'`, `'16:9'`, `'1:1'`
 * are the documented examples, but the schema accepts anything. A Tailwind
 * `aspect-[4/3]` class only paints if that exact candidate is in the committed
 * corpus, and the corpus cannot enumerate a free string. So the value travels
 * inline, exactly as the kanban column dot and the timeline bar already carry
 * their author colour: `style={{ aspectRatio: resolveGalleryAspectRatio(v) }}`.
 *
 * ## What it accepts
 * `W:H` and `W/H` with optional surrounding whitespace, both sides finite and
 * strictly positive. Returns the CSS spelling `'W / H'`. Everything else —
 * an empty string, `'wide'`, `'0:3'`, `'4:0'`, `'-4:3'`, `'4:3:2'` — returns
 * `undefined`, and the caller falls back to
 * {@link GALLERY_COVER_FALLBACK_HEIGHT_CLASS}. A zero or negative side is
 * rejected rather than passed through because CSS treats a non-positive
 * `aspect-ratio` as invalid and the box would collapse — which is the one
 * outcome worse than ignoring the config.
 *
 * `data-aspect-ratio` keeps carrying the RAW author value regardless of whether
 * it parsed. `[internal ref]` asserts the attribute, and an author who
 * typed something unparseable should still be able to see what they typed in
 * the DOM.
 */
export const resolveGalleryAspectRatio = (value: string | undefined): string | undefined => {
  if (value === undefined) return undefined
  const match = /^\s*(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)\s*$/.exec(value)
  if (!match) return undefined
  const width = Number(match[1])
  const height = Number(match[2])
  if (!(width > 0) || !(height > 0)) return undefined
  return `${String(width)} / ${String(height)}`
}

// ──────────────────────────────────────────────────────────────────────────────
// OVERLAY — the `data-role="gallery-card-overlay"` hover scrim
// ──────────────────────────────────────────────────────────────────────────────

// Canvas: `rgba(19,19,19,0.72)` fill, 11px type, `ground` foreground.
//
// ## Accepted divergence — the overlay's SHAPE
// The canvas draws the overlay as a bottom caption strip carrying the record's
// title and date. `GalleryCard.hoverOverlay` is `{ children }` — an ARRAY OF
// AUTHOR COMPONENTS — so the engine's overlay is a generic container and the
// canvas' strip is one thing an author might put in it. Converging the shape
// would break every overlay holding an action button, which is what the shipped
// one holds. R-D converges the overlay's FILL and TYPE and leaves its box a
// full-cover container. Named in the R-D target table, not silent.
//
// The reveal is pure CSS: `invisible opacity-0` at rest, both released under
// `group-hover:`. That pairing (rather than opacity alone) is what makes
// Playwright's `toBeHidden()` / `toBeVisible()` resolve — `visibility: hidden`
// is what those matchers read, and a 0-opacity element is still "visible" to
// them. The specs assert exactly that, so neither half may be dropped.
const GALLERY_OVERLAY = [
  'invisible absolute inset-0 flex items-center justify-center gap-2 opacity-0',
  'transition-opacity group-hover:visible group-hover:opacity-100',
  'text-xs',
  // `bg-scrim/70` is spelled as a PLAIN utility, not as
  // `bg-[${'${'}v('sv-scrim', T.scrim)}]/70`. The arbitrary-var safelist
  // generator's `CLASS_USE_PATTERN` terminates the class at the closing `]`,
  // so the `/70` opacity modifier would be dropped from the emitted safelist
  // entry and the overlay would paint fully opaque. The plain form is what the
  // `/50` that shipped used, and it reaches the compiled CSS through the oxide
  // candidate scan instead.
  'bg-scrim/70',
  `text-[${v('sv-fg-inverse', T.fgInverse)}]`,
].join(' ')

/**
 * Compute the default className for the hover overlay
 * (`data-role="gallery-card-overlay"`).
 *
 * A full-cover scrim at 70% on the inverse foreground, revealed by the card's
 * `group` hover. The fill moves from `/50` to the canvas' `/72` (rounded to the
 * `/70` step Tailwind can express): at half opacity a pale cover image showed
 * through enough that white overlay text sat at roughly 2:1 against it, which
 * is unreadable by any standard.
 *
 * Requires {@link computeGalleryCardClasses} on the ancestor — that is where
 * `group` and `relative` live, and without either this element neither reveals
 * nor positions.
 */
export const computeGalleryOverlayClasses = (): string => GALLERY_OVERLAY

// ──────────────────────────────────────────────────────────────────────────────
// PAGER — the pagination footer and its numbered page chips
// ──────────────────────────────────────────────────────────────────────────────

// Canvas `pager`: a centred footer; numbered chips are 28px boxes on a 4px
// radius at 12px, outlined in `hair-strong`, with the current page inverted to
// a `primary` fill.
const GALLERY_PAGER_FOOTER = 'flex w-full items-center justify-center gap-1.5 p-3'

const GALLERY_PAGER_PAGE_BASE = [
  // `h-7 w-7` rather than `size-7`: both spell 28px, but only the pair is in
  // the committed candidate corpus today (measured 2026-09-09), and the
  // compiler is scan-free. Same reasoning as the kanban column dot.
  'inline-flex h-7 w-7 items-center justify-center text-sm',
  `rounded-[${v('radius-base', T.radiusBase)}]`,
  'border',
].join(' ')

const GALLERY_PAGER_PAGE_DEFAULT = [
  `border-[${v('sv-border-strong', T.borderStrong)}]`,
  `text-[${v('sv-fg-muted', T.fgMuted)}]`,
].join(' ')

const GALLERY_PAGER_PAGE_CURRENT = [
  'border-transparent',
  `bg-[${v('sv-primary', T.primary)}]`,
  `text-[${v('sv-primary-fg', T.primaryFg)}]`,
].join(' ')

/**
 * Compute the default className for the pagination footer (`part: 'footer'`)
 * or for one numbered page chip (`part: 'page'`, `current` inverting it).
 *
 * Both parts are wired. The footer is spent twice over: it holds the "Load
 * More" control when `pagination.style === 'loadMore'` (`load-more-button.tsx`,
 * where the control itself is drawn by
 * `computeButtonDefaultClasses({ variant: 'secondary', size: 'sm' })` from
 * `button-default-classes.ts` rather than by a literal here — reusing the F1
 * button recipe is what keeps the gallery's pagination control and the list's
 * identical, which the canvas draws them as), and it is the `<nav>` the
 * numbered pager hangs its chips from. The `'page'` chips are that pager's
 * buttons, `current` inverting the one carrying `aria-current="page"`.
 *
 * The chips shipped INERT for a while — `pagination.style` accepted
 * `'numbered'` and the island rendered nothing for it, so a numbered gallery
 * drew its first page and no control at all, putting every record past it out
 * of reach. `gallery-pager.tsx` is the caller that ended that, and it is the
 * only one: a second hand-written set of chip classes is what this recipe
 * exists to prevent.
 */
export const computeGalleryPagerClasses = ({
  part = 'footer',
  current = false,
}: {
  readonly part?: 'footer' | 'page'
  readonly current?: boolean
} = {}): string => {
  if (part === 'footer') return GALLERY_PAGER_FOOTER
  return [
    GALLERY_PAGER_PAGE_BASE,
    current ? GALLERY_PAGER_PAGE_CURRENT : GALLERY_PAGER_PAGE_DEFAULT,
  ].join(' ')
}
