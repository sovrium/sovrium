/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { ReactElement } from 'react'

interface ComponentSearch {
  readonly enabled?: boolean
  readonly placeholder?: string
  readonly debounceMs?: number
  readonly highlight?: boolean
}

export function renderComponentSearchBar(search: unknown): ReactElement | undefined {
  const cfg = (search ?? {}) as ComponentSearch
  if (cfg.enabled !== true) {
    return undefined
  }
  const placeholder = typeof cfg.placeholder === 'string' ? cfg.placeholder : 'Search...'
  return (
    <div
      className="mb-3"
      data-component-search=""
    >
      <input
        type="search"
        role="searchbox"
        placeholder={placeholder}
        aria-label={placeholder}
        data-search-debounce={cfg.debounceMs ?? 300}
        data-search-highlight={cfg.highlight === true ? 'true' : 'false'}
        className="border-border w-full rounded-md border px-3 py-2 text-sm"
      />
    </div>
  )
}
