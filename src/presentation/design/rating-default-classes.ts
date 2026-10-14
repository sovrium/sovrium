/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `rating` component's parts. shadcn/ui has no rating, so the parts follow
 * its naming (`rating`, `rating-item`) and its colour roles: an earned star is
 * drawn in the primary colour, an unearned one in the muted foreground, so the shape of
 * the scale stays visible without competing with the score.
 *
 * Each star states itself with `data-state` — `on`, `off` or `half` — and the
 * tone is read off that attribute, so a server-drawn reading and a radio input
 * share one recipe. A half star is an `off` star with an `on` half laid over
 * its left side ({@link computeRatingHalfClasses}).
 *
 * The glyph is a lucide icon (`RatingGlyph`, `Star` by default) sized in
 * `em`: `style` selects the icon, `size` a type step.
 */

/** The row of stars: one inline line, the stars a hair apart. */
export const computeRatingClasses = (): string =>
  'inline-flex w-fit items-center gap-0.5 leading-none'

/** One star, toned by its `data-state`. */
export const computeRatingItemClasses = (): string =>
  'relative inline-block text-muted-foreground data-[state=on]:text-primary'

/** The earned half laid over a half star's left side. */
export const computeRatingHalfClasses = (): string =>
  'absolute inset-y-0 left-0 w-1/2 overflow-hidden text-primary'

/**
 * One rank of a server-drawn rating input: a star with a transparent native
 * radio laid over it. Nothing repaints it from script, so it is not toned by
 * `data-state`: a rank is earned when its own radio, or a later rank's, is the
 * checked one, and the CSS reads exactly that — so the fill follows a click or
 * an arrow the moment the radio moves. The radio's own ring is invisible, so
 * the rank draws base-nova's focus ring whenever the radio inside it holds
 * keyboard focus.
 */
export const computeRatingRankClasses = (): string =>
  [
    'relative inline-block text-muted-foreground cursor-pointer rounded-sm outline-none',
    'has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50',
    'has-[:checked]:text-primary [&:has(~*_:checked)]:text-primary',
    'has-[:checked]:[&_svg]:fill-current [&:has(~*_:checked)_svg]:fill-current',
  ].join(' ')
