/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */



import { useState, type ReactElement } from 'react'
import { ObjectConfirmDialog } from '../shared/inline-confirm-dialog'
import type { TableRecord } from '../shared/types'
import type { ActionColumnItem } from '@/domain/models/app/pages/components/data-table'

export type ActionClickHandler = (
  action: ActionColumnItem,
  record: TableRecord
) => void | Promise<void>

function actionTypeAttr(action: ActionColumnItem): string {
  return 'type' in action.action ? action.action.type : action.action.action
}

function ConfirmDialog({
  action,
  record,
  onConfirm,
  onCancel,
}: {
  readonly action: ActionColumnItem
  readonly record: TableRecord
  readonly onConfirm: ActionClickHandler
  readonly onCancel: () => void
}): ReactElement {
  if (action.confirm !== undefined && typeof action.confirm !== 'string') {
    return (
      <ObjectConfirmDialog
        config={action.confirm}
        confirmDataActionType={actionTypeAttr(action)}
        record={record}
        fallbackConfirmLabel={action.label}
        onConfirm={() => {
          onCancel()
          void onConfirm(action, record)
        }}
        onCancel={onCancel}
      />
    )
  }
  const prompt = typeof action.confirm === 'string' ? action.confirm : ''
  return (
    <div
      role="alertdialog"
      aria-modal="false"
      aria-label={prompt}
      className="border-border bg-background-raised flex items-center gap-2 rounded-md border p-2"
    >
      <span className="text-foreground-subtle text-xs">{prompt}</span>
      <button
        type="button"
        data-action-type={actionTypeAttr(action)}
        className="bg-error-bg text-error-fg rounded-md px-2 py-1 text-xs font-medium transition-opacity hover:opacity-90"
        onClick={() => {
          onCancel()
          void onConfirm(action, record)
        }}
      >
        {action.label}
      </button>
      <button
        type="button"
        aria-label="Annuler"
        className="border-border text-foreground-subtle hover:bg-background-subtle rounded-md border px-2 py-1 text-xs transition-colors"
        onClick={onCancel}
      >
        Annuler
      </button>
    </div>
  )
}

function EditSelectEditor({
  action,
  record,
  onCommit,
  onCancel,
}: {
  readonly action: ActionColumnItem
  readonly record: TableRecord
  readonly onCommit: (value: string) => void
  readonly onCancel: () => void
}): ReactElement {
  const editSelect = action.editSelect!
  const [value, setValue] = useState(String(record[editSelect.field] ?? ''))

  return (
    <div className="border-border bg-background-raised flex items-center gap-2 rounded-md border p-2">
      <select
        aria-label={editSelect.label}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="border-border bg-background text-foreground focus:border-primary focus:ring-primary rounded-md border px-2 py-1 text-xs focus:ring-1 focus:outline-none"
      >
        {editSelect.options.map((option) => (
          <option
            key={option.value}
            value={option.value}
          >
            {option.label ?? option.value}
          </option>
        ))}
      </select>
      <button
        type="button"
        data-action-type={actionTypeAttr(action)}
        className="bg-primary text-primary-fg rounded-md px-2 py-1 text-xs font-medium transition-opacity hover:opacity-90"
        onClick={() => onCommit(value)}
      >
        {editSelect.saveLabel ?? 'Enregistrer'}
      </button>
      <button
        type="button"
        aria-label="Annuler"
        className="border-border text-foreground-subtle hover:bg-background-subtle rounded-md border px-2 py-1 text-xs transition-colors"
        onClick={onCancel}
      >
        Annuler
      </button>
    </div>
  )
}

function ActionTriggerButton({
  action,
  record,
  onActionClick,
  onArm,
}: {
  readonly action: ActionColumnItem
  readonly record: TableRecord
  readonly onActionClick?: ActionClickHandler
  readonly onArm: () => void
}): ReactElement {
  const armed = action.editSelect !== undefined || action.confirm !== undefined
  return (
    <button
      type="button"
      className="text-primary hover:bg-primary-subtle rounded px-2 py-1 text-xs disabled:opacity-50"
      data-action-type={actionTypeAttr(action)}
      disabled={!onActionClick}
      onClick={
        onActionClick ? () => (armed ? onArm() : void onActionClick(action, record)) : undefined
      }
    >
      {action.label}
    </button>
  )
}

export function ActionButton({
  action,
  record,
  onActionClick,
}: {
  readonly action: ActionColumnItem
  readonly record: TableRecord
  readonly onActionClick?: ActionClickHandler
}): ReactElement {
  const [confirming, setConfirming] = useState(false)
  const [editing, setEditing] = useState(false)
  const { editSelect } = action

  if (editSelect && editing && onActionClick) {
    return (
      <EditSelectEditor
        action={action}
        record={record}
        onCommit={(value) => {
          setEditing(false)
          void onActionClick(action, { ...record, [editSelect.field]: value })
        }}
        onCancel={() => setEditing(false)}
      />
    )
  }

  if (action.confirm && confirming && onActionClick) {
    return (
      <ConfirmDialog
        action={action}
        record={record}
        onConfirm={onActionClick}
        onCancel={() => setConfirming(false)}
      />
    )
  }

  return (
    <ActionTriggerButton
      action={action}
      record={record}
      onActionClick={onActionClick}
      onArm={() => (editSelect ? setEditing(true) : setConfirming(true))}
    />
  )
}
