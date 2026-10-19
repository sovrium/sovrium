/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Menu } from '@base-ui/react/menu'
import { useState, type ReactElement } from 'react'
import { computeMenuItemClasses } from '../../overlays/menu-default-classes'
import { actionTypeAttr } from './action-type-attr'
import { useArmedConfirm } from './armed-confirm'
import { controlIdOf, rowActionDisabledOn } from './row-action-control'
import { RowConfirmDialog } from './row-confirm-dialog'
import { RowEditSubmenu } from './row-edit-submenu'
import { refocusMenuTrigger } from './trigger-focus'
import type { ActionClickHandler, ActionControlLabels } from './row-action-types'
import type { TableRecord } from '../../runtime/types'
import type { ActionColumnItem } from '@/domain/models/app/pages/components/component-types/data/table/schema'

/** What one menu entry needs to dispatch its action for its row. */
export interface RowActionEntryProps {
  readonly action: ActionColumnItem
  readonly record: TableRecord
  readonly onActionClick: ActionClickHandler
  readonly labels: ActionControlLabels
  /** Identifies this action's confirm gate across a rebuild: `<row id>::action-<n>`. */
  readonly confirmKey: string
  /** The row the menu belongs to, read when the action dispatches. */
  readonly origin: () => Element | undefined
  /** The key the row's `…` trigger takes the focus back by, once the action is answered. */
  readonly focusKey: string
}

const variantOf = (action: ActionColumnItem): 'default' | 'destructive' =>
  action.variant === 'destructive' ? 'destructive' : 'default'

/**
 * One row action as an entry of the row's `…` menu (`rowActions.display:
 * menu`), base-nova's `DropdownMenuItem`.
 *
 * A plain action dispatches when the item is chosen. A `confirm` action arms its
 * gate, the same modal alert dialog the inline button opens, held in the
 * grid-level store so it survives the rebuild the dispatch causes. An
 * `editSelect` action is a submenu of its options. A destructive action is a
 * destructive item, in the destructive ink. An action the row disables
 * (`disabledWhen`, the server's verdict in the row's `_disabled`) is a disabled
 * item, its reason written under its label.
 */
export function RowActionMenuItem(props: RowActionEntryProps): ReactElement {
  const { action, record, onActionClick, confirmKey, origin, focusKey } = props
  const confirm = useArmedConfirm(confirmKey)
  const [pending, setPending] = useState(false)
  if (action.editSelect !== undefined) return <RowEditSubmenu {...props} />
  const variant = variantOf(action)
  const disabledOnRow = rowActionDisabledOn(action, record)
  const controlId = controlIdOf(action)
  return (
    <Menu.Item
      data-slot="dropdown-menu-item"
      data-variant={variant}
      data-action-type={actionTypeAttr(action)}
      {...(controlId === undefined ? {} : { 'data-control-id': controlId })}
      disabled={pending || disabledOnRow !== undefined}
      className={computeMenuItemClasses({ variant })}
      onClick={() => {
        if (action.confirm !== undefined) return confirm.arm()
        setPending(true)
        void Promise.resolve(onActionClick(action, record, origin())).finally(() => {
          setPending(false)
          refocusMenuTrigger(focusKey)
        })
        return undefined
      }}
    >
      {action.label}
      {disabledOnRow?.reason ? (
        <span className="text-muted-foreground block text-xs">{disabledOnRow.reason}</span>
      ) : undefined}
    </Menu.Item>
  )
}

/**
 * The confirm gate of one action in a row's menu. Drawn BESIDE the menu rather
 * than inside it: the menu closes the moment an item is chosen, and a gate
 * mounted in its popup would close with it.
 */
export function RowMenuGate(props: RowActionEntryProps): ReactElement {
  const { action, record, onActionClick, labels, confirmKey, origin, focusKey } = props
  const confirm = useArmedConfirm(confirmKey)
  const settle = () => {
    confirm.disarm()
    refocusMenuTrigger(focusKey)
  }
  return (
    <RowConfirmDialog
      open={confirm.armed}
      action={action}
      record={record}
      labels={labels}
      onCancel={settle}
      onConfirm={() => {
        settle()
        void Promise.resolve(onActionClick(action, record, origin())).finally(() =>
          refocusMenuTrigger(focusKey)
        )
      }}
    />
  )
}
