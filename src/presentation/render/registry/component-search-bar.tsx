/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared SSR search-bar for data-bound island components
 *.
 *
 * Data-bound components (calendar, kanban, …) accept a `ComponentSearchSchema`
 * via the `search` field of the `data-bound` module. When `search.enabled` is
 * true this renders a static `<input type="search">` carrying the configured
 * `placeholder`, marked structurally with `data-component-search`.
 *
 * Rendered server-side (not behind the island Suspense fallback) so the search
 * input is queryable via `getByPlaceholder(...)` immediately on load, before
 * the component bundle hydrates.
 *
 * SCOPE: this bar is presentational only. **Client-side filtering for these
 * components is not currently wired** — neither the calendar nor the kanban
 * island subscribes to this input, so typing in it filters nothing. The
 * `debounceMs` and `highlight` keys of `ComponentSearchSchema` consequently
 * have no effect on `calendar` / `kanban` today; they were previously emitted
 * here as `data-*` attributes that no code ever read.
 *
 * This is a DIFFERENT surface from the `search-input` component, which does
 * publish its value to bound subscribers (see
 * `islands/search/search-query-binding.ts`).
 */

import type { ReactElement } from 'react'

interface ComponentSearch {
  readonly enabled?: boolean
  readonly placeholder?: string
}

/**
 * Render the component search bar when `search.enabled` is true, else nothing.
 */
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
        className="border-border text-md w-full rounded-md border px-3 py-2"
      />
    </div>
  )
}
