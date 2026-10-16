/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The editable drawer's control for a field that is neither a choice nor a
 * single link: the control a form draws for its type, one input (36 px) high —
 * a date picker for a date, a number input for a number, a text area for long
 * text, a checkbox for a checkbox, a file picker for an attachment, a colour
 * input for a colour, `h:mm` for a duration, a text area for JSON, and a text
 * box for the rest. A rating, a multi-select, a date-time, rich text, code and
 * a multi-valued link are the create form's own controls
 * (`record-drawer-form-control.tsx`).
 *
 * The decisions are the form's own: `fieldWidgetOf` says which control a type
 * takes, `inputComponentTypeOf` what the control is named, and the file picker
 * IS the form's (`FileField`), so it uploads to the column's bucket and holds
 * the stored key the records API takes. Each control holds a string, as every
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
import { fieldDescriptionId } from '@/presentation/design/field-display'
import { fieldWidgetOf } from '@/presentation/design/field-type-behavior'
import { computeInputDefaultClasses } from '@/presentation/design/input-default-classes'
import { FileField } from '../parts/crud-form/file-field'
import { readsAsTrue } from '../runtime/cell-value-semantics'
import { isFormControlEntry } from './record-drawer-choices'
import { FormControl } from './record-drawer-form-control'
import type { FieldDef } from '../parts/crud-form/field-def'
import type { ReactElement, ReactNode } from 'react'

/** The drawer entry a typed control is drawn for — see `RecordDrawerField`. */
export interface DrawerTypedEntry {
  readonly name: string
  readonly type: string
  readonly description?: string
  readonly bucket?: string
  readonly allowedFileTypes?: readonly string[]
  readonly maxFileSize?: number
  readonly required?: boolean
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

/** The id of the line saying why an entry's value was refused. */
const errorIdOf = (name: string): string => `${fieldDescriptionId(name)}-error`

/**
 * The state attributes every control carries: required, refused, and the lines
 * describing it — its guidance, then why it was refused.
 */
function stateAttributes(props: TypedFieldProps): Readonly<Record<string, unknown>> {
  const { field, error } = props
  const describedBy = [
    field.description === undefined ? undefined : fieldDescriptionId(field.name),
    error === undefined ? undefined : errorIdOf(field.name),
  ].filter((id): id is string => id !== undefined)
  return {
    ...(field.required === true ? { required: true } : {}),
    ...(error === undefined ? {} : { 'aria-invalid': 'true' }),
    ...(describedBy.length === 0 ? {} : { 'aria-describedby': describedBy.join(' ') }),
  }
}

/** The line saying why the value was refused. */
function RefusalLine({ name, error }: { readonly name: string; readonly error?: string }) {
  if (error === undefined) return undefined
  return (
    <span
      id={errorIdOf(name)}
      className="text-destructive text-sm"
    >
      {error}
    </span>
  )
}

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
      <span className="text-muted-foreground">{label}</span>
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
        {...stateAttributes(props)}
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
      <span className="text-muted-foreground">{label}</span>
      <textarea
        data-component-type="textarea"
        aria-label={label}
        name={field.name}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(field.name, event.target.value)}
        className={json ? cn(TEXTAREA_CLASS, 'font-mono') : TEXTAREA_CLASS}
        {...(json ? { spellCheck: false } : {})}
        {...stateAttributes(props)}
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
          {...stateAttributes(props)}
        />
        <span className="text-muted-foreground">{label}</span>
      </label>
      {children}
    </div>
  )
}

/** The form's field definition for an attachment, as its file picker reads it. */
const toFileFieldDef = (field: DrawerTypedEntry, label: string, disabled: boolean): FieldDef => ({
  name: field.name,
  type: field.type as FieldDef['type'],
  displayLabel: label,
  ...(disabled ? { disabled: true } : {}),
  ...(field.bucket === undefined ? {} : { bucket: field.bucket }),
  ...(field.allowedFileTypes === undefined ? {} : { allowedFileTypes: field.allowedFileTypes }),
  ...(field.maxFileSize === undefined ? {} : { maxFileSize: field.maxFileSize }),
})

/**
 * An attachment: the form's file picker, showing the stored file. It reads its
 * value once, so it is drawn afresh when the record lands (`key`) rather than
 * keeping the empty value it was first drawn with.
 */
function AttachmentField({ field, label, value, disabled, onChange, children }: TypedFieldProps) {
  return (
    <div className="text-md flex flex-col gap-1">
      <FileField
        key={disabled ? 'pending' : 'loaded'}
        field={toFileFieldDef(field, label, disabled)}
        multiple={field.type === 'multiple-attachments'}
        value={value}
        onChange={onChange}
      />
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
  if (widget === 'file-single' || widget === 'file-multiple') return <AttachmentField {...props} />
  return <BoxField {...props} />
}
