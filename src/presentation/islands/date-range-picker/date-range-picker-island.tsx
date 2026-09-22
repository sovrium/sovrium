/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useMemo } from 'react'
import { computeDateTriggerClasses } from '../date-picker/date-default-classes'
import { formatRange } from '../date-picker/date-format-helpers'
import { RangePanel } from './range-panel'
import { formatInterval } from './range-value'
import { useDateRangeState } from './use-range-state'
import type { ReactElement } from 'react'

/**
 * `date-range-picker` — a period, typed or picked, with the usual presets.
 *
 * ─── WHY NOT `date-picker` WITH `datePickerMode: 'range'` ──────────────────
 *
 * That mode exists and stays: it turns ONE calendar into a two-click selection.
 * A period needs three things that mode does not have and cannot grow without
 * becoming a second component inside the first — two months side by side,
 * presets resolved against the clock, and one value carrying two ends. So the
 * two types sit beside each other and share their CALENDAR (the grid, the
 * tokens, the trigger recipe all come from `date-picker/`), never their shape.
 *
 * ─── ONE VALUE, NOT TWO FIELDS ─────────────────────────────────────────────
 *
 * The submitted value is the ISO 8601 interval `<from>/<to>` in a single hidden
 * input. `periodFrom` + `periodTo` was the alternative: it invents a naming
 * convention every consumer has to know, and it lets a half-submitted period
 * exist, which a period is not. See `range-value.ts`.
 *
 * ─── THE LABEL IS NOT INSIDE THE TRIGGER ───────────────────────────────────
 *
 * A closed trigger reads the period, or the placeholder when there is none, and
 * nothing else. Folding the caption into the button would make its accessible
 * name change every time the reader picked a different period, which is a name
 * that describes the value rather than the control.
 *
 * ─── THE BOX AROUND TRIGGER AND PANEL IS WHAT "INSIDE" MEANS ───────────────
 *
 * A press anywhere outside it shuts the panel; a press on the trigger is left
 * to the trigger's own toggle, so an open panel closes exactly once rather than
 * closing here and re-opening there. `block w-full` for the reason the
 * single-date root carries it: the trigger asks for `w-full`, and a
 * shrink-to-fit parent made that mean the caption's own width rather than the
 * width of the field's column.
 */

interface DateRangePickerIslandProps {
  readonly id?: string
  readonly className?: string
  readonly label?: string
  readonly name?: string
  readonly value?: string
  readonly placeholder?: string
  readonly dateFormat?: string
  readonly minDate?: string
  readonly maxDate?: string
  readonly months?: 1 | 2
  readonly presets?: readonly string[]
}

/** The visible field name, drawn only when there is one. */
function FieldLabel({ label }: { readonly label?: string }): ReactElement | undefined {
  if (label === undefined || label === '') return undefined
  return <span className="text-md block font-medium">{label}</span>
}

/**
 * The one field a period submits: the ISO 8601 interval, under the declared
 * name. Absent when the picker declares no `name`, which is how a display-only
 * period says it is not part of a form.
 */
function SubmittedInterval({
  name,
  value,
}: {
  readonly name?: string
  readonly value: string
}): ReactElement | undefined {
  if (name === undefined || name === '') return undefined
  return (
    <input
      type="hidden"
      name={name}
      value={value}
      readOnly
    />
  )
}

/** The closed control: what the period reads, and the handle that opens it. */
function RangeTrigger({
  id,
  open,
  label,
  onClick,
}: {
  readonly id?: string
  readonly open: boolean
  readonly label: string
  readonly onClick: () => void
}): ReactElement {
  return (
    <button
      type="button"
      id={id}
      data-date-range-trigger
      onClick={onClick}
      aria-haspopup="dialog"
      aria-expanded={open ? 'true' : 'false'}
      className={computeDateTriggerClasses({ state: open ? 'open' : 'default' })}
    >
      {label}
    </button>
  )
}

export default function DateRangePickerIsland({
  id,
  className,
  label,
  name,
  value,
  placeholder,
  dateFormat,
  minDate,
  maxDate,
  months = 2,
  presets,
}: DateRangePickerIslandProps): ReactElement {
  const state = useDateRangeState({ value, minDate, maxDate })
  // A fresh `[]` per render would remount the preset column on every keystroke
  // elsewhere on the page; `react-perf/jsx-no-new-array-as-prop` exists for it.
  const presetList = useMemo(() => presets ?? [], [presets])

  const submitted = formatInterval(state.range)
  const triggerLabel =
    submitted === '' ? (placeholder ?? 'Pick a period') : formatRange(state.range, dateFormat)

  return (
    <div className={className}>
      <FieldLabel label={label} />
      <span
        ref={state.containerRef}
        className="relative block w-full"
      >
        <RangeTrigger
          id={id}
          open={state.open}
          label={triggerLabel}
          onClick={state.toggleOpen}
        />
        {state.open && (
          <RangePanel
            label={label}
            viewMonth={state.viewMonth}
            months={months}
            presets={presetList}
            minDate={state.minDateObj}
            maxDate={state.maxDateObj}
            range={state.range}
            pendingStart={state.pendingStart}
            onDayClick={state.handleDayClick}
            onPresetClick={state.handlePresetClick}
            onShiftMonths={state.shiftMonths}
          />
        )}
      </span>
      <SubmittedInterval
        name={name}
        value={submitted}
      />
    </div>
  )
}
