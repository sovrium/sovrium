/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect } from 'react'

export function useIslandSearch(callback: (query: string) => void, searchSourceId?: string): void {
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { query?: string; sourceId?: string } | undefined
      if (detail?.query === undefined) return
      if (searchSourceId && detail.sourceId !== searchSourceId) return
      callback(detail.query)
    }
    document.addEventListener('island:search', handler)
    return () => document.removeEventListener('island:search', handler)
  }, [searchSourceId, callback])
}
