/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The two ways a record drawer opens on its own, beside the create button
 * (`use-record-drawer-create.ts`): a `sovrium:open-drawer` dispatch naming it,
 * and an address naming a record (`?record=<id>`, or `?record=new`).
 */

import { useEffect, type RefObject } from 'react'
import { subscribe } from '@/presentation/islands/runtime/event-bus'
import { addressedRecordId, NEW_RECORD_ADDRESS, writeDrawerAddress } from './record-drawer-address'
import { toFormValue } from './record-drawer-values'

/** Open the drawer on a record id, or on a new record for {@link NEW_RECORD_ADDRESS}. */
export type OpenOn = (target: string) => void

/**
 * Open on a dispatch naming this drawer — a row, a card, an event, another
 * drawer's footer — and name the drawer and its record in the address. A
 * dispatch carrying no record opens a table-bound drawer on a new one.
 */
export function useOpenDrawerEvent(
  id: string | undefined,
  bound: { readonly table: boolean; readonly system: boolean },
  openOn: OpenOn
): void {
  const { table, system } = bound
  useEffect(() => {
    if (!id) return undefined
    return subscribe('sovrium:open-drawer', (detail) => {
      if (detail.id !== id) return
      const opened = toFormValue(detail.record['id']) || undefined
      if (opened === undefined) {
        if (table) openOn(NEW_RECORD_ADDRESS)
        return
      }
      openOn(opened)
      if (table || system) writeDrawerAddress(id, opened)
    })
  }, [id, table, system, openOn])
}

/**
 * `?record={id}` deep-link self-open: when the surface is reached with a
 * `?record=` param AND this drawer is record-bound (a DB-table OR a system
 * DETAIL endpoint), open itself for that record. Reading the URL HERE — on the
 * drawer's own mount — is race-free with respect to a sibling island
 * dispatching `sovrium:open-drawer` (cross-root `useEffect` ordering is not
 * guaranteed after an SPA content swap). The read is RETRIED on a short
 * schedule because the SPA nav module mounts this island BEFORE it calls
 * `history.pushState(url)`, so the very first read can still see the
 * pre-navigation URL; re-reading over ~400ms catches the pushState'd `?record=`.
 *
 * Once the drawer is open — by any gesture — the retries stop: an address the
 * drawer wrote itself must not reopen it over what was typed.
 */
export function useDeepLinkOpen(
  drawer: { readonly id: string | undefined; readonly bound: boolean; readonly deepLink: boolean },
  openRef: RefObject<boolean>,
  openOn: OpenOn
): void {
  const { id, bound, deepLink } = drawer
  useEffect(() => {
    if (!bound || typeof window === 'undefined') return undefined
    const tryOpen = (): boolean => {
      if (openRef.current) return true
      // `?drawer=` names the drawer; a bare `?record=` opens only the first
      // record-bound drawer the page declares (see `record-drawer-address.ts`).
      const target = addressedRecordId(id, deepLink)
      if (!target) return false
      openOn(target)
      return true
    }
    if (tryOpen()) return undefined
    const timers = [0, 100, 250, 450].map((delay) => setTimeout(tryOpen, delay))
    return () => timers.forEach((timer) => clearTimeout(timer))
    // Read once per drawer: `openOn` follows the entries, fixed after mount.
  }, [id, bound, deepLink])
}
