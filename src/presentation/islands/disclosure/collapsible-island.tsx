/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useRef } from 'react'
import type { ReactElement } from 'react'

/**
 * The hydrated `collapsible`: an ENHANCEMENT island that renders only an inert
 * anchor. The trigger, the region and the region's children are the server's
 * (so nested islands and links in the region are untouched); this script finds
 * the root it sits in, wires the trigger, and enables it — the server drew it
 * disabled so a press before this ran is never lost.
 */
export default function CollapsibleIsland(): ReactElement {
  const anchor = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const root = anchor.current?.closest<HTMLElement>('[data-slot="collapsible"]')
    const trigger = root?.querySelector<HTMLButtonElement>(
      ':scope > [data-slot="collapsible-trigger"]'
    )
    const region = root?.querySelector<HTMLElement>(':scope > [data-slot="collapsible-content"]')
    if (!root || !trigger || !region) return undefined
    const toggle = (): void => {
      const open = trigger.getAttribute('aria-expanded') !== 'true'
      trigger.setAttribute('aria-expanded', String(open))
      root.dataset['state'] = open ? 'open' : 'closed'
      region.hidden = !open
    }
    trigger.addEventListener('click', toggle)
    trigger.disabled = false
    return () => trigger.removeEventListener('click', toggle)
  }, [])
  return (
    <span
      ref={anchor}
      hidden
    />
  )
}
