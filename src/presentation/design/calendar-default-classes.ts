/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui button-group (https://ui.shadcn.com), registry commit 3464245c4513b7998b1d11fa9c67b71cc1534dc7.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * The event calendar's TOOLBAR, on shadcn/ui's anatomy (base-nova).
 *
 * FullCalendar keeps drawing the grid (its theming is
 * `infrastructure/css/theme/calendar-styles.ts`); its own `headerToolbar` is
 * switched off in `calendar-view.tsx` and this toolbar is drawn above it from
 * shadcn/ui's parts:
 *
 *   - a `button-group` of two outline `icon-sm` buttons, the period arrows
 *     (the button strings are `button-variant-classes.ts`);
 *   - an outline `sm` button, Today;
 *   - the period title;
 *   - a `toggle-group` of outline `sm` items, the views (the toggle strings
 *     are `islands/form-controls/toggle-default-classes.ts`).
 *
 * The SSR skeleton (`island-calendar-component.tsx`) and the loading state
 * draw their bones inside the same row, so the swap does not move a line.
 *
 * ## `sv-calendar-title` is load-bearing, not decorative
 *
 * `data-calendar.spec.ts` reads the period caption through a locator matching
 * `[class*="title"]` among others and takes `.first()`: with FullCalendar's
 * toolbar off, the first remaining match in DOM order would be the weekday
 * row, whose text does not change with the month. A literal class token
 * containing `title`, on an element ahead of the grid, keeps that locator on
 * the caption.
 */

/**
 * The class token the calendar-heading spec locator resolves through. Exported
 * so the SSR skeleton can carry it too.
 */
export const CALENDAR_TITLE_HOOK = 'sv-calendar-title'

/** The toolbar row: arrows, Today, the title, the views. */
export const computeCalendarToolbarClasses = (): string => 'mb-3 flex flex-wrap items-center gap-2'

/**
 * base-nova's `buttonGroupVariants` at the horizontal orientation: the joined
 * edges square off and the second button drops its leading border.
 */
export const computeCalendarNavGroupClasses = (): string =>
  'flex w-fit items-stretch *:focus-visible:relative *:focus-visible:z-10 *:data-slot:rounded-r-none [&>[data-slot]:not(:has(~[data-slot]))]:rounded-r-lg! [&>[data-slot]~[data-slot]]:rounded-l-none [&>[data-slot]~[data-slot]]:border-l-0'

/**
 * The period title: `text-base font-semibold`, claiming the free space and
 * truncating rather than wrapping the row taller. See the module docstring for
 * why {@link CALENDAR_TITLE_HOOK} is here.
 */
export const computeCalendarTitleClasses = (): string =>
  `${CALENDAR_TITLE_HOOK} min-w-0 flex-1 truncate text-center text-base font-semibold text-foreground`

/**
 * The dimmer behind the create-event dialog: base-nova's dialog backdrop
 * (`dialog.tsx`, the `OVERLAY` of `dialog-default-classes.ts`), one layer under
 * the dialog it sits behind. Repeated rather than imported so the calendar
 * island does not pull the dialog recipe module in as a shared chunk; the unit
 * test pins it to the dialog's own tokens.
 */
export const computeCalendarCreateBackdropClasses = (): string =>
  'fixed inset-0 z-40 bg-black/10 supports-backdrop-filter:backdrop-blur-xs'
