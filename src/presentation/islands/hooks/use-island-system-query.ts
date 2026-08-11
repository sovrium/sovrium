/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useState } from 'react'

/**
 * Dynamic query params for a system-source data-table, driven by an EXTERNAL
 * filter bar on the same page (mirrors {@link useIslandSearch}).
 *
 * A sibling filter island dispatches an `island:system-query` CustomEvent whose
 * `detail.params` is the new query-param bag (e.g. `{ automationName, status }`)
 * and whose `detail.sourceId` scopes the event to one grid (matched against the
 * data-table's `searchSourceId`, which is its component `id`). The grid merges
 * these params into every request to `system.endpoint`, so a page-level filter
 * forwards as `?automationName=` / `?status=` without the filter living inside
 * the data-table toolbar.
 *
 * Used by the converted automation-runs Exécutions directory
 *: its
 * "Filtrer par automatisation" / "Filtrer par état" comboboxes forward to the
 * runs read endpoint.
 */
export function useIslandSystemQuery(sourceId?: string): Record<string, string> {
  const [params, setParams] = useState<Record<string, string>>({})

  useEffect(() => {
    const handler = (e: Event): void => {
      const detail = (e as CustomEvent).detail as
        { params?: Record<string, string>; sourceId?: string } | undefined
      if (detail?.params === undefined) return
      if (sourceId && detail.sourceId !== sourceId) return
      setParams(detail.params)
    }
    document.addEventListener('island:system-query', handler)
    return () => document.removeEventListener('island:system-query', handler)
  }, [sourceId])

  return params
}
