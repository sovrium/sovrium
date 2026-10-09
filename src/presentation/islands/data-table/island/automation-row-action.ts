/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { substituteRecordInBody } from '../../runtime/fetch-action-substitution'

type OutcomeToast = { readonly toast?: { readonly message?: string; readonly variant?: string } }

/** The `type: 'automation'` action an actions column entry may carry. */
export type AutomationRowAction = {
  readonly type: 'automation'
  readonly name: string
  readonly inputData?: Record<string, unknown>
  readonly await?: boolean
  readonly onSuccess?: OutcomeToast
  readonly onError?: OutcomeToast
}

type ToastRenderer = (message: string, variant?: string) => void

/**
 * Press an automation from a row: the same request a page `button` with this
 * action sends (`POST /api/automations/<name>/form-action` with `{ inputData }`),
 * its `$record.<field>` references filled from the clicked row rather than the
 * page's record. The toast rules match the page button's: a fire-and-forget
 * press shows `onSuccess` on the press itself, an awaited one reads the run's
 * status, and a refused press or a network failure shows `onError`.
 *
 * Resolves `true` when the press was accepted, so the grid can re-read the rows
 * the run may have changed.
 */
export async function runAutomationRowAction(
  action: AutomationRowAction,
  record: Record<string, unknown>,
  renderToast: ToastRenderer
): Promise<boolean> {
  const show = (slot: OutcomeToast | undefined): void => {
    if (slot?.toast?.message) renderToast(slot.toast.message, slot.toast.variant)
  }
  const awaitRun = action.await === true
  if (!awaitRun) show(action.onSuccess)
  try {
    const response = await fetch(
      `/api/automations/${encodeURIComponent(action.name)}/form-action`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputData: substituteRecordInBody(action.inputData ?? {}, record) }),
      }
    )
    const body = (await response.json().catch(() => undefined)) as
      { readonly status?: unknown } | undefined
    if (!response.ok || (awaitRun && body?.status === 'failed')) {
      show(action.onError)
      return false
    }
    if (awaitRun) show(action.onSuccess)
    return true
  } catch {
    show(action.onError)
    return false
  }
}
