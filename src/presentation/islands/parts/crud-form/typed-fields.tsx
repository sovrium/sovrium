/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useId, type ReactElement, type ReactNode } from 'react'
import {
  numericAdornmentOf,
  numericInputAttributes,
  toDateInputValue,
} from '@/presentation/design/field-control-attributes'
import { fieldDescribedBy } from '@/presentation/design/field-display'
import { computeFormFieldLabelClasses } from '@/presentation/design/form-layout-classes'
import {
  fromLocalInputValue,
  LOCAL_ZONE,
  toLocalInputValue,
} from '@/presentation/design/zoned-datetime'
import { RatingScale } from '../rating-scale'
import { CONTROL_CLASS, LABEL_CLASS } from './field-chrome-classes'
import { type FieldDef, labelOf } from './field-def'
import { FieldHelpText } from './field-help-text'
import { FieldShell, PickerControl, ReadOnlyPicker } from './record-picker-chrome'
import { readLinkedIds, writeLinkedIds } from './record-picker-value'
import { useUserPicker } from './use-user-picker'

/**
 * The controls a table-bound form draws for a TYPED column — the same control
 * the data table edits that column with, so one column never reads as a number
 * in the grid and as a text box in the form.
 *
 * Every control here holds a STRING in the form's value map, like every other
 * control does; `wire-values` turns it into the column's own kind of value on
 * the way out.
 */
export interface TypedFieldProps {
  readonly field: FieldDef
  readonly value: string
  readonly onChange: (name: string, value: string) => void
  readonly invalid?: boolean
}

/** One native input carrying the field's shared state attributes. */
function NativeInput(props: {
  readonly field: FieldDef
  readonly type: string
  readonly value: string
  readonly onInput: (raw: string) => void
  readonly invalid?: boolean
  readonly attributes?: Readonly<Record<string, unknown>>
  readonly id?: string
}): ReactElement {
  const { field } = props
  return (
    <input
      type={props.type}
      {...(props.id !== undefined && { id: props.id })}
      name={field.name}
      value={props.value}
      onChange={(e) => props.onInput(e.target.value)}
      className={CONTROL_CLASS}
      {...props.attributes}
      {...(field.required && { required: true, 'data-required': 'true' })}
      {...(field.placeholder && { placeholder: field.placeholder })}
      {...(field.readOnly && { readOnly: true })}
      {...(field.disabled && { disabled: true })}
      {...(props.invalid && { 'aria-invalid': 'true' })}
      {...fieldDescribedBy(field)}
    />
  )
}

/** The label wrapping a control, with the field's help text under it. */
function LabelledControl(props: {
  readonly field: FieldDef
  readonly children: ReactNode
}): ReactElement {
  return (
    <label className={LABEL_CLASS}>
      {labelOf(props.field)}
      {props.children}
      <FieldHelpText field={props.field} />
    </label>
  )
}

/**
 * A `decimal`, `integer`, `currency`, `percentage`, `duration` or `progress`
 * column: a number input stepped by the column's `precision`, bounded by its
 * `min`/`max`, with its currency symbol or percent sign beside it.
 *
 * An adorned control is labelled by `htmlFor` rather than by a wrapping
 * `<label>`: a unit inside the label would become part of the label's text, and
 * the control would answer to "Budget €" instead of "Budget".
 */
export function NumberField({ field, value, onChange, invalid }: TypedFieldProps): ReactElement {
  const inputId = useId()
  const adornment = numericAdornmentOf(field)
  const input = (
    <NativeInput
      field={field}
      type="number"
      value={value}
      onInput={(raw) => onChange(field.name, raw)}
      attributes={numericInputAttributes(field)}
      id={inputId}
      {...(invalid !== undefined && { invalid })}
    />
  )
  if (adornment === undefined) return <LabelledControl field={field}>{input}</LabelledControl>
  const unit = <span className="text-foreground-muted text-sm">{adornment.text}</span>
  return (
    <FieldShell
      field={field}
      inputId={inputId}
    >
      <div className="flex items-center gap-2">
        {adornment.position === 'before' && unit}
        {input}
        {adornment.position === 'after' && unit}
      </div>
    </FieldShell>
  )
}

/** A `date` column: a native date input holding the ISO calendar date. */
export function DateField({ field, value, onChange, invalid }: TypedFieldProps): ReactElement {
  return (
    <LabelledControl field={field}>
      <NativeInput
        field={field}
        type="date"
        value={toDateInputValue(value)}
        onInput={(raw) => onChange(field.name, raw)}
        {...(invalid !== undefined && { invalid })}
      />
    </LabelledControl>
  )
}

/**
 * A `datetime` column: a date-and-time input showing the wall-clock reading in
 * the column's `timeZone`, and holding the ISO instant that reading means — the
 * same conversion the data table's cell editor makes.
 */
export function DateTimeField({ field, value, onChange, invalid }: TypedFieldProps): ReactElement {
  const zone = field.timeZone ?? LOCAL_ZONE
  return (
    <LabelledControl field={field}>
      <NativeInput
        field={field}
        type="datetime-local"
        value={toLocalInputValue(value, zone)}
        onInput={(raw) => onChange(field.name, fromLocalInputValue(raw, zone) ?? '')}
        {...(invalid !== undefined && { invalid })}
      />
    </LabelledControl>
  )
}

/**
 * A `rating` column: the rating scale the data table's cell draws, one radio per
 * rank up to the column's `max`. Choosing the current rank clears the field.
 */
export function RatingField({ field, value, onChange }: TypedFieldProps): ReactElement {
  const locked = field.readOnly === true || field.disabled === true
  return (
    <div className={LABEL_CLASS}>
      <span>{labelOf(field)}</span>
      <RatingScale
        value={value}
        label={labelOf(field)}
        commit={(next) => {
          if (!locked) onChange(field.name, next === null ? '' : String(next))
        }}
        {...(field.max !== undefined && { max: field.max })}
        {...(field.ratingStyle !== undefined && { style: field.ratingStyle })}
      />
      <FieldHelpText field={field} />
    </div>
  )
}

/**
 * A `multi-select` column: one checkbox per declared option, grouped under the
 * field's label. The ticked options travel JSON-encoded in the form's value map,
 * as a multi-valued relationship's links do, and are sent as a list.
 */
export function MultiSelectField({ field, value, onChange }: TypedFieldProps): ReactElement {
  const selected = readLinkedIds(value, true)
  const toggle = (option: string): void => {
    const next = selected.includes(option)
      ? selected.filter((entry) => entry !== option)
      : [...selected, option]
    onChange(field.name, writeLinkedIds(next, true))
  }
  return (
    <fieldset
      className={LABEL_CLASS}
      {...fieldDescribedBy(field)}
      {...(field.disabled && { disabled: true })}
    >
      <legend className={computeFormFieldLabelClasses()}>{labelOf(field)}</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {(field.options ?? []).map((option) => (
          <label
            key={option.value}
            className="text-foreground flex items-center gap-2 text-sm font-medium"
          >
            <input
              type="checkbox"
              checked={selected.includes(option.value)}
              onChange={() => toggle(option.value)}
              className="accent-primary h-4 w-4"
              {...(field.readOnly && { readOnly: true, disabled: true })}
            />
            {option.label}
          </label>
        ))}
      </div>
      <FieldHelpText field={field} />
    </fieldset>
  )
}

/**
 * A `user` column: a people picker that searches the account directory by name
 * and holds the id of the account picked — the relationship picker's combobox,
 * fed by the directory the data table's user editor reads.
 */
export function UserPickerField({
  field,
  value,
  onChange,
  invalid,
}: TypedFieldProps): ReactElement {
  const inputId = useId()
  const picker = useUserPicker({ field, value, onChange })
  if (field.readOnly === true || field.disabled === true) {
    return (
      <ReadOnlyPicker
        field={field}
        inputId={inputId}
        display={picker.linkedIds.map(picker.labelOfId).join(', ')}
      />
    )
  }
  return (
    <FieldShell
      field={field}
      inputId={inputId}
    >
      <PickerControl
        field={field}
        inputId={inputId}
        picker={picker}
        allowMultiple={false}
        {...(invalid !== undefined && { invalid })}
      />
    </FieldShell>
  )
}
