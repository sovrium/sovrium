/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * THE OPEN-SPECIMEN BRIDGE — the popup a still document cannot open, drawn
 * from the island's own components.
 *
 * ─── WHY IT SITS IN `island-ssr/` AND NOT BESIDE ITS CALLERS ────────────────
 *
 * This directory is the ONE place outside `src/presentation/islands/` allowed
 * to import an island module, and the reason it
 * is a directory rather than an allowance on `presentation-rendering` applies
 * here exactly as it does to the field-specimen bridge next door: a static
 * import runs the island's module scope in the SERVER process, so one island
 * touching `window` at module scope becomes a boot crash rather than a
 * client-side error. Confining that hazard to files written knowing about it is
 * the whole point.
 *
 * All three components imported below were checked for it. `DatePickerPopup`,
 * `RangePanel` and `MenuPopupBody` are pure render functions over their props;
 * none reads a browser global at module scope, and none of their transitive
 * imports (the class recipes, the date helpers, `LucideGlyph`) does either.
 *
 * ─── WHY THE ISLAND'S COMPONENTS AND NOT A DRAWING OF THEM ──────────────────
 *
 * `[internal ref]` exists to catch a specimen that documents markup
 * the app never emits. A calendar hand-shaped out of a table and some buttons
 * would look right and teach a reader a structure this app does not ship, so
 * what is rendered here is the same `<DateGrid>` a visitor clicks, the same
 * month-nav buttons, and the same menu rows — reached through each component's
 * `depicted` mode rather than through a second implementation.
 *
 * ─── WHAT A DEPICTION HONESTLY WITHHOLDS ────────────────────────────────────
 *
 * Three things, and each is the one the drawing cannot claim:
 *
 *  - **the dialog role**, because a dialog nobody opened is a second dialog the
 * document advertises (`[internal ref]` asserts its absence);
 *  - **the floating position**, because a specimen cell lays its neighbours out
 *    beside it and an absolutely positioned panel would cover them;
 *  - **every handler**, which costs nothing to withhold: `renderToStaticMarkup`
 *    emits no event wiring in the first place, and the callbacks below are
 *    hoisted no-ops purely to satisfy the components' own prop types.
 *
 * Together those are why `open` is filed in `DEPICTED_STATES` rather than among
 * the rendered ones: the appearance is real markup, the POSITION and the
 * MODALITY are the console's arrangement.
 *
 * ─── A STRING, AND WHY ──────────────────────────────────────────────────────
 *
 * Each function returns markup rather than a `ReactElement`, for the same
 * reason `field-specimen-renderer.ts` does: the callers are component renderers
 * in `presentation-component`, which may not import this directory directly,
 * and `renderToStaticMarkup` is what lets the hop through
 * `presentation/rendering/open-specimen-markup.ts` carry the result. The HTML
 * is produced here from decoded config and never from user input, so the
 * callers emit it with `dangerouslySetInnerHTML` exactly as the field-specimen
 * component already does.
 */

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { parseIso } from '@/presentation/islands/date-picker/date-format-helpers'
import { DatePickerPopup } from '@/presentation/islands/date-picker/date-picker-popup'
import { RangePanel } from '@/presentation/islands/date-range-picker/range-panel'
import { parseInterval } from '@/presentation/islands/date-range-picker/range-value'
import { MenuPopupBody } from '@/presentation/islands/overlays/menu-popup-body'
import type { MenuItem, MenuSurface } from '@/presentation/islands/overlays/menu-item-types'

/**
 * The no-op every handler prop is given.
 *
 * Hoisted to module scope rather than written inline at each call: a fresh
 * arrow per render is what `react-perf/jsx-no-new-function-as-prop` is about,
 * and there is genuinely one no-op here rather than several.
 */
const NOOP = (): void => undefined

/**
 * The month a drawn calendar opens on: the first of the month of whichever date
 * the specimen already names, else of today.
 *
 * The same rule `useDatePickerState` applies when the live popup opens
 * (`minDateObj ?? maxDateObj ?? new Date()`, normalised to the 1st), so a
 * reader comparing the drawing with the control meets the same month.
 */
const viewMonthFor = (anchor: Date | undefined): Date => {
  const base = anchor ?? new Date()
  return new Date(base.getFullYear(), base.getMonth(), 1)
}

/** What a drawn `date-picker` popup needs to know about the specimen it is of. */
export interface OpenDatePickerOptions {
  readonly label?: string
  readonly minDate?: string
  readonly maxDate?: string
  readonly datePickerMode?: 'single' | 'range'
}

/** The open calendar of a `date-picker`, as static markup. */
export const renderOpenDatePickerPopup = (options: OpenDatePickerOptions): string => {
  const minDateObj = parseIso(options.minDate)
  const maxDateObj = parseIso(options.maxDate)
  return renderToStaticMarkup(
    createElement(DatePickerPopup, {
      depicted: true,
      label: options.label,
      viewMonth: viewMonthFor(minDateObj ?? maxDateObj),
      onPrevMonth: NOOP,
      onNextMonth: NOOP,
      minDateObj,
      maxDateObj,
      datePickerMode: options.datePickerMode ?? 'single',
      singleValue: undefined,
      rangeValue: undefined,
      onDayClick: NOOP,
    })
  )
}

/** What a drawn `date-range-picker` panel needs to know. */
export interface OpenDateRangeOptions {
  readonly label?: string
  readonly value?: string
  readonly minDate?: string
  readonly maxDate?: string
  readonly months?: 1 | 2
  readonly presets?: readonly string[]
}

/**
 * The open panel of a `date-range-picker`, as static markup.
 *
 * `value` is honoured rather than dropped: the specimen declares a period, and
 * a panel drawn with its range selected is what distinguishes this cell from a
 * picture of an empty calendar under the label `open`.
 */
export const renderOpenDateRangePanel = (options: OpenDateRangeOptions): string => {
  const range = parseInterval(options.value)
  const minDate = parseIso(options.minDate)
  const maxDate = parseIso(options.maxDate)
  return renderToStaticMarkup(
    createElement(RangePanel, {
      depicted: true,
      label: options.label,
      months: options.months ?? 2,
      presets: options.presets ?? [],
      onPresetClick: NOOP,
      onShiftMonths: NOOP,
      viewMonth: viewMonthFor(range?.from ?? minDate ?? maxDate),
      minDate,
      maxDate,
      range,
      pendingStart: undefined,
      onDayClick: NOOP,
    })
  )
}

/**
 * What a drawn menu popup needs to know.
 *
 * `menuItems` is typed `readonly unknown[]` at this boundary rather than
 * `readonly MenuItem[]`, and that is the honest shape: the caller reads the
 * array off `buildDropdownMenuProps`, which has already run icon resolution and
 * `$t:` substitution over decoded config and types its own output structurally.
 * Naming the island's interface here would also make the island TYPE part of
 * this module's published surface, which every caller would then have to import
 * across a boundary it may not cross.
 */
export interface OpenMenuOptions {
  readonly menuItems: readonly unknown[]
  readonly surface?: MenuSurface
}

/** The open popup of a menu type, as static markup. */
export const renderOpenMenuPopup = (options: OpenMenuOptions): string =>
  renderToStaticMarkup(
    createElement(MenuPopupBody, {
      menuItems: options.menuItems as readonly MenuItem[],
      surface: options.surface ?? 'default',
    })
  )
