/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The ONE card recipe of the operator console.
//
// A card on a console page is shadcn's Card (base-nova): the `card` ground and
// foreground, `rounded-xl`, a one-pixel `ring-foreground/10` hairline instead of
// a border, and the 16px `--card-spacing` rhythm. Where a page can declare the
// engine's `card` type it does (the dashboard-01 section cards, the facts card),
// and the engine paints exactly this. Where it cannot — a frame that hosts an
// island, a `section` landmark, a list whose rows are flush to the edge — the
// container is dressed with the same surface here, so the two read as one card.
//
// It replaced six hand-made frames (`border-border bg-card rounded-lg border`
// with a padding each page chose) that looked like cards without being shadcn's.
// Deliberately NOT a `design.components` entry: that key restyles an ENGINE type
// by name, and these are containers.

/** The card surface alone: ground, foreground, radius, hairline. No layout. */
export const CARD_SURFACE =
  'bg-card text-card-foreground overflow-hidden rounded-xl ring-1 ring-foreground/10'

/** A padded card: the surface, a column, the card's 16px spacing. */
export const CARD_CLASS = `${CARD_SURFACE} flex flex-col gap-3 p-4`

/** A card whose rows run edge to edge, ruled between them. */
export const CARD_LIST_CLASS = `${CARD_SURFACE} divide-border divide-y`

// A card heading is an `h2`: the page title above it is the `h1`, and skipping
// to `h3` is a WCAG 1.3.1 structure failure however the heading looks.

/** The body column every account surface centres its cards in. */
export const ACCOUNT_COLUMN = 'flex max-w-3xl flex-col gap-6'
