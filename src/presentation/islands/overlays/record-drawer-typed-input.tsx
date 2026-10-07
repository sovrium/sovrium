/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The editable drawer's control for a field that is neither a choice nor a
 * link: the control a form draws for its type, one input (36 px) high — a date
 * picker for a date, a number input for a number, a text area for long text,
 * a checkbox for a checkbox, a file picker for an attachment, and a text box
 * for the rest.
 *
 * The decisions are the form's own: `fieldWidgetOf` says which control a type
 * takes, `inputComponentTypeOf` what the control is named, and the file picker
 * IS the form's (`FileField`), so it uploads to the column's bucket and holds
 * the stored key the records API takes. Each control holds a string, as every
 * drawer control does; the save sends it as held.
 */

import { cn } from '@/presentation/design/class-merge'
import {
  inputComponentTypeOf,
  nativeInputTypeOf,
  numericInputAttributes,
  toDateInputValue,
} from '@/presentation/design/field-control-attributes'
import { fieldDescribedBy } from '@/presentation/design/field-display'
import { fieldWidgetOf } from '@/presentation/design/field-type-behavior'
import { computeInputDefaultClasses } from '@/presentation/design/input-default-classes'
import { FileField } from '../parts/crud-form/file-field'
import { readsAsTrue } from '../runtime/cell-value-semantics'
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
}

/** What the drawer hands a typed entry's control. */
export interface TypedFieldProps {
  readonly field: DrawerTypedEntry
  readonly label: string
  readonly value: string
  readonly disabled: boolean
  readonly onChange: (name: string, value: string) => void
  readonly children?: ReactNode
}

/** The input component's surface: 36 px high, dimmed while the record loads. */
const CONTROL_CLASS = `${computeInputDefaultClasses()} disabled:cursor-not-allowed disabled:opacity-60`

/** A text area starts one input high and grows with its text, never below it. */
const TEXTAREA_CLASS = cn(CONTROL_CLASS, 'h-auto min-h-20')

/** The native input a box-shaped widget is drawn with, and the value it holds. */
function boxInputOf(
  type: string,
  value: string
): { readonly type: string; readonly value: string } {
  const widget = fieldWidgetOf(type)
  // A datetime keeps its text box: its value is an instant in the column's zone,
  // which the drawer does not carry, and a wall-clock picker would shift it.
  if (widget === 'datetime') return { type: 'text', value }
  const native = nativeInputTypeOf(type)
  return { type: native, value: native === 'date' ? toDateInputValue(value) : value }
}

/** A box control: text, email, url, number or date, labelled by its heading. */
function BoxField({ field, label, value, disabled, onChange, children }: TypedFieldProps) {
  const input = boxInputOf(field.type, value)
  return (
    <label className="text-md flex flex-col gap-1">
      <span className="text-foreground-muted">{label}</span>
      <input
        type={input.type}
        data-component-type={inputComponentTypeOf(input.type)}
        aria-label={label}
        name={field.name}
        value={input.value}
        disabled={disabled}
        onChange={(event) => onChange(field.name, event.target.value)}
        className={CONTROL_CLASS}
        {...(input.type === 'number' ? numericInputAttributes({ type: field.type }) : {})}
        {...fieldDescribedBy(field)}
      />
      {children}
    </label>
  )
}

/** Long text: a text area at least one input high. */
function TextAreaField({ field, label, value, disabled, onChange, children }: TypedFieldProps) {
  return (
    <label className="text-md flex flex-col gap-1">
      <span className="text-foreground-muted">{label}</span>
      <textarea
        data-component-type="textarea"
        aria-label={label}
        name={field.name}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(field.name, event.target.value)}
        className={TEXTAREA_CLASS}
        {...fieldDescribedBy(field)}
      />
      {children}
    </label>
  )
}

/** A checkbox: ticked as the grid reads the stored value, sent as `true` / `false`. */
function CheckboxField({ field, label, value, disabled, onChange, children }: TypedFieldProps) {
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
          {...fieldDescribedBy(field)}
        />
        <span className="text-foreground-muted">{label}</span>
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
  const widget = fieldWidgetOf(props.field.type)
  if (widget === 'textarea') return <TextAreaField {...props} />
  if (widget === 'checkbox') return <CheckboxField {...props} />
  if (widget === 'file-single' || widget === 'file-multiple') return <AttachmentField {...props} />
  return <BoxField {...props} />
}
