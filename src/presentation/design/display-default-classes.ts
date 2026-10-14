/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui empty, item, table and avatar (https://ui.shadcn.com), registry commit 3464245c4513b7998b1d11fa9c67b71cc1534dc7.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * Class computers for the server-rendered display surfaces.
 *
 * Four of them are on shadcn/ui's anatomy, base-nova's strings unchanged and
 * one `data-slot` per part, stamped by their renderers: `empty`, `item`, the
 * static `table` and `avatar`. Each is shadcn's role utilities
 * (`bg-muted`, `text-muted-foreground`, `border-border` …) read straight off
 * the theme, so an app's `design` repaints them without a `--sv-*` hook.
 *
 * The `description-list` and the record-field value have no shadcn row; they
 * read the same role utilities.
 */

import { computePartButtonClasses } from '@/presentation/design/button-variant-classes'

// ──────────────────────────────────────────────────────────────────────────────
// EMPTY — base-nova's `Empty`, `EmptyHeader`, `EmptyTitle`, `EmptyDescription`,
// `EmptyContent`
// ──────────────────────────────────────────────────────────────────────────────

// The empty recipe lives in its own leaf module, for the same reason as the item.
export {
  computeEmptyContentClasses,
  computeEmptyDescriptionClasses,
  computeEmptyHeaderClasses,
  computeEmptyMediaClasses,
  computeEmptyStateContainerClasses,
  computeEmptyStateTitleClasses,
} from './empty-default-classes'

// ──────────────────────────────────────────────────────────────────────────────
// ITEM — base-nova's `Item`, at its default variant and size
// ──────────────────────────────────────────────────────────────────────────────

// The item recipe lives in its own leaf module so an island drawing an item
// pays for those few strings rather than for this whole file.
export { computeListItemClasses } from './item-default-classes'

/** shadcn/ui's Item variants: the border and the ground. */
const ITEM_VARIANT = {
  default: '',
  outline: 'border-border',
  muted: 'bg-muted/50',
} as const

/**
 * shadcn/ui's Item sizes. base-nova draws `sm` with the same padding as
 * `default` at the commit this is read from; here `sm` is the shorter row its
 * name promises.
 */
const ITEM_SIZE = {
  default: '',
  sm: 'gap-2 py-1.5',
} as const

/** The variant and size of an item, appended to the row's own classes. */
export const computeItemVariantClasses = (
  variant: keyof typeof ITEM_VARIANT,
  size: keyof typeof ITEM_SIZE
): string => `${ITEM_VARIANT[variant]} ${ITEM_SIZE[size]}`.trim()

/** `item-media`: the leading glyph or picture. */
export const computeItemMediaClasses = (): string =>
  "flex shrink-0 items-center justify-center gap-2 group-has-data-[slot=item-description]/item:translate-y-0.5 group-has-data-[slot=item-description]/item:self-start [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4"

/** `item-content`: the column holding the title and the description. */
export const computeItemContentClasses = (): string => 'flex flex-1 flex-col gap-1'

/** `item-title`. */
export const computeItemTitleClasses = (): string =>
  'line-clamp-1 flex w-fit items-center gap-2 text-sm leading-snug font-medium underline-offset-4'

/** `item-description`. */
export const computeItemDescriptionClasses = (): string =>
  'line-clamp-2 text-left text-sm leading-normal font-normal text-muted-foreground'

/** `item-actions`. */
export const computeItemActionsClasses = (): string => 'flex items-center gap-2'

/** `item-header` and `item-footer`: full-width lines above and below the body. */
export const computeItemEdgeClasses = (): string =>
  'flex basis-full items-center justify-between gap-2'

// ──────────────────────────────────────────────────────────────────────────────
// TABLE (static rows) — base-nova's `Table` parts
// ──────────────────────────────────────────────────────────────────────────────

// The static-table recipe lives in its own leaf module, for the same reason.
export {
  computeStaticTableBodyClasses,
  computeStaticTableCaptionClasses,
  computeStaticTableCellClasses,
  computeStaticTableContainerClasses,
  computeStaticTableRowClasses,
  computeStaticTableShellClasses,
} from './static-table-default-classes'

// ──────────────────────────────────────────────────────────────────────────────
// AVATAR — base-nova's `Avatar`, `AvatarImage`, `AvatarFallback`,
// `AvatarBadge`, `AvatarGroup`, `AvatarGroupCount`
// ──────────────────────────────────────────────────────────────────────────────

/** The three rungs of the avatar size ladder. See `display/avatar.ts`. */
export type AvatarSize = 'sm' | 'default' | 'lg'

/** Corner shape of an avatar box. */
export type AvatarShape = 'circle' | 'square'

/** Presence, drawn as a corner dot. */
export type AvatarStatus = 'online' | 'away' | 'busy' | 'offline'

/**
 * base-nova's `Avatar` root. The rung is read off `data-size` (24 / 32 / 40px),
 * which the renderer stamps, so the ladder lives in the one string; the
 * `after:` ring is the hairline base-nova draws over the picture.
 */
const AVATAR_ROOT =
  'group/avatar relative flex size-8 shrink-0 rounded-full select-none after:absolute after:inset-0 after:rounded-full after:border after:border-border after:mix-blend-darken data-[size=lg]:size-10 data-[size=sm]:size-6 dark:after:mix-blend-lighten'

/**
 * The fallback's ground and ink, on the root as well as on the fallback.
 *
 * base-nova paints them on `AvatarFallback` only. Sovrium's root carries them
 * too, for two rungs that have no fallback element to paint: the empty disc
 * (no picture, no name), which would otherwise be an outline, and the
 * initials a session-bound avatar draws in the browser, which arrive without
 * the server's classes. A picture covers the ground, so it changes nothing
 * where a picture is drawn.
 */
const AVATAR_ROOT_GROUND =
  'items-center justify-center bg-muted text-sm text-muted-foreground data-[size=sm]:text-xs'

/**
 * `shape: 'square'` keeps the box and softens its corners instead of rounding
 * them fully — Sovrium's, since base-nova draws only discs.
 */
const AVATAR_SQUARE = 'rounded-md after:rounded-md'

const shapeClass = (shape: AvatarShape): string => (shape === 'square' ? AVATAR_SQUARE : '')

/**
 * Compute the className for one avatar root (`data-slot="avatar"`), a single
 * avatar or one member of a group. `size` is read through `data-size`; it
 * stays in the signature so a caller cannot forget to stamp it.
 */
export const computeAvatarBoxClasses = ({
  shape,
}: {
  readonly size: AvatarSize
  readonly shape: AvatarShape
}): string =>
  [AVATAR_ROOT, AVATAR_ROOT_GROUND, shapeClass(shape)].filter((part) => part !== '').join(' ')

/** The picture (`data-slot="avatar-image"`), clipped to the box it sits in. */
export const computeAvatarImageClasses = ({ shape }: { readonly shape: AvatarShape }): string =>
  ['aspect-square size-full rounded-full object-cover', shape === 'square' ? 'rounded-md' : '']
    .filter((part) => part !== '')
    .join(' ')

/** The initials (`data-slot="avatar-fallback"`) on the muted ground. */
export const computeAvatarFallbackClasses = ({ shape }: { readonly shape: AvatarShape }): string =>
  [
    'flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground group-data-[size=sm]/avatar:text-xs',
    shape === 'square' ? 'rounded-md' : '',
  ]
    .filter((part) => part !== '')
    .join(' ')

/** One member of a stack: the same root; the group pulls it back and rings it. */
export const computeAvatarMemberClasses = ({
  size,
  shape,
}: {
  readonly size: AvatarSize
  readonly shape: AvatarShape
}): string => computeAvatarBoxClasses({ size, shape })

/** The row a group of members sits in (`data-slot="avatar-group"`). */
export const computeAvatarGroupClasses = (): string =>
  'group/avatar-group flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background'

/** The `+N` disc (`data-slot="avatar-group-count"`) for the members a `max` hid. */
export const computeAvatarOverflowClasses = (): string =>
  'relative flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground ring-2 ring-background group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6 [&>svg]:size-4 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3'

/**
 * The tone of each presence. base-nova's `AvatarBadge` is `bg-primary`; a
 * presence is a status, so it takes the status roles instead.
 */
const AVATAR_STATUS_TONE: Record<AvatarStatus, string> = {
  online: 'bg-success-solid',
  away: 'bg-warning-solid',
  busy: 'bg-destructive',
  offline: 'bg-muted-foreground',
}

/** base-nova's `AvatarBadge`, less its tone: the corner dot, sized per rung by the root's `data-size`. */
const AVATAR_BADGE_BASE = [
  'absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full text-primary-foreground bg-blend-color ring-2 ring-background select-none',
  'group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden',
  'group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2',
  'group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2',
].join(' ')

/**
 * base-nova's `AvatarBadge` as shadcn draws it (`data-slot="avatar-badge"`),
 * in the primary colour: the "she is here now" dot of a presence indicator.
 */
export const computeAvatarBadgeClasses = (): string => `${AVATAR_BADGE_BASE} bg-primary`

/**
 * The presence dot (`data-slot="avatar-badge"`) on the lower-right corner,
 * sized per rung by the root's `data-size`. Absolutely positioned, so the box
 * keeps the ladder's geometry whether or not a presence is drawn.
 */
export const computeAvatarStatusClasses = ({ status }: { readonly status: AvatarStatus }): string =>
  `${AVATAR_BADGE_BASE} ${AVATAR_STATUS_TONE[status]}`

// ──────────────────────────────────────────────────────────────────────────────
// DESCRIPTION-LIST — the <dl>, its rows, and the cells of a row
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
 * The `<dl>` itself (`data-slot="description-list"`). `rows` stacks the pairs
 * vertically; `stacked` flows them as a responsive row of blocks. Same element
 * either way — the accessible pairing is what must survive the switch.
 */
export const computeDescriptionListClasses = ({
  layout,
}: {
  readonly layout: DescriptionListLayout
}): string => (layout === 'stacked' ? 'flex flex-wrap gap-x-8 gap-y-4' : 'flex flex-col')

/**
 * One `<dt>`/`<dd>` pair's wrapper (`data-slot="description-list-item"`) — a
 * `<div>`, which `<dl>` permits precisely so a row can be addressed as one
 * thing.
 *
 * Under `rows` it is a two-column grid, the term a third of the width and the
 * detail two thirds, ruled underneath unless it is the last row or the author
 * turned `dividers` off. The rule and the vertical padding are drawn by the two
 * CELLS, which the grid stretches to one height, so they read as one unbroken
 * line under the row while each `<dd>` still carries the rule it sits on; the
 * term's `pr-4` stands in for a column gap that would break that line.
 * Auto-placement without this wrapper would pull the next row's term into the
 * detail column of the row above it. The action rides inside the `<dd>`: a
 * `<dl>` row admits `<dt>` and `<dd>` and nothing else.
 */
export const computeDescriptionRowClasses = ({
  layout,
  dividers = true,
}: {
  readonly layout: DescriptionListLayout
  readonly dividers?: boolean
}): string =>
  layout === 'stacked'
    ? 'flex min-w-[8rem] flex-col gap-1'
    : [
        'grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] *:py-3 [&>dt]:pr-4',
        dividers ? '*:border-b last:*:border-b-0' : '*:border-b-0',
      ].join(' ')

/**
 * The `<dt>` (`data-slot="description-list-term"`): small and muted, because
 * the term names the fact and the detail IS the fact.
 */
export const computeDescriptionTermClasses = (): string => 'text-sm text-muted-foreground'

/**
 * The `<dd>` (`data-slot="description-list-detail"`): small, medium weight, in
 * the foreground.
 *
 * `min-h-5` is load-bearing rather than cosmetic: an EMPTY detail keeps a box of
 * its own, so a summary panel does not silently lose a line when one fact is
 * missing.
 *
 * `withAction` turns the cell into a row of its own so the link sits at its far
 * edge. It is off by default because most rows carry no action.
 */
export const computeDescriptionDetailClasses = ({
  withAction = false,
}: {
  readonly withAction?: boolean
} = {}): string =>
  [
    'm-0 min-h-5 text-sm font-medium text-foreground',
    withAction ? 'flex items-start justify-between gap-4' : '',
  ]
    .filter(Boolean)
    .join(' ')

/** The muted dash standing in for a declared-and-empty detail. */
export const computeDescriptionEmptyClasses = (): string =>
  'font-normal text-muted-foreground select-none'

/**
 * The row's action (`data-slot="description-list-action"`): shadcn/ui's Button
 * at its link variant and small size, at the far edge of the detail cell.
 */
export const computeDescriptionActionClasses = (): string =>
  `${computePartButtonClasses({ variant: 'link', size: 'sm' })} shrink-0 self-start`

// ──────────────────────────────────────────────────────────────────────────────
// RECORD-FIELD VALUE — one bound record value, drawn read-only
// ──────────────────────────────────────────────────────────────────────────────

const RECORD_FIELD_VALUE =
  'text-base text-foreground has-data-[slot=record-field-empty]:text-muted-foreground'

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
 *
 * A filled value is written in the foreground. An empty one is an em dash
 * (`data-slot="record-field-empty"`) in the muted foreground, so an absent
 * value reads as absent rather than as a gap in the page.
 */
export const computeRecordFieldValueClasses = (): string => RECORD_FIELD_VALUE
