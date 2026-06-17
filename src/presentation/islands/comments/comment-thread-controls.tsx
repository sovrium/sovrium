/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */



import type { ReactElement } from 'react'

export function SortDropdown({
  sort,
  onChange,
}: {
  readonly sort: 'newest' | 'oldest'
  readonly onChange: (next: 'newest' | 'oldest') => void
}): ReactElement {
  return (
    <label className="ml-auto flex items-center gap-1 text-xs">
      <span>Sort</span>
      <select
        aria-label="Sort comments"
        value={sort}
        onChange={(e) => onChange(e.target.value === 'oldest' ? 'oldest' : 'newest')}
        className="border-input bg-background rounded border px-1 py-0.5"
      >
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
      </select>
    </label>
  )
}

export function LoadMoreButton({
  hasMore,
  onClick,
  isLoading,
}: {
  readonly hasMore: boolean
  readonly onClick: () => void
  readonly isLoading: boolean
}): ReactElement | null {
  if (!hasMore) return null
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      className="border-input rounded border px-3 py-1 text-sm disabled:opacity-50"
    >
      {isLoading ? 'Loading…' : 'Load more'}
    </button>
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
    <nav className="flex items-center gap-1 text-xs">
      <button
        type="button"
        onClick={() => onSelect(Math.max(0, offset - limit))}
        disabled={currentPage === 1}
        className="border-input rounded border px-2 py-0.5 disabled:opacity-50"
      >
        Previous
      </button>
      {pages.map((page) => (
        <button
          key={page}
          type="button"
          onClick={() => onSelect((page - 1) * limit)}
          className={`border-input rounded border px-2 py-0.5 ${page === currentPage ? 'bg-primary text-primary-foreground' : ''}`}
        >
          {page}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onSelect(Math.min((pageCount - 1) * limit, offset + limit))}
        disabled={currentPage === pageCount}
        className="border-input rounded border px-2 py-0.5 disabled:opacity-50"
      >
        Next
      </button>
    </nav>
  )
}
