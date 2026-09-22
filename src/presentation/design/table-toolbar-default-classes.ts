/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The bar ABOVE the grid — the toolbar strip and its two button weights, the
 * search field and the way a hit is marked, and the segmented view switcher.
 *
 * One band, three controls, and a single shared constraint: none of them may
 * restate the button recipe. `button-default-classes.ts` already resolves to
 * the design exactly, so every control here COMPOSES it. The one class the
 * active state has to change goes through {@link swapUtility}, not through
 * tailwind-merge, whose 29.4 KB this grid may not put into an island — the
 * measurement behind that is in `table-class-swap.ts`.
 *
 * A toolbar PANEL is a band inside the grid's own frame and lives with the
 * filter and sort chrome in `table-panel-default-classes.ts`; a toolbar MENU
 * floats over the rows and lives in `table-overlay-default-classes.ts`. The
 * line is a question about the element, not about length.
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'
import { computeButtonDefaultClasses } from './button-default-classes'
import { swapUtility } from './table-class-swap'

// ──────────────────────────────────────────────────────────────────────────────
// TOOLBAR — the bar above the grid, and its two button weights
// ──────────────────────────────────────────────────────────────────────────────

// Canvas: `display:flex; flex-wrap:wrap; gap:6px; align-items:center;
// padding:8px; border-bottom:1px solid #e3e3e3; background:#fefefe`.
//
// The bar gains a SURFACE. It shipped transparent, so the toolbar and the
// header row underneath it read as one undivided block of chrome above the
// data; on the raised tone, with a bottom rule, it reads as the grid's own
// control strip.
//
// 8px padding and a 6px gap, down from 12px and 8px. Fourteen controls can be
// switched on at once, and at the old spend the bar was the tallest single
// element on a page whose subject is the rows beneath it.
//
// `flex-wrap` is load-bearing and predates this recipe: with every control on,
// the trailing cluster measured 906px inside a 375px viewport with no scroll,
// so eight controls were silently unreachable on a phone.
const TABLE_TOOLBAR = [
  'flex flex-wrap items-center gap-1.5 p-2',
  'border-b',
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
  `border-[${v('sv-border', T.border)}]`,
].join(' ')

/**
 * Compute the default className for the grid's toolbar.
 *
 * Chrome and flow only. The trailing cluster's own `ml-auto` stays at the call
 * site: which controls hug the right edge is a composition decision of that
 * markup, not of the design.
 */
export const computeTableToolbarClasses = (): string => TABLE_TOOLBAR

/**
 * The resting fill the shared `secondary` variant emits, and the well an active
 * control replaces it with.
 *
 * Named constants rather than inline literals because they are the SWAP's
 * contract: the first has to still be what `button-default-classes.ts` emits,
 * and a test asserts exactly that.
 */
const TOOLBAR_BUTTON_RESTING_BG = `bg-[${v('sv-bg-raised', T.bgRaised)}]`
const TOOLBAR_BUTTON_ACTIVE_BG = `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`

/**
 * Compute the default className for a secondary toolbar control — every button
 * on the bar except `+ New record`.
 *
 * Delegates to the shared button recipe at `secondary` / `sm`, which IS the
 * design's `.btn-sec .btn-sm`: 28px tall, 4px/10px padding, 12px type, raised
 * fill, strong border, a well on hover. What shipped was a hand-written
 * `rounded border px-3 py-1 text-md` that was 32px tall, 14px, and carried no
 * fill at all — so the grid's own controls were a size and a weight apart from
 * every other button the platform draws.
 *
 * `active` marks a control whose panel is OPEN. It lands on the same well the
 * variant already uses for hover, so a pressed control and a hovered one read
 * alike — which is correct: both say "this is the one you are working with".
 * It REPLACES the resting fill rather than being appended to it (see
 * {@link swapUtility}): two `bg-*` classes on one element leave the winner to
 * the stylesheet's emission order, which is not a decision this file makes.
 *
 * `disabled` is a STATE rather than a `disabled:` variant because the shared
 * recipe spends it unconditionally — a caller that renders a disabled control
 * passes the flag rather than appending its own opacity utility.
 */
export const computeTableToolbarButtonClasses = ({
  active = false,
  disabled = false,
}: {
  readonly active?: boolean
  readonly disabled?: boolean
} = {}): string => {
  const base = computeButtonDefaultClasses({
    variant: 'secondary',
    size: 'sm',
    state: disabled ? 'disabled' : 'default',
  })
  return active ? swapUtility(base, TOOLBAR_BUTTON_RESTING_BG, TOOLBAR_BUTTON_ACTIVE_BG) : base
}

/**
 * Compute the default className for the toolbar's ONE primary control —
 * `+ New record` — and for the two panel commits that share its weight.
 *
 * A grid offers a dozen ways to look at records and exactly one way to add one.
 * That asymmetry is what the single filled button says, so the recipe is
 * deliberately not parameterised: a second primary on this bar would spend the
 * emphasis that makes the first one legible.
 */
export const computeTableToolbarPrimaryButtonClasses = (): string =>
  computeButtonDefaultClasses({ variant: 'default', size: 'sm' })

// ──────────────────────────────────────────────────────────────────────────────
// SEARCH — the toolbar's search field, and how a hit is marked
// ──────────────────────────────────────────────────────────────────────────────

// Canvas: a NARROWED `.input` — `height:28px; padding:4px 8px; font-size:12px;
// background:#fefefe; border:1px solid #d3d3d3; radius:4px; max-width:140–200px`.
//
// The cap is the point. The field shipped at `max-w-sm` (384px) and 36px tall,
// so on a bar holding a dozen controls the search box alone took a third of the
// width and pushed the rest onto a second row at desktop sizes. A grid search
// takes a word or two; the box only has to look like it will hold one.
//
// `max-w-[13rem]` (208px) is a LITERAL arbitrary value, not an interpolated
// one, so the source scan reads it whole — the distinction that decides whether
// an arbitrary class reaches the stylesheet at all (see
// {@link computeTableCellCursorClasses}).
const TABLE_SEARCH = [
  'h-7 w-full max-w-[13rem] border px-2 py-1 text-sm',
  `rounded-[${v('radius-base', T.radiusBase)}]`,
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
  `border-[${v('sv-border-strong', T.borderStrong)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
  `placeholder:text-[${v('sv-fg-disabled', T.fgDisabled)}]`,
  `focus:border-[${v('sv-primary', T.primary)}]`,
  `focus:ring-1 focus:ring-[${v('sv-focus-ring', T.focusRing)}] focus:outline-none`,
].join(' ')

/**
 * Compute the default className for the toolbar search field.
 *
 * `w-full` under the cap rather than a fixed width: inside the wrapping toolbar
 * the field shrinks with the row it lands on, which is what keeps it usable at
 * 375px where a fixed 208px would force one more wrap.
 */
export const computeTableSearchClasses = (): string => TABLE_SEARCH

/**
 * Compute the className a matched substring carries inside a searched cell.
 *
 * A WELL, never a yellow highlight. The grid already spends colour on record
 * data — option hues, row fills, status dots — and a chromatic mark laid over
 * that competes with the author's own meaning. The neutral step says "this is
 * why the row is here" without claiming a hue the data may already own.
 */
export const computeTableSearchHitClasses = (): string => `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`

// ──────────────────────────────────────────────────────────────────────────────
// VIEW SWITCHER — grid / kanban / calendar / gallery, as ONE control
// ──────────────────────────────────────────────────────────────────────────────

// Canvas: `display:inline-flex; border:1px solid #d3d3d3; border-radius:4px;
// overflow:hidden`, item `padding:4px 10px; font-size:12px`, active
// `background:#1e1e1e; color:#fafafa`, every item but the first
// `border-left:1px solid #d3d3d3`.
const TABLE_VIEW_SWITCHER = [
  'inline-flex overflow-hidden',
  `rounded-[${v('radius-base', T.radiusBase)}]`,
  'border',
  `border-[${v('sv-border-strong', T.borderStrong)}]`,
].join(' ')

/**
 * Compute the default className for the view-switcher GROUP.
 *
 * ## One segmented control, not four buttons
 * The switcher shipped as four independently bordered buttons separated by a
 * 4px gap, which says four unrelated actions where the truth is one control
 * with four positions — exactly one of which is always active. A segmented
 * control says that structurally: one border around the set, dividers inside
 * it, and no gap for the eye to read as separation.
 *
 * `overflow-hidden` is what lets the items' square corners sit inside the
 * group's rounded ones; without it the active fill paints past the radius at
 * both ends.
 */
export const computeTableViewSwitcherClasses = (): string => TABLE_VIEW_SWITCHER

const TABLE_VIEW_SWITCHER_ITEM = 'px-2.5 py-1 text-sm'

/**
 * Compute the default className for one position of the view switcher.
 *
 * `first` suppresses the leading divider rather than the last one suppressing a
 * trailing rule: N positions need N-1 dividers, and hanging them off the LEFT
 * edge of every item but the first means the group's own border is never
 * doubled at either end.
 *
 * The active position takes the primary fill — the only place in the grid's
 * chrome that does, and the reason it can: a switcher's active position is a
 * statement about what the reader is looking at, which is the same class of
 * claim `+ New record` makes about what they can do.
 */
export const computeTableViewSwitcherItemClasses = ({
  active,
  first = false,
}: {
  readonly active: boolean
  readonly first?: boolean
}): string =>
  [
    TABLE_VIEW_SWITCHER_ITEM,
    first ? '' : `border-l border-[${v('sv-border-strong', T.borderStrong)}]`,
    active
      ? `bg-[${v('sv-primary', T.primary)}] text-[${v('sv-primary-fg', T.primaryFg)}]`
      : `bg-[${v('sv-bg-raised', T.bgRaised)}] text-[${v('sv-fg', T.fg)}] hover:bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  ]
    .filter(Boolean)
    .join(' ')
