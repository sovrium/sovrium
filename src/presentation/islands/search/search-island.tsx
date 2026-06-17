/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useState, useEffect, useRef } from 'react'
import { useDebounced } from '@/presentation/hooks/use-debounced'


interface SearchIslandProps {
  readonly id?: string
  readonly placeholder?: string
  readonly debounceMs?: number
  readonly className?: string
}


export default function SearchIsland({
  id,
  placeholder = 'Search...',
  debounceMs = 300,
  className,
}: SearchIslandProps) {
  const [inputValue, setInputValue] = useState('')
  const debouncedValue = useDebounced(inputValue, debounceMs)
  const mountedRef = useRef(false)

  useEffect(() => {
    if (!mountedRef.current) {
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
        className="border-border bg-background-raised text-foreground focus:border-focus-ring focus:ring-focus-ring w-full rounded-md border py-2 pr-8 pl-3 text-sm focus:ring-1 focus:outline-none"
      />
      {inputValue && (
        <button
          type="button"
          onClick={() => setInputValue('')}
          className="text-foreground-subtle hover:text-foreground-muted absolute top-1/2 right-2 -translate-y-1/2"
          aria-label="Clear search"
        >
          ×
        </button>
      )}
    </div>
  )
}
