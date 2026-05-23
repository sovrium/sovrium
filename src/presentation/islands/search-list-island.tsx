/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import React, { useCallback, useEffect, useState } from 'react'
import {
  renderResultsBody,
  substituteRecordVars,
  type ChildTemplate,
  type ItemTemplate,
} from './search-list-renderers'

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

  const fieldMatch = searchFields.some((field) => {
    const value = record[field]
    return value !== undefined && String(value).toLowerCase().includes(lowerQuery)
  })
  if (!fieldMatch) return false

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

function useBoundQuery(bindTo: string | undefined, setQuery: (value: string) => void): void {
  useEffect(() => {
    if (!bindTo) return undefined
    const container = document.getElementById(bindTo)
    const input = container?.querySelector('input') ?? document.querySelector(`#${bindTo} input`)
    if (!input) return undefined
    const onInput = (e: Event) => setQuery((e.target as HTMLInputElement).value)
    input.addEventListener('input', onInput)
    return () => input.removeEventListener('input', onInput)
  }, [bindTo, setQuery])
}

export default function SearchListIsland({
  records,
  searchFields,
  debounceMs: _debounceMs = 0,
  limit = 0,
  childTemplate,
  itemTemplate,
  emptyMessage,
  bindTo,
  placeholder = 'Search...',
  className,
  'data-testid': testid,
}: SearchListIslandProps) {
  const [inputValue, setInputValue] = useState('')

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setInputValue(e.target.value),
    []
  )

  useBoundQuery(bindTo, setInputValue)

  const filteredRecords = filterRecords({
    records,
    query: inputValue,
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

  return (
    <div
      className={className}
      data-testid={testid}
    >
      {bindTo ? undefined : (
        <SearchBox
          value={inputValue}
          placeholder={placeholder}
          onChange={handleInputChange}
        />
      )}
      {results}
    </div>
  )
}
