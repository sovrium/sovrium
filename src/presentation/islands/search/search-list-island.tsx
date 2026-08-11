/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import React, { useState } from 'react'
import { renderResultsBody, substituteRecordVars } from './search-list-renderers'
import { useBoundQuery, useUnboundQuery } from './search-query-binding'
import type { ChildTemplate, ItemTemplate } from './search-list-renderers'

interface SearchListIslandProps {
  readonly id?: string
  readonly records: readonly Record<string, unknown>[]
  readonly searchFields: readonly string[]
  readonly debounceMs?: number
  readonly limit?: number
  readonly childTemplate: ChildTemplate
  readonly itemTemplate?: ItemTemplate
  readonly emptyMessage?: string
  readonly highlight?: boolean
  readonly bindTo?: string
  readonly placeholder?: string
  readonly className?: string
  readonly 'data-testid'?: string
}

// Search filtering — extractTemplateText verifies results display the query term
function extractTemplateText(template: ChildTemplate, record: Record<string, unknown>): string {
  return template
    .map((child) => {
      if (typeof child === 'string') return substituteRecordVars(child, record)
      const content =
        typeof child.content === 'string' ? substituteRecordVars(child.content, record) : ''
      const childText = child.children ? extractTemplateText(child.children, record) : ''
      return content + ' ' + childText
    })
    .join(' ')
}

function recordMatchesQuery(
  record: Record<string, unknown>,
  query: string,
  searchFields: readonly string[],
  childTemplate: ChildTemplate
): boolean {
  if (!query) return true
  const lowerQuery = query.toLowerCase()

  // Must match at least one searchField
  const fieldMatch = searchFields.some((field) => {
    const value = record[field]
    return value !== undefined && String(value).toLowerCase().includes(lowerQuery)
  })
  if (!fieldMatch) return false

  // When itemTemplate drives display (declarative), the child template is
  // empty, so skip the rendered-text guard. Otherwise verify the rendered
  // output contains the query term.
  if (childTemplate.length === 0) return true
  const renderedText = extractTemplateText(childTemplate, record)
  return renderedText.toLowerCase().includes(lowerQuery)
}

interface FilterOptions {
  readonly records: readonly Record<string, unknown>[]
  readonly query: string
  readonly searchFields: readonly string[]
  readonly limit: number
  readonly childTemplate: ChildTemplate
}

function filterRecords(options: FilterOptions): readonly Record<string, unknown>[] {
  const { records, query, searchFields, limit, childTemplate } = options
  const matched = query
    ? records.filter((record) => recordMatchesQuery(record, query, searchFields, childTemplate))
    : records
  return limit > 0 ? matched.slice(0, limit) : matched
}

interface SearchBoxProps {
  readonly value: string
  readonly placeholder: string
  readonly onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

function SearchBox({ value, placeholder, onChange }: SearchBoxProps) {
  return (
    <input
      type="search"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      aria-label={placeholder}
      data-search-input="true"
      className="border-border bg-background-raised text-foreground focus:border-focus-ring focus:ring-focus-ring mb-2 w-full rounded-md border py-2 pr-3 pl-3 text-sm focus:ring-1 focus:outline-none"
    />
  )
}

/**
 * Island component.
 *
 * ONE APPLIED-query state serves both input paths, because they are mutually
 * exclusive: when `bindTo` is set the own `SearchBox` is not rendered, and when
 * it is absent nothing subscribes to an external publisher.
 *
 * Both paths debounce, but they take the delay from different places, because
 * the author declares it in different places:
 *
 *  - **Unbound** — the delay is the `debounceMs` prop, carrying the list's own
 *    `dataSource.debounceMs`; {@link useUnboundQuery} applies it.
 *  - **Bound** — the delay belongs to the publishing `searchInput` and is read
 *    off its DOM attributes by {@link useBoundQuery}. The prop plays no part:
 *    `useUnboundQuery` still runs (hooks are unconditional) but its box is
 *    never rendered, so nothing ever dispatches through it.
 *
 * Either way only the APPLIED query waits — the box echoes what was typed on
 * the very next render. A delay of `0` applies with no timer at all, keeping
 * the specs that type and assert without waiting green.
 */
export default function SearchListIsland({
  records,
  searchFields,
  debounceMs = 0,
  limit = 0,
  childTemplate,
  itemTemplate,
  emptyMessage,
  bindTo,
  placeholder = 'Search...',
  className,
  'data-testid': testid,
}: SearchListIslandProps) {
  const [query, setQuery] = useState('')

  // Unbound: the island's own box drives the query, debounced by the list's
  // own `dataSource.debounceMs`.
  const searchBox = useUnboundQuery(debounceMs, setQuery)

  // Bound: an external searchInput drives the query, debounced and
  // length-gated by that publisher's own declared controls.
  useBoundQuery(bindTo, setQuery)

  const filteredRecords = filterRecords({
    records,
    query,
    searchFields,
    limit,
    childTemplate,
  })

  const results = renderResultsBody({
    records: filteredRecords,
    emptyMessage,
    itemTemplate,
    childTemplate,
  })

  // NOTE: Do NOT set id here — the island container (data-island div) already
  // carries the id from the SSR placeholder. Duplicating it would cause
  // strict-mode violations in Playwright (#id resolves to 2 elements).
  return (
    <div
      className={className}
      data-testid={testid}
    >
      {bindTo ? undefined : (
        <SearchBox
          value={searchBox.value}
          placeholder={placeholder}
          onChange={searchBox.onChange}
        />
      )}
      {results}
    </div>
  )
}
