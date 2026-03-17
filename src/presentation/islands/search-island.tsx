/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useState, useEffect, useRef } from 'react'
import { useDebounced } from '@/presentation/hooks/use-debounced'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SearchIslandProps {
  /** Unique identifier for this search island (used in cross-island events) */
  readonly id?: string
  /** Placeholder text for the search input */
  readonly placeholder?: string
  /** Debounce delay in milliseconds (default: 300) */
  readonly debounceMs?: number
  /** CSS class name for the container */
  readonly className?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * SearchIsland — A standalone debounced search input.
 *
 * Dispatches `island:search` CustomEvents on the document for
 * cross-island communication. DataTableIsland listens for these
 * events and applies the search query as a global filter.
 *
 * @example SSR placeholder:
 * ```html
 * <div data-island="search-input"
 *      data-island-props='{"id":"order-search","placeholder":"Search orders..."}'>
 *   <input type="search" placeholder="Search orders..." disabled />
 * </div>
 * ```
 */
export default function SearchIsland({
  id,
  placeholder = 'Search...',
  debounceMs = 300,
  className,
}: SearchIslandProps) {
  const [inputValue, setInputValue] = useState('')
  const debouncedValue = useDebounced(inputValue, debounceMs)
  const mountedRef = useRef(false)

  // Dispatch cross-island search event when debounced value changes (skip initial mount)
  useEffect(() => {
    if (!mountedRef.current) {
      // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- React ref mutation is idiomatic
      mountedRef.current = true
      return
    }
    document.dispatchEvent(
      new CustomEvent('island:search', {
        detail: { query: debouncedValue, sourceId: id },
      })
    )
  }, [debouncedValue, id])

  return (
    <div className={className ?? 'relative w-full max-w-sm'}>
      <input
        type="search"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full rounded-md border border-gray-300 py-2 pr-8 pl-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
      />
      {inputValue && (
        <button
          type="button"
          onClick={() => setInputValue('')}
          className="absolute top-1/2 right-2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          aria-label="Clear search"
        >
          ×
        </button>
      )}
    </div>
  )
}
