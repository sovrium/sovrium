/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback } from 'react'
import {
  computeDateNavButtonClasses,
  computeDatePopupClasses,
} from '../date-picker/date-default-classes'
import { RangeMonth } from './range-month'
import { PRESET_LABELS } from './range-presets'
import type { DateRange } from '../date-picker/date-format-helpers'
import type { ReactElement } from 'react'

/** What a calendar needs to draw a day and decide whether it can be clicked. */
interface CalendarProps {
  readonly viewMonth: Date
  readonly minDate: Date | undefined
  readonly maxDate: Date | undefined
  readonly range: DateRange | undefined
  readonly pendingStart: Date | undefined
  readonly onDayClick: (day: Date) => void
}

interface RangePanelProps extends CalendarProps {
  readonly label: string | undefined
  readonly months: 1 | 2
  readonly presets: readonly string[]
  readonly onPresetClick: (preset: string) => void
  readonly onShiftMonths: (delta: number) => void
  /**
   * Draw the panel as a still DEPICTION of the open state.
   *
   * The same two withholdings `DatePickerPopup.depicted` makes, for the same
   * reasons — no `role="dialog"` a reader never opened, and no floating
   * position a specimen cell cannot host. The presets, the month nav and the
   * calendars are the component's own.
   */
  readonly depicted?: boolean
}

/**
 * The open panel: a preset column, then one or two months side by side.
 *
 * TWO months is the default because a period that crosses a month boundary is
 * the common case, and paging one calendar back and forth to pick its two ends
 * loses the shape of the selection between the clicks. `months: 1` is the
 * narrow-viewport shape, worth declaring where the panel has to fit a sidebar.
 *
 * An empty `presets` draws no column at all rather than an empty one — omitted
 * and `[]` say the same thing here, unlike `rich-text-editor.toolbar` where the
 * empty array has a second reading (a toolbar-free editor whose slash menu still
 * reaches every action).
 */
export function RangePanel({
  label,
  months,
  presets,
  onPresetClick,
  onShiftMonths,
  depicted = false,
  ...calendar
}: RangePanelProps): ReactElement {
  return (
    <div
      data-date-range-panel
      role={depicted ? undefined : 'dialog'}
      aria-label={depicted ? undefined : (label ?? 'Choose a period')}
      data-specimen-open={depicted ? 'true' : undefined}
      className={computeDatePopupClasses({ depicted })}
    >
      {/* Stacks below `md`. Side by side, the preset column and one calendar
          want more width than a phone has, and the panel is absolutely
          positioned so nothing else would stop them: the popup's own
          `max-w-[calc(100vw-2rem)]` would then clip the calendar instead of the
          author's config choosing per screen. Above `md` the two sit beside
          each other, which is the shape the presets were designed for. */}
      <div className="flex flex-col gap-4 md:flex-row">
        <PresetColumn
          presets={presets}
          onPresetClick={onPresetClick}
        />
        <div>
          <MonthNav onShiftMonths={onShiftMonths} />
          <MonthPair
            months={months}
            {...calendar}
          />
        </div>
      </div>
    </div>
  )
}

/**
 * The named periods down the left of the panel, drawn only when some are
 * declared — an author who offers none gets no column rather than an empty one.
 */
function PresetColumn({
  presets,
  onPresetClick,
}: {
  readonly presets: readonly string[]
  readonly onPresetClick: (preset: string) => void
}): ReactElement | undefined {
  if (presets.length === 0) return undefined
  return (
    <div className="flex flex-col gap-1">
      {presets.map((preset) => (
        <PresetButton
          key={preset}
          preset={preset}
          onClick={onPresetClick}
        />
      ))}
    </div>
  )
}

/**
 * The two arrows that move the view by one month.
 *
 * They move BOTH calendars of a two-month panel, because the pair is one window
 * onto the year: paging the left one independently would let a reader put
 * October beside August and read the gap as a rendering fault.
 */
function MonthNav({
  onShiftMonths,
}: {
  readonly onShiftMonths: (delta: number) => void
}): ReactElement {
  const previous = useCallback(() => onShiftMonths(-1), [onShiftMonths])
  const next = useCallback(() => onShiftMonths(1), [onShiftMonths])
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <button
        type="button"
        aria-label="previous month"
        onClick={previous}
        className={computeDateNavButtonClasses({ direction: 'previous' })}
      >
        ‹
      </button>
      <button
        type="button"
        aria-label="next month"
        onClick={next}
        className={computeDateNavButtonClasses({ direction: 'next' })}
      >
        ›
      </button>
    </div>
  )
}

/**
 * The calendars themselves: the month in view, and — in the default shape — the
 * one after it, derived here rather than held in state so the pair can never
 * drift out of sequence.
 */
function MonthPair({
  months,
  ...calendar
}: CalendarProps & { readonly months: 1 | 2 }): ReactElement {
  const { viewMonth } = calendar
  const secondMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1)
  return (
    <div className="flex gap-4">
      <RangeMonth {...calendar} />
      {months === 2 && (
        // HIDDEN below `md`, not dropped: two calendars do not fit a phone, and
        // an author writes one config for every screen, so `months: 1` cannot
        // be the answer here. Keeping the node in the DOM and hiding it is what
        // lets the same declaration read as two months on a laptop and one on a
        // phone, and it is what the width does — not a prop the author has to
        // guess a viewport for.
        <div className="hidden md:block">
          <RangeMonth
            {...calendar}
            viewMonth={secondMonth}
          />
        </div>
      )}
    </div>
  )
}

function PresetButton({
  preset,
  onClick,
}: {
  readonly preset: string
  readonly onClick: (preset: string) => void
}): ReactElement {
  const handleClick = useCallback(() => onClick(preset), [preset, onClick])
  return (
    <button
      type="button"
      data-date-range-preset={preset}
      onClick={handleClick}
      // `whitespace-nowrap`: a named period is a phrase, and "This month"
      // broken over two rows beside a calendar reads as two presets rather
      // than one. The column is sized by its longest label either way, so
      // nothing is saved by letting them wrap.
      className="text-foreground-muted hover:bg-background-subtle hover:text-foreground rounded px-2 py-1 text-left text-sm whitespace-nowrap"
    >
      {PRESET_LABELS[preset] ?? preset}
    </button>
  )
}
