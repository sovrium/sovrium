/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useState } from 'react'

/**
 * The set of group values a reader has folded, seeded ONCE from the config.
 *
 * `kanbanGroupBy.collapsed` names a starting state, not a capability, so the
 * list is the lazy initialiser of a `useState` and is never read again —
 * re-seeding it on a re-render would fold a column back under a reader who had
 * just opened it, every time the records query refetched. The same rule
 * `swimlanes.collapsed` follows one axis over.
 */
export function useFoldedValues(
  initial: readonly string[] | undefined
): readonly [ReadonlySet<string>, (value: string) => void] {
  const [folded, setFolded] = useState<ReadonlySet<string>>(() => new Set(initial ?? []))
  const toggle = useCallback((value: string) => {
    setFolded((previous) =>
      previous.has(value)
        ? new Set([...previous].filter((entry) => entry !== value))
        : new Set([...previous, value])
    )
  }, [])
  return [folded, toggle] as const
}
