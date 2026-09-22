/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable react-perf/jsx-no-new-function-as-prop, unicorn/no-null -- conventional React event-handler pattern; ReactElement | null return is canonical React component contract. */

/**
 * Comment-thread pagination + sort controls. Extracted from the main island
 * file to respect the per-island `max-lines: 250` cap.
 */

import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import { computeCommentSortSelectClasses } from '@/presentation/design/comments-default-classes'
import type { ReactElement } from 'react'

/**
 * "Previous"/"Next" and the non-current page numbers are the quiet half of a
 * pager — the current page is the one thing in the row that announces itself,
 * so it alone takes the primary fill.
 */
const PAGER_BUTTON = computeButtonDefaultClasses({ variant: 'secondary', size: 'sm' })
const CURRENT_PAGE_BUTTON = computeButtonDefaultClasses({ variant: 'default', size: 'sm' })

export function SortDropdown({
  sort,
  onChange,
}: {
  readonly sort: 'newest' | 'oldest'
  readonly onChange: (next: 'newest' | 'oldest') => void
}): ReactElement {
  return (
    // The sort bar supplies the row's alignment and its 11px muted tone, so
    // the label only has to keep its own two children on one baseline.
    <label className="flex items-center gap-1">
      <span>Sort</span>
      <select
        aria-label="Sort comments"
        value={sort}
        onChange={(e) => onChange(e.target.value === 'oldest' ? 'oldest' : 'newest')}
        className={computeCommentSortSelectClasses()}
      >
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
      </select>
    </label>
  )
}

export function NumberedPagination({
  total,
  limit,
  offset,
  onSelect,
}: {
  readonly total: number
  readonly limit: number
  readonly offset: number
  readonly onSelect: (offset: number) => void
}): ReactElement | null {
  const pageCount = Math.max(1, Math.ceil(total / limit))
  if (pageCount <= 1) return null
  const currentPage = Math.floor(offset / limit) + 1
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1)
  return (
    <nav className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onSelect(Math.max(0, offset - limit))}
        disabled={currentPage === 1}
        className={PAGER_BUTTON}
      >
        Previous
      </button>
      {pages.map((page) => (
        <button
          key={page}
          type="button"
          onClick={() => onSelect((page - 1) * limit)}
          className={page === currentPage ? CURRENT_PAGE_BUTTON : PAGER_BUTTON}
        >
          {page}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onSelect(Math.min((pageCount - 1) * limit, offset + limit))}
        disabled={currentPage === pageCount}
        className={PAGER_BUTTON}
      >
        Next
      </button>
    </nav>
  )
}
