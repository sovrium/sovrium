/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * One row action drawn INLINE, as a button in the action column (the
 * `rowActions.display: inline` default).
 *
 * A plain action dispatches on the press. A `confirm` action asks first, in a
 * modal alert dialog over the page (`row-confirm-dialog.tsx`), so the row never
 * reflows under the reader: the button stays where it was and takes the focus
 * back when the dialog closes. An `editSelect` action reveals its select editor
 * in place of the button, a native `<select>` named by `editSelect.label` and
 * preset to the row's value; committing dispatches the action with the picked
 * value OVERRIDING `$record.<field>`, through the same row-action handler, so
 * the action's `onSuccess.refetch` re-reads the grid.
 */

import { useId, useRef, useState, type ReactElement } from 'react'
import {
  disabledControlAttributes,
  renderDisabledControl,
} from '@/presentation/design/disabled-reason'
import { pendingControlProps } from '@/presentation/design/pending-state'
import { renderPendingContent } from '@/presentation/design/spinner-mark'
import { computeTableActionButtonClasses } from '@/presentation/design/table-default-classes'
import { InlineAccountAction } from './account-action-controls'
import { isInlineAccountAction } from './account-action-kind'
import { actionTypeAttr } from './action-type-attr'
import { useArmedConfirm } from './armed-confirm'
import { EditSelectEditor } from './edit-select-editor'
import { usePendingRowWord } from './pending-word'
import { controlIdOf, rowActionDisabledOn } from './row-action-control'
import { RowConfirmDialog } from './row-confirm-dialog'
import { rowOf } from './row-origin'
import { claimTriggerFocus, requestTriggerFocus } from './trigger-focus'
import { triggerTone, useTriggerPress } from './trigger-press'
import type { ActionClickHandler, ActionControlLabels } from './row-action-types'
import type { TableRecord } from '../../runtime/types'
import type { ActionColumnItem } from '@/domain/models/app/pages/components/component-types/data/table/schema'

/** A plain button, named `button` as the page's own button component is. */
const NAMED_BUTTON = { type: 'button', 'data-component-type': 'button' } as const

/** The trigger button of one action: its label, or the pending word while it runs. */
function ActionTriggerButton({
  action,
  record,
  onActionClick,
  onArm,
  focusKey,
  onNode,
}: {
  readonly action: ActionColumnItem
  readonly record: TableRecord
  readonly onActionClick?: ActionClickHandler
  readonly onArm: () => void
  /** The key focus returns to this trigger by after its editor closes or its press is answered. */
  readonly focusKey: string
  /** Receives the button, so a gate portalled out of the row can read its row. */
  readonly onNode: (node: HTMLButtonElement | null) => void
}): ReactElement {
  const { pending, onClick } = useTriggerPress({ action, record, focusKey, onArm, onActionClick })
  const pendingWord = usePendingRowWord(action)
  const tone = triggerTone(action.variant)
  const reasonId = useId()
  // Disabled on this row by the server's verdict: drawn, focusable, inert.
  const disabledOnRow = rowActionDisabledOn(action, record)
  const controlId = controlIdOf(action)
  const button = (
    <button
      {...NAMED_BUTTON}
      ref={(node) => {
        onNode(node)
        claimTriggerFocus(focusKey, node)
      }}
      className={computeTableActionButtonClasses({
        disabled: !onActionClick || disabledOnRow !== undefined,
        ...(tone === undefined ? {} : { tone }),
      })}
      data-action-type={actionTypeAttr(action)}
      {...(controlId === undefined ? {} : { 'data-control-id': controlId })}
      disabled={!onActionClick}
      {...(disabledOnRow === undefined
        ? {}
        : disabledControlAttributes(disabledOnRow.reason ? reasonId : undefined))}
      {...pendingControlProps(pending)}
      onClick={disabledOnRow === undefined ? onClick : undefined}
    >
      {pending ? renderPendingContent(pendingWord) : action.label}
    </button>
  )
  return disabledOnRow === undefined
    ? button
    : renderDisabledControl(button, reasonId, disabledOnRow.reason)
}

interface ActionButtonProps {
  readonly action: ActionColumnItem
  readonly record: TableRecord
  readonly onActionClick?: ActionClickHandler
  readonly labels: ActionControlLabels
  /** Identifies this action's gate across a rebuild: `<row id>::action-<n>`. */
  readonly confirmKey: string
}

/**
 * A single per-row action button.
 *
 * The armed CONFIRM is held by `confirmKey` in the grid-level store rather than
 * here, because this component is destroyed and rebuilt whenever the island
 * re-renders (`armed-confirm.ts`); a gate that survived a rebuild answers for
 * the row's CURRENT record. The inline editor's `editing` stays local: its
 * in-progress `<select>` value would not survive a rebuild in any case.
 */
function ArmableActionButton({
  action,
  record,
  onActionClick,
  labels,
  confirmKey,
}: ActionButtonProps): ReactElement {
  const confirm = useArmedConfirm(confirmKey)
  const [editing, setEditing] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
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
  return (
    <>
      <ActionTriggerButton
        action={action}
        record={record}
        onActionClick={onActionClick}
        focusKey={confirmKey}
        onNode={(node) => (triggerRef.current = node)}
        onArm={() => (editSelect ? setEditing(true) : confirm.arm())}
      />
      {action.confirm !== undefined && onActionClick && (
        <RowConfirmDialog
          open={confirm.armed}
          action={action}
          record={record}
          labels={labels}
          onCancel={confirm.disarm}
          onConfirm={() => {
            confirm.disarm()
            void onActionClick(action, record, rowOf(triggerRef.current))
          }}
        />
      )}
    </>
  )
}

/** A row action inline: an account control in the row itself, else its button. */
export function ActionButton(props: ActionButtonProps): ReactElement {
  // A role or a passkey name is chosen in the row itself, beside its button.
  if (isInlineAccountAction(props.action)) {
    return (
      <InlineAccountAction
        action={props.action}
        record={props.record}
        onActionClick={props.onActionClick}
      />
    )
  }
  return <ArmableActionButton {...props} />
}
