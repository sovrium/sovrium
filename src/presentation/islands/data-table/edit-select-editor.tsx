/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The inline select EDITOR a row action with an `editSelect` block opens.
 *
 * Split out of `action-cell.tsx`, which keeps the trigger, the confirm gate and
 * the choice between them.
 */

import { useEffect, useRef, useState, type ReactElement } from 'react'
import {
  computeTableActionButtonClasses,
  computeTableInlineConfirmClasses,
  computeTablePanelCaptionClasses,
  computeTablePanelControlClasses,
} from '@/presentation/design/table-default-classes'
import { useGridString } from './island/grid-strings'
import type { ActionControlLabels } from './action-cell'
import type { TableRecord } from '../runtime/types'
import type { ActionColumnItem } from '@/domain/models/app/pages/components/component-types/data/table/schema'

type EditSelect = NonNullable<ActionColumnItem['editSelect']>
type EditOption = NonNullable<EditSelect['options']>[number]

/** A plain button, named `button` as the page's own button component is. */
const NAMED_BUTTON = { type: 'button', 'data-component-type': 'button' } as const

/**
 * The most rows a list box shows before it scrolls: every option of a short
 * list is in view, and a long one does not push the row it edits off screen.
 */
const LISTBOX_MAX_ROWS = 6

/**
 * The editor's opening value. `multiple` edits a LIST: it opens on every value
 * the row holds, and commits the picked values in option order — an empty pick
 * is the answer "none". Otherwise it opens on the row's one value.
 */
function initialEditValue(editSelect: EditSelect, record: TableRecord): string | readonly string[] {
  const stored = record[editSelect.field]
  if (editSelect.multiple !== true) return String(stored ?? '')
  return (Array.isArray(stored) ? stored : []).map(String)
}

/**
 * Whether a LIST editor opens on a row that does not carry its list — the key
 * absent, which a server sends when it could not read the value. An empty list
 * means "none" and is editable; an absent one is unknown, and a save from it
 * would replace values nobody could see.
 */
const isUnreadList = (editSelect: EditSelect, record: TableRecord): boolean =>
  editSelect.multiple === true && !Array.isArray(record[editSelect.field])

/**
 * The editor's `<select>` — a list box of every option with `multiple`, sized
 * to show them all up to {@link LISTBOX_MAX_ROWS}. Takes focus as it opens: the
 * trigger that was pressed is gone, and focus would otherwise fall to `<body>`.
 */
function EditSelectControl({
  editSelect,
  options,
  value,
  onChange,
}: {
  readonly editSelect: EditSelect
  readonly options: readonly EditOption[]
  readonly value: string | readonly string[]
  readonly onChange: (value: string | readonly string[]) => void
}): ReactElement {
  const multiple = editSelect.multiple === true
  const ref = useRef<HTMLSelectElement>(null)
  useEffect(() => ref.current?.focus(), [])
  return (
    <select
      ref={ref}
      data-component-type="select"
      aria-label={editSelect.label}
      multiple={multiple}
      {...(multiple ? { size: Math.min(options.length, LISTBOX_MAX_ROWS) } : {})}
      value={value as string | string[]}
      onChange={(event) =>
        onChange(
          event.target.multiple
            ? Array.from(event.target.selectedOptions, (option) => option.value)
            : event.target.value
        )
      }
      className={computeTablePanelControlClasses({ multiple })}
    >
      {options.map((option) => (
        <option
          key={option.value}
          value={option.value}
        >
          {option.label ?? option.value}
        </option>
      ))}
    </select>
  )
}

/**
 * Said in place of the control when there is nothing to pick from — an
 * `optionsSource` that resolved to no rows. Generic on purpose: the editor does
 * not know what it edits, only its label.
 */
function NoOptionsHint({ label }: { readonly label: string }): ReactElement {
  const text = useGridString('datatable.rowEditNoOptions', 'No {label} to choose from', { label })
  return <span className={computeTablePanelCaptionClasses()}>{text}</span>
}

/**
 * What the editor can offer: a control to `edit`, an `empty` source with
 * nothing to pick, or an `unread` list whose current value is unknown.
 */
const editorMode = (
  editSelect: EditSelect,
  record: TableRecord,
  options: readonly EditOption[]
): 'edit' | 'empty' | 'unread' => {
  if (isUnreadList(editSelect, record)) return 'unread'
  return options.length === 0 ? 'empty' : 'edit'
}

/** Said in place of the control when the row's current list could not be read. */
function UnreadHint({ label }: { readonly label: string }): ReactElement {
  const text = useGridString(
    'datatable.rowEditUnreadable',
    'The current {label} could not be read',
    {
      label,
    }
  )
  return <span className={computeTablePanelCaptionClasses()}>{text}</span>
}

/** The editor's dismissal — focused when it is the only control the bar holds. */
function CancelButton({
  label,
  onCancel,
  takesFocus,
}: {
  readonly label: string
  readonly onCancel: () => void
  readonly takesFocus: boolean
}): ReactElement {
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (takesFocus) ref.current?.focus()
  }, [takesFocus])
  return (
    <button
      {...NAMED_BUTTON}
      ref={ref}
      aria-label={label}
      className={computeTableActionButtonClasses()}
      onClick={onCancel}
    >
      {label}
    </button>
  )
}

/**
 * The inline select EDITOR shown when an `editSelect` action is armed.
 *
 * Renders a `<select>` (accessible name `editSelect.label`; a multi-select with
 * `editSelect.multiple`) preset to the clicked row's `editSelect.field` value,
 * plus a commit button (the author's `editSelect.saveLabel`, else the
 * interpreter's language-resolved default) and a cancel button. On commit the
 * picked value is handed to `onCommit`, which dispatches the action with the
 * row record's `editSelect.field` OVERRIDDEN by the selection — so the action
 * body's `$record.<field>` resolves to the picked value, not the stored one.
 *
 * `options` is optional since `optionsSource`, but a source is resolved
 * server-side and REPLACED with an array before the grid's props are
 * serialised — so an absent list is the same answer as an empty one. With no
 * options there is nothing to save: the bar says so and offers only
 * Cancel, which takes focus. A LIST editor on a row that does not carry its
 * list at all (the server could not read it) shows no control and a disabled
 * Save, so it can never send an empty list in place of an unknown one; Cancel
 * takes focus there too. Escape dismisses the editor from anywhere in it.
 */
export function EditSelectEditor({
  action,
  dataActionType,
  record,
  onCommit,
  onCancel,
  labels,
}: {
  readonly action: ActionColumnItem
  readonly dataActionType: string
  readonly record: TableRecord
  readonly onCommit: (value: string | readonly string[]) => void
  readonly onCancel: () => void
  readonly labels: ActionControlLabels
}): ReactElement {
  // Present only when the caller has armed the editor (guarded in ActionButton).
  const editSelect = action.editSelect!
  const [value, setValue] = useState(() => initialEditValue(editSelect, record))
  const options = editSelect.options ?? []
  const mode = editorMode(editSelect, record, options)

  return (
    <div
      className={computeTableInlineConfirmClasses()}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onCancel()
      }}
    >
      {mode === 'unread' && <UnreadHint label={editSelect.label} />}
      {mode === 'empty' && <NoOptionsHint label={editSelect.label} />}
      {mode === 'edit' && (
        <EditSelectControl
          editSelect={editSelect}
          options={options}
          value={value}
          onChange={setValue}
        />
      )}
      {mode !== 'empty' && (
        <button
          {...NAMED_BUTTON}
          data-action-type={dataActionType}
          className={computeTableActionButtonClasses({ tone: 'primary' })}
          disabled={mode === 'unread'}
          onClick={() => {
            if (mode === 'edit') onCommit(value)
          }}
        >
          {editSelect.saveLabel ?? labels.save}
        </button>
      )}
      <CancelButton
        label={labels.cancel}
        onCancel={onCancel}
        takesFocus={mode !== 'edit'}
      />
    </div>
  )
}
