/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useState } from 'react'

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
