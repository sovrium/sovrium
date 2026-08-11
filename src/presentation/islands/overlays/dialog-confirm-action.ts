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
 * page-button `AutomationAction` shape; only `automation` actions are wired (a
 * confirm gating a destructive automation). Other action `type`s are ignored —
 * the confirm just closes the dialog.
 */
export interface DialogConfirmAction {
  readonly type?: string
  readonly name?: string
  readonly inputData?: Record<string, unknown>
}

/**
 * Dispatch the confirm button's automation action to the form-action endpoint.
 * Fire-and-forget against `/api/automations/:name/form-action`. A
 * non-automation action (or a missing name) is a no-op — the dialog still
 * closes.
 */
export function dispatchConfirmAction(action: DialogConfirmAction | undefined): void {
  if (action?.type !== 'automation' || !action.name) return
  const inputData = action.inputData ?? {}
  void fetch(`/api/automations/${encodeURIComponent(action.name)}/form-action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputData }),
  }).catch(() => undefined)
}
