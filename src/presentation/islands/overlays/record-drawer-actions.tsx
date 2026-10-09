/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The record drawer's footer actions (CAP-1): a row of buttons below the record
 * body, each firing against the loaded record — a `fetch`, or an `openDrawer`
 * that hands the same record to the drawer it names — behind an optional
 * confirm gate. Split out of `record-drawer-content.tsx`, which composes it.
 */

import { useCallback, useState, type ReactElement } from 'react'
import {
  substituteRecordVars,
  withRecordText,
} from '@/domain/models/app/pages/substitute-record-vars'
import { executeFetchAction } from '../runtime/action-executor'
import { dispatch } from '../runtime/event-bus'
import { InlineConfirmDialog, ObjectConfirmDialog } from '../runtime/inline-confirm-dialog'
import type { Action, FetchAction } from '@/domain/models/app/pages/components/action'
import type { ConfirmObject } from '@/domain/models/app/pages/components/confirm-gate'

type RawRecord = Record<string, unknown>

/** A footer action button the drawer renders below the record body (CAP-1). */
export interface DrawerAction {
  readonly label: string
  readonly action: Action
  readonly variant?: string
  /** Confirm gate before firing — the legacy STRING prompt or the rich OBJECT form. */
  readonly confirm?: string | ConfirmObject
}

/**
 * Dispatch a drawer footer action against the loaded record. Reuses the shared
 * `executeFetchAction` runtime — `$record.<field>` in the action's `url` / `body`
 * resolves against `record` at CLICK time (the drawer loads its record lazily).
 * An `openDrawer` action closes this drawer and opens the one it names.
 */
function dispatchDrawerAction(action: Action, record: RawRecord, onLeave: () => void): void {
  if ('type' in action && action.type === 'fetch') {
    void executeFetchAction(action as FetchAction, { record })
    return
  }
  // `openDrawer` hands the SAME record to the drawer it names — a detail drawer
  // whose footer opens the decision drawer — and steps aside for it, so one
  // modal surface is open at a time.
  if ('action' in action && action.action === 'openDrawer') {
    onLeave()
    dispatch('sovrium:open-drawer', { id: action.component, record })
  }
}

const ACTION_BUTTON_CLASS =
  'border-border text-foreground hover:bg-background-subtle rounded border px-3 py-1.5 text-md transition-colors disabled:cursor-not-allowed disabled:opacity-50'

/**
 * A single footer action button. A `confirm`-bearing action arms the shared
 * inline `alertdialog` gate on the first click (its confirm affordance re-uses
 * this action's label); otherwise the action fires immediately.
 */
function DrawerActionButton({
  item,
  record,
  disabled,
  onLeave,
}: {
  readonly item: DrawerAction
  readonly record: RawRecord
  /** The record has not loaded yet: `$record.*` would resolve against nothing. */
  readonly disabled: boolean
  readonly onLeave: () => void
}): ReactElement {
  const [confirming, setConfirming] = useState(false)
  const fire = useCallback(
    () => dispatchDrawerAction(item.action, record, onLeave),
    [item.action, record, onLeave]
  )

  if (item.confirm && confirming) {
    // The OBJECT form renders the shared `ObjectConfirmDialog` (separate title /
    // dialog role / type-to-confirm input / label overrides); the legacy STRING
    // form keeps the byte-identical inline gate.
    if (typeof item.confirm !== 'string') {
      return (
        <ObjectConfirmDialog
          config={item.confirm}
          record={record}
          fallbackConfirmLabel={item.label}
          onConfirm={fire}
          onCancel={() => setConfirming(false)}
        />
      )
    }
    return (
      <InlineConfirmDialog
        prompt={substituteRecordVars(item.confirm, withRecordText(record))}
        confirmLabel={item.label}
        onConfirm={fire}
        onCancel={() => setConfirming(false)}
      />
    )
  }

  return (
    <button
      type="button"
      data-component-type="button"
      className={ACTION_BUTTON_CLASS}
      disabled={disabled}
      onClick={() => (item.confirm ? setConfirming(true) : fire())}
    >
      {item.label}
    </button>
  )
}

/** The footer action row rendered below the record body (nothing when empty). */
export function DrawerActions({
  actions,
  record,
  loading,
  onLeave,
}: {
  readonly actions: ReadonlyArray<DrawerAction>
  readonly record: RawRecord
  readonly loading: boolean
  readonly onLeave: () => void
}): ReactElement | null {
  if (actions.length === 0) return null
  return (
    <div className="border-border mt-2 flex flex-wrap gap-2 border-t pt-4">
      {actions.map((item, index) => (
        <DrawerActionButton
          key={`${item.label}-${index}`}
          item={item}
          record={record}
          disabled={loading}
          onLeave={onLeave}
        />
      ))}
    </div>
  )
}
