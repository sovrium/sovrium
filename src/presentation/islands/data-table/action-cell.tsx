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

import { useState, type ReactElement } from 'react'
import { substituteRecordVars } from '@/domain/models/app/pages/substitute-record-vars'
import {
  computeTableActionButtonClasses,
  computeTableInlineConfirmClasses,
  computeTablePanelCaptionClasses,
} from '@/presentation/design/table-default-classes'
import { ObjectConfirmDialog } from '../runtime/inline-confirm-dialog'
import { InlineAccountAction } from './account-action-controls'
import { isInlineAccountAction } from './account-action-kind'
import { useArmedConfirm } from './armed-confirm'
import { EditSelectEditor } from './edit-select-editor'
import { claimTriggerFocus, requestTriggerFocus } from './trigger-focus'
import type { TableRecord } from '../runtime/types'
import type { ActionColumnItem } from '@/domain/models/app/pages/components/component-types/data/table/schema'

/** A plain button, named `button` as the page's own button component is. */
const NAMED_BUTTON = { type: 'button', 'data-component-type': 'button' } as const

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
 * Both fill `$record.*` from the row the gate was armed for, as text, never markup.
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
  const prompt = substituteRecordVars(action.confirm ?? '', record)
  return (
    <div
      role="alertdialog"
      aria-modal="false"
      aria-label={prompt}
      className={computeTableInlineConfirmClasses()}
    >
      <span className={computeTablePanelCaptionClasses()}>{prompt}</span>
      <button
        {...NAMED_BUTTON}
        data-action-type={actionTypeAttr(action)}
        className={computeTableActionButtonClasses({ tone: 'destructive' })}
        onClick={() => {
          onCancel()
          void onConfirm(action, record)
        }}
      >
        {action.label}
      </button>
      <button
        {...NAMED_BUTTON}
        aria-label={labels.cancel}
        className={computeTableActionButtonClasses()}
        onClick={onCancel}
      >
        {labels.cancel}
      </button>
    </div>
  )
}

/**
 * The recipe tone an authored `variant` asks for.
 *
 * An UNNAMED variant returns `undefined` so the recipe applies its own default
 * rather than being told what that default is — which is what makes omission and
 * an explicit `secondary` reach the same class string, and what keeps the two
 * from drifting the day the default moves. Only the TRIGGER is toned: the
 * confirm and commit buttons inside an armed action answer to the gate's own
 * weight, not to the affordance that opened it.
 */
function triggerTone(
  variant: ActionColumnItem['variant']
): 'primary' | 'ghost' | 'destructive' | undefined {
  if (variant === 'default') return 'primary'
  if (variant === 'ghost') return 'ghost'
  if (variant === 'destructive') return 'destructive'
  return undefined
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
  focusKey,
}: {
  readonly action: ActionColumnItem
  readonly record: TableRecord
  readonly onActionClick?: ActionClickHandler
  readonly onArm: () => void
  /** The key focus returns to this trigger by after its editor closes. */
  readonly focusKey: string
}): ReactElement {
  // A role or a passkey name is chosen in the row itself, beside its button.
  if (isInlineAccountAction(action)) {
    return (
      <InlineAccountAction
        action={action}
        record={record}
        onActionClick={onActionClick}
      />
    )
  }
  const armed = action.editSelect !== undefined || action.confirm !== undefined
  const tone = triggerTone(action.variant)
  return (
    <button
      {...NAMED_BUTTON}
      ref={(node) => claimTriggerFocus(focusKey, node)}
      className={computeTableActionButtonClasses({
        disabled: !onActionClick,
        ...(tone === undefined ? {} : { tone }),
      })}
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
 *
 * The armed CONFIRM is held by `confirmKey` in the grid-level store rather than
 * here, because this component is destroyed and rebuilt whenever the island
 * re-renders — see `armed-confirm.ts` for why that is structural. The inline
 * editor's `editing` stays local: it is not a destructive question, and its
 * in-progress `<select>` value would not survive a rebuild in any case.
 *
 * A gate that survived a rebuild is handed the row's CURRENT record rather than
 * the one it was armed against, so it answers for the row as the server last
 * described it.
 *
 * The editor commits with the edited field OVERRIDDEN by the picked value, so
 * the dispatched action's `$record.<field>` resolves to the selection, not the
 * stored row value; the shared row-action handler then runs the action's
 * `onSuccess.refetch`. Saved or dismissed, focus goes back to the trigger.
 */
export function ActionButton({
  action,
  record,
  onActionClick,
  labels,
  confirmKey,
}: {
  readonly action: ActionColumnItem
  readonly record: TableRecord
  readonly onActionClick?: ActionClickHandler
  readonly labels: ActionControlLabels
  /** Identifies this action's gate across a rebuild — `<row id>::action-<n>`. */
  readonly confirmKey: string
}): ReactElement {
  const confirm = useArmedConfirm(confirmKey)
  const [editing, setEditing] = useState(false)
  const { editSelect } = action
  const closeEditor = () => {
    requestTriggerFocus(confirmKey)
    setEditing(false)
  }

  if (editSelect && editing && onActionClick) {
    return (
      <EditSelectEditor
        action={action}
        dataActionType={actionTypeAttr(action)}
        record={record}
        onCommit={(value) => {
          closeEditor()
          void onActionClick(action, { ...record, [editSelect.field]: value })
        }}
        onCancel={closeEditor}
        labels={labels}
      />
    )
  }

  if (action.confirm && confirm.armed && onActionClick) {
    return (
      <ConfirmDialog
        action={action}
        record={record}
        onConfirm={onActionClick}
        onCancel={confirm.disarm}
        labels={labels}
      />
    )
  }

  return (
    <ActionTriggerButton
      action={action}
      record={record}
      onActionClick={onActionClick}
      focusKey={confirmKey}
      onArm={() => (editSelect ? setEditing(true) : confirm.arm())}
    />
  )
}
