/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prestyled-by-default class computer for the Sovrium calendar TOOLBAR
 * (wave R-D, [internal ref]).
 *
 * FullCalendar's own `headerToolbar` is switched off in `calendar-view.tsx` and
 * this toolbar is rendered above the grid instead, driving the calendar through
 * `getApi().prev() / .next() / .today() / .changeView(...)`. The grid itself
 * stays FullCalendar's — see `infrastructure/css/theme/calendar-styles.ts` for
 * why its DOM is a spec contract and is themed from the outside.
 *
 * Swapping the toolbar rather than theming it is what the canvas asks for
 * (`spec-data.mjs` `calToolbar`): a joined `‹ ›` nav pair, a small secondary
 * `today` button, a centred title, and a joined `month | week | day` segmented
 * trio. FullCalendar's toolbar is a row of six identically-shaped buttons whose
 * chrome comes from a `--fc-button-*` family with no Sovrium analogue — a
 * filled `#2c3e50` slab with its own hover and active fills. Bridging that
 * family would have meant inventing four token roles to describe a control we
 * do not draw anywhere else in the product.
 *
 * ## Parts
 *
 *   - TOOLBAR        — the row itself: nav pair, today button, title, segmented
 *   - NAV GROUP      — the joined `‹ ›` pair's bordered shell
 *   - NAV BUTTON     — one arrow inside that shell; `divider` draws the 1px
 *                      hairline that separates the pair
 *   - TITLE          — the centred period caption; carries the `sv-calendar-title`
 *                      hook (see below)
 *   - SEGMENTED      — the joined `month | week | day` trio's bordered shell
 *   - SEGMENTED ITEM — one view button inside that shell; `active` flips it to
 *                      the `primary` fill, `divider` draws the separator
 *
 * The `today` button is NOT a part here: it is a plain `sm` `secondary` from
 * `button-default-classes.ts`, which is exactly what the canvas draws, and
 * minting a seventh button recipe for it would fork the button vocabulary.
 * `SIZE_CLASS_DEFAULT.sm` there is `h-7 px-2.5 py-1 text-sm`, which is why the
 * two groups below are `h-7` with `px-2.5 text-sm` items — all three controls
 * then sit on one 28px row with one type step and one horizontal rhythm.
 *
 * ## `sv-calendar-title` is load-bearing, not decorative
 *
 * `data-calendar.spec.ts` reads the period caption through
 * `'[data-component="calendar"] [class*="header"], [data-component="calendar"] h2,
 * [data-component="calendar"] [class*="title"]'` and `.first()`, then asserts the
 * text CHANGES after clicking next. Today that resolves to FullCalendar's
 * `.fc-toolbar-title`; with `headerToolbar={false}` that element no longer
 * exists, and the first remaining match in DOM order would be `.fc-col-header`
 * — the weekday row, whose text does not change when the month does, so the
 * assertion would fail on a correct implementation. A literal class token
 * containing `title`, on an element that precedes the grid, is what keeps that
 * locator resolving to the right node.
 *
 * ## Accessible names are a spec contract
 *
 * The nav buttons render `‹` / `›` as their text and carry `aria-label`s whose
 * text still satisfies `/next|forward|›/i`; the three segmented items are real
 * `<button>`s named exactly `month`, `week`, `day`, with NO `aria-label`,
 * because `data-calendar.spec.ts` matches them with `/^(week|day)$/i` — an
 * anchored regex that an `aria-label` of "Week view" would break. The anchoring
 * is also what keeps `today` out of that match, which is the reason the spec
 * carries a comment saying so.
 *
 * ## Why it lives in `presentation/utils/recipes`
 *
 * Two reasons, and only the second is about layers. `eslint-plugin-boundaries`
 * forbids an island importing from `ui/sections` and vice versa, and the
 * calendar is drawn on both sides (the hydrated island and the SSR skeleton in
 * `island-calendar-component.tsx`), so a recipe both need can only live here —
 * the same reasoning as `button-default-classes.ts` next door. And this
 * directory is registered in `RECIPE_DIRS`
 * (`src/infrastructure/css/arbitrary-var-safelist.ts`), which scans every
 * `*-default-classes.ts` for `v('sv-X', T.Y)` template literals and emits them
 * to the compiler's `@source inline(...)` safelist. The compiler does not scan
 * source for class names, so a recipe outside a `RECIPE_DIR` produces arbitrary
 * classes that read correctly, typecheck, lint clean — and paint nothing.
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'

// ──────────────────────────────────────────────────────────────────────────────
// Shared building blocks
// ──────────────────────────────────────────────────────────────────────────────

/**
 * The class token the calendar-heading spec locator resolves through. Exported
 * so the SSR skeleton can carry it too — a skeleton that omits it would move
 * the `.first()` match to the grid for as long as hydration takes.
 */
export const CALENDAR_TITLE_HOOK = 'sv-calendar-title'

/**
 * Focus ring, matching `button-default-classes.ts` verbatim rather than
 * importing it: that module keeps its `FOCUS_CLASS` private, and a shared
 * export would have to live in `islands/recipes/`, which `presentation/utils`
 * may not import. Copied deliberately, with this note, so the duplication is
 * legible rather than accidental.
 */
const FOCUS_CLASS = [
  'focus-visible:outline-none',
  'focus-visible:ring-2',
  'focus-visible:ring-offset-2',
  `focus-visible:ring-[${v('sv-focus-ring', T.focusRing)}]`,
  `focus-visible:ring-offset-[${v('sv-bg', T.bg)}]`,
].join(' ')

/**
 * The shell both joined groups share: a `hair-strong` hairline on the base
 * radius, clipping its children so the first and last item's corners follow the
 * shell's rather than squaring off inside it.
 *
 * `h-7` matches the `sm` button so the three controls read as one row.
 */
const JOINED_GROUP = [
  'inline-flex h-7 items-center overflow-hidden',
  `rounded-[${v('radius-base', T.radiusBase)}]`,
  'border',
  `border-[${v('sv-border-strong', T.borderStrong)}]`,
].join(' ')

/**
 * The 1px rule between two joined items. It is a LEADING border on every item
 * but the first, never a trailing one on every item but the last: a trailing
 * rule on the last item is clipped by the shell's `overflow-hidden` on some
 * sub-pixel widths and reappears on others, which reads as a flickering divider
 * at certain zoom levels.
 */
const JOINED_DIVIDER = `border-l border-[${v('sv-border-strong', T.borderStrong)}]`

/** Geometry shared by every item inside a joined group. */
const JOINED_ITEM = [
  'inline-flex h-full items-center justify-center',
  'px-2.5 text-sm leading-none whitespace-nowrap select-none',
  'cursor-pointer transition-colors',
].join(' ')

/** The resting tone for an unselected item in either joined group. */
const JOINED_ITEM_RESTING = [
  `text-[${v('sv-fg-muted', T.fgMuted)}]`,
  `hover:bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `hover:text-[${v('sv-fg', T.fg)}]`,
].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// TOOLBAR (the row)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute the default className for the toolbar row.
 *
 * Canvas: `flex`, `items-center`, 8px gap. The bottom margin is not on the
 * canvas drawing and is added here because the drawing has no grid beneath it
 * to collide with — without it the segmented trio's hairline sits flush against
 * the scrollgrid frame and the two read as one doubled rule.
 */
export const computeCalendarToolbarClasses = (): string => 'mb-2 flex items-center gap-2'

// ──────────────────────────────────────────────────────────────────────────────
// NAV GROUP + NAV BUTTON (the joined `‹ ›` pair)
// ──────────────────────────────────────────────────────────────────────────────

/** Compute the default className for the joined previous/next shell. */
export const computeCalendarNavGroupClasses = (): string => JOINED_GROUP

/**
 * Compute the default className for one arrow inside the nav shell.
 *
 * `divider` draws the leading hairline and is passed on the `next` button only.
 * The arrow glyphs are narrower than a word, so the canvas' 9px inset would
 * leave a cramped pair; `px-2.5` (10px) is the ladder rung nearest it and the
 * one the `sm` button already uses.
 */
export const computeCalendarNavButtonClasses = ({
  divider = false,
}: { readonly divider?: boolean } = {}): string =>
  [JOINED_ITEM, JOINED_ITEM_RESTING, divider ? JOINED_DIVIDER : '', FOCUS_CLASS]
    .filter(Boolean)
    .join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// TITLE (the centred period caption)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute the default className for the period caption.
 *
 * Canvas: `flex:1`, centred, 14px / 600 — `text-md` is exactly 14/22 on the
 * platform ladder. `truncate` matters on a narrow viewport: a month name plus a
 * year in a `flex-1` box with two joined groups either side wraps to a second
 * line and shoves the whole toolbar 18px taller.
 *
 * See the module docstring for why {@link CALENDAR_TITLE_HOOK} is here.
 */
export const computeCalendarTitleClasses = (): string =>
  [
    CALENDAR_TITLE_HOOK,
    'min-w-0 flex-1 truncate text-center text-md font-semibold',
    `text-[${v('sv-fg', T.fg)}]`,
  ].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// SEGMENTED + SEGMENTED ITEM (the joined `month | week | day` trio)
// ──────────────────────────────────────────────────────────────────────────────

/** Compute the default className for the joined view-switch shell. */
export const computeCalendarSegmentedClasses = (): string => JOINED_GROUP

/**
 * Compute the default className for one view button inside the segmented shell.
 *
 * `active` flips the item to the `primary` fill with `primary-fg` text, which
 * is the canvas' only state distinction here. The selected item deliberately
 * keeps NO hover change: a control that is already at full `primary` has
 * nowhere brighter to go, and re-applying the resting hover would lighten the
 * one item that is supposed to look pressed.
 */
export const computeCalendarSegmentedItemClasses = ({
  active = false,
  divider = false,
}: { readonly active?: boolean; readonly divider?: boolean } = {}): string =>
  [
    JOINED_ITEM,
    active
      ? `bg-[${v('sv-primary', T.primary)}] text-[${v('sv-primary-fg', T.primaryFg)}]`
      : JOINED_ITEM_RESTING,
    divider ? JOINED_DIVIDER : '',
    FOCUS_CLASS,
  ]
    .filter(Boolean)
    .join(' ')
