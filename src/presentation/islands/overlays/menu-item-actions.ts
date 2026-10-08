/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a menu item DOES when it is picked, for the actions that run in the
 * browser without turning the row into something else: a `toast`, an
 * `automation` press and a `fetch`. (`navigate` makes the row an anchor and
 * `auth` logout signs out; both are drawn by their own entries.)
 *
 * Each runs through the same contract a button on the page speaks:
 *
 *  - `toast` raises the shared toast, with its variant and duration;
 *  - `automation` posts to the page-press road
 *    (`/api/automations/:name/form-action`) — the road a page button takes,
 *    judged by the same page gate — and reads the run's outcome from the body
 *    when the item awaits it: `onSuccess` unless the run failed, `onError` when
 *    it did; a refused or unreachable press shows `onError` in either mode;
 *  - `fetch` goes through the shared `executeFetchAction`, so its envelope,
 *    confirm gate, `status`/`refetch` effects and toasts behave as a fetch
 *    button's do.
 */

import { executeFetchAction } from '../runtime/action-executor'
import { renderToast } from '../runtime/toast'
import type { MenuItemAction } from './menu-item-types'
import type { FetchAction } from '@/domain/models/app/pages/components/action'

/** The action types a picked menu item runs here. */
const RUNNABLE_TYPES: ReadonlySet<string> = new Set(['toast', 'automation', 'fetch'])

/** True when picking an item with this action runs it in the browser. */
export function isRunnableMenuAction(action: MenuItemAction | undefined): boolean {
  return action?.type !== undefined && RUNNABLE_TYPES.has(action.type)
}

type OutcomeSlot = MenuItemAction['onSuccess']

/** Raise the toast an `onSuccess` / `onError` slot of an automation declares. */
function showSlotToast(slot: OutcomeSlot): void {
  const toast = slot?.toast
  if (toast?.message) renderToast(toast.message, toast.variant)
}

/** Press the automation the item names, telling the reader what the press did. */
async function pressAutomation(action: MenuItemAction): Promise<void> {
  if (action.name === undefined) return
  const awaited = action.await === true
  if (!awaited) showSlotToast(action.onSuccess)
  try {
    const response = await fetch(
      `/api/automations/${encodeURIComponent(action.name)}/form-action`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputData: action.inputData }),
      }
    )
    const body = (await response.json().catch(() => undefined)) as
      { readonly status?: unknown } | undefined
    if (!response.ok || (awaited && body?.status === 'failed')) {
      showSlotToast(action.onError)
    } else if (awaited) {
      showSlotToast(action.onSuccess)
    }
  } catch {
    showSlotToast(action.onError)
  }
}

/** Run the action of a picked menu item (a no-op for any type not run here). */
export function runMenuItemAction(action: MenuItemAction | undefined): void {
  if (action?.type === 'toast' && action.message !== undefined) {
    renderToast(action.message, action.variant, action.duration)
    return
  }
  if (action?.type === 'automation') {
    void pressAutomation(action)
    return
  }
  if (action?.type === 'fetch') {
    void executeFetchAction(action as FetchAction, {
      renderToast: (message, variant) => renderToast(message, variant),
    })
  }
}
