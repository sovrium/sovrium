/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { islandCalendarComponent } from './island-calendar-component'
import { islandChartComponent } from './island-chart-component'
import type { ComponentRenderer } from '../component-dispatch-config'
import type { Component } from '@/domain/models/app/pages/components'

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
    bulkActions: elementProps.bulkActions,
    tableFields: elementProps.tableFields,
    fieldMeta: elementProps.fieldMeta,
    tablePermissions: elementProps.tablePermissions,
    groupBy: elementProps.groupBy,
    summary: elementProps.summary,
  }
}

/**
 * Extracts kanban island props from section component props.
 *
 * Forwarded to the kanban island for client-side data fetching, grouping
 * into columns, and per-column rendering.
 */
function extractKanbanProps(elementProps: Record<string, unknown>): Record<string, unknown> {
  return {
    dataSource: elementProps.dataSource,
    kanbanGroupBy: elementProps.kanbanGroupBy,
    card: elementProps.card,
    drag: elementProps.drag,
    emptyColumnMessage: elementProps.emptyColumnMessage,
    colorField: elementProps.colorField,
    columnOptions: elementProps.columnOptions,
  }
}

/**
 * Extracts gallery island props from section component props.
 *
 * Forwarded to the gallery island for client-side data fetching and
 * responsive card-grid rendering with $record.* template substitution.
 */
function extractGalleryProps(elementProps: Record<string, unknown>): Record<string, unknown> {
  return {
    dataSource: elementProps.dataSource,
    gridColumns: elementProps.gridColumns,
    galleryCard: elementProps.galleryCard,
    emptyMessage: elementProps.emptyMessage,
    layout: elementProps.layout,
  }
}

/**
 * Extracts dropdown island props from section component props.
 */
function extractDropdownProps(elementProps: Record<string, unknown>): {
  id?: string
  label?: string
  dataSource: unknown
  valueField: unknown
  displayField: unknown
  initialValue?: string
  onSelect?: unknown
} {
  return {
    id: elementProps.id as string | undefined,
    label: elementProps.label as string | undefined,
    dataSource: elementProps.dataSource,
    valueField: elementProps.valueField,
    displayField: elementProps.displayField,
    initialValue: elementProps.initialValue as string | undefined,
    onSelect: elementProps.onSelect,
  }
}

/** Data-oriented island components: data-table, kanban, calendar, dropdown */
export const islandDataComponents: Partial<Record<Component['type'], ComponentRenderer>> = {
  dropdown: ({ elementProps, rawProps }) => {
    const dropdownProps = extractDropdownProps({
      ...elementProps,
      ...(rawProps ?? {}),
    })
    const containerId = dropdownProps.id ?? (rawProps?.id as string | undefined)
    const label = dropdownProps.label ?? (rawProps?.label as string | undefined)
    const propsJson = JSON.stringify(dropdownProps)

    return (
      <div
        id={containerId}
        data-island="dropdown"
        data-island-props={propsJson}
        data-testid={elementProps['data-testid'] as string | undefined}
        data-component-type="dropdown"
      >
        {label && (
          <label
            htmlFor={containerId ? `${containerId}-select` : undefined}
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            {label}
          </label>
        )}
        <select
          id={containerId ? `${containerId}-select` : undefined}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          defaultValue=""
        >
          <option
            value=""
            disabled
          >
            Loading...
          </option>
        </select>
      </div>
    )
  },
  calendar: islandCalendarComponent,
  gallery: ({ elementProps }) => {
    const islandProps = extractGalleryProps(elementProps)
    const propsJson = JSON.stringify(islandProps)

    // Note: `data-component="gallery"` is intentionally set only on the inner
    // GalleryGrid (not on this outer island wrapper), so attribute assertions
    // like `data-columns` resolve to a single element after hydration.
    return (
      <div
        data-island="gallery"
        data-island-props={propsJson}
        data-component-type="gallery"
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        {/* Loading skeleton — preserved as Suspense fallback */}
        <div
          className="grid w-full grid-cols-1 gap-4 p-2 sm:grid-cols-2 lg:grid-cols-3"
          aria-label="Loading gallery..."
          role="status"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={`gallery-skeleton-${String(i)}`}
              className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
            >
              <div className="h-32 w-full animate-pulse rounded bg-gray-200" />
              <div className="h-5 w-3/4 animate-pulse rounded bg-gray-200" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200" />
            </div>
          ))}
        </div>
      </div>
    )
  },
  chart: islandChartComponent,
  kanban: ({ elementProps }) => {
    const islandProps = extractKanbanProps(elementProps)
    const propsJson = JSON.stringify(islandProps)

    return (
      <div
        data-island="kanban"
        data-island-props={propsJson}
        data-component="kanban"
        data-component-type="kanban"
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        {/* Loading skeleton — preserved as Suspense fallback */}
        <div
          className="flex w-full gap-4 overflow-x-auto p-2"
          aria-label="Loading kanban board..."
          role="status"
        >
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={`kanban-skeleton-col-${String(i)}`}
              className="flex w-72 shrink-0 flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3"
            >
              <div className="h-5 w-24 animate-pulse rounded bg-gray-200" />
              <div className="h-20 animate-pulse rounded bg-white" />
              <div className="h-20 animate-pulse rounded bg-white" />
            </div>
          ))}
        </div>
      </div>
    )
  },
  'data-table': ({ elementProps }) => {
    const islandProps = extractDataTableProps(elementProps)
    const propsJson = JSON.stringify(islandProps)

    return (
      <div
        data-island="data-table"
        data-island-props={propsJson}
        data-component-type="data-table"
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
