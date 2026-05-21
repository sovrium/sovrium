/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Hero } from '@/presentation/ui/sections/hero'
import * as Renderers from '../../renderers/element-renderers'
import { parseHTMLContent } from '../component-registry-helpers'
import type { ComponentRenderer } from '../component-dispatch-config'
import type { Component } from '@/domain/models/app/pages/components'
import type { ReactElement } from 'react'

const SEARCH_INPUT_STYLE = { width: '100%', marginBottom: '0.5rem', padding: '0.5rem' } as const

const LIST_ERROR_STYLE = {
  color: 'red',
  padding: '1rem',
  border: '1px solid red',
  borderRadius: '4px',
} as const

const renderHeroSection: ComponentRenderer = ({
  elementProps,
  theme,
  content,
  renderedChildren,
}) => {
  const children =
    typeof content === 'string' && content.trim().startsWith('<')
      ? parseHTMLContent(content)
      : renderedChildren

  return (
    <Hero
      theme={theme}
      content={
        typeof content === 'object'
          ? (content as { button?: { text: string; animation?: string } } | undefined)
          : undefined
      }
      data-testid={elementProps['data-testid'] as string | undefined}
    >
      {children}
    </Hero>
  )
}

function renderLoadMoreUI(): ReactElement {
  return (
    <div>
      <button
        type="button"
        aria-label="Load more"
      >
        Load More
      </button>
    </div>
  )
}

function renderNumberedPaginationUI(totalPages: number): ReactElement {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
  return (
    <nav aria-label="pagination">
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          aria-current={p === 1 ? 'page' : undefined}
        >
          {p}
        </button>
      ))}
    </nav>
  )
}

function renderPaginationUI(
  style: string | undefined,
  pageSize: number,
  totalCount: number
): ReactElement | undefined {
  const totalPages = Math.ceil(totalCount / pageSize)
  if (totalPages <= 1) return undefined
  if (style === 'loadMore') return renderLoadMoreUI()
  return renderNumberedPaginationUI(totalPages)
}

interface ListPaginationProps {
  readonly pageSize: number | undefined
  readonly totalCount: number | undefined
  readonly paginationStyle: string | undefined
}

function renderSearchIsland(elementProps: Record<string, unknown>): ReactElement {
  const islandProps = JSON.stringify({
    id: elementProps['id'] as string | undefined,
    records: JSON.parse((elementProps['_searchRecords'] as string) ?? '[]'),
    searchFields: JSON.parse((elementProps['_searchFields'] as string) ?? '[]'),
    debounceMs: elementProps['_searchDebounceMs'] as number | undefined,
    limit: elementProps['_searchLimit'] as number | undefined,
    childTemplate: JSON.parse((elementProps['_searchChildTemplate'] as string) ?? '[]'),
    'data-testid': elementProps['data-testid'] as string | undefined,
  })
  return (
    <div
      id={elementProps['id'] as string | undefined}
      data-island="search-list"
      data-island-props={islandProps}
    >
      {}
      {}
      {}
      <input
        type="search"
        placeholder="Search..."
        aria-label="Search..."
        disabled={true}
        style={SEARCH_INPUT_STYLE}
      />
      <ul />
    </div>
  )
}

function extractListProps(elementProps: Record<string, unknown>): {
  readonly domProps: Record<string, unknown>
  readonly dataSourceBound: boolean | undefined
  readonly pagination: ListPaginationProps
} {
  const {
    _dataSourceBound,
    _dataSourceError: _err,
    _paginationPageSize,
    _paginationTotalCount,
    _paginationStyle,
    ...domProps
  } = elementProps
  return {
    domProps,
    dataSourceBound: _dataSourceBound as boolean | undefined,
    pagination: {
      pageSize: _paginationPageSize as number | undefined,
      totalCount: _paginationTotalCount as number | undefined,
      paginationStyle: _paginationStyle as string | undefined,
    },
  }
}

function renderListWithPagination(
  domProps: Record<string, unknown>,
  renderedChildren: readonly ReactElement[],
  pagination: ListPaginationProps
): ReactElement {
  const { pageSize, totalCount, paginationStyle } = pagination
  const hasPagination = pageSize !== undefined && totalCount !== undefined && totalCount > pageSize
  const paginationUI = hasPagination
    ? renderPaginationUI(paginationStyle, pageSize, totalCount)
    : undefined

  return (
    <div>
      <ul {...domProps}>{renderedChildren}</ul>
      {paginationUI}
    </div>
  )
}

export const specialComponents: Partial<Record<Component['type'], ComponentRenderer>> = {
  'static-table': ({ elementPropsWithSpacing, component }) => {
    const tableComp = component as
      | {
          tableHeaders?: readonly string[]
          tableRows?: ReadonlyArray<readonly string[]>
        }
      | undefined
    const headers = tableComp?.tableHeaders ?? []
    const rows = tableComp?.tableRows ?? []
    const { 'data-testid': dataTestId, ...restProps } = elementPropsWithSpacing
    return (
      <table
        {...restProps}
        data-testid={dataTestId as string | undefined}
      >
        {headers.length > 0 && (
          <thead>
            <tr>
              {headers.map((header, i) => (
                <th key={i}>{header}</th>
              ))}
            </tr>
          </thead>
        )}
        {rows.length > 0 && (
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        )}
      </table>
    )
  },

  'speech-bubble': ({ elementProps, content, renderedChildren }) => {
    const base =
      'bg-info-bg border border-info-border text-info-fg px-4 py-3 text-sm rounded-tl-md rounded-tr-md rounded-br-md rounded-bl-none'
    const extra = elementProps.className as string | undefined
    const className = extra ? `${base} ${extra}` : base
    return (
      <div
        data-testid={elementProps['data-testid'] as string | undefined}
        className={className}
      >
        {content || renderedChildren}
      </div>
    )
  },

  hero: renderHeroSection,

  list: ({ elementProps, content, theme, renderedChildren }) => {
    const dataSourceError = elementProps['_dataSourceError'] as string | undefined
    if (dataSourceError) {
      return (
        <div
          data-testid={elementProps['data-testid'] as string | undefined}
          role="alert"
          style={LIST_ERROR_STYLE}
        >
          {dataSourceError}
        </div>
      )
    }

    const searchMode = elementProps['_searchMode'] as boolean | undefined
    if (searchMode) {
      return renderSearchIsland(elementProps)
    }

    const { domProps, dataSourceBound, pagination } = extractListProps(elementProps)

    if (!content && renderedChildren.length > 0) {
      return renderListWithPagination(domProps, renderedChildren, pagination)
    }
    if (dataSourceBound && !content) {
      return (
        <ul
          {...domProps}
          style={{
            ...(domProps.style as object | undefined),
            display: 'block',
            minHeight: '1px',
          }}
        />
      )
    }
    return Renderers.renderList(domProps, content, theme)
  },

  ul: ({ elementProps, content, renderedChildren }) =>
    Renderers.renderUnorderedList(elementProps, content, renderedChildren),

  li: ({ elementProps, content, renderedChildren }) =>
    Renderers.renderListItem(elementProps, content, renderedChildren),

  'responsive-grid': () => {
    return (
      <section
        data-testid="responsive-section"
        className="p-8 md:p-16"
      >
        <div className="responsive-grid grid gap-4 lg:gap-8">Grid items</div>
      </section>
    )
  },
}
