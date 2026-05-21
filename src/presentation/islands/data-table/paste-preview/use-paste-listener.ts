/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useLayoutEffect } from 'react'
import { parseTsv, type ParsedTsv } from './parse-tsv'

interface UsePasteListenerParams {
  readonly containerRef: React.RefObject<HTMLDivElement | null>
  readonly onPasteDetected: (parsed: ParsedTsv) => void
}

export function usePasteListener({ containerRef, onPasteDetected }: UsePasteListenerParams): void {
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return undefined

    const scope = container.closest<HTMLElement>('[data-island]') ?? container

    let active = false

    const handlePointerDown = (event: MouseEvent): void => {
      const target = event.target as Node | null
      active = target !== null && (scope === target || scope.contains(target))
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      const isPasteKey = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v'
      if (!isPasteKey || !active) return
      event.preventDefault()
      void (async () => {
        const text = await navigator.clipboard.readText().catch(() => '')
        const result = parseTsv(text)
        if (result.headers.length === 0) return
        onPasteDetected(result)
      })()
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [containerRef, onPasteDetected])
}
