/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The editable drawer's control for a field that is neither a choice nor a
 * single link: the control a form draws for its type, one input (36 px) high —
 * a text box in the page's date format for a date, a number input for a number, a text area for long
 * text, a checkbox for a checkbox, a drop zone for an attachment, an amount
 * box flanked by its currency's sign for a currency, a colour
 * input for a colour, `h:mm` for a duration, a text area for JSON, and a text
 * box for the rest. A rating, a multi-select, a date-time, rich text, code and
 * a multi-valued link are the create form's own controls
 * (`record-drawer-form-control.tsx`).
 *
 * The decisions are the form's own: `fieldWidgetOf` says which control a type
 * takes, `inputComponentTypeOf` what the control is named, and the drop zone
 * uploads as the form's file picker does (`useFileField`), to the column's
 * bucket, holding the stored key the records API takes. Each control holds a string, as every
 * drawer control does (`record-drawer-values.ts`).
 *
 * A refused value — a blank required field of a new record, JSON that does not
 * parse, a field the server refused — marks its control `aria-invalid` and
 * says why under it, the message being the control's accessible description.
 */

import { cn } from '@/presentation/design/class-merge'
import {
  inputComponentTypeOf,
  nativeInputTypeOf,
  numericInputAttributes,
  toDateInputValue,
} from '@/presentation/design/field-control-attributes'
import { fieldWidgetOf } from '@/presentation/design/field-type-behavior'
import { computeInputDefaultClasses } from '@/presentation/design/input-default-classes'
import { RequiredMark } from '../parts/crud-form/field-label'
import { readsAsTrue } from '../runtime/cell-value-semantics'
import { AmountField } from './record-drawer-amount-input'
import { AttachmentField } from './record-drawer-attachment-input'
import { isFormControlEntry } from './record-drawer-choices'
import { controlStateAttributes } from './record-drawer-control-state'
import { DateTextField } from './record-drawer-date-input'
import { FormControl } from './record-drawer-form-control'
import { RefusalLine } from './record-drawer-refusal-line'
import type { DrawerDropZoneWords } from './record-drawer-field'
import type { CurrencyDisplayOptions } from '@/domain/kernel/format/currency-format'
import type { ReactElement, ReactNode } from 'react'

/** The drawer entry a typed control is drawn for — see `RecordDrawerField`. */
export interface DrawerTypedEntry {
  readonly name: string
  readonly type: string
  readonly description?: string
  readonly bucket?: string
  readonly allowedFileTypes?: readonly string[]
  readonly maxFileSize?: number
  readonly dropZone?: DrawerDropZoneWords
  /** A currency field's display: its code, and where its sign sits. */
  readonly currency?: CurrencyDisplayOptions
  readonly required?: boolean
  /** The label carries a visible `*`, hidden from assistive technology. */
  readonly requiredMark?: boolean
  readonly options?: ReadonlyArray<{ readonly value: string; readonly label: string }>
  readonly max?: number
  readonly ratingStyle?: string
  readonly timeZone?: string
  readonly language?: string
  readonly relatedTable?: string
  readonly displayField?: string
  readonly allowMultiple?: boolean
}

/** What the drawer hands a typed entry's control. */
export interface TypedFieldProps {
  readonly field: DrawerTypedEntry
  readonly label: string
  readonly value: string
  readonly disabled: boolean
  readonly onChange: (name: string, value: string) => void
  /** Why the value was refused, drawn under the control; absent when it was not. */
  readonly error?: string | undefined
  readonly children?: ReactNode
}

/** The input component's surface: 36 px high, dimmed while the record loads. */
const CONTROL_CLASS = `${computeInputDefaultClasses()} disabled:cursor-not-allowed disabled:opacity-60`

/** A text area starts one input high and grows with its text, never below it. */
const TEXTAREA_CLASS = cn(CONTROL_CLASS, 'h-auto min-h-20')

/** The native input a box-shaped entry is drawn with, and the value it holds. */
function boxInputOf(
  type: string,
  value: string
): { readonly type: string; readonly value: string } {
  if (type === 'color') return { type: 'color', value: value === '' ? '#000000' : value }
  if (type === 'duration') return { type: 'text', value }
  const native = nativeInputTypeOf(type)
  return { type: native, value: native === 'date' ? toDateInputValue(value) : value }
}

/** A box control: text, email, url, number, date, colour or duration, labelled by its heading. */
function BoxField(props: TypedFieldProps) {
  const { field, label, value, disabled, onChange, children } = props
  const input = boxInputOf(field.type, value)
  return (
    <label className="text-md flex flex-col gap-1">
      <span className="text-muted-foreground">
        {label}
        <RequiredMark marked={field.requiredMark} />
      </span>
      <input
        type={input.type}
        data-component-type={inputComponentTypeOf(input.type)}
        aria-label={label}
        name={field.name}
        value={input.value}
        disabled={disabled}
        onChange={(event) => onChange(field.name, event.target.value)}
        className={input.type === 'color' ? cn(CONTROL_CLASS, 'w-16 p-1') : CONTROL_CLASS}
        {...(input.type === 'number' ? numericInputAttributes({ type: field.type }) : {})}
        {...controlStateAttributes(props)}
      />
      <RefusalLine
        name={field.name}
        error={props.error}
      />
      {children}
    </label>
  )
}

/** Long text, or JSON as indented text: a text area at least one input high. */
function TextAreaField(props: TypedFieldProps) {
  const { field, label, value, disabled, onChange, children } = props
  const json = field.type === 'json'
  return (
    <label className="text-md flex flex-col gap-1">
      <span className="text-muted-foreground">
        {label}
        <RequiredMark marked={field.requiredMark} />
      </span>
      <textarea
        data-component-type="textarea"
        aria-label={label}
        name={field.name}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(field.name, event.target.value)}
        className={json ? cn(TEXTAREA_CLASS, 'font-mono') : TEXTAREA_CLASS}
        {...(json ? { spellCheck: false } : {})}
        {...controlStateAttributes(props)}
      />
      <RefusalLine
        name={field.name}
        error={props.error}
      />
      {children}
    </label>
  )
}

/** A checkbox: ticked as the grid reads the stored value, sent as `true` / `false`. */
function CheckboxField(props: TypedFieldProps) {
  const { field, label, value, disabled, onChange, children } = props
  return (
    <div className="text-md flex flex-col gap-1">
      <label className="text-foreground flex items-center gap-2">
        <input
          type="checkbox"
          data-component-type="checkbox"
          name={field.name}
          checked={readsAsTrue(value)}
          disabled={disabled}
          onChange={(event) => onChange(field.name, String(event.target.checked))}
          className="accent-primary h-4 w-4 disabled:cursor-not-allowed"
          {...controlStateAttributes(props)}
        />
        <span className="text-muted-foreground">
          {label}
          <RequiredMark marked={field.requiredMark} />
        </span>
      </label>
      {children}
    </div>
  )
}

/** The editable drawer's control for a typed field — see the module note. */
export function TypedField(props: TypedFieldProps): ReactElement {
  if (isFormControlEntry(props.field)) return <FormControl {...props} />
  const widget = fieldWidgetOf(props.field.type)
  if (widget === 'textarea' || props.field.type === 'json') return <TextAreaField {...props} />
  if (widget === 'checkbox') return <CheckboxField {...props} />
  if (props.field.type === 'currency') return <AmountField {...props} />
  if (props.field.type === 'date') return <DateTextField {...props} />
  if (widget === 'file-single' || widget === 'file-multiple') return <AttachmentField {...props} />
  return <BoxField {...props} />
}
