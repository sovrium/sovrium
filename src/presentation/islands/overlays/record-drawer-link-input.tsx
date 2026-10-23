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
import { ChevronDownGlyph } from '@/presentation/design/control-glyphs'
import { computeInputGroupIconButtonClasses } from '@/presentation/design/input-group-default-classes'
import { computeInputGroupFieldClasses } from '@/presentation/design/input-group-field-classes'
import { computeInputGroupClasses } from '@/presentation/design/input-group-root-classes'
import { useFieldLineIds } from '../parts/crud-form/field-id-scope'
import { RequiredMark } from '../parts/crud-form/field-label'
import { PickerControl } from '../parts/crud-form/record-picker-chrome'
import { useRecordPicker } from '../parts/crud-form/use-record-picker'
import { RefusalLine } from './record-drawer-refusal-line'
import type { FieldDef } from '../parts/crud-form/field-def'

/** The drawer entry a link control is drawn for — see `RecordDrawerField`. */
export interface DrawerLinkEntry {
  readonly name: string
  readonly relatedTable?: string
  readonly displayField?: string
  readonly required?: boolean
  /** The label carries a visible `*`, hidden from assistive technology. */
  readonly requiredMark?: boolean
  readonly description?: string
  /** The Clear control's caption and accessible name in the page language; English when absent. */
  readonly clearLabel?: string
  readonly clearName?: string
  /** The accessible name of the button listing the records, in the page language; English when absent. */
  readonly showOptionsName?: string
}

/** What the drawer hands a link entry's control. */
export interface LinkFieldProps {
  readonly field: DrawerLinkEntry
  readonly label: string
  readonly value: string
  readonly disabled: boolean
  readonly onChange: (name: string, value: string) => void
  /** Why the link was refused — a blank required link, or the server's reason. */
  readonly error?: string | undefined
  readonly children?: ReactNode
}

/** The search box inside its input group, the group carrying the border. */
const PICKER_CLASS = computeInputGroupFieldClasses()

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
      className="text-muted-foreground hover:text-foreground self-start text-xs underline"
    >
      {field.clearLabel ?? 'Clear'}
    </button>
  )
}

/** The picker in shadcn's input group, its button listing the records without typing. */
function LinkPickerGroup({
  field,
  fieldDef,
  label,
  inputId,
  picker,
  error,
}: {
  readonly field: DrawerLinkEntry
  readonly fieldDef: FieldDef
  readonly label: string
  readonly inputId: string
  readonly picker: ReturnType<typeof useRecordPicker>
  readonly error: string | undefined
}): ReactElement {
  const { refusal } = useFieldLineIds(field.name)
  return (
    <span
      data-slot="input-group"
      className={computeInputGroupClasses()}
    >
      <span className="min-w-0 flex-1">
        <PickerControl
          field={fieldDef}
          inputId={inputId}
          picker={picker}
          allowMultiple={false}
          componentType="record-picker"
          controlClassName={PICKER_CLASS}
          {...(error === undefined ? {} : { invalid: true, errorId: refusal })}
        />
      </span>
      <span
        data-slot="input-group-addon"
        data-align="inline-end"
        className="flex items-center pr-1"
      >
        <button
          type="button"
          data-slot="input-group-button"
          aria-label={field.showOptionsName ?? `Show ${label} options`}
          onClick={picker.openPopup}
          className={computeInputGroupIconButtonClasses()}
        >
          <ChevronDownGlyph />
        </button>
      </span>
    </span>
  )
}

/**
 * A link entry of an editable drawer: its heading, the picker in an input
 * group whose button lists the records without typing, the Clear
 * control while an optional link holds a record, and `children` — the
 * entry's guidance line. Inert (a disabled fieldset) until the record loads.
 */
export function LinkField({
  field,
  label,
  value,
  disabled,
  onChange,
  error,
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
        className="text-muted-foreground"
      >
        {label}
        <RequiredMark marked={field.requiredMark} />
      </label>
      <LinkPickerGroup
        field={field}
        fieldDef={fieldDef}
        label={label}
        inputId={inputId}
        picker={picker}
        error={error}
      />
      <RefusalLine
        name={field.name}
        error={error}
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
