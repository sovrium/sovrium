/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { runSuccessOutcome, toastShownAhead } from '../../runtime/action-outcome'
import { automationPressHeaders } from '../../runtime/automation-press-headers'
import { substituteRecord, substituteRecordInBody } from '../../runtime/fetch-action-substitution'

type OutcomeToast = { readonly toast?: { readonly message?: string; readonly variant?: string } }

/** A success slot: its toast, where it goes next (`$record.*` from the row), and `close`. */
type OutcomeSuccess = OutcomeToast & { readonly navigate?: string; readonly close?: boolean }

/** The `type: 'automation'` action an actions column entry may carry. */
export type AutomationRowAction = {
  readonly type: 'automation'
  readonly name: string
  readonly inputData?: Record<string, unknown>
  readonly await?: boolean
  readonly onSuccess?: OutcomeSuccess
  readonly onError?: OutcomeToast
}

type ToastRenderer = (message: string, variant?: string) => void

/** Where the success goes next, its `$record.*` filled from the row pressed. */
function rowNavigate(
  onSuccess: OutcomeSuccess | undefined,
  record: Record<string, unknown>
): string | undefined {
  const navigate = onSuccess?.navigate
  return navigate === undefined ? undefined : substituteRecord(navigate, record)
}

/**
 * Press an automation from a row: the same request a page `button` with this
 * action sends (`POST /api/automations/<name>/form-action` with `{ inputData }`),
 * its `$record.<field>` references filled from the clicked row rather than the
 * page's record. The toast rules match the page button's: a fire-and-forget
 * press shows `onSuccess` on the press itself, an awaited one reads the run's
 * status, and a refused press or a network failure shows `onError`. An
 * accepted press then closes the overlay holding the table when `onSuccess.close`
 * asks (`origin` is the pressed button), and follows `onSuccess.navigate`,
 * filled from the same row.
 *
 * Resolves `true` when the press was accepted, so the grid can re-read the rows
 * the run may have changed.
 */
export async function runAutomationRowAction(
  action: AutomationRowAction,
  record: Record<string, unknown>,
  renderToast: ToastRenderer,
  origin?: Element
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
        headers: automationPressHeaders(),
        body: JSON.stringify({ inputData: substituteRecordInBody(action.inputData ?? {}, record) }),
      }
    )
    const body = (await response.json().catch(() => undefined)) as
      { readonly status?: unknown } | undefined
    if (!response.ok || (awaitRun && body?.status === 'failed')) {
      show(action.onError)
      return false
    }
    runSuccessOutcome(origin, {
      toast: awaitRun ? () => show(action.onSuccess) : undefined,
      shownToast: toastShownAhead(awaitRun, action.onSuccess),
      close: action.onSuccess?.close,
      navigate: rowNavigate(action.onSuccess, record),
    })
    return true
  } catch {
    show(action.onError)
    return false
  }
}
