/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactElement,
  type Ref,
  type RefObject,
} from 'react'
import { formatPageDate, parsePageDate } from '@/domain/kernel/format/page-date-text'
import { cn } from '@/presentation/design/class-merge'
import { CalendarGlyph } from '@/presentation/design/control-glyphs'
import { computeInputDefaultClasses } from '@/presentation/design/input-default-classes'
import { computeInputGroupIconButtonClasses } from '@/presentation/design/input-group-default-classes'
import { resolvePageLocale } from '../runtime/page-locale'

/**
 * The date picker a form draws for a `date` field: a text box holding the day
 * in the PAGE's date format — `11/30/2026` on an English (US) page,
 * `30/11/2026` on an English (UK) one — and reading what the reader types the
 * same way, with a calendar button inside its end that opens the shared day
 * grid on the held day. shadcn/ui's "date picker with input": the box is an
 * `Input`, the button a ghost icon button laid over its end, so the box's edge
 * lines up with every other control of the form.
 *
 * A native date input would follow the BROWSER's locale instead, and draw the
 * browser's own control rather than the app's. The value is the day as
 * `YYYY-MM-DD`; a day typed that way is read as itself. The box either carries
 * the field's `name` itself (`name`, for a form that sends what it holds), or
 * leaves it to a visually hidden input holding the ISO day (`valueName`, for a
 * form the browser posts and validates).
 */
const DateTextCalendar = lazy(() => import('./date-text-calendar'))

export interface DateTextBoxProps {
  readonly id?: string
  /** The day held, `YYYY-MM-DD` — or the text typed, when it names no day. */
  readonly value: string
  readonly onChange: (day: string) => void
  /** The field's name, carried by the text box itself. */
  readonly name?: string
  /** The field's name, carried by a hidden input holding the ISO day instead. */
  readonly valueName?: string
  readonly valueRef?: Ref<HTMLInputElement>
  readonly required?: boolean
  readonly disabled?: boolean
  readonly readOnly?: boolean
  readonly invalid?: boolean
  readonly describedBy?: string
  readonly placeholder?: string
  /** The box's name when no `<label for>` names it. */
  readonly ariaLabel?: string
  /** The picker's words in the page language, where they differ from English. */
  readonly uiStrings?: Readonly<Record<string, string>> | undefined
}

/**
 * Out of sight and out of the tab order, yet validated and posted by the
 * browser — laid over the box at its size, so the field's named control sits
 * where the field is.
 */
const VISUALLY_HIDDEN: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  margin: 0,
  padding: 0,
  border: 0,
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
}

const BOX_CLASSES = cn(computeInputDefaultClasses(), 'pr-9')
const BUTTON_CLASSES = cn(
  computeInputGroupIconButtonClasses(),
  'absolute top-1/2 right-1 -translate-y-1/2'
)

/**
 * The text the box shows for the held value. The value landing from outside
 * replaces what the box shows; the reader's own typing, which reads as the
 * value already held, does not. A value that arrived in the page's format
 * (typed before the box was live) is handed back as the day it names.
 */
function useDateText(value: string, onChange: (day: string) => void, locale: string) {
  const [text, setText] = useState(() => formatPageDate(value, locale))
  useEffect(() => {
    setText((typed) =>
      parsePageDate(typed, locale) === value ? typed : formatPageDate(value, locale)
    )
    const day = parsePageDate(value, locale)
    if (day !== value) onChange(day)
  }, [value, locale, onChange])
  return [text, setText] as const
}

/** Close the calendar on a press outside the field, while it is open. */
function useCloseOnOutsidePress(
  open: boolean,
  container: RefObject<HTMLElement | null>,
  close: () => void
): void {
  useEffect(() => {
    if (!open) return undefined
    const onPress = (event: PointerEvent): void => {
      if (!(event.target instanceof Node) || container.current?.contains(event.target)) return
      close()
    }
    document.addEventListener('pointerdown', onPress)
    return () => document.removeEventListener('pointerdown', onPress)
  }, [open, container, close])
}

/** The calendar's open state, its pick, and the Escape that closes only it. */
function useCalendar(onPick: (day: string) => void) {
  const [open, setOpen] = useState(false)
  const container = useRef<HTMLSpanElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useCloseOnOutsidePress(open, container, close)
  const pick = useCallback(
    (day: string) => {
      setOpen(false)
      onPick(day)
      button.current?.focus()
    },
    [onPick]
  )
  // Escape closes the calendar, and only the calendar: inside a dialog the key
  // would otherwise close the dialog the form sits in.
  const onKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    setOpen(false)
    button.current?.focus()
  }, [])
  const toggle = useCallback(() => setOpen((was) => !was), [])
  return { open, container, button, pick, onKeyDown, toggle }
}

/** The state attributes the box carries: required, refused, and its guidance. */
function boxState(props: DateTextBoxProps): Readonly<Record<string, unknown>> {
  return {
    ...(props.name === undefined ? {} : { name: props.name }),
    ...(props.required === true && { required: true, 'aria-required': 'true' }),
    ...(props.placeholder !== undefined && { placeholder: props.placeholder }),
    ...(props.readOnly === true && { readOnly: true }),
    ...(props.disabled === true && { disabled: true }),
    ...(props.invalid === true && { 'aria-invalid': 'true' }),
    ...(props.describedBy === undefined ? {} : { 'aria-describedby': props.describedBy }),
    ...(props.ariaLabel === undefined ? {} : { 'aria-label': props.ariaLabel }),
  }
}

/**
 * The hidden input is never typed into — it only mirrors the box — so its own
 * change handler has nothing to do. It is NOT `readOnly`: a read-only input is
 * barred from constraint validation, and a required day must still be one.
 */
const HOLDS_NOTHING_TYPED = (): void => undefined

/** The hidden input carrying the ISO day under the field's name; focusing it focuses the box. */
function HeldDay({
  props,
  box,
}: {
  readonly props: DateTextBoxProps
  readonly box: RefObject<HTMLInputElement | null>
}): ReactElement | undefined {
  if (props.valueName === undefined) return undefined
  return (
    <input
      ref={props.valueRef}
      type="text"
      name={props.valueName}
      value={props.value}
      onChange={HOLDS_NOTHING_TYPED}
      tabIndex={-1}
      aria-hidden="true"
      style={VISUALLY_HIDDEN}
      onFocus={() => box.current?.focus()}
      {...(props.required === true && { required: true })}
      {...(props.disabled === true && { disabled: true })}
    />
  )
}

/** The button inside the box's end that opens the calendar. */
function CalendarButton({
  calendar,
  label,
  locked,
}: {
  readonly calendar: ReturnType<typeof useCalendar>
  readonly label: string
  readonly locked: boolean
}): ReactElement {
  return (
    <button
      ref={calendar.button}
      type="button"
      aria-label={label}
      aria-haspopup="dialog"
      aria-expanded={calendar.open}
      disabled={locked}
      onClick={calendar.toggle}
      className={BUTTON_CLASSES}
    >
      <CalendarGlyph />
    </button>
  )
}

/** The date picker — see the module note. */
export function DateTextBox(props: DateTextBoxProps): ReactElement {
  const { id, value, onChange, uiStrings } = props
  const locale = resolvePageLocale()
  const [text, setText] = useDateText(value, onChange, locale)
  const box = useRef<HTMLInputElement>(null)
  const pickDay = useCallback(
    (day: string) => {
      setText(formatPageDate(day, locale))
      onChange(day)
    },
    [locale, onChange, setText]
  )
  const calendar = useCalendar(pickDay)
  return (
    <span
      ref={calendar.container}
      className="relative block w-full"
      onKeyDown={calendar.open ? calendar.onKeyDown : undefined}
    >
      <input
        ref={box}
        {...(id === undefined ? {} : { id })}
        type="text"
        data-component-type="date-picker"
        value={text}
        autoComplete="off"
        onChange={(event) => {
          setText(event.target.value)
          onChange(parsePageDate(event.target.value, locale))
        }}
        className={BOX_CLASSES}
        {...boxState(props)}
      />
      <CalendarButton
        calendar={calendar}
        label={uiStrings?.['datePicker.pick'] ?? 'Pick a date'}
        locked={props.readOnly === true || props.disabled === true}
      />
      <HeldDay
        props={props}
        box={box}
      />
      {calendar.open && (
        <Suspense fallback={null}>
          <DateTextCalendar
            value={value}
            label={uiStrings?.['datePicker.choose'] ?? 'Choose date'}
            onPick={calendar.pick}
          />
        </Suspense>
      )}
    </span>
  )
}
