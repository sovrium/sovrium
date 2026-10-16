/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useRef } from 'react'
import type { PaginationState } from '@tanstack/react-table'

/**
 * Back to the first page whenever the narrowing changes, so a numbered grid
 * never asks for a page past the end of the narrowed set.
 */
export function usePageResetOnNarrowing(
  key: string,
  setPagination: (updater: (previous: PaginationState) => PaginationState) => void
): void {
  const previous = useRef(key)
  useEffect(() => {
    if (previous.current === key) return
    previous.current = key
    setPagination((current) => (current.pageIndex === 0 ? current : { ...current, pageIndex: 0 }))
  }, [key, setPagination])
}
