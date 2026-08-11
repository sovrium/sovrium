/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prestyled-by-default class computers for the display-category surfaces
 *: empty-state, list-item rows, speech-bubble,
 * static-table chrome, and the structural timeline container. These are the
 * SSR-rendered display schemas under
 * `src/domain/models/app/pages/components/component-types/display/` that
 * previously fell through to an unstyled `<div>` (empty-state /
 * timeline) or carried hard-coded `bg-info-*` aliases (speech-bubble) — this
 * slice paints them with the same var-with-fallback recipe established in
 * the prior slices (buttons + inputs + selects + toggles + numeric + date +
 * overlays + disclosure + feedback + navigation + layout + forms + data +
 * typography).
 *
 * Each helper paints COLOR / BORDER-COLOR / RADIUS / SHADOW classes through
 * {@link withVarFallback} so `app.theme.*` overrides still win at the CSS
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

import { TOKENS as T, withVarFallback as v } from '@/presentation/utils/design/css-var'

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
  `rounded-[${v('sv-radius-lg', T.radiusLg)}]`,
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

const LIST_ITEM_LAYOUT = 'px-3 py-2 text-sm transition-colors'

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

const SPEECH_BUBBLE_LAYOUT = 'px-4 py-3 text-sm max-w-md'

const SPEECH_BUBBLE_SURFACE = [
  `bg-[${v('sv-info-bg', T.infoBg)}]`,
  'border',
  `border-[${v('sv-info-border', T.infoBorder)}]`,
  `text-[${v('sv-info-fg', T.infoFg)}]`,
]

const SPEECH_BUBBLE_RADIUS_LEFT = [
  `rounded-tl-[${v('sv-radius-md', T.radiusMd)}]`,
  `rounded-tr-[${v('sv-radius-md', T.radiusMd)}]`,
  `rounded-br-[${v('sv-radius-md', T.radiusMd)}]`,
  // Sharp bottom-left corner — the "tail" anchor for sender bubbles.
  'rounded-bl-none',
].join(' ')

const SPEECH_BUBBLE_RADIUS_RIGHT = [
  `rounded-tl-[${v('sv-radius-md', T.radiusMd)}]`,
  `rounded-tr-[${v('sv-radius-md', T.radiusMd)}]`,
  `rounded-bl-[${v('sv-radius-md', T.radiusMd)}]`,
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
  `rounded-[${v('sv-radius-md', T.radiusMd)}]`,
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
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  'border-b',
  `border-[${v('sv-border', T.border)}]`,
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

const STATIC_TABLE_CELL_LAYOUT_BASE = 'px-4 py-2 text-left'

const STATIC_TABLE_CELL_HEADER = [
  'text-xs font-semibold uppercase tracking-wider',
  `text-[${v('sv-fg-muted', T.fgMuted)}]`,
].join(' ')

const STATIC_TABLE_CELL_DATA = ['text-sm', `text-[${v('sv-fg', T.fg)}]`].join(' ')

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
