/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import React, { useCallback, useState } from 'react'

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
// Schema type → HTML tag mapping
// ---------------------------------------------------------------------------

const TYPE_TO_TAG: Record<string, string> = {
  text: 'span',
  container: 'div',
  card: 'div',
  list: 'ul',
  li: 'li',
  link: 'a',
  button: 'button',
  image: 'img',
  hero: 'div',
}

// ---------------------------------------------------------------------------
// Render child template to JSX
// ---------------------------------------------------------------------------

function renderChild(child: ChildNode | string, key: string): React.ReactNode {
  if (typeof child === 'string') return child

  const { type: schemaType, props = {}, content, children } = child
  const type = TYPE_TO_TAG[schemaType] ?? schemaType
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

/**
 * Extracts all visible text from a substituted child template.
 * Used to verify that search results actually display the query term.
 */
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

  // Also verify the rendered output contains the query term
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

// ---------------------------------------------------------------------------
// Island component
// ---------------------------------------------------------------------------

export default function SearchListIsland({
  records,
  searchFields,
  debounceMs: _debounceMs = 0,
  limit = 0,
  childTemplate,
  placeholder = 'Search...',
  className,
  'data-testid': testid,
}: SearchListIslandProps) {
  const [inputValue, setInputValue] = useState('')

  // eslint-disable-next-line no-restricted-syntax -- needed to satisfy react-perf/jsx-no-new-function-as-prop; React Compiler not yet enabled in Bun (see docs/infrastructure/ui/react.md)
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setInputValue(e.target.value),
    []
  )

  const filteredRecords = filterRecords({
    records,
    query: inputValue,
    searchFields,
    limit,
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
      <input
        type="search"
        value={inputValue}
        onChange={handleInputChange}
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
