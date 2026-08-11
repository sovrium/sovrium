/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useLayoutEffect } from 'react'
import { parseTsv, type ParsedTsv } from './parse-tsv'

interface UsePasteListenerParams {
  /** Container the paste interaction is scoped to (the data-table island root). */
  readonly containerRef: React.RefObject<HTMLDivElement | null>
  /** Invoked with the parsed clipboard payload when Ctrl/Cmd+V fires. */
  readonly onPasteDetected: (parsed: ParsedTsv) => void
  /** When `false`, the paste detector is not attached (read-only / system source). */
  readonly enabled?: boolean
}

/**
 * Attaches the Ctrl/Cmd+V paste detector to the data-table.
 *
 * The island mounts inside a `[data-island]` host element (which carries the
 * schema-provided `id`); the container ref points at the rendered table
 * *inside* that host. Activity detection is scoped to the host so a click
 * anywhere on the table — including its own padding — counts as "focused".
 *
 * When the table is focused and the user presses Ctrl/Cmd+V, the clipboard's
 * TSV payload is parsed and handed to `onPasteDetected`. Lives in a `.ts`
 * module (no JSX) so the effect here is unaffected by the island JSX rules.
 *
 * Uses `useLayoutEffect` so the listeners are wired synchronously on commit —
 * before the browser paints — closing the race where a test interacts with
 * the table the instant it becomes visible.
 */
export function usePasteListener({
  containerRef,
  onPasteDetected,
  enabled = true,
}: UsePasteListenerParams): void {
  useLayoutEffect(() => {
    if (!enabled) return undefined
    const container = containerRef.current
    if (!container) return undefined

    const scope = container.closest<HTMLElement>('[data-island]') ?? container

    // Tracks whether the table was the last element the user interacted with.
    // eslint-disable-next-line functional/no-let -- mutable activity flag scoped to this effect
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
  }, [containerRef, onPasteDetected, enabled])
}
