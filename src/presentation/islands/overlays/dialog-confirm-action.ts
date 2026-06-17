/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export interface DialogConfirmAction {
  readonly type?: string
  readonly name?: string
  readonly inputData?: Record<string, unknown>
}

export function dispatchConfirmAction(action: DialogConfirmAction | undefined): void {
  if (action?.type !== 'automation' || !action.name) return
  const inputData = action.inputData ?? {}
  void fetch(`/api/automations/${encodeURIComponent(action.name)}/form-action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputData }),
  }).catch(() => undefined)
}
