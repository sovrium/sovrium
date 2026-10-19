/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui card and badge (https://ui.shadcn.com), registry commit 3464245c4513b7998b1d11fa9c67b71cc1534dc7.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * The `kanban` on shadcn/ui's anatomy. shadcn/ui ships no board, so the board
 * is composed from its parts: each column is a Sovrium `kanban-column` — a
 * well on the muted surface — whose `kanban-column-header` names the column
 * and counts its cards in a `secondary` badge, and each card is a small
 * shadcn `Card` (the card ground, a faint ring, no border).
 *
 * Drawn by the hydrated island (`islands/kanban/*`) and by the SSR skeleton
 * (`render/registry/island-kanban-skeleton.tsx`) from this one module, so a
 * board does not re-draw at hydration. Every colour is a role utility.
 *
 * Width is NOT here: a column's width is a placement concern owned by
 * whatever composes the board (`column-sizing.ts`).
 */

import { computeBadgeClasses } from '@/presentation/design/badge-default-classes'

// ──────────────────────────────────────────────────────────────────────────────
// BOARD — the horizontal scroller holding the columns
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute the className for the board: the columns in one row, scrolling
 * sideways rather than wrapping — a board is an ordered pipeline.
 */
export const computeKanbanBoardClasses = (): string => 'flex w-full gap-3 overflow-x-auto p-1'

/**
 * The end-edge shadow a board casts over its right side while columns are still
 * clipped past it — the grid's own scroll edge, so a board that scrolls
 * sideways says so the way a wide grid does.
 */
export const computeKanbanScrollEdgeClasses = (): string =>
  'pointer-events-none absolute inset-y-0 right-0 z-20 w-4 shadow-[inset_-12px_0_8px_-8px_rgb(0_0_0_/_0.18)] dark:shadow-[inset_-12px_0_8px_-8px_rgb(0_0_0_/_0.6)]'

// ──────────────────────────────────────────────────────────────────────────────
// COLUMN — the `data-column` well (`data-slot="kanban-column"`)
// ──────────────────────────────────────────────────────────────────────────────

const KANBAN_COLUMN_BASE = 'flex flex-col gap-2 rounded-xl p-2 transition-colors'

/**
 * Compute the className for a column: a well on the muted surface, which
 * deepens while a card is held over it.
 */
export const computeKanbanColumnClasses = ({
  state = 'default',
}: {
  readonly state?: 'default' | 'over'
} = {}): string => `${KANBAN_COLUMN_BASE} ${state === 'over' ? 'bg-muted' : 'bg-muted/60'}`

/**
 * Compute the className for a column header (`data-slot="kanban-column-header"`):
 * the optional colour dot, the title and the count on one line.
 */
export const computeKanbanColumnHeaderClasses = (): string =>
  'flex min-h-8 items-center gap-2 px-1 text-sm font-medium'

/** The column title, truncated so the count always shows. */
export const KANBAN_COLUMN_TITLE_CLASSES = 'min-w-0 truncate text-sm font-medium'

/** A column's colour dot, painted inline from its option colour. */
export const computeKanbanColumnDotClasses = (): string =>
  'inline-block size-2 shrink-0 rounded-full'

/**
 * Compute the className for the column count: the shared badge at its
 * `secondary` tone, pushed to the end of the header.
 */
export const computeKanbanColumnCountClasses = (): string =>
  `${computeBadgeClasses({ variant: 'secondary' })} ml-auto shrink-0`

/** The column's card well under its header. */
export const KANBAN_COLUMN_BODY_CLASSES = 'flex min-h-10 flex-col gap-2'

// ──────────────────────────────────────────────────────────────────────────────
// CARD — one record (`data-slot="card"`, `data-size="sm"`)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute the className for a card: a small shadcn `Card` surface — the card
 * ground and foreground, `rounded-xl`, a faint ring instead of a border. Its
 * cover, body and footer pad themselves.
 */
export const computeKanbanCardClasses = (): string =>
  'relative flex min-w-0 flex-col overflow-hidden rounded-xl bg-card text-sm text-card-foreground ring-1 ring-foreground/10 transition-shadow'

/** The `data-*` every board card carries: its shadcn part name and its size. */
export const KANBAN_CARD_SLOT_ATTRIBUTES = { 'data-slot': 'card', 'data-size': 'sm' } as const

/** A card that opens a record: the pointer, and the ring in the ring colour under it. */
export const KANBAN_CLICKABLE_CARD_CLASSES = 'cursor-pointer hover:ring-ring'

/** The card's body: its children, on the small card's 12px padding. */
export const KANBAN_CARD_BODY_CLASSES = 'flex min-w-0 flex-col gap-1 p-3'

/** The title a card with no template draws. */
export const KANBAN_CARD_DEFAULT_TITLE_CLASSES = 'truncate text-sm font-medium'

/** The card's cover, a 44px band across its top. */
export const computeKanbanCardCoverClasses = (): string => 'h-11 w-full shrink-0 object-cover'

/** The colour stripe down a coloured card's leading edge, painted inline. */
export const computeKanbanCardStripeClasses = (): string =>
  'pointer-events-none absolute inset-y-0 left-0 w-[3px]'

/** Compute the className for the card footer: a rule in the border colour over its chips. */
export const computeKanbanCardFooterClasses = (): string =>
  'flex flex-wrap items-center gap-1.5 border-t border-border px-3 py-2'

/** Compute the className for one footer chip, in the muted foreground. */
export const computeKanbanCardFooterChipClasses = (): string =>
  'inline-flex items-center gap-1.5 text-xs text-muted-foreground'

/** Compute the className for a footer option badge: the shared `secondary` badge. */
export const computeKanbanFooterBadgeClasses = (): string =>
  computeBadgeClasses({ variant: 'secondary' })

/** A footer avatar: a small circle on the muted surface. */
export const KANBAN_FOOTER_AVATAR_CLASSES =
  'inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-2xs font-medium text-muted-foreground'

// ──────────────────────────────────────────────────────────────────────────────
// DRAG — the card in hand, and where it would land
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute the className added to the card in hand (`data-dragging`): ringed
 * in the ring colour and lifted, never rotated.
 */
export const computeKanbanDragGhostClasses = (): string => 'shadow-lg ring-2 ring-ring'

/**
 * Compute the className for where a held card would land
 * (`data-role="kanban-placeholder"`): a dashed outline in the ring colour.
 */
export const computeKanbanPlaceholderClasses = (): string =>
  'min-h-11 rounded-lg border border-dashed border-ring'

/**
 * Compute the className for an empty column's message
 * (`data-slot="kanban-column-empty"`), centred in the muted foreground.
 */
export const computeKanbanEmptyColumnClasses = (): string =>
  'px-1 py-4 text-center text-sm text-muted-foreground'

// ──────────────────────────────────────────────────────────────────────────────
// SWIMLANES — the two-axis board
// ──────────────────────────────────────────────────────────────────────────────

/** The two-axis board: its lanes stacked, scrolling sideways together. */
export const computeKanbanGridClasses = (): string =>
  'flex w-full flex-col gap-4 overflow-x-auto p-1'

/** One lane's row of cells. */
export const computeKanbanLaneRowClasses = (): string => 'flex min-w-max gap-3'

/** One lane: its header over its row. */
export const computeKanbanSwimlaneClasses = (): string => 'flex min-w-max flex-col gap-2'

/** A lane header: drawn as a column header is, its rule running to the end. */
export const computeKanbanSwimlaneHeaderClasses = (): string =>
  'flex min-h-8 items-center gap-2 px-1'

/**
 * Compute the className for the toggle that folds a lane or a column: a
 * ghost control on the header's type, muted under the pointer.
 */
export const computeKanbanSwimlaneToggleClasses = (): string =>
  'flex shrink-0 items-center gap-1.5 rounded-md px-1 py-0.5 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50'

/** The rule after a lane's name, in the border colour. */
export const computeKanbanSwimlaneRuleClasses = (): string => 'h-px flex-1 bg-border'

/** The chevron of a fold toggle. */
export const computeKanbanSwimlaneChevronClasses = (): string =>
  'inline-block size-2 shrink-0 transition-transform'
