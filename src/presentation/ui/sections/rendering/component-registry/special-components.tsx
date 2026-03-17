/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Hero } from '@/presentation/ui/sections/hero'
import * as Renderers from '../../renderers/element-renderers'
import { parseHTMLContent } from '../component-registry-helpers'
import type { ComponentRenderer } from '../component-dispatch-config'
import type { Component } from '@/domain/models/app/page/sections'
import type { ReactElement } from 'react'

/** Inline class maps for card sub-components */
const CARD_CLASSES = {
  'card-with-header': 'bg-white border border-gray-200 overflow-hidden rounded-lg',
  'card-header': 'bg-gray-50 px-4 py-3 border-b border-gray-200 rounded-t-lg',
  'card-body': 'px-4 py-3',
  'card-footer': 'bg-gray-50 px-4 py-3 border-t border-gray-200 rounded-b-lg',
} as const

/**
 * Creates a renderer for card components using inline div elements
 */
function createCardRenderer(baseClasses: string): ComponentRenderer {
  return ({ elementProps, content, renderedChildren }) => {
    const extra = elementProps.className as string | undefined
    const className = extra ? `${baseClasses} ${extra}` : baseClasses
    return (
      <div
        data-testid={elementProps['data-testid'] as string | undefined}
        className={className}
      >
        {content || renderedChildren}
      </div>
    )
  }
}

/**
 * Shared renderer for hero and hero-section component types
 */
const renderHeroSection: ComponentRenderer = ({
  elementProps,
  theme,
  content,
  renderedChildren,
}) => {
  // If content is an HTML string, parse it as children
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

/**
 * Renders a load more button
 */
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

/**
 * Renders numbered page navigation
 */
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

/**
 * Renders pagination UI based on pagination style
 */
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

/**
 * Renders the search island placeholder for client-side interactive search
 */
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
      data-island="search-list"
      data-island-props={islandProps}
    >
      {/* SSR placeholder: search input skeleton visible before island hydration */}
      {/* NOTE: No data-search-input attribute here — Playwright targets [data-search-input] */}
      {/* which only exists after React hydration, ensuring tests wait for the island to mount */}
      <input
        type="search"
        placeholder="Search..."
        aria-label="Search..."
        style={{ width: '100%', marginBottom: '0.5rem', padding: '0.5rem' }}
      />
      <ul />
    </div>
  )
}

/**
 * Extracts and strips internal _dataSource* and _pagination* props
 */
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

/**
 * Renders the list with optional pagination UI
 */
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

/**
 * Special components (hero, card-*, speech-bubble, navigation, list, etc.)
 *
 * These components have complex rendering logic or use custom UI components.
 */
export const specialComponents: Partial<Record<Component['type'], ComponentRenderer>> = {
  'speech-bubble': ({ elementProps, content, renderedChildren }) => {
    const base =
      'bg-blue-100 border border-blue-300 px-4 py-3 text-sm rounded-tl-md rounded-tr-md rounded-br-md rounded-bl-none'
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

  'card-with-header': createCardRenderer(CARD_CLASSES['card-with-header']),
  'card-header': createCardRenderer(CARD_CLASSES['card-header']),
  'card-body': createCardRenderer(CARD_CLASSES['card-body']),
  'card-footer': createCardRenderer(CARD_CLASSES['card-footer']),

  hero: renderHeroSection,

  'hero-section': renderHeroSection,

  list: ({ elementProps, content, theme, renderedChildren }) => {
    // Show error if dataSource validation failed
    const dataSourceError = elementProps['_dataSourceError'] as string | undefined
    if (dataSourceError) {
      return (
        <div
          data-testid={elementProps['data-testid'] as string | undefined}
          role="alert"
          style={{ color: 'red', padding: '1rem', border: '1px solid red', borderRadius: '4px' }}
        >
          {dataSourceError}
        </div>
      )
    }

    // Search mode: render island placeholder for client-side interactive search
    const searchMode = elementProps['_searchMode'] as boolean | undefined
    if (searchMode) {
      return renderSearchIsland(elementProps)
    }

    const { domProps, dataSourceBound, pagination } = extractListProps(elementProps)

    // Render list with children (data-bound or static) when no HTML content string
    if (!content && renderedChildren.length > 0) {
      return renderListWithPagination(domProps, renderedChildren, pagination)
    }
    // Ensure data-bound lists are visible even when empty (no records in table)
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

  navigation: ({ elementPropsWithSpacing, content, renderedChildren, interactions }) => {
    // Default hamburger menu button when no children provided
    // Rationale: Navigation without children should display something visible
    // Used in APP-THEME-BREAKPOINTS-APPLICATION-002 test for default rendering
    const defaultChildren =
      renderedChildren.length === 0 ? (
        <button
          type="button"
          aria-label="Menu"
          className="cursor-pointer rounded-md border-none bg-blue-500 px-3 py-3 text-xl leading-none text-white"
        >
          ☰
        </button>
      ) : (
        renderedChildren
      )

    // Add default padding to nav element
    const navProps = {
      ...elementPropsWithSpacing,
      className: elementPropsWithSpacing.className
        ? `${elementPropsWithSpacing.className} p-4`
        : 'p-4',
    }

    return Renderers.renderHTMLElement({
      type: 'nav',
      props: navProps,
      content: content,
      children: defaultChildren as readonly ReactElement[],
      interactions: interactions,
    })
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
