/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  resolveRowExpandDrawerProps,
  resolveRowExpandRowClick,
} from '@/presentation/ui/sections/props/resolve-row-expand'
import {
  computeDataTableShellClasses,
  computeKanbanColumnClasses,
} from '../../renderers/element-renderers/recipes/data-default-classes'
import { renderComponentSearchBar } from './component-search-bar'
import { DataTableSkeleton } from './data-table-skeleton'
import { islandCalendarComponent } from './island-calendar-component'
import { islandChartComponent } from './island-chart-component'
import { RowExpandDrawerHost } from './row-expand-drawer-host'
import type { ComponentRenderer, DispatchableComponentType } from '../component-dispatch-config'

/**
 * Extracts data-table island props from section component props.
 *
 * These props are serialized as JSON into data-island-props and
 * parsed by the island client to initialize the React component.
 */
function extractDataTableProps(elementProps: Record<string, unknown>): Record<string, unknown> {
  return {
    // Accessible name for the grid:
    // forwarded so the island can label the `role="grid"` table, letting
    // `getByRole('grid', { name })` resolve.
    ariaLabel: elementProps['aria-label'],
    // The component `id` doubles as the `searchSourceId`: a system-source
    // directory's external filter bar scopes its `island:system-query` events
    // to this id so only the matching grid re-queries
    //.
    searchSourceId: elementProps.id,
    dataSource: elementProps.dataSource,
    columns: elementProps.columns,
    pagination: elementProps.pagination,
    search: elementProps.search,
    selection: elementProps.selection,
    toolbar: elementProps.toolbar,
    striped: elementProps.striped,
    // Row fill by declared option colour — the grid's spelling of the record
    // views' `colorField`: the field name, plus the `optionValue → hex` map
    // resolved server-side from `app.tables` (the island only sees records).
    rowColorField: elementProps.rowColorField,
    rowColorFieldColors: elementProps.rowColorFieldColors,
    bordered: elementProps.bordered,
    emptyMessage: elementProps.emptyMessage,
    noMatchMessage: elementProps.noMatchMessage,
    showRowNumbers: elementProps.showRowNumbers,
    rowHeight: elementProps.rowHeight,
    bulkActions: elementProps.bulkActions,
    autoSave: elementProps.autoSave,
    tableFields: elementProps.tableFields,
    fieldMeta: elementProps.fieldMeta,
    tablePermissions: elementProps.tablePermissions,
    tableViews: elementProps.tableViews,
    // Render-time create-permission gate:
    // forwarded so the island's toolbar offers the create affordance only when
    // the current role may create the bound table.
    canCreate: elementProps.canCreate,
    // Render-time update-permission gate: the
    // permission-derived default for a column's `editable`. Read by the island;
    // `tablePermissions` above is descriptive only and gates nothing.
    canUpdate: elementProps.canUpdate,
    // Interpreter-provided create-record label, resolved server-side
    // against the active language so the toolbar button + create modal localize.
    newRecordLabel: elementProps.newRecordLabel,
    // The create dialog's footer pair + the inline editor's commit/dismiss pair,
    // resolved server-side alongside the create label.
    saveLabel: elementProps.saveLabel,
    cancelLabel: elementProps.cancelLabel,
    groupBy: elementProps.groupBy,
    summary: elementProps.summary,
    // View-type switcher: the ordered set of view
    // types the toolbar offers, their localizable labels, and the per-view
    // bindings the non-grid views need to render. Validation guarantees each
    // binding is present whenever its view type is listed.
    views: elementProps.views,
    viewLabels: elementProps.viewLabels,
    kanbanGroupBy: elementProps.kanbanGroupBy,
    dateField: elementProps.dateField,
    // Row-click action surfaced to the island. The schema narrows this to the
    // two variants the handler implements — `{ type: 'navigate', path }` and
    // `{ action: 'openDrawer', component }` — so nothing else can arrive here.
    onRowClick: elementProps.onRowClick,
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
    columnColors: elementProps.columnColors,
    // `optionValue → hex` for the field `card.colorField` names, resolved
    // server-side from `app.tables` (the island only ever sees records).
    colorFieldColors: elementProps.colorFieldColors,
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
 * Extracts KPI island props from section component props.
 *
 * Forwarded to the KPI island for client-side data fetching, single-metric
 * aggregation, and formatted card rendering.
 */
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

/**
 * Extracts data-timeline island props from section component props.
 *
 * Forwarded to the timeline island for client-side data fetching and
 * time-axis rendering of records as horizontal bars / point markers. The
 * timeline display bindings (`startField`, `endField`, `labelField`,
 * `groupBy`, `colorField`, `defaultZoom`) live inside the component's
 * freeform `props` object — `component-renderer.tsx` lifts them to the top
 * level of `elementProps` for this extractor.
 */
function extractTimelineProps(elementProps: Record<string, unknown>): Record<string, unknown> {
  return {
    dataSource: elementProps.dataSource,
    startField: elementProps.startField,
    endField: elementProps.endField,
    labelField: elementProps.labelField,
    groupBy: elementProps.groupBy,
    colorField: elementProps.colorField,
    // `optionValue → hex` for the field `colorField` names, resolved
    // server-side from `app.tables` (the island only ever sees records).
    colorFieldColors: elementProps.colorFieldColors,
    defaultZoom: elementProps.defaultZoom,
    emptyMessage: elementProps.emptyMessage,
  }
}

/** Data-oriented island components: data-table, kanban, calendar */
export const islandDataComponents: Partial<Record<DispatchableComponentType, ComponentRenderer>> = {
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

    // Note: `data-component="data-timeline"` is intentionally set only on the
    // inner TimelineView/state (not on this outer island wrapper), so
    // attribute assertions resolve to a single element after hydration.
    return (
      <div
        data-island="data-timeline"
        data-island-props={propsJson}
        data-component-type="data-timeline"
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        {/* Loading skeleton — preserved as Suspense fallback */}
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
    // GAP-I1: server-render the KPI label as visible text in the SSR skeleton.
    // The label is a static, public binding (not record data), so it can paint
    // pre-hydration and remain visible to anonymous visitors on public pages —
    // independent of the auth-gated records fetch the island performs.
    const kpiLabel = typeof elementProps.label === 'string' ? elementProps.label : undefined

    // Note: `data-component="kpi"` is intentionally set only on the inner
    // KpiCard (not on this outer island wrapper), so attribute assertions
    // resolve to a single element after hydration.
    return (
      <div
        data-island="kpi"
        data-island-props={propsJson}
        data-component-type="kpi"
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        {/* Loading skeleton — preserved as Suspense fallback */}
        <div
          className="border-border bg-background-raised w-full rounded-lg border p-4"
          aria-label="Loading KPI..."
          role="status"
        >
          {kpiLabel ? (
            <div
              data-role="kpi-label"
              className="text-foreground-muted mb-2 text-sm font-medium"
            >
              {kpiLabel}
            </div>
          ) : (
            <div className="bg-background-subtle mb-2 h-4 w-32 animate-pulse rounded" />
          )}
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
        {/* Loading skeleton — preserved as Suspense fallback */}
        <div
          className="flex w-full gap-4 overflow-x-auto p-2"
          aria-label="Loading kanban board..."
          role="status"
        >
          {Array.from({ length: 3 }).map((_, i) => (
            // [internal ref]: kanban column shell painted via helper so the SSR
            // skeleton paints the same chrome as the hydrated island. The
            // `w-72 shrink-0` width sizing stays raw — width is a layout
            // concern owned by the consumer.
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
  'data-table': ({ elementProps, component, tables, languages, currentLang }) => {
    // `rowExpand` resolves to the wiring an author writes by hand: a synthesized
    // drawer beside the grid, opened by an `openDrawer` row-click. The grid
    // island learns nothing new, and a row that expands is a row carrying a row
    // action — so it keeps its focusability and its Enter route for free.
    const expandDrawer = resolveRowExpandDrawerProps({ component, tables, languages, currentLang })
    const expandRowClick = resolveRowExpandRowClick(component)
    const propsJson = JSON.stringify({
      ...extractDataTableProps(elementProps),
      ...(expandRowClick && { onRowClick: expandRowClick }),
    })

    const grid = (
      <div
        data-island="data-table"
        data-island-props={propsJson}
        data-component="data-table"
        data-component-type="data-table"
        id={elementProps.id as string | undefined}
        data-testid={elementProps['data-testid'] as string | undefined}
        // The `[data-component="data-table"]` element IS the styled table
        // surface: the design-system token chrome lives here, on the island
        // mount host. `createRoot` renders the hydrated `<DataTableView>`
        // INTO this element, so the surface tokens survive hydration on the
        // asserted element (the view itself renders chrome-less — see
        // data-table-view.tsx). Before the refactor the chrome lived on an
        // inner child, leaving this mount host transparent post-hydration
        // (the "unstyled surface" footgun the ISLAND-DEFAULTS contract
        // guards against). [internal ref]: the shell chrome (border + radius +
        // bg + overflow-hidden) now flows through
        // `computeDataTableShellClasses()` so var-fallback paints the
        // surface even when the theme layer is absent; `w-full` stays raw
        // because width is a layout / placement concern.
        className={`${computeDataTableShellClasses()} w-full`}
      >
        <DataTableSkeleton />
      </div>
    )
    if (!expandDrawer) return grid
    return (
      <>
        {grid}
        <RowExpandDrawerHost props={expandDrawer} />
      </>
    )
  },
}
