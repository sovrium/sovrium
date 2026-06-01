/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeDataTableHeaderClasses,
  computeDataTableShellClasses,
  computeKanbanColumnClasses,
} from '../../renderers/element-renderers/data-default-classes'
import { renderComponentSearchBar } from './component-search-bar'
import { islandCalendarComponent } from './island-calendar-component'
import { islandChartComponent } from './island-chart-component'
import { islandDropdownComponent } from './island-dropdown-component'
import type { ComponentRenderer } from '../component-dispatch-config'
import type { Component } from '@/domain/models/app/pages/components'

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
    autoSave: elementProps.autoSave,
    tableFields: elementProps.tableFields,
    fieldMeta: elementProps.fieldMeta,
    tablePermissions: elementProps.tablePermissions,
    tableViews: elementProps.tableViews,
    groupBy: elementProps.groupBy,
    summary: elementProps.summary,
    onRowClick: elementProps.onRowClick,
  }
}

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

function extractGalleryProps(elementProps: Record<string, unknown>): Record<string, unknown> {
  return {
    dataSource: elementProps.dataSource,
    gridColumns: elementProps.gridColumns,
    galleryCard: elementProps.galleryCard,
    emptyMessage: elementProps.emptyMessage,
    layout: elementProps.layout,
  }
}

function extractKpiProps(elementProps: Record<string, unknown>): Record<string, unknown> {
  return {
    dataSource: elementProps.dataSource,
    label: elementProps.label,
    kpiAggregate: elementProps.kpiAggregate,
    kpiFormat: elementProps.kpiFormat,
    icon: elementProps.icon,
    trend: elementProps.trend,
    thresholds: elementProps.thresholds,
    sparkline: elementProps.sparkline,
  }
}

function extractTimelineProps(elementProps: Record<string, unknown>): Record<string, unknown> {
  return {
    dataSource: elementProps.dataSource,
    startField: elementProps.startField,
    endField: elementProps.endField,
    labelField: elementProps.labelField,
    groupBy: elementProps.groupBy,
    colorField: elementProps.colorField,
    defaultZoom: elementProps.defaultZoom,
    emptyMessage: elementProps.emptyMessage,
  }
}

export const islandDataComponents: Partial<Record<Component['type'], ComponentRenderer>> = {
  dropdown: islandDropdownComponent,
  calendar: islandCalendarComponent,
  gallery: ({ elementProps }) => {
    const islandProps = extractGalleryProps(elementProps)
    const propsJson = JSON.stringify(islandProps)

    return (
      <div
        data-island="gallery"
        data-island-props={propsJson}
        data-component-type="gallery"
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        {}
        <div
          className="grid w-full grid-cols-1 gap-4 p-2 sm:grid-cols-2 lg:grid-cols-3"
          aria-label="Loading gallery..."
          role="status"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={`gallery-skeleton-${String(i)}`}
              className="border-border bg-background-raised flex flex-col gap-2 rounded-lg border p-3 shadow-sm"
            >
              <div className="bg-background-subtle h-32 w-full animate-pulse rounded" />
              <div className="bg-background-subtle h-5 w-3/4 animate-pulse rounded" />
              <div className="bg-background-subtle h-4 w-1/2 animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  },
  chart: islandChartComponent,
  'data-timeline': ({ elementProps }) => {
    const islandProps = extractTimelineProps(elementProps)
    const propsJson = JSON.stringify(islandProps)

    return (
      <div
        data-island="data-timeline"
        data-island-props={propsJson}
        data-component-type="data-timeline"
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        {}
        <div
          className="border-border bg-background-raised w-full rounded-lg border p-4"
          aria-label="Loading timeline..."
          role="status"
        >
          <div className="bg-background-subtle mb-3 h-4 w-40 animate-pulse rounded" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={`timeline-skeleton-${String(i)}`}
                className="bg-background-subtle h-7 animate-pulse rounded"
              />
            ))}
          </div>
        </div>
      </div>
    )
  },
  kpi: ({ elementProps }) => {
    const islandProps = extractKpiProps(elementProps)
    const propsJson = JSON.stringify(islandProps)

    return (
      <div
        data-island="kpi"
        data-island-props={propsJson}
        data-component-type="kpi"
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        {}
        <div
          className="border-border bg-background-raised w-full rounded-lg border p-4"
          aria-label="Loading KPI..."
          role="status"
        >
          <div className="bg-background-subtle mb-2 h-4 w-32 animate-pulse rounded" />
          <div className="bg-background-subtle h-8 w-24 animate-pulse rounded" />
        </div>
      </div>
    )
  },
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
        {renderComponentSearchBar(elementProps.search)}
        {}
        <div
          className="flex w-full gap-4 overflow-x-auto p-2"
          aria-label="Loading kanban board..."
          role="status"
        >
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={`kanban-skeleton-col-${String(i)}`}
              className={`${computeKanbanColumnClasses()} w-72 shrink-0`}
            >
              <div className="bg-background-subtle h-5 w-24 animate-pulse rounded" />
              <div className="bg-background-raised h-20 animate-pulse rounded" />
              <div className="bg-background-raised h-20 animate-pulse rounded" />
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
        data-component="data-table"
        data-component-type="data-table"
        id={elementProps.id as string | undefined}
        data-testid={elementProps['data-testid'] as string | undefined}
        className={`${computeDataTableShellClasses()} w-full`}
      >
        {}
        <div
          aria-label="Loading data table..."
          role="status"
        >
          {}
          <div className="border-border border-b p-3">
            <div className="bg-background-subtle h-9 w-64 animate-pulse rounded" />
          </div>
          {}
          <div className={`${computeDataTableHeaderClasses()} flex gap-4`}>
            <div className="bg-background-subtle h-4 w-24 animate-pulse rounded" />
            <div className="bg-background-subtle h-4 w-32 animate-pulse rounded" />
            <div className="bg-background-subtle h-4 w-20 animate-pulse rounded" />
            <div className="bg-background-subtle h-4 w-28 animate-pulse rounded" />
          </div>
          {}
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={`skeleton-${String(i)}`}
              className="border-border flex gap-4 border-b px-4 py-3"
            >
              <div className="bg-background-subtle h-4 w-24 animate-pulse rounded" />
              <div className="bg-background-subtle h-4 w-32 animate-pulse rounded" />
              <div className="bg-background-subtle h-4 w-20 animate-pulse rounded" />
              <div className="bg-background-subtle h-4 w-28 animate-pulse rounded" />
            </div>
          ))}
          {}
          <div className="flex items-center justify-between px-4 py-3">
            <div className="bg-background-subtle h-4 w-24 animate-pulse rounded" />
            <div className="flex gap-2">
              <div className="bg-background-subtle h-8 w-20 animate-pulse rounded" />
              <div className="bg-background-subtle h-8 w-20 animate-pulse rounded" />
            </div>
          </div>
        </div>
      </div>
    )
  },
}
