/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect } from 'react'
import {
  subscribe as subscribeIslandEvent,
  type OpenDrawerDetail,
} from '@/presentation/islands/runtime/event-bus'

/**
 * Opening a drawer from outside it: a trigger elsewhere on the page, or an
 * open request that arrived before the island mounted.
 */

/** Whether a `data-click-modal="<id>"` trigger points at this drawer (client-side). */
export function hasExternalTrigger(id: string | undefined): boolean {
  if (!id || typeof document === 'undefined') return false
  return document.querySelector(`[data-click-modal="${id}"]`) !== null
}

/** Consume the pre-hydration click flag `clickScript` sets — as the dialog island does. */
function consumePendingOpen(id: string): boolean {
  const pending = (window as { __sovriumOpenModals?: Record<string, boolean> }).__sovriumOpenModals
  return pending?.[id] === true && Reflect.deleteProperty(pending, id)
}

/**
 * Wires external open triggers for this drawer:
 *
 * 1. The legacy `data-click-modal="<id>"` click contract used by the existing
 *    `<button data-click-modal="...">` schema authoring path. The legacy
 *    openModal handler in `PageBodyScripts` only toggles `display` on the
 *    placeholder div, which has no effect on a hydrated Base UI portal —
 *    so the island owns the trigger wiring for itself.
 *
 * 2. The `sovrium:open-drawer` CustomEvent dispatched by the data-table
 *    island when a row click resolves to an `action: 'openDrawer'` action
 *    (PG-04 quick-edit drawer pattern). The event's `detail.id` matches the
 *    drawer component id, and `detail.record` carries the clicked row's
 *    record so the drawer's child form can be populated client-side. The
 *    record is stored in a ref so the popup body's injection step can bind it
 *    to the form before the form's island mounts (`drawer-record-binding.ts`).
 *
 * 3. The `sovrium:crud-success` CustomEvent dispatched by the embedded
 *    crud-form's `submitCrudForm` after a successful update / create
 *    — this closes the drawer so the user
 *    returns to the underlying data-table view with the updated row.
 *
 * 4. The `sovrium:close-dialog` CustomEvent an endpoint form declaring
 *    `onSuccess.close` bubbles once its request succeeds — honoured only when
 *    it comes from inside THIS drawer's panel.
 */
export function useExternalOpenTrigger(
  id: string | undefined,
  setOpen: (open: boolean) => void,
  recordRef: { current: OpenDrawerDetail | null },
  closeOnCrudSuccess: boolean
): void {
  useEffect(() => {
    if (!id) return
    // Replay a trigger click that landed BEFORE this (lazy) island hydrated —
    // the drawer now mounts closed, so that click would otherwise be lost.
    if (consumePendingOpen(id)) setOpen(true)
    const raf = requestAnimationFrame(() => consumePendingOpen(id) && setOpen(true))
    const clickHandler = (event: Event): void => {
      const target = event.target as HTMLElement | null
      const trigger = target?.closest(`[data-click-modal="${id}"]`)
      if (trigger) setOpen(true)
    }
    document.addEventListener('click', clickHandler)
    const unsubscribeOpenDrawer = subscribeIslandEvent('sovrium:open-drawer', (detail) => {
      if (detail.id !== id) return
      // eslint-disable-next-line no-param-reassign -- ref mutation is the documented React pattern for late-arriving data
      recordRef.current = detail
      setOpen(true)
    })
    const unsubscribeCrudSuccess = subscribeIslandEvent('sovrium:crud-success', () => {
      if (!closeOnCrudSuccess) return
      setOpen(false)
    })
    const closeHandler = (event: Event): void => {
      if ((event.target as Element | null)?.closest?.('[role="dialog"]')?.id === id) setOpen(false)
    }
    document.addEventListener('sovrium:close-dialog', closeHandler)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('click', clickHandler)
      document.removeEventListener('sovrium:close-dialog', closeHandler)
      unsubscribeOpenDrawer()
      unsubscribeCrudSuccess()
    }
  }, [id, setOpen, recordRef, closeOnCrudSuccess])
}
