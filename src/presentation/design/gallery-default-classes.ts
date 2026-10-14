/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui card and empty (https://ui.shadcn.com), registry commit 3464245c4513b7998b1d11fa9c67b71cc1534dc7.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * The `gallery` on shadcn/ui's anatomy: a grid of small `Card`s, each led by
 * an optional cover that bleeds to the card's top edge, its children in the
 * card content, and an `Empty` when no record matches.
 *
 * Drawn by the SSR host (`render/registry/gallery-component.tsx`) and by the
 * hydrated island (`islands/gallery/*`) from this one module, so a card does
 * not re-draw at hydration. Every colour is a role utility.
 *
 * One departure from base-nova: the card does not pad its own block axis.
 * Its cover sits in a box (it carries the author's aspect ratio), not as the
 * card's first `<img>`, so the content pads itself instead and the cover
 * starts at the top edge.
 */

import { computeBadgeClasses } from '@/presentation/design/badge-default-classes'

// ──────────────────────────────────────────────────────────────────────────────
// GRID — the gallery container
// ──────────────────────────────────────────────────────────────────────────────

const GALLERY_GRID = 'grid w-full gap-4'

const GALLERY_MASONRY = 'columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4'

/**
 * Compute the className for the gallery container. `'grid'` is a CSS grid to
 * which the caller appends the responsive `grid-cols-*`; `'masonry'` is a
 * self-contained CSS-columns shell. Both space their cards 16px apart.
 */
export const computeGalleryGridClasses = ({
  layout = 'grid',
}: {
  readonly layout?: 'grid' | 'masonry'
} = {}): string => (layout === 'masonry' ? GALLERY_MASONRY : GALLERY_GRID)

// ──────────────────────────────────────────────────────────────────────────────
// CARD — one record (`data-slot="card"`, `data-size="sm"`)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute the className for a card: base-nova's small `Card` surface — the
 * card ground and foreground, `rounded-xl`, a faint ring instead of a border
 * — stacking its cover and content on the 12px card spacing. `group` lets
 * the hover overlay appear under the pointer.
 */
export const computeGalleryCardClasses = (): string =>
  'group/card group relative flex w-full min-w-0 flex-col gap-(--card-spacing) overflow-hidden rounded-xl bg-card text-sm text-card-foreground ring-1 ring-foreground/10 [--card-spacing:--spacing(3)]'

/** The `data-*` every gallery card carries: its shadcn part name and its size. */
export const GALLERY_CARD_SLOT_ATTRIBUTES = { 'data-slot': 'card', 'data-size': 'sm' } as const

/** A card that opens a record: the pointer, and the ring in the ring colour under it. */
export const GALLERY_CLICKABLE_CARD_CLASSES = 'cursor-pointer hover:ring-ring'

/**
 * The card content (`data-slot="card-content"`): base-nova's `CardContent`
 * (`px-(--card-spacing)`, which the unit test holds equal to the card
 * recipe's), padding its foot too since the card leaves its block axis to
 * the parts. Spelled here rather than imported: the card recipe's module
 * would cost the gallery island a chunk of strings it never draws.
 */
export const GALLERY_CARD_BODY_CLASSES =
  'flex min-w-0 flex-col gap-1 px-(--card-spacing) pb-(--card-spacing)'

/** The content of a card with no cover, padded at its top as well. */
export const GALLERY_CARD_BODY_NO_COVER_CLASSES = `${GALLERY_CARD_BODY_CLASSES} pt-(--card-spacing)`

/** An avatar a card child draws: a small circle on the muted surface. */
export const GALLERY_CARD_AVATAR_CLASSES =
  'inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-2xs font-medium text-muted-foreground'

/** A badge a card child draws: the shared badge at its `secondary` tone. */
export const computeGalleryCardBadgeClasses = (): string =>
  computeBadgeClasses({ variant: 'secondary' })

/** The title a card with no template draws: the card title's type, on one line. */
export const GALLERY_CARD_DEFAULT_TITLE_CLASSES = 'truncate text-sm leading-snug font-medium'

// ──────────────────────────────────────────────────────────────────────────────
// COVER — the box carrying `data-aspect-ratio`, and its `<img>`
// ──────────────────────────────────────────────────────────────────────────────

/** The cover box: full width, on the muted surface while the image loads or if it fails. */
const GALLERY_IMAGE_BOX = 'relative w-full overflow-hidden bg-muted'

const GALLERY_IMAGE_IMG = 'h-full w-full object-cover'

/** The cover's height when no `aspectRatio` resolves — a box with neither collapses. */
export const GALLERY_COVER_FALLBACK_HEIGHT_CLASS = 'h-40'

/** Compute the className for the cover box (`part: 'box'`) or its `<img>` (`part: 'img'`). */
export const computeGalleryImageClasses = ({
  part = 'box',
}: {
  readonly part?: 'box' | 'img'
} = {}): string => (part === 'img' ? GALLERY_IMAGE_IMG : GALLERY_IMAGE_BOX)

/**
 * Resolve `galleryCard.aspectRatio` (`'4:3'`, `'16/9'`) to a CSS
 * `aspect-ratio` value, or `undefined` when it is absent or not two positive
 * numbers — the caller then falls back to the fixed height.
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
// OVERLAY — the hover scrim (`data-role="gallery-card-overlay"`)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute the className for the hover overlay: hidden until the card is
 * hovered, then a scrim of the foreground under the background's ink.
 */
export const computeGalleryOverlayClasses = (): string =>
  'invisible absolute inset-0 flex items-center justify-center gap-2 bg-foreground/60 text-xs text-background opacity-0 transition-opacity group-hover:visible group-hover:opacity-100'

// ──────────────────────────────────────────────────────────────────────────────
// EMPTY — base-nova's `Empty`, when no card is drawn
// ──────────────────────────────────────────────────────────────────────────────

/**
 * The empty gallery's parts: base-nova's `Empty` with its outline drawn
 * (`border` beside the root's `border-dashed`), `EmptyHeader`, `EmptyTitle`
 * and `EmptyDescription`. They repeat `display-default-classes.ts`'s strings,
 * which the unit test holds equal: importing that module costs the gallery
 * island a shared chunk of server-side display recipes it never draws.
 */
export const GALLERY_EMPTY_CLASSES = {
  root: 'flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-4 rounded-xl border-dashed p-6 text-center text-balance',
  header: 'flex max-w-sm flex-col items-center gap-2',
  title: 'text-sm font-medium tracking-tight',
  description:
    'text-sm/relaxed text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary',
} as const

// ──────────────────────────────────────────────────────────────────────────────
// PAGER — the pagination footer and its numbered pages
// ──────────────────────────────────────────────────────────────────────────────

const GALLERY_PAGER_FOOTER = 'flex w-full items-center justify-center gap-1 p-3'

const GALLERY_PAGER_PAGE_BASE =
  'inline-flex size-8 items-center justify-center rounded-lg border text-sm font-medium transition-colors'

const GALLERY_PAGER_PAGE_DEFAULT = 'border-border bg-background hover:bg-muted'

const GALLERY_PAGER_PAGE_CURRENT = 'border-transparent bg-primary text-primary-foreground'

/**
 * Compute the className for the pager footer (`part: 'footer'`) or one page
 * (`part: 'page'`): an outline button, the current page a primary one.
 */
export const computeGalleryPagerClasses = ({
  part = 'footer',
  current = false,
}: {
  readonly part?: 'footer' | 'page'
  readonly current?: boolean
} = {}): string => {
  if (part === 'footer') return GALLERY_PAGER_FOOTER
  return `${GALLERY_PAGER_PAGE_BASE} ${current ? GALLERY_PAGER_PAGE_CURRENT : GALLERY_PAGER_PAGE_DEFAULT}`
}
