/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ComponentRenderer } from '../component-dispatch-config'
import type { Component } from '@/domain/models/app/page/sections'

/**
 * Extracts data-table island props from section component props.
 *
 * These props are serialized as JSON into data-island-props and
 * parsed by the island client to initialize the React component.
 */
function extractDataTableProps(elementProps: Record<string, unknown>): Record<string, unknown> {
  return {
    dataSource: elementProps.dataSource,
    columns: elementProps.columns,
    pagination: elementProps.pagination,
    search: elementProps.search,
    selection: elementProps.selection,
    toolbar: elementProps.toolbar,
    striped: elementProps.striped,
    bordered: elementProps.bordered,
    emptyMessage: elementProps.emptyMessage,
    showRowNumbers: elementProps.showRowNumbers,
    rowHeight: elementProps.rowHeight,
  }
}

/**
 * Island components — SSR placeholders for client-side React islands.
 *
 * These renderers output `<div data-island="..." data-island-props="...">` markers
 * with loading skeletons. The island client script discovers these markers
 * and mounts interactive React components into them.
 *
 * The loading skeleton is preserved as a Suspense fallback during lazy loading.
 */
export const islandComponents: Partial<Record<Component['type'], ComponentRenderer>> = {
  'data-table': ({ elementProps }) => {
    const islandProps = extractDataTableProps(elementProps)
    const propsJson = JSON.stringify(islandProps)

    return (
      <div
        data-island="data-table"
        data-island-props={propsJson}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        {/* Loading skeleton — preserved as Suspense fallback */}
        <div
          className="w-full overflow-hidden rounded-lg border border-gray-200 bg-white"
          aria-label="Loading data table..."
          role="status"
        >
          {/* Toolbar skeleton */}
          <div className="border-b border-gray-200 p-3">
            <div className="h-9 w-64 animate-pulse rounded bg-gray-200" />
          </div>
          {/* Header skeleton */}
          <div className="flex gap-4 border-b border-gray-200 bg-gray-50 px-4 py-3">
            <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
          </div>
          {/* Row skeletons */}
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={`skeleton-${String(i)}`}
              className="flex gap-4 border-b border-gray-100 px-4 py-3"
            >
              <div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
              <div className="h-4 w-32 animate-pulse rounded bg-gray-100" />
              <div className="h-4 w-20 animate-pulse rounded bg-gray-100" />
              <div className="h-4 w-28 animate-pulse rounded bg-gray-100" />
            </div>
          ))}
          {/* Pagination skeleton */}
          <div className="flex items-center justify-between px-4 py-3">
            <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
            <div className="flex gap-2">
              <div className="h-8 w-20 animate-pulse rounded bg-gray-200" />
              <div className="h-8 w-20 animate-pulse rounded bg-gray-200" />
            </div>
          </div>
        </div>
      </div>
    )
  },
}
