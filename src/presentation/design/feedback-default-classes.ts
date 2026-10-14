/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui skeleton and progress (https://ui.shadcn.com), registry commit 3464245c4513b7998b1d11fa9c67b71cc1534dc7.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * Prestyled-by-default class computer for the feedback-cluster components
 * `badge` (default + status mode), `skeleton`, and `progress`. Schema
 * authors who write the bare `{ type: 'badge', content: 'New' }`,
 * `{ type: 'skeleton' }`, or `{ type: 'progress', progressValue: 75 }` get a
 * complete, opinionated feedback surface — semantic tone (info/success/
 * warning/error), pill-rounded chrome, pulse animation, focal accent — with
 * zero theme-layer dependency.
 *
 * Every colour is a shadcn role utility (`bg-muted`, `bg-primary`,
 * `text-muted-foreground`), so an app's `design` reaches it through the
 * variables those utilities read. The `alert` left this file for its own
 * recipe, `alert-default-classes.ts`, when it moved to shadcn's anatomy.
 *
 * Subparts covered:
 *
 *   - BADGE (default)       — pill-rounded label with variant tones (default
 *                             / secondary / destructive / outline)
 *   - BADGE (status mode)   — wrapper + colored status dot inside the badge
 *                             when `variant: 'status'` is set; pulse opt-in
 *   - SKELETON              — loading placeholder block with three shape
 *                             variants (text / circular / rectangular);
 *                             `animate` toggles the `animate-pulse` shimmer
 *   - PROGRESS TRACK        — linear-variant background bar (`bg-bg-subtle`
 *                             tone, full-pill rounded)
 *   - PROGRESS BAR          — linear-variant filled portion (primary tone)
 *   - PROGRESS CIRCLE TRACK — circle-variant ring under-layer (faint border
 *                             tone) painted via SVG `stroke`
 *   - PROGRESS CIRCLE BAR   — circle-variant ring over-layer (primary tone)
 *                             painted via SVG `stroke`
 *   - PROGRESS LABEL        — strong-foreground tone percentage label
 *   - SPINNER ROOT          — the box the mark turns in, with a 16px default
 *                             so a bare `{ type: 'spinner' }` is visible
 *                             without the author sizing it first
 *   - SPINNER GLYPH         — the mark itself, filling whatever box the root
 *                             was given rather than a fixed pixel size
 *
 * Helper file lives in `src/presentation/ui/sections/renderers/element-
 * renderers/` (alongside the renderers that consume it) because all of these
 * surfaces are server-rendered as part of the SSR pass — the
 * `presentation-component → presentation-island` layer boundary does not
 * apply since this is purely a same-layer helper. Mirrors the location chosen
 * for `button-default-classes.ts` and `input-default-classes.ts`.
 */

// The default-mode badge is base-nova's recipe in `badge-default-classes.ts`;
// it is re-exported here so the status mode below and existing importers of
// this feedback module read the one badge.
import { cva } from 'class-variance-authority'
import { computeBadgeClasses, type BadgeVariant } from '@/presentation/design/badge-default-classes'

export { computeBadgeClasses, type BadgeVariant }

// ──────────────────────────────────────────────────────────────────────────────
// Shared building blocks
// ──────────────────────────────────────────────────────────────────────────────

/** Schema-aligned vocabulary for `SkeletonVariantSchema`. */
export type SkeletonVariant = 'text' | 'circular' | 'rectangular'

/** Status-dot color vocabulary (`StatusDotColorSchema`). */
export type StatusDotColor = 'green' | 'red' | 'amber' | 'yellow' | 'blue' | 'gray'

/**
 * Linear progress size vocabulary (`ComponentSizeSchema`).
 *
 * @public Schema-aligned vocabulary type exported alongside its sibling
 * default-class maps for type-safe consumption at renderer call sites.
 */
export type ProgressSize = 'sm' | 'default' | 'lg'

// ──────────────────────────────────────────────────────────────────────────────
// BADGE (status mode) — the secondary badge, with a coloured dot inside it
//
// The chip is base-nova's secondary badge (`computeBadgeClasses`), so a status
// badge and a plain one are one shape. The dot is Sovrium's: shadcn has no
// status badge, and its tones are the four status roles plus the muted ink.
// ──────────────────────────────────────────────────────────────────────────────

const STATUS_DOT_COLOR_CLASS: Record<StatusDotColor, string> = {
  green: 'bg-success-solid',
  red: 'bg-destructive',
  amber: 'bg-warning-solid',
  yellow: 'bg-warning-solid',
  blue: 'bg-info-solid',
  gray: 'bg-muted-foreground',
}

/**
 * Compute the default className for the outer wrapper `<span>` of a
 * status-mode badge (`variant: 'status'`): the secondary badge, with a wider
 * gap so the dot reads as a mark beside its label rather than a glyph in it.
 */
export const computeStatusBadgeWrapperClasses = (): string =>
  computeBadgeClasses({ variant: 'secondary' }).replace(' gap-1 ', ' gap-1.5 ')

/**
 * Compute the default className for the coloured dot inside a status-mode
 * badge. The `color` axis maps short tokens (`green` / `red` / `amber` /
 * `yellow` / `blue` / `gray`) onto the status roles; `pulse` adds
 * `animate-pulse` so a live status draws attention. The dot stays 2×2 so it
 * reads as an indicator at any badge size.
 */
export const computeStatusBadgeDotClasses = ({
  color = 'gray',
  pulse = false,
}: {
  color?: StatusDotColor
  pulse?: boolean
} = {}): string =>
  [
    'inline-block h-2 w-2 rounded-full shrink-0',
    STATUS_DOT_COLOR_CLASS[color],
    pulse ? 'animate-pulse' : '',
  ]
    .filter(Boolean)
    .join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// SKELETON — loading placeholder block with shape variants
// ──────────────────────────────────────────────────────────────────────────────

/**
 * base-nova draws one skeleton, `rounded-md`, and that is the `text` shape. The
 * other two are Sovrium's: `circular` for an avatar placeholder and
 * `rectangular`, the square-cornered block its name promises, for a card or an
 * image.
 */
const SKELETON_VARIANT_RADIUS = cva('', {
  variants: {
    variant: {
      text: 'rounded-md',
      circular: 'rounded-full',
      rectangular: 'rounded-none',
    },
  },
})

/**
 * Compute the default className for a `skeleton`: base-nova's `bg-muted`
 * block with its `animate-pulse`, which `animate: false` drops so a reader who
 * asked for reduced motion gets a static placeholder.
 */
export const computeSkeletonClasses = ({
  variant = 'text',
  animate = true,
}: {
  variant?: SkeletonVariant
  animate?: boolean
} = {}): string =>
  [animate ? 'animate-pulse' : '', SKELETON_VARIANT_RADIUS({ variant: variant }), 'bg-muted']
    .filter(Boolean)
    .join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// PROGRESS — base-nova's track and indicator, Sovrium's ring and label
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute the default className for the linear-variant track (base-nova's
 * `ProgressTrack`). The renderer still sets the height per `size` inline, so
 * base-nova's `h-1` is left out: it would lose to the inline height anyway.
 */
export const computeProgressTrackClasses = (): string =>
  'relative flex w-full items-center overflow-x-hidden rounded-full bg-muted'

/**
 * Compute the default className for the linear-variant fill (base-nova's
 * `ProgressIndicator`); the renderer sets its width to the percentage.
 */
export const computeProgressBarClasses = (): string => 'h-full bg-primary transition-all'

/**
 * The SVG `stroke` of the circle variant's under-ring. A `var()` rather than a
 * class, because a presentation attribute takes a value, not a utility.
 */
export const computeProgressCircleTrackStroke = (): string => 'var(--muted)'

/** The SVG `stroke` of the circle variant's filled arc. */
export const computeProgressCircleBarStroke = (): string => 'var(--primary)'

/**
 * Compute the default className for the percentage (base-nova's
 * `ProgressValue`), beside the bar or in the centre of the ring.
 */
export const computeProgressLabelClasses = (): string =>
  'shrink-0 text-sm text-muted-foreground tabular-nums'

// ──────────────────────────────────────────────────────────────────────────────
// SPINNER — the box, and the mark that turns in it
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute the default className for a `spinner` root.
 *
 * `size-4` is a DEFAULT, not a fixed size: the recipe is merged through
 * `tailwind-merge`, so an author's `size-5` / `size-8` drops it outright and
 * the mark follows. It exists because a `<div>` with no box at all is a block
 * — page-wide and exactly 0px tall — which is what a bare
 * `{ type: 'spinner' }` would render without it (a theme animations spec
 * passes `h-8 w-8` for that reason). 16px is
 * the size the product draws its icons at.
 *
 * `inline-block` rather than `inline-flex` on purpose. An empty positional
 * child is given an INLINE `display:inline-block` by `buildEmptyElementStyles`
 * (props-builder), and an inline style beats any class, so a `flex` here would
 * be silently overruled on exactly the pages the console draws. Matching the
 * inline value keeps the two in agreement instead of fighting; the mark fills
 * the box by percentage, which needs no flex.
 *
 * No tone. The mark strokes `currentColor`, so a spinner sitting in a run of
 * muted text turns in that text's colour — the behaviour the loading button
 * has always had, and what lets the console's `md with label` drawing read as
 * one phrase rather than as an accent beside a caption.
 */
export const computeSpinnerClasses = (): string => 'inline-block size-4 shrink-0'

/**
 * Compute the default className for the `<svg>` mark inside a spinner root.
 *
 * `size-full` is the whole point of the pair: the one spinner mark the product
 * owns is pinned at `width="16" height="16"` (see `render/elements/
 * spinner-mark.tsx`), so reusing it unchanged would paint `sm`, `md` and `lg`
 * at one size and the console's size ladder would still not be visible. A CSS
 * rule beats an SVG presentation attribute, so this is what makes the mark
 * take its size from the box the author gave the root.
 */
export const computeSpinnerGlyphClasses = (): string => 'size-full'
