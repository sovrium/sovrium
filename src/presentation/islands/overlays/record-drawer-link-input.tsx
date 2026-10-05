/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The editable drawer's control for a single-valued `relationship`: the
 * linked record shown by its `displayField`, a search over the related
 * table's records to pick another one, and — for an optional link — a Clear
 * control, exactly as the form draws the same column.
 *
 * It is the form's picker, not a copy: `useRecordPicker` (the stored key, the
 * label lookup, the search state) and `PickerControl` (the combobox and its
 * popup) are the form's own modules, so the drawer and the form cannot
 * disagree about what a link reads as or which records it offers. Candidates
 * and labels are read through the related table's records API, so its
 * row-level read rule applies: a record the reader may not read is neither
 * offered nor named.
 *
 * The value written is the picked record's KEY; a cleared link writes the
 * empty string, which the drawer's save sends as `null`.
 */

import { useCallback, useId, type ReactElement, type ReactNode } from 'react'
import { computeInputDefaultClasses } from '@/presentation/design/input-default-classes'
import { PickerControl } from '../parts/crud-form/record-picker-chrome'
import { useRecordPicker } from '../parts/crud-form/use-record-picker'
import type { FieldDef } from '../parts/crud-form/field-def'

/** The drawer entry a link control is drawn for — see `RecordDrawerField`. */
export interface DrawerLinkEntry {
  readonly name: string
  readonly relatedTable?: string
  readonly displayField?: string
  readonly required?: boolean
  readonly description?: string
  /** The Clear control's caption and accessible name in the page language; English when absent. */
  readonly clearLabel?: string
  readonly clearName?: string
}

/** What the drawer hands a link entry's control. */
export interface LinkFieldProps {
  readonly field: DrawerLinkEntry
  readonly label: string
  readonly value: string
  readonly disabled: boolean
  readonly onChange: (name: string, value: string) => void
  readonly children?: ReactNode
}

/** The search box's surface: one input (36 px) high, as every drawer control is. */
const PICKER_CLASS = computeInputDefaultClasses()

/** The form's field definition for the same link, as the picker modules read it. */
const toFieldDef = (field: DrawerLinkEntry, label: string): FieldDef => ({
  name: field.name,
  type: 'relationship',
  displayLabel: label,
  ...(field.relatedTable === undefined ? {} : { relatedTable: field.relatedTable }),
  ...(field.displayField === undefined ? {} : { displayField: field.displayField }),
  ...(field.required === true ? { required: true } : {}),
  ...(field.description === undefined ? {} : { description: field.description }),
})

/** The Clear control of an optional link, named after the entry as the form's is. */
function ClearLink(props: {
  readonly field: DrawerLinkEntry
  readonly label: string
  readonly onChange: (name: string, value: string) => void
}): ReactElement {
  const { field, onChange } = props
  const { name } = field
  const onClick = useCallback(() => onChange(name, ''), [name, onChange])
  return (
    <button
      type="button"
      data-component-type="button"
      aria-label={field.clearName ?? `Clear ${props.label}`}
      onClick={onClick}
      className="text-foreground-muted hover:text-foreground self-start text-xs underline"
    >
      {field.clearLabel ?? 'Clear'}
    </button>
  )
}

/**
 * A link entry of an editable drawer: its heading, the picker, the Clear
 * control while an optional link holds a record, and `children` — the
 * entry's guidance line. Inert (a disabled fieldset) until the record loads.
 */
export function LinkField({
  field,
  label,
  value,
  disabled,
  onChange,
  children,
}: LinkFieldProps): ReactElement {
  const inputId = useId()
  const fieldDef = toFieldDef(field, label)
  const picker = useRecordPicker({ field: fieldDef, value, onChange })
  return (
    <fieldset
      disabled={disabled}
      className="text-md flex min-w-0 flex-col gap-1 disabled:opacity-60"
    >
      <label
        htmlFor={inputId}
        className="text-foreground-muted"
      >
        {label}
      </label>
      <PickerControl
        field={fieldDef}
        inputId={inputId}
        picker={picker}
        allowMultiple={false}
        componentType="record-picker"
        controlClassName={PICKER_CLASS}
      />
      {field.required !== true && value.trim() !== '' && (
        <ClearLink
          field={field}
          label={label}
          onChange={onChange}
        />
      )}
      {children}
    </fieldset>
  )
}
