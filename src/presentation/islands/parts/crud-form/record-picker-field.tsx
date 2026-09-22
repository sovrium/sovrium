/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useId } from 'react'
import { type FieldDef } from './field-def'
import {
  FieldShell,
  LinkCount,
  LinkedChips,
  PickerControl,
  ReadOnlyPicker,
} from './record-picker-chrome'
import { useRecordPicker } from './use-record-picker'
import type { ReactElement } from 'react'

/**
 * The FORM's control for a `relationship` column.
 *
 * Until [internal ref] this widget rendered `renderTypedInputField(args, 'text')` — a
 * free-text box asking for a raw foreign key. Measured live: typing a company
 * NAME into it posted that string as the key and 500'd on the column's CHECK.
 * The grid's cell editor had had a real picker for the same column all along,
 * so one control had two behaviours depending on which surface bound it.
 *
 * This is deliberately NOT the grid's `FetchingPicker`. That component is a
 * cell EDITOR: it lives in a popover, commits through the grid's write queue,
 * and carries Tab-to-next-cell and Escape-to-revert semantics that a form field
 * has no use for. What the two genuinely share — the candidate query, the
 * listbox, the search state — they now share as modules (`record-candidates`,
 * `OptionListbox`, `useCandidateSearch`) rather than by one pretending to be
 * the other.
 *
 * Inline CREATE (`allowCreate`) is not offered here. It is live on the grid,
 * where its permission gate is resolved and its refusal path is specced; this
 * surface has neither yet, and an ungated create affordance is exactly the
 * enumeration leak the gate exists to prevent.
 */

interface RecordPickerFieldProps {
  readonly field: FieldDef
  readonly value: string
  readonly onChange: (name: string, value: string) => void
  readonly invalid?: boolean
}

export function RecordPickerField({
  field,
  value,
  onChange,
  invalid,
}: RecordPickerFieldProps): ReactElement {
  const inputId = useId()
  const picker = useRecordPicker({ field, value, onChange })
  const { linkedIds, labelOfId } = picker
  const allowMultiple = field.allowMultiple === true

  if (field.readOnly === true || field.disabled === true) {
    return (
      <ReadOnlyPicker
        field={field}
        inputId={inputId}
        display={linkedIds.map(labelOfId).join(', ')}
      />
    )
  }

  return (
    <FieldShell
      field={field}
      inputId={inputId}
    >
      {allowMultiple && linkedIds.length > 0 && (
        <LinkedChips
          ids={linkedIds}
          labelOfId={labelOfId}
          onRemove={picker.remove}
        />
      )}
      <PickerControl
        field={field}
        inputId={inputId}
        picker={picker}
        allowMultiple={allowMultiple}
        {...(invalid !== undefined && { invalid })}
      />
      {field.maxLinked !== undefined && (
        <LinkCount
          linked={linkedIds.length}
          maxLinked={field.maxLinked}
        />
      )}
    </FieldShell>
  )
}
