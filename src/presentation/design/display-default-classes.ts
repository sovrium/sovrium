/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prestyled-by-default class computers for the display-category surfaces
 *: empty-state, list-item rows, the `card` bubble variant,
 * static-table chrome, and the structural timeline container. These are the
 * SSR-rendered display schemas under
 * `src/domain/models/app/pages/components/component-types/display/` that
 * previously fell through to an unstyled `<div>` (empty-state /
 * timeline) or carried hard-coded `bg-info-*` aliases (the bubble) — this
 * slice paints them with the same var-with-fallback recipe established in
 * the prior slices (buttons + inputs + selects + toggles + numeric + date +
 * overlays + disclosure + feedback + navigation + layout + forms + data +
 * typography).
 *
 * Each helper paints COLOR / BORDER-COLOR / RADIUS / SHADOW classes through
 * {@link withVarFallback} so `app.design.*` overrides still win at the CSS
 * cascade layer (`var(--sv-X)` resolves the override first, falling back to
 * the inline OKLCH literal); layout / spacing classes (`flex flex-col`,
 * `px-4 py-3`, `gap-2`) stay raw — they encode structure, not color.
 *
 * Subparts covered (one or two compute helpers per schema — the
 * highest-visibility surfaces of each):
 *
 *   - EMPTY-STATE CONTAINER — outer wrapper for the empty-state composition
 *                           (centered flex column + dashed border + muted
 *                           background tint + padding). The dashed border
 *                           evokes the conventional "nothing here yet"
 *                           visual idiom; centered layout anchors the
 *                           icon-headline-description-CTA stack.
 *   - EMPTY-STATE TITLE   — primary headline above the description ("No
 *                           records yet"). Strong foreground tone +
 *                           medium-large size so the headline carries the
 *                           message without crowding the supporting body.
 *
 *   - LIST-ITEM           — single `<li>` row inside a list composition.
 *                           The `interactive` axis flips the row from
 *                           passive chrome (no hover bg, no cursor change)
 *                           to actionable (hover bg-subtle + cursor-pointer)
 *                           when the schema's action fields are bound. The
 *                           `state` axis covers `'default' | 'selected' |
 *                           'disabled'` — selected rows tint with
 *                           primary-subtle so the current row reads at a
 *                           glance.
 *
 *   - SPEECH-BUBBLE       — chat bubble container with asymmetric rounded
 *                           corners (sharp bottom-left or bottom-right to
 *                           form a tail). The `side` axis flips the sharp
 *                           corner between `'left'` (sender, sharp bottom-
 *                           left) and `'right'` (receiver, sharp bottom-
 *                           right). Uses info-tone palette so the bubble
 *                           reads as conversational chrome.
 *
 *   - STATIC-TABLE SHELL  — outer `<table>` wrapper (border + radius +
 *                           bg + overflow-hidden so the inner corners clip
 *                           cleanly). Distinct from the data-table shell
 *                           (`data-default-classes.ts`) — static-table is a
 *                           pure presentational composition (the schema
 *                           ships rows as inline literal arrays), while
 *                           data-table renders an island with live records.
 *   - STATIC-TABLE HEADER ROW — `<thead>` chrome (bg-bgSubtle + uppercase +
 *                           muted-fg). Mirrors the data-table header's
 *                           visual rhythm so the two table variants read as
 *                           one design language.
 *   - STATIC-TABLE CELL   — `<td>` body cell + `<th>` header cell (px / py
 *                           + text size + fg tone). The `kind` axis flips
 *                           between `'header'` (semibold + uppercase +
 *                           muted-fg) and `'data'` (regular weight + full-
 *                           strength fg) so the same compute can paint both
 *                           subparts of the table.
 *
 *   - TIMELINE CONTAINER  — outer vertical wrapper for the structural-
 *                           display timeline (children list). Renders as a
 *                           flex-col with a left-padded "rail" — the rail
 *                           is what `computeTimelineRailClasses` paints.
 *                           NOTE: This is the structural-display `timeline`
 *                           schema (children container), NOT the data-bound
 *                           `data-timeline` Gantt island
 *                           (`src/presentation/islands/timeline/`).
 *   - TIMELINE RAIL       — vertical line down the left edge of the
 *                           container that connects child events. Pure
 *                           chrome: 2px wide on the border tone, positioned
 *                           absolute behind the dot markers each event
 *                           paints.
 *
 * Intentionally NOT covered (this slice scopes to ≤20 helpers + 8
 * components):
 *
 *   - ASPECT-RATIO        — schema is a pass-through container (only a
 *                           ratio prop); no chrome to style. Rendered as a
 *                           bare `<div>` with `aspect-ratio` CSS — the
 *                           schema author owns the inner content; no
 *                           helper would add value.
 *   - RESIZABLE           — schema is a pass-through container (only an
 *                           orientation prop); Base UI Resizable handles
 *                           the gutter chrome via its own primitives. No
 *                           per-component opinion to register at this
 *                           layer.
 *   - COMMAND             — the `command-palette` component is synthesized
 *                           at render-time (NOT schema-authored) and the
 *                           overlay DOM is built lazily on first `Cmd+K`
 *                           inside a stringified runtime IIFE
 *                           (`command-palette-runtime-dom.ts`) using inline
 *                           `element.style.background = '#ffffff'` etc.
 *                           Restyling needs the runtime to thread CSS
 *                           variable expressions through the style strings
 *                           — a different surface than this SSR-class
 *                           recipe — and is tracked as a follow-up slice.
 *   - ACCORDION / TABS    — already restyled by the disclosure slice
 *                           (`disclosure-default-classes.ts`, commit
 *                           `1b3f551a7`). Untouched here.
 *   - SCROLL-AREA         — handled by a sibling island helper file
 *                           (`src/presentation/islands/scroll-area-default-
 *                           classes.ts`) because it lives in the islands/
 *                           layer (Base UI ScrollArea is client-only).
 *
 * Helper file lives in `src/presentation/ui/sections/renderers/element-
 * renderers/` because every schema in this slice is server-rendered through
 * the component registry (no island side). Mirrors the location chosen for
 * `button-default-classes.ts`, `input-default-classes.ts`,
 * `feedback-default-classes.ts`, `navigation-default-classes.ts`,
 * `layout-default-classes.ts`, `forms-default-classes.ts`,
 * `data-default-classes.ts`, and `typography-default-classes.ts`.
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'

// ──────────────────────────────────────────────────────────────────────────────
// EMPTY-STATE — outer container + headline
// ──────────────────────────────────────────────────────────────────────────────

const EMPTY_STATE_CONTAINER = [
  'flex flex-col items-center justify-center text-center gap-3 px-6 py-12',
  // Dashed border evokes the conventional "nothing here yet" affordance
  // (mirrors the empty-state scene fixture's idiom). Bg-subtle tint anchors
  // the surface so the icon + headline + body read as a contained module.
  'border border-dashed',
  `border-[${v('sv-border', T.border)}]`,
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `rounded-[${v('radius-lg', T.radiusLg)}]`,
].join(' ')

/**
 * Compute the default className for the outer empty-state wrapper. Centered
 * flex column with a dashed border (the conventional "no records yet"
 * idiom) + bg-subtle tint so the surface reads as a contained empty
 * module. Generous py-12 + gap-3 give the icon + headline + body +
 * optional CTA enough breathing room to feel like an intentional state
 * rather than a layout glitch.
 */
export const computeEmptyStateContainerClasses = (): string => EMPTY_STATE_CONTAINER

const EMPTY_STATE_TITLE = ['text-lg font-semibold', `text-[${v('sv-fg', T.fg)}]`].join(' ')

/**
 * Compute the default className for the empty-state primary headline ("No
 * records yet", "Nothing to show"). Strong full-fg tone + semibold weight
 * + text-lg so the headline anchors the empty module; the surrounding
 * description text (paired below) inherits the muted-fg + text-sm tone via
 * the standard paragraph renderer.
 */
export const computeEmptyStateTitleClasses = (): string => EMPTY_STATE_TITLE

// ──────────────────────────────────────────────────────────────────────────────
// LIST-ITEM — single row inside a list composition
// ──────────────────────────────────────────────────────────────────────────────

/**
 * List-item state axis:
 *   - `'default'`  — regular row tone
 *   - `'selected'` — currently-selected row, tinted with primary-subtle bg
 *   - `'disabled'` — dimmed row (opacity-50 + cursor-not-allowed)
 */
export type ListItemState = 'default' | 'selected' | 'disabled'

const LIST_ITEM_LAYOUT = 'px-3 py-2 text-base transition-colors'

const LIST_ITEM_SURFACE_BASE = `text-[${v('sv-fg', T.fg)}]`

const LIST_ITEM_INTERACTIVE = [
  'cursor-pointer',
  `hover:bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
].join(' ')

const LIST_ITEM_SELECTED = `bg-[${v('sv-primary-subtle', T.primarySubtle)}]`

const LIST_ITEM_DISABLED = 'opacity-50 cursor-not-allowed'

/**
 * Compute the default className for a single `<li>` row. The `interactive`
 * axis flips the row between passive chrome (no hover bg, default cursor)
 * and an actionable hit-target (hover bg-subtle + cursor-pointer) for
 * schema authors who bind `actionFields` to the item. The `state` axis
 * covers the three RBAC-style row tones:
 *
 *   - `'default'`  — base row (no tint).
 *   - `'selected'` — primary-subtle bg tint so the row reads as the
 *                    currently-active record (e.g. the open detail row in a
 *                    master-detail UI). Pairs with the same primary
 *                    palette buttons + focus rings register.
 *   - `'disabled'` — 50% opacity + not-allowed cursor (overrides the
 *                    interactive cursor when both flags are set).
 */
export const computeListItemClasses = ({
  state = 'default',
  interactive = false,
}: {
  readonly state?: ListItemState
  readonly interactive?: boolean
} = {}): string =>
  [
    LIST_ITEM_LAYOUT,
    LIST_ITEM_SURFACE_BASE,
    ...(interactive && state !== 'disabled' ? [LIST_ITEM_INTERACTIVE] : []),
    ...(state === 'selected' ? [LIST_ITEM_SELECTED] : []),
    ...(state === 'disabled' ? [LIST_ITEM_DISABLED] : []),
  ].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// SPEECH-BUBBLE — chat bubble with asymmetric corners
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Speech-bubble side axis (which corner is "sharp" to form the tail):
 *   - `'left'`  — sharp bottom-left, rounded other three (sender)
 *   - `'right'` — sharp bottom-right, rounded other three (receiver)
 */
export type SpeechBubbleSide = 'left' | 'right'

const SPEECH_BUBBLE_LAYOUT = 'px-4 py-3 text-base max-w-md'

const SPEECH_BUBBLE_SURFACE = [
  `bg-[${v('sv-info-bg', T.infoBg)}]`,
  'border',
  `border-[${v('sv-info-border', T.infoBorder)}]`,
  `text-[${v('sv-info-fg', T.infoFg)}]`,
]

const SPEECH_BUBBLE_RADIUS_LEFT = [
  `rounded-tl-[${v('radius-md', T.radiusMd)}]`,
  `rounded-tr-[${v('radius-md', T.radiusMd)}]`,
  `rounded-br-[${v('radius-md', T.radiusMd)}]`,
  // Sharp bottom-left corner — the "tail" anchor for sender bubbles.
  'rounded-bl-none',
].join(' ')

const SPEECH_BUBBLE_RADIUS_RIGHT = [
  `rounded-tl-[${v('radius-md', T.radiusMd)}]`,
  `rounded-tr-[${v('radius-md', T.radiusMd)}]`,
  `rounded-bl-[${v('radius-md', T.radiusMd)}]`,
  // Sharp bottom-right corner — the "tail" anchor for receiver bubbles.
  'rounded-br-none',
].join(' ')

/**
 * Compute the default className for a chat-style speech bubble. The `side`
 * axis flips which corner is "sharp" (no radius) to form the visual tail —
 * left-side bubbles point down-left (the sender), right-side bubbles point
 * down-right (the receiver). Uses the info-tone palette (light blue
 * background + matching foreground) so the bubble reads as conversational
 * chrome distinct from focal cards / banners.
 *
 * Replaces the previously inline `bg-info-bg border border-info-border
 * text-info-fg ...` alias string in `special-components.tsx` so the bubble
 * tone now flows through the same var-fallback registration as every other
 * info-toned surface (badges, alerts).
 */
export const computeSpeechBubbleClasses = ({
  side = 'left',
}: {
  readonly side?: SpeechBubbleSide
} = {}): string =>
  [
    SPEECH_BUBBLE_LAYOUT,
    ...SPEECH_BUBBLE_SURFACE,
    side === 'right' ? SPEECH_BUBBLE_RADIUS_RIGHT : SPEECH_BUBBLE_RADIUS_LEFT,
  ].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// STATIC-TABLE — shell + header row + cell
// ──────────────────────────────────────────────────────────────────────────────

const STATIC_TABLE_SHELL = [
  'w-full border-collapse overflow-hidden',
  `bg-[${v('sv-bg', T.bg)}]`,
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `rounded-[${v('radius-base', T.radiusBase)}]`,
].join(' ')

/**
 * Compute the default className for the outer `<table>` wrapper of a
 * static-table composition (schema-author-supplied `tableHeaders` +
 * `tableRows` literal arrays). Distinct from the data-table shell in
 * `data-default-classes.ts` — static-table is a pure presentational
 * composition (no island, no live records), while data-table renders an
 * interactive island with sortable/filterable rows.
 *
 * `border-collapse` keeps the per-cell border ruling clean; rounded
 * corners + overflow-hidden ensure the inner cell borders don't bleed past
 * the rounded shell.
 */
export const computeStaticTableShellClasses = (): string => STATIC_TABLE_SHELL

const STATIC_TABLE_HEADER_ROW = [
  'border-b',
  `border-[${v('sv-border-strong', T.borderStrong)}]`,
].join(' ')

/**
 * Compute the default className for the `<thead>` row of a static-table.
 * Pairs with the shell at the top of the table: bg-subtle tint so the
 * header reads as chrome distinct from the body cells, bottom border
 * separating the header from the first body row. Mirrors the data-table
 * header recipe so the two table variants share visual rhythm.
 */
export const computeStaticTableHeaderRowClasses = (): string => STATIC_TABLE_HEADER_ROW

/**
 * Static-table cell kind:
 *   - `'header'` — `<th>` header cell (semibold uppercase muted-fg)
 *   - `'data'`   — `<td>` body cell (regular weight + full-strength fg)
 */
export type StaticTableCellKind = 'header' | 'data'

/**
 * Row padding comes from the density token, not from a literal. The token's
 * default IS the `5px` that used to be typed here, so this reads identically
 * until an author declares `design.density` — at which point it follows, which
 * a literal never could.
 */
const STATIC_TABLE_CELL_LAYOUT_BASE = 'px-2 py-(--sv-density-row-y) text-left'

/**
 * Header 11px, body 12px — the same pairing `data-default-classes.ts` uses, so
 * the two table variants keep reading as one component family rather than two.
 *
 * They shared ONE 11px step until the data-table ramp separated them, and this
 * constant's whole job is to track that ramp: a static table and a data table
 * differ in where their rows come from, never in how a cell is set. A reader
 * comparing the two on one page is the reason the pairing has to move in both
 * places at once — which is also why the two halves are named rather than
 * spelled inline at the call site below.
 */
const STATIC_TABLE_HEADER_TEXT = 'text-xs'
const STATIC_TABLE_BODY_TEXT = 'text-sm'

const STATIC_TABLE_CELL_HEADER = [
  `${STATIC_TABLE_HEADER_TEXT} font-medium`,
  `text-[${v('sv-fg-muted', T.fgMuted)}]`,
].join(' ')

const STATIC_TABLE_CELL_DATA = [STATIC_TABLE_BODY_TEXT, `text-[${v('sv-fg', T.fg)}]`].join(' ')

/**
 * Compute the default className for a static-table cell (`<th>` or
 * `<td>`). The `kind` axis flips between header and data cell typography:
 *
 *   - `'header'` — semibold + uppercase + tracking-wider + muted-fg so
 *                  column labels read as quiet chrome. Same recipe the
 *                  data-table header row uses.
 *   - `'data'`   — text-sm + regular weight + full-strength fg so the
 *                  cell content carries the actual reading load.
 *
 * Padding stays the same on both kinds so columns align cleanly between
 * the header and body rows.
 */
export const computeStaticTableCellClasses = ({
  kind,
}: {
  readonly kind: StaticTableCellKind
}): string =>
  [
    STATIC_TABLE_CELL_LAYOUT_BASE,
    kind === 'header' ? STATIC_TABLE_CELL_HEADER : STATIC_TABLE_CELL_DATA,
  ].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// TIMELINE (structural display) — container + left rail
// ──────────────────────────────────────────────────────────────────────────────

const TIMELINE_CONTAINER = ['relative flex flex-col gap-4 pl-6'].join(' ')

/**
 * Compute the default className for the structural-display `timeline`
 * container. NOT to be confused with the data-bound `data-timeline` Gantt
 * island (`src/presentation/islands/timeline/`) — this is the schema
 * author's `{ type: 'timeline', children: [...] }` container that renders
 * a vertical event list with a left rail connecting the dots.
 *
 * `relative` + `pl-6` reserve the left strip for the rail line + dot
 * markers; the children render to the right of the rail.
 */
export const computeTimelineContainerClasses = (): string => TIMELINE_CONTAINER

const TIMELINE_RAIL = [
  'absolute left-2 top-2 bottom-2 w-0.5',
  `bg-[${v('sv-border', T.border)}]`,
].join(' ')

/**
 * Compute the default className for the vertical rail line down the left
 * edge of the timeline container. Pure chrome: 2px wide on the standard
 * border tone, positioned absolute behind the dot markers each timeline
 * event paints. The `top-2 bottom-2` insets keep the rail short of the
 * container's outer padding so it visually starts at the first dot and
 * ends at the last.
 */
export const computeTimelineRailClasses = (): string => TIMELINE_RAIL

// ──────────────────────────────────────────────────────────────────────────────
// AVATAR — the disc, its group overlap, its initials and its presence dot
// ──────────────────────────────────────────────────────────────────────────────

/** The three rungs of the avatar size ladder. See `display/avatar.ts`. */
export type AvatarSize = 'sm' | 'md' | 'lg'

/** Corner shape of an avatar box. */
export type AvatarShape = 'circle' | 'square'

/** Presence, drawn as a corner dot. */
export type AvatarStatus = 'online' | 'away' | 'busy' | 'offline'

/**
 * The box, per rung — 24 / 32 / 40px SQUARE, and the type step derived from it.
 *
 * `size-*` is rem-based off the ROOT font size, so the per-rung `text-*` on the
 * same element cannot move it: the ladder measures the same three numbers the
 * schema names whatever the initials end up sized at. That is the whole reason
 * the schema refuses a free pixel value — see its module docstring.
 */
const AVATAR_BOX: Record<AvatarSize, string> = {
  sm: 'size-6 text-[0.625rem]',
  md: 'size-8 text-xs',
  lg: 'size-10 text-sm',
}

/**
 * The disc's own skin.
 *
 * Deliberately quiet: an avatar is a person's or a record's identity, and the
 * chrome around it competes with a photograph. `bg-subtle` under `fg-muted`
 * initials is the resting surface the rest of the display cluster uses.
 */
const AVATAR_SKIN = [
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `text-[${v('sv-fg-muted', T.fgMuted)}]`,
  `border border-[${v('sv-border', T.border)}]`,
].join(' ')

// `overflow-visible` and not `overflow-hidden`: the presence dot sits ON the
// lower-right corner, and clipping the box would cut it in half. The picture is
// clipped by its OWN radius instead (see `computeAvatarImageClasses`).
const AVATAR_LAYOUT =
  'relative inline-flex shrink-0 select-none items-center justify-center overflow-visible font-medium leading-none'

/**
 * Compute the className for one avatar box — a single avatar's root, or one
 * member of a group.
 *
 * `shape: 'square'` keeps the SAME box and softens the corners to the design
 * radius rather than fully, so a row of mixed shapes still aligns on one
 * baseline. That is the schema's claim; this is where it is kept.
 */
export const computeAvatarBoxClasses = ({
  size,
  shape,
}: {
  readonly size: AvatarSize
  readonly shape: AvatarShape
}): string =>
  [
    AVATAR_LAYOUT,
    AVATAR_BOX[size],
    shape === 'square' ? `rounded-[${v('radius-base', T.radiusBase)}]` : 'rounded-full',
    AVATAR_SKIN,
  ].join(' ')

/** The picture, clipped to the box it sits in. */
export const computeAvatarImageClasses = ({ shape }: { readonly shape: AvatarShape }): string =>
  [
    'size-full object-cover',
    shape === 'square' ? `rounded-[${v('radius-base', T.radiusBase)}]` : 'rounded-full',
  ].join(' ')

/**
 * The negative inline-start margin that makes a stack a STACK.
 *
 * Applied to every member after the first. A group drawn as a plain row is the
 * thing this variant is not, and the pull-back is the only fact that separates
 * them — which is why `[internal ref]` measures it
 * rather than looking at the picture. The ring paints the page ground between
 * two overlapping discs so the seam reads as depth rather than as a collision.
 */
export const computeAvatarStackOffsetClasses = (): string =>
  `-ml-2 ring-2 ring-[${v('sv-bg', T.bg)}]`

/**
 * One member of a stack: the same disc, pulled back over the one before it.
 *
 * Composed HERE rather than at the call site, beside the overflow disc that
 * composes the same two recipes. Two reasons, and the second is the load-bearing
 * one. A caller joining these itself joins them RAW, with no tailwind-merge
 * between them — so the day the box recipe and the offset recipe reach for the
 * same utility, the winner is decided by Tailwind's own emission order rather
 * than by which one was meant to win. And an arbitrary-value class written at a
 * call site under `rendering/component-registry/` is invisible to the
 * arbitrary-var safelist, which scans this directory and not that one.
 *
 * `stacked` is false for the first member only: a group drawn as a plain row is
 * the thing this variant is not, and the pull-back is the only fact separating
 * them.
 */
export const computeAvatarMemberClasses = ({
  size,
  shape,
  stacked,
}: {
  readonly size: AvatarSize
  readonly shape: AvatarShape
  readonly stacked: boolean
}): string =>
  [computeAvatarBoxClasses({ size, shape }), stacked ? computeAvatarStackOffsetClasses() : '']
    .filter((part) => part !== '')
    .join(' ')

/** The row a group of members sits in. */
export const computeAvatarGroupClasses = (): string => 'inline-flex items-center'

/** The `+N` disc that stands for the members a `max` hid. */
export const computeAvatarOverflowClasses = ({ size }: { readonly size: AvatarSize }): string =>
  [
    computeAvatarBoxClasses({ size, shape: 'circle' }),
    computeAvatarStackOffsetClasses(),
    `text-[${v('sv-fg-muted', T.fgMuted)}]`,
  ].join(' ')

/** The tone of each presence, one per member of the schema's four-state union. */
const AVATAR_STATUS_TONE: Record<AvatarStatus, string> = {
  online: `bg-[${v('sv-success-solid', T.successSolid)}]`,
  away: `bg-[${v('sv-warning-solid', T.warningSolid)}]`,
  busy: `bg-[${v('sv-error-solid', T.errorSolid)}]`,
  offline: `bg-[${v('sv-fg-disabled', T.fgDisabled)}]`,
}

/**
 * The presence dot on the lower-right corner.
 *
 * Absolutely positioned, so it takes the box out of flow and the avatar's own
 * measured geometry stays the ladder's — a dot that grew the box would make
 * `size: 'lg'` mean 40px for a person with no presence and something else for a
 * person with one.
 */
export const computeAvatarStatusClasses = ({ status }: { readonly status: AvatarStatus }): string =>
  [
    'absolute right-0 bottom-0 block size-2 rounded-full',
    `ring-2 ring-[${v('sv-bg', T.bg)}]`,
    AVATAR_STATUS_TONE[status],
  ].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// DESCRIPTION-LIST — the <dl>, its rows, and the three cells of a row
// ──────────────────────────────────────────────────────────────────────────────

/** Where the term sits relative to its detail. See `display/description-list.ts`. */
export type DescriptionListLayout = 'rows' | 'stacked'

/**
 * The wrapper the list and its optional heading share.
 *
 * A recipe rather than a literal at the call site even though it carries one
 * layout utility and no token: the safelist that keeps an arbitrary-value class
 * in the shipped stylesheet scans THIS directory and not the registry the
 * renderer lives in, so a token added to a call-site literal later would be
 * dropped from the stylesheet with nothing turning red.
 */
export const computeDescriptionListRootClasses = (): string => 'w-full'

/**
 * The `<dl>` itself.
 *
 * `rows` stacks the pairs vertically; `stacked` flows them as a responsive row
 * of blocks. Same element either way — the accessible pairing is what must
 * survive the switch, and it is the half a stylesheet could not have produced.
 */
export const computeDescriptionListClasses = ({
  layout,
}: {
  readonly layout: DescriptionListLayout
}): string => (layout === 'stacked' ? 'flex flex-wrap gap-x-8 gap-y-4' : 'flex flex-col text-base')

/**
 * One `<dt>`/`<dd>` pair's wrapper — a `<div>`, which `<dl>` permits precisely
 * so a row can be addressed as one thing.
 *
 * Under `rows` it is a two-column grid (term, detail) with the cells
 * top-aligned, so a term and its detail share a baseline row and the geometry
 * assertion reads `beside`. Auto-placement without this wrapper would pull the
 * next row's term into the detail column of the row above it.
 *
 * There is no third column for the action, and there was one until the action
 * moved inside the detail cell: a `<dl>` row admits `<dt>` and `<dd>` and
 * nothing else, so a link drawn as their sibling was invalid markup, and the
 * pairing assistive technology reads off that structure stopped being
 * predictable. The action rides in the `<dd>` now — see
 * {@link computeDescriptionDetailClasses}.
 */
export const computeDescriptionRowClasses = ({
  layout,
}: {
  readonly layout: DescriptionListLayout
}): string =>
  layout === 'stacked'
    ? 'flex min-w-[8rem] flex-col gap-1'
    : 'grid grid-cols-[minmax(0,12rem)_1fr] items-start gap-x-4'

/**
 * The rule under a row, or its explicit absence.
 *
 * The colour goes on `border-[…]` — every side — rather than on `border-b-[…]`:
 * the width utilities leave the other three at the preflight's `0`, so painting
 * all four is invisible, and `border-[<value>]` is the arbitrary spelling the
 * rest of this recipe tree already resolves as a COLOUR. A side-scoped
 * arbitrary value is ambiguous between a width and a colour — the same trap
 * `text-[var(…)]` sets one utility over.
 *
 * The `off` arm is spelled out rather than omitted so the absence is a
 * declaration a reader can see, and so it survives a stylesheet that ever gave
 * `<dd>` a border of its own.
 */
const dividerClasses = (dividers: boolean): string =>
  dividers ? `border-b border-[${v('sv-border', T.border)}]` : 'border-b-0'

/**
 * The `<dt>`.
 *
 * Muted, because the term names the fact and the detail IS the fact; a summary
 * panel whose labels shout is one a reader has to look past.
 */
export const computeDescriptionTermClasses = ({
  layout,
  dividers,
}: {
  readonly layout: DescriptionListLayout
  readonly dividers: boolean
}): string =>
  [
    layout === 'stacked' ? 'text-sm' : 'py-2 text-base',
    `text-[${v('sv-fg-muted', T.fgMuted)}]`,
    layout === 'stacked' ? 'border-b-0' : dividerClasses(dividers),
  ].join(' ')

/**
 * The `<dd>`.
 *
 * `min-h-5` is load-bearing rather than cosmetic: an EMPTY detail keeps a box of
 * its own, so a summary panel does not silently lose a line when one fact is
 * missing. A collapsed row tells the reader the fact was never declared, when in
 * truth it is declared and empty.
 *
 * `withAction` turns the cell into a row of its own so the link sits at its far
 * edge, which is where the retired third grid column used to put it. It is off
 * by default because most rows carry no action, and a cell that became a flex
 * container unconditionally would change how every detail's own content lays
 * out for the benefit of the few that do.
 */
export const computeDescriptionDetailClasses = ({
  layout,
  dividers,
  withAction = false,
}: {
  readonly layout: DescriptionListLayout
  readonly dividers: boolean
  readonly withAction?: boolean
}): string =>
  [
    'm-0 min-h-5',
    withAction ? 'flex items-start justify-between gap-4' : '',
    layout === 'stacked' ? 'text-base' : 'py-2 text-base',
    `text-[${v('sv-fg', T.fg)}]`,
    layout === 'stacked' ? 'border-b-0' : dividerClasses(dividers),
  ]
    .filter(Boolean)
    .join(' ')

/** The placeholder standing in for a declared-and-empty detail. */
export const computeDescriptionEmptyClasses = (): string =>
  `select-none text-[${v('sv-fg-disabled', T.fgDisabled)}]`

/**
 * The link at the far edge of a detail cell, because a control must always do
 * something.
 *
 * Both parameters are accepted and unread, and that is the point rather than an
 * oversight. The link used to be a grid cell of the row and drew its own
 * segment of the row's rule; now that it sits INSIDE the `<dd>`, the pair around
 * it draws that rule and a border here would read as a permanent underline on a
 * link that underlines on hover. The shape of the call is kept so every
 * description-list recipe is asked the same two questions, and so the answer
 * `border-b-0` is a declaration a reader can see rather than an omission.
 */
export const computeDescriptionActionClasses = ({
  layout: _layout,
  dividers: _dividers,
}: {
  readonly layout: DescriptionListLayout
  readonly dividers: boolean
}): string =>
  [
    'shrink-0 self-start border-b-0 text-sm underline-offset-2 hover:underline',
    `text-[${v('sv-primary', T.primary)}]`,
  ].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// RECORD-FIELD VALUE — one bound record value, drawn read-only
// ──────────────────────────────────────────────────────────────────────────────

const RECORD_FIELD_VALUE = ['text-base', `text-[${v('sv-fg', T.fg)}]`].join(' ')

/**
 * The value a `record-field` draws — the read-only twin of a form control.
 *
 * `text-base` because that is the step the description list's `<dd>` already
 * takes beside its `<dt>`, and a record field is the same relation wearing a
 * different tag: a value, named by a label one rung below it. Reaching for a
 * step of its own would give this system two answers to "how big is a value
 * beside its label".
 *
 * That it needs a recipe AT ALL is the defect this closes. The renderer painted
 * no typography class, so every drawn value inherited the document root — 16px
 * — while the labels naming them read 12px and the controls beside them 13px.
 * Unruled is not neutral: it is the largest step on the page, claimed by the
 * one thing on it that should read as quiet content.
 */
export const computeRecordFieldValueClasses = (): string => RECORD_FIELD_VALUE
