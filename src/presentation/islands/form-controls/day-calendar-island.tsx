/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useMemo, useState } from 'react'
import { Calendar } from '../parts/day-picker'
import type { CalendarProps } from '../parts/day-picker'
import type { ComponentProps, ReactElement } from 'react'
import type { DateRange, Matcher } from 'react-day-picker'

type Mode = 'single' | 'range' | 'multiple'
type Selection = Date | DateRange | readonly Date[] | undefined

interface DayCalendarIslandProps {
  readonly mode?: Mode
  readonly defaultValue?:
    string | { readonly from: string; readonly to?: string } | readonly string[]
  readonly minDate?: string
  readonly maxDate?: string
  readonly disabled?: {
    readonly before?: string
    readonly after?: string
    readonly daysOfWeek?: readonly number[]
    readonly dates?: readonly string[]
  }
  readonly months?: number
  readonly captionLayout?: 'label' | 'dropdown'
  readonly weekStartsOn?: number
  readonly name?: string
  /** The page language's BCP 47 locale, for the caption and the weekday names. */
  readonly locale?: string
  readonly className?: string
}

/** An ISO day as a local date, so no time zone moves it to the day before. */
const toDate = (iso: string | undefined): Date | undefined => {
  if (iso === undefined) return undefined
  const [year, month, day] = iso.split('-').map(Number)
  return year === undefined || month === undefined || day === undefined
    ? undefined
    : new Date(year, month - 1, day)
}

/** A local date as an ISO day. */
const toIso = (date: Date): string =>
  [
    String(date.getFullYear()),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')

const initialSelection = (mode: Mode, value: DayCalendarIslandProps['defaultValue']): Selection => {
  if (mode === 'range' && typeof value === 'object' && !Array.isArray(value)) {
    const range = value as { readonly from: string; readonly to?: string }
    return { from: toDate(range.from), to: toDate(range.to) }
  }
  if (mode === 'multiple' && Array.isArray(value)) {
    return value.flatMap((iso) => toDate(iso) ?? [])
  }
  return typeof value === 'string' ? toDate(value) : undefined
}

/** The selection as the ISO text a form receives: a day, `from/to`, or days joined by commas. */
const serialize = (selection: Selection): string => {
  if (selection === undefined) return ''
  if (selection instanceof Date) return toIso(selection)
  if (Array.isArray(selection)) return selection.map(toIso).join(',')
  const range = selection as DateRange
  return [range.from, range.to]
    .flatMap((date) => (date === undefined ? [] : [toIso(date)]))
    .join('/')
}

/** The days that cannot be pressed, as react-day-picker matchers. */
const matchersOf = (props: DayCalendarIslandProps): readonly Matcher[] => {
  const before = [props.minDate, props.disabled?.before].flatMap((iso) => toDate(iso) ?? [])
  const after = [props.maxDate, props.disabled?.after].flatMap((iso) => toDate(iso) ?? [])
  return [
    ...before.map((date) => ({ before: date })),
    ...after.map((date) => ({ after: date })),
    ...(props.disabled?.daysOfWeek === undefined
      ? []
      : [{ dayOfWeek: [...props.disabled.daysOfWeek] }]),
    ...(props.disabled?.dates ?? []).flatMap((iso) => toDate(iso) ?? []),
  ]
}

/** The first day of the week the page language uses: Monday in French, Sunday in American English. */
const localeWeekStart = (locale: string): number => {
  const info =
    (
      new Intl.Locale(locale) as Intl.Locale & {
        readonly getWeekInfo?: () => { readonly firstDay: number }
        readonly weekInfo?: { readonly firstDay: number }
      }
    ).getWeekInfo?.() ??
    (new Intl.Locale(locale) as { readonly weekInfo?: { readonly firstDay: number } }).weekInfo
  return info === undefined ? 0 : info.firstDay % 7
}

/** Caption and weekday names in the page language, read from the browser's Intl. */
const localeText = (locale: string): Pick<CalendarProps, 'formatters' | 'labels'> => {
  const caption = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' })
  const weekdayShort = new Intl.DateTimeFormat(locale, { weekday: 'short' })
  const weekdayLong = new Intl.DateTimeFormat(locale, { weekday: 'long' })
  const day = new Intl.DateTimeFormat(locale, { dateStyle: 'full' })
  return {
    formatters: {
      formatCaption: (date: Date) => caption.format(date),
      formatWeekdayName: (date: Date) => weekdayShort.format(date),
    },
    labels: {
      labelWeekday: (date: Date) => weekdayLong.format(date),
      labelDayButton: (date: Date) => day.format(date),
    },
  }
}

/**
 * The weekday row, exposed to assistive technology. react-day-picker hides its
 * `thead` from it, leaving a reader with day numbers and no column names; the
 * row carries each weekday's full name, so it is announced here as the grid's
 * column headers.
 */
const AnnouncedWeekdays = (props: ComponentProps<'tr'>): ReactElement => (
  <thead>
    <tr {...props} />
  </thead>
)

const COMPONENTS = { Weekdays: AnnouncedWeekdays }

/** The next range after a press: a complete range starts over at the day pressed. */
const nextRange = (current: Selection, pressed: Date): DateRange => {
  const range = current as DateRange | undefined
  if (range?.from === undefined || range.to !== undefined) return { from: pressed, to: undefined }
  return pressed < range.from
    ? { from: pressed, to: range.from }
    : { from: range.from, to: pressed }
}

/**
 * `calendar` — a month of days to pick one date, a range or several, drawn
 * through the shared day grid. The selection is mirrored into a hidden input
 * of the calendar's `name`, as ISO text, so a surrounding form submits it.
 */
export default function DayCalendarIsland(props: DayCalendarIslandProps): ReactElement {
  const mode: Mode = props.mode ?? 'single'
  const locale = props.locale ?? 'en-US'
  const [selection, setSelection] = useState<Selection>(() =>
    initialSelection(mode, props.defaultValue)
  )
  const text = useMemo(() => localeText(locale), [locale])
  const shared = {
    ...text,
    numberOfMonths: props.months ?? 1,
    captionLayout: props.captionLayout ?? 'label',
    weekStartsOn: (props.weekStartsOn ?? localeWeekStart(locale)) as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    disabled: [...matchersOf(props)],
    defaultMonth: initialMonth(selection),
    startMonth: toDate(props.minDate),
    endMonth: toDate(props.maxDate),
    className: props.className,
    components: COMPONENTS,
  }
  return (
    <div data-slot="calendar-field">
      {mode === 'range' ? (
        <Calendar
          {...shared}
          mode="range"
          selected={selection as DateRange | undefined}
          onSelect={(_next: DateRange | undefined, pressed: Date) =>
            setSelection((current) => nextRange(current, pressed))
          }
        />
      ) : mode === 'multiple' ? (
        <Calendar
          {...shared}
          mode="multiple"
          selected={selection as Date[] | undefined}
          onSelect={(next: Date[] | undefined) => setSelection(next)}
        />
      ) : (
        <Calendar
          {...shared}
          mode="single"
          selected={selection as Date | undefined}
          onSelect={(next: Date | undefined) => setSelection(next)}
        />
      )}
      {props.name === undefined ? undefined : (
        <input
          type="hidden"
          name={props.name}
          value={serialize(selection)}
        />
      )}
    </div>
  )
}

/** The month a calendar opens on: that of its first selected day, else this month. */
function initialMonth(selection: Selection): Date | undefined {
  if (selection instanceof Date) return selection
  if (Array.isArray(selection)) return selection[0]
  return (selection as DateRange | undefined)?.from
}
