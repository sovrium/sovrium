/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useEffect, useState } from 'react'
import { computeTableSearchClasses } from '@/presentation/design/table-default-classes'
import type { ComponentSearch } from '@/domain/models/app/pages/components/component-types/data/table/schema'

interface SearchToolbarProps {
  readonly search: ComponentSearch
  readonly value: string
  readonly onChange: (value: string) => void
  /**
   * Report that a typed term has NOT yet reached the grid — the debounce window
   * between the keystroke and the re-read.
   *
   * The grid needs this because during that window everything on screen answers
   * the PREVIOUS question. An action taken then acts on a view that is about to
   * be replaced: a "load more" issued mid-window continues the UNFILTERED feed,
   * appends a page of it, and has the whole accumulation discarded a fraction of
   * a second later when the term lands — so the request is not merely wasted,
   * it briefly shows the operator rows their own search excludes.
   */
  readonly onPendingChange?: (pending: boolean) => void
}

export function SearchToolbar({ search, value, onChange, onPendingChange }: SearchToolbarProps) {
  const [localValue, setLocalValue] = useState(value)
  const debounceMs = search.debounceMs ?? 300

  useEffect(() => {
    const timer = setTimeout(() => {
      onChange(localValue)
      onPendingChange?.(false)
    }, debounceMs)
    return () => clearTimeout(timer)
  }, [localValue, debounceMs, onChange, onPendingChange])

  useEffect(() => setLocalValue(value), [value])

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setLocalValue(e.target.value)
      // Reported from the keystroke handler rather than an effect: the window
      // opens the instant the character is typed, and an effect would leave one
      // commit in which the grid still believed itself current.
      onPendingChange?.(e.target.value !== value)
    },
    [onPendingChange, value]
  )

  return (
    <input
      type="search"
      placeholder={search.placeholder ?? 'Search...'}
      value={localValue}
      onChange={onInputChange}
      className={computeTableSearchClasses()}
      aria-label={search.placeholder ?? 'Search'}
    />
  )
}
