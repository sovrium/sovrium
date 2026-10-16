/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useState } from 'react'
import { useRecordSelectionToggle } from '../hooks/use-lazy-shared-filter-publisher'
import type { SharedFilterPublisherConfig } from '../hooks/use-shared-filter-publisher'

/**
 * Which pin's card is open, how a pin or its twin entry opens one, and how the
 * card closes. On a map that publishes the pin a reader selects, choosing a pin
 * also publishes its record; closing gives focus back to the twin entry that
 * opened the card.
 */
export function useOpenPin(publishes: SharedFilterPublisherConfig | undefined) {
  const [openId, setOpenId] = useState<string | undefined>(undefined)
  const select = useRecordSelectionToggle(publishes)
  const choose = (id: string | undefined): void => {
    setOpenId(id)
    if (id !== undefined) select?.(id)
  }
  const close = (): void => {
    setOpenId(undefined)
    if (openId === undefined) return
    document.querySelector<HTMLElement>(`[data-map-twin="${CSS.escape(openId)}"]`)?.focus()
  }
  return { openId, choose, close }
}
