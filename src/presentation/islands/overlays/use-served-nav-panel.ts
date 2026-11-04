/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect } from 'react'
import { navPanelId } from '@/presentation/design/navigation-menu-default-classes'

/** The served panel open now, and the island host it sits in. */
interface ServedPanel {
  readonly id: string
  readonly host: Element | null
}

const SERVED_PANEL = '[data-slot="navigation-menu-content"][popover]'

const servedPanelOf = (panel: Element | null | undefined): ServedPanel | undefined =>
  panel ? { id: panel.id, host: panel.closest('[data-island]') } : undefined

/** Whether `panel` is an open popover: false where the platform has none. */
const isOpen = (panel: Element): boolean => {
  try {
    return panel.matches(':popover-open')
  } catch {
    return false
  }
}

/**
 * The served panel the reader opened last, followed from the moment this chunk
 * loads: a panel already open then, and every one opened or closed after it,
 * up to the island's mount replacing the served menu.
 */
let opened = servedPanelOf(Array.from(document.querySelectorAll(SERVED_PANEL)).find(isOpen))
document.addEventListener(
  'toggle',
  (event) => {
    const panel = event.target instanceof Element ? event.target : null
    if (!panel?.matches(SERVED_PANEL)) return
    if ((event as ToggleEvent).newState === 'open') opened = servedPanelOf(panel)
    else if (opened?.id === panel.id) opened = undefined
  },
  true
)

/**
 * Carry over a panel the reader opened before the island mounted. The served
 * trigger opens its panel natively, and mounting replaces that markup, which
 * closes it under the reader; once the island has drawn its menu, the entry
 * whose served panel was open is opened again. Only the island whose entries
 * name that panel acts.
 */
export function useServedNavPanel(
  navItems: readonly { readonly label: string; readonly children?: readonly unknown[] }[]
): void {
  useEffect(() => {
    const served = opened
    const index = navItems.findIndex((item, at) => navPanelId(item, at) === served?.id)
    if (served === undefined || index < 0) return
    opened = undefined
    const entry = served.host?.querySelectorAll('[data-slot="navigation-menu-item"]').item(index)
    const trigger = entry?.querySelector<HTMLElement>('[data-slot="navigation-menu-trigger"]')
    // After this commit: opening flushes the menu's own state synchronously.
    setTimeout(() => trigger?.click(), 0)
  }, [navItems])
}
