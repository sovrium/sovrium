/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Confirm-action dispatch for the alert-dialog island.
 *
 * When an alert-dialog's confirm button carries a configured automation
 * `action`, pressing it POSTs the action to the same
 * `/api/automations/:name/form-action` endpoint the always-loaded page-button
 * runtime uses — so a confirmation dialog can fire a gated automation rather
 * than merely closing. Extracted from `dialog-island.tsx` to keep that island
 * under its line cap.
 */

/**
 * Automation action the alert-dialog's confirm button dispatches. Mirrors the
 * page-button `AutomationAction` shape. Two kinds are wired: an `automation`
 * (a confirm gating a destructive automation) and a `crud` delete of the record
 * the page is bound to. Other actions are ignored — the confirm just closes the
 * dialog.
 */
export interface DialogConfirmAction {
  readonly type?: string
  readonly name?: string
  readonly inputData?: Record<string, unknown>
  /** `crud` actions: the operation; only `delete` is dispatched from a dialog. */
  readonly operation?: string
  readonly table?: string
  /** `crud` delete: the bound record's id, stamped on the server from the page record. */
  readonly recordId?: string
}

/**
 * Dispatch the confirm button's automation action to the form-action endpoint.
 * Fire-and-forget against `/api/automations/:name/form-action`. A
 * non-automation action (or a missing name) is a no-op — the dialog still
 * closes.
 */
export function dispatchConfirmAction(action: DialogConfirmAction | undefined): void {
  if (action?.type === 'crud' && action.operation === 'delete' && action.table && action.recordId) {
    // The records API applies the table's own delete permission; a refusal
    // answers 404 and the record simply stays.
    void fetch(
      `/api/tables/${encodeURIComponent(action.table)}/records/${encodeURIComponent(action.recordId)}`,
      { method: 'DELETE', credentials: 'same-origin' }
    ).catch(() => undefined)
    return
  }
  if (action?.type !== 'automation' || !action.name) return
  const inputData = action.inputData ?? {}
  void fetch(`/api/automations/${encodeURIComponent(action.name)}/form-action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputData }),
  }).catch(() => undefined)
}
