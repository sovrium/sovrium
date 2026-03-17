/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import React, { useState } from 'react'
import { useDebounced } from '@/presentation/hooks/use-debounced'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ChildTemplate = readonly (ChildNode | string)[]

interface ChildNode {
  readonly type: string
  readonly props?: Record<string, unknown>
  readonly content?: string
  readonly children?: ChildTemplate
}

interface SearchListIslandProps {
  readonly id?: string
  readonly records: readonly Record<string, unknown>[]
  readonly searchFields: readonly string[]
  readonly debounceMs?: number
  readonly limit?: number
  readonly childTemplate: ChildTemplate
  readonly placeholder?: string
  readonly className?: string
  readonly 'data-testid'?: string
}

// ---------------------------------------------------------------------------
// Record substitution (mirrors data-source-resolver substituteRecordVars)
// ---------------------------------------------------------------------------

function substituteRecordVars(text: string, record: Record<string, unknown>): string {
  return text.replace(/\$record\.([a-zA-Z0-9_]+)/g, (_, fieldName: string) => {
    const value = record[fieldName]
    return value !== undefined ? String(value) : ''
  })
}

function substituteChildProps(
  props: Record<string, unknown> | undefined,
  record: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!props) return props
  return Object.fromEntries(
    Object.entries(props).map(([key, value]) => [
      key,
      typeof value === 'string' ? substituteRecordVars(value, record) : value,
    ])
  )
}

function substituteChildTemplate(
  template: ChildTemplate,
  record: Record<string, unknown>
): ChildTemplate {
  return template.map((child) => {
    if (typeof child === 'string') return substituteRecordVars(child, record)
    return {
      ...child,
      props: substituteChildProps(child.props, record),
      content:
        typeof child.content === 'string'
          ? substituteRecordVars(child.content, record)
          : child.content,
      children: child.children ? substituteChildTemplate(child.children, record) : child.children,
    }
  })
}

// ---------------------------------------------------------------------------
// Render child template to JSX
// ---------------------------------------------------------------------------

function renderChild(child: ChildNode | string, key: string): React.ReactNode {
  if (typeof child === 'string') return child

  const { type, props = {}, content, children } = child
  const {
    id,
    className,
    'data-testid': testid,
    ...rest
  } = props as {
    id?: string
    className?: string
    'data-testid'?: string
    [key: string]: unknown
  }

  const renderedChildren = children
    ? children.map((c, i) => renderChild(c, `${key}-${i}`))
    : undefined
  const inner = content ?? renderedChildren ?? undefined

  return React.createElement(type, { key, id, className, 'data-testid': testid, ...rest }, inner)
}

// ---------------------------------------------------------------------------
// Search filtering
// ---------------------------------------------------------------------------

function recordMatchesQuery(
  record: Record<string, unknown>,
  query: string,
  searchFields: readonly string[]
): boolean {
  if (!query) return true
  const lowerQuery = query.toLowerCase()
  return searchFields.some((field) => {
    const value = record[field]
    return value !== undefined && String(value).toLowerCase().includes(lowerQuery)
  })
}

function filterRecords(
  records: readonly Record<string, unknown>[],
  query: string,
  searchFields: readonly string[],
  limit: number
): readonly Record<string, unknown>[] {
  const matched = query
    ? records.filter((record) => recordMatchesQuery(record, query, searchFields))
    : records
  return limit > 0 ? matched.slice(0, limit) : matched
}

// ---------------------------------------------------------------------------
// Island component
// ---------------------------------------------------------------------------

export default function SearchListIsland({
  id,
  records,
  searchFields,
  debounceMs = 0,
  limit = 0,
  childTemplate,
  placeholder = 'Search...',
  className,
  'data-testid': testid,
}: SearchListIslandProps) {
  const [inputValue, setInputValue] = useState('')
  const debouncedQuery = useDebounced(inputValue, debounceMs)
  // Use the raw input value directly when debounceMs is 0 (no debounce)
  const activeQuery = debounceMs === 0 ? inputValue : debouncedQuery

  const filteredRecords = filterRecords(records, activeQuery, searchFields, limit)

  return (
    <div
      id={id}
      className={className}
      data-testid={testid}
    >
      <input
        type="search"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        data-search-input="true"
        className="mb-2 w-full rounded-md border border-gray-300 py-2 pr-3 pl-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
      />
      <ul>
        {filteredRecords.map((record, i) => (
          <li key={i}>
            {childTemplate.map((child, j) => {
              const substituted = substituteChildTemplate([child], record)[0]
              return substituted ? renderChild(substituted, `${i}-${j}`) : undefined
            })}
          </li>
        ))}
      </ul>
    </div>
  )
}
