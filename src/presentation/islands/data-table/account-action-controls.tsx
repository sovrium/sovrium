/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The account methods whose value is chosen IN the row, beside their button:
 * a member's role (`setRole` with an `editSelect`) and a passkey's name
 * (`renamePasskey`). Drawn open rather than behind a first click, because the
 * value is the whole gesture — a settings list reads as a form, one per row.
 *
 * The chosen value overrides the row's own (`role`, `name`) in the record the
 * action is dispatched with, the same way an armed `editSelect` does, so the
 * request carries what the reader picked rather than what the server held.
 */

import { useState, type ReactElement } from 'react'
import {
  computeTableActionButtonClasses,
  computeTableInlineConfirmClasses,
  computeTablePanelControlClasses,
} from '@/presentation/design/table-default-classes'
import { useGridString } from './island/grid-strings'
import type { ActionClickHandler } from './action-cell'
import type { TableRecord } from '../runtime/types'
import type { ActionColumnItem } from '@/domain/models/app/pages/components/component-types/data/table/schema'

const NAMED_BUTTON = { type: 'button', 'data-component-type': 'button' } as const

/** The open value control and its button, for one row. */
export function InlineAccountAction({
  action,
  record,
  onActionClick,
}: {
  readonly action: ActionColumnItem
  readonly record: TableRecord
  readonly onActionClick?: ActionClickHandler
}): ReactElement {
  const { editSelect } = action
  const field = editSelect?.field ?? 'name'
  const [value, setValue] = useState(String(record[field] ?? ''))
  const passkeyName = useGridString('datatable.passkeyName', 'Passkey name')
  return (
    <div className={computeTableInlineConfirmClasses()}>
      {editSelect === undefined ? (
        <input
          type="text"
          data-component-type="input"
          aria-label={passkeyName}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className={computeTablePanelControlClasses()}
        />
      ) : (
        <select
          data-component-type="select"
          aria-label={editSelect.label}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className={computeTablePanelControlClasses()}
        >
          {(editSelect.options ?? []).map((option) => (
            <option
              key={option.value}
              value={option.value}
            >
              {option.label ?? option.value}
            </option>
          ))}
        </select>
      )}
      <button
        {...NAMED_BUTTON}
        data-action-type="auth"
        disabled={!onActionClick}
        className={computeTableActionButtonClasses({ disabled: !onActionClick })}
        onClick={() => void onActionClick?.(action, { ...record, [field]: value })}
      >
        {action.label}
      </button>
    </div>
  )
}
