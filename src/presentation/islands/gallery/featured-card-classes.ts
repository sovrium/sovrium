/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `featured: first` — the gallery's first card, from md up: two grid columns
 * wide, its cover beside its body on a 1.25 / 1 grid, the body centred on the
 * cover's height. Below md it is an ordinary card, as wide as the others,
 * cover above title.
 */
const FEATURED_LAYOUT_CLASSES = 'md:grid md:grid-cols-[1.25fr_1fr] md:items-center md:gap-1.5'

/**
 * The featured card's own classes: two columns wide, and the cover-and-body
 * grid itself unless a click wraps them. Nothing for an ordinary card.
 */
export const featuredCardClasses = (featured: boolean, clickable: boolean): string => {
  if (!featured) return ''
  return clickable ? ' md:col-span-2' : ` md:col-span-2 ${FEATURED_LAYOUT_CLASSES}`
}

/** The wrapper a clickable featured card adds carries the cover-and-body grid. */
export const FEATURED_WRAPPER_CLASSES = `md:w-full ${FEATURED_LAYOUT_CLASSES}`
