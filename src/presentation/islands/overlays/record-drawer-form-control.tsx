/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The record sheet's controls that ARE the create form's: a rating scale, a
 * checkbox group for a multi-select, a date-and-time input in the field's zone,
 * the rich-text and code editors (each fetched on demand, the way the form
 * fetches them), and the record picker holding several links as chips.
 *
 * The sheet hands the form's dispatcher (`renderField`) a field definition
 * built from its entry, so one column never reads as one control in the form
 * and as another in the sheet. Each control holds a string, as every sheet
 * control does — see `record-drawer-values.ts` for the five that hold something
 * other than the stored text.
 *
 * The two editors read their value when they mount, so they are drawn afresh
 * when the record lands (`key`) rather than keeping the empty value they were
 * first drawn with — the same reason the file picker is.
 */

import { fieldWidgetOf } from '@/presentation/design/field-type-behavior'
import { renderField } from '../parts/crud-form/fields'
import type { TypedFieldProps } from './record-drawer-typed-input'
import type { FieldDef } from '../parts/crud-form/field-def'
import type { ReactElement } from 'react'

/** The entry's own column settings the form's control reads, each only when set. */
const columnSettings = (field: TypedFieldProps['field']): Partial<FieldDef> =>
  Object.fromEntries(
    (
      [
        ['options', field.options],
        ['max', field.max],
        ['ratingStyle', field.ratingStyle],
        ['timeZone', field.timeZone],
        ['language', field.language],
        ['relatedTable', field.relatedTable],
        ['displayField', field.displayField],
        ['allowMultiple', field.allowMultiple === true ? true : undefined],
      ] as const
    ).filter(([, value]) => value !== undefined)
  )

/** The form's field definition for a sheet entry. */
const toFieldDef = (props: TypedFieldProps): FieldDef => ({
  name: props.field.name,
  type: props.field.type as FieldDef['type'],
  displayLabel: props.label,
  ...(props.disabled ? { disabled: true } : {}),
  ...(props.field.required === true ? { required: true } : {}),
  ...columnSettings(props.field),
})

/** A sheet entry drawn with the create form's control for its type. */
export function FormControl(props: TypedFieldProps): ReactElement {
  const { field, label, value, disabled, onChange, children } = props
  const control = renderField({
    field: toFieldDef(props),
    value,
    onChange,
    invalid: props.error !== undefined,
  })
  const widget = fieldWidgetOf(field.type)
  // The code editor draws no caption of its own; its label names it.
  if (widget === 'code') {
    return (
      <label
        key={disabled ? 'pending' : 'loaded'}
        className="text-md flex flex-col gap-1"
      >
        <span className="text-muted-foreground">{label}</span>
        {control}
        {children}
      </label>
    )
  }
  return (
    <div
      key={widget === 'rich-text' && disabled ? 'pending' : 'loaded'}
      className="text-md flex flex-col gap-1"
    >
      {control}
      {children}
    </div>
  )
}
