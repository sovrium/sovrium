/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Per-row action button for a data-table action column.
 *
 * Extracted from `formatting.tsx` so the action cell can own its per-action
 * confirm state. When an action item carries a `confirm` message it is treated as
 * destructive: the first click swaps the button for an inline `alertdialog`
 * (non-modal — it never inerts the page, the safe plain-`<div>` pattern) whose
 * confirm button re-uses the action's own label; confirming dispatches the
 * action, cancelling restores the button. Without `confirm`, the click dispatches
 * immediately (the original, unchanged behavior). This is the per-row analog of
 * the existing bulk-action confirm gate and the config equivalent of an inline
 * row-level confirm (e.g. the dashboard connections directory's disconnect).
 *
 * When an action item carries an `editSelect` block, the trigger instead reveals
 * an inline single-select EDITOR (a `<select>` named `editSelect.label`, preset to
 * the clicked row's `editSelect.field` value, plus a commit button). On commit the
 * action is dispatched with the PICKED value OVERRIDING `$record.<field>` — so the
 * action body's `$record.<field>` resolves to the selection (the generic config
 * equivalent of the admin "Modifier le rôle → POST /api/auth/admin/set-role"
 * gesture). The dispatch flows through the SAME `onActionClick` row-action handler,
 * so the shipped `executeFetchAction` `$record.*` substitution + `onSuccess.refetch`
 * (the grid re-query) compose unchanged.
 */

/* eslint-disable react-perf/jsx-no-new-function-as-prop -- conventional React event-handler pattern (per-row onClick + confirm-swap toggle closing over the row record); these are presentational cells re-rendered only on row/confirm-state changes, not a hot path. Mirrors the same exemption in formatting.tsx. */

import { useState, type ReactElement } from 'react'
import { ObjectConfirmDialog } from '../shared/inline-confirm-dialog'
import type { TableRecord } from '../shared/types'
import type { ActionColumnItem } from '@/domain/models/app/pages/components/component-types/data/data-table/schema'

/** Per-row action click handler (mirrors `RowActionHandler` in formatting.tsx). */
export type ActionClickHandler = (
  action: ActionColumnItem,
  record: TableRecord
) => void | Promise<void>

/**
 * The interpreter-provided labels an action cell's OWN controls wear: the inline
 * select-editor's commit + dismiss, and the confirm gate's dismiss. Resolved
 * server-side against the app language. The action's own `label` and an
 * `editSelect.saveLabel` are author content and still win where they apply.
 */
export interface ActionControlLabels {
  readonly save: string
  readonly cancel: string
}

/** The `data-action-type` discriminator for an action button (type, or the `action` literal). */
function actionTypeAttr(action: ActionColumnItem): string {
  return 'type' in action.action ? action.action.type : action.action.action
}

/**
 * The inline destructive-confirm gate shown when a `confirm` action is armed.
 *
 * The OBJECT form (separate title / dialog role / type-to-confirm input gated on
 * `$session.email` / label overrides) renders the shared `ObjectConfirmDialog`;
 * the legacy STRING form keeps the byte-identical inline alertdialog below. Both
 * take their dismissal text from `labels.cancel` — server-resolved against the
 * app language, so neither falls back to the shared component's English constant.
 */
function ConfirmDialog({
  action,
  record,
  onConfirm,
  onCancel,
  labels,
}: {
  readonly action: ActionColumnItem
  readonly record: TableRecord
  readonly onConfirm: ActionClickHandler
  readonly onCancel: () => void
  readonly labels: ActionControlLabels
}): ReactElement {
  if (action.confirm !== undefined && typeof action.confirm !== 'string') {
    return (
      <ObjectConfirmDialog
        config={action.confirm}
        confirmDataActionType={actionTypeAttr(action)}
        record={record}
        fallbackConfirmLabel={action.label}
        fallbackCancelLabel={labels.cancel}
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
        aria-label={labels.cancel}
        className="border-border text-foreground-subtle hover:bg-background-subtle rounded-md border px-2 py-1 text-xs transition-colors"
        onClick={onCancel}
      >
        {labels.cancel}
      </button>
    </div>
  )
}

/**
 * The inline single-select EDITOR shown when an `editSelect` action is armed.
 *
 * Renders a `<select>` (accessible name `editSelect.label`) preset to the clicked
 * row's `editSelect.field` value, plus a commit button (the author's
 * `editSelect.saveLabel`, else the interpreter's language-resolved default) and
 * a cancel button. On commit the picked value is handed to
 * `onCommit`, which dispatches the action with the row record's `editSelect.field`
 * OVERRIDDEN by the selection — so the action body's `$record.<field>` resolves to
 * the picked value, not the row's stored value.
 */
function EditSelectEditor({
  action,
  record,
  onCommit,
  onCancel,
  labels,
}: {
  readonly action: ActionColumnItem
  readonly record: TableRecord
  readonly onCommit: (value: string) => void
  readonly onCancel: () => void
  readonly labels: ActionControlLabels
}): ReactElement {
  // Present only when the caller has armed the editor (guarded in ActionButton).
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
        {editSelect.saveLabel ?? labels.save}
      </button>
      <button
        type="button"
        aria-label={labels.cancel}
        className="border-border text-foreground-subtle hover:bg-background-subtle rounded-md border px-2 py-1 text-xs transition-colors"
        onClick={onCancel}
      >
        {labels.cancel}
      </button>
    </div>
  )
}

/**
 * The plain trigger button. Its click either dispatches the action immediately
 * or, when armed, hands off to the inline editor / confirm gate via `onArm`.
 */
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

/**
 * A single per-row action button. An `editSelect`-bearing action reveals an inline
 * single-select editor on the first click; a `confirm`-bearing action arms an
 * inline `alertdialog`; otherwise the action dispatches immediately.
 */
export function ActionButton({
  action,
  record,
  onActionClick,
  labels,
}: {
  readonly action: ActionColumnItem
  readonly record: TableRecord
  readonly onActionClick?: ActionClickHandler
  readonly labels: ActionControlLabels
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
          // Override the edited field with the picked value so the dispatched
          // action's `$record.<field>` resolves to the selection (not the stored
          // row value). The shared row-action handler then runs the action's
          // `onSuccess.refetch` to refresh the grid.
          void onActionClick(action, { ...record, [editSelect.field]: value })
        }}
        onCancel={() => setEditing(false)}
        labels={labels}
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
        labels={labels}
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
