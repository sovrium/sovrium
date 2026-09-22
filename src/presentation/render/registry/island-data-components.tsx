/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  GALLERY_CARD_BODY_CLASSES,
  GALLERY_COVER_FALLBACK_HEIGHT_CLASS,
  computeGalleryCardClasses,
  computeGalleryGridClasses,
} from '@/presentation/design/gallery-default-classes'
import {
  computeKpiCardClasses,
  computeKpiLabelClasses,
} from '@/presentation/design/kpi-default-classes'
import {
  computeTableFillShellClasses,
  computeTableShellClasses,
} from '@/presentation/design/table-default-classes'
import { computeTimelineShellClasses } from '@/presentation/design/timeline-default-classes'
import { resolveLucideIconNode } from '@/presentation/render/elements/lucide-resolver'
import {
  resolveRowExpandDrawerProps,
  resolveRowExpandRowClick,
} from '@/presentation/render/props/resolve-row-expand'
import { renderComponentSearchBar } from './component-search-bar'
import { DataTableSkeleton } from './data-table-skeleton'
import { islandCalendarComponent } from './island-calendar-component'
import { islandChartComponent } from './island-chart-component'
import { KanbanSkeleton } from './island-kanban-skeleton'
import { RowExpandDrawerHost } from './row-expand-drawer-host'
import { staticTableComponent } from './static-table-component'
import type { ComponentRenderer, DispatchableComponentType } from './component-dispatch-config'

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
    // How the grid occupies its parent. Forwarded because hydration replaces
    // this host's contents wholesale: the outer surface can be dressed
    // server-side, but the scroll region and the pinned column heads are drawn
    // by the island, so a value that stopped here would re-dress a frame around
    // rows that still flowed.
    layout: elementProps.layout,
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
    // The SECOND grouping axis and its declared lane values. Both have to pass
    // this gate AND the `kanban` entry of `type-specific-props-builder.ts` to
    // reach the browser; a key added to one and not the other arrives as
    // `undefined` with no error anywhere, and the board silently draws flat.
    swimlanes: elementProps.swimlanes,
    swimlaneOptions: elementProps.swimlaneOptions,
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
    // Server-resolved icon geometry. The island draws from this instead of
    // resolving the name itself, which is what keeps lucide's ~2,000-icon set
    // (a measured 668 KB chunk) out of the island graph — see
    // `@/presentation/utils/lucide-glyph`.
    iconNode:
      typeof elementProps.icon === 'string' ? resolveLucideIconNode(elementProps.icon) : undefined,
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
 * `groupBy`, `colorField`, `defaultZoom`, and the Gantt affordances below) live
 * inside the component's freeform `props` object — `component-renderer.tsx`
 * lifts them to the top level of `elementProps` for this extractor.
 *
 * This list and the `timeline` entry of `type-specific-props-builder.ts` are the
 * TWO gates a binding has to pass to reach the browser, and they are separate
 * files. A key added to one and not the other arrives as `undefined` with no
 * error anywhere.
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
    showToday: elementProps.showToday,
    showDependencies: elementProps.showDependencies,
    dependencyField: elementProps.dependencyField,
    emptyMessage: elementProps.emptyMessage,
  }
}

/**
 * A `timeline` carrying a `dataSource` — the record-bound Gantt.
 *
 * A standalone function rather than a registry entry: `data-timeline` stopped
 * being a component type when it merged into `timeline`, but it is still its
 * own ISLAND, and the marker below is what selects it. The structural timeline
 * renders in `structural-components.tsx` and mounts nothing.
 *
 * The `data-island` NAME follows the type to `timeline`, so the bundle gate
 * needs no spelling translation — renaming the key removes a split rather than
 * describing it, which is the rule the search merge set. The island FILE stays
 * `timeline/timeline-island.tsx`, because file names are load-bearing for the
 * payload ceilings.
 *
 * `data-component-type` keeps the old `data-timeline` spelling: it names the
 * rendered SURFACE, which specs and stylesheet rules address, and which did not
 * merge into anything.
 */
export const recordBoundTimelineComponent: ComponentRenderer = ({ elementProps }) => {
  const islandProps = extractTimelineProps(elementProps)
  const propsJson = JSON.stringify(islandProps)

  // Note: `data-component="data-timeline"` is intentionally set only on the
  // inner TimelineView/state (not on this outer island wrapper), so
  // attribute assertions resolve to a single element after hydration.
  return (
    <div
      data-island="timeline"
      data-island-props={propsJson}
      data-component-type="data-timeline"
      data-testid={elementProps['data-testid'] as string | undefined}
    >
      {/* Loading skeleton — preserved as Suspense fallback. Reads the same
          shell recipe as the hydrated timeline, so the frame does not change
          radius under the reader at the moment the island mounts. */}
      <div
        className={computeTimelineShellClasses()}
        aria-label="Loading timeline..."
        role="status"
      >
        <div className="bg-background-inset mb-3 h-4 w-40 animate-pulse rounded-sm" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={`timeline-skeleton-${String(i)}`}
              className="bg-background-inset h-7 animate-pulse rounded-sm"
            />
          ))}
        </div>
      </div>
    </div>
  )
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
        {/* Loading skeleton — preserved as Suspense fallback.

            Grid and card chrome come from the SAME recipes the hydrated island
            uses (`gallery-default-classes.ts`), so the cards do not re-draw at
            hydration: only the pulsing bars are replaced, inside boxes whose
            border, radius, fill and gutter never move. */}
        <div
          className={`${computeGalleryGridClasses()} grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`}
          aria-label="Loading gallery..."
          role="status"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={`gallery-skeleton-${String(i)}`}
              className={computeGalleryCardClasses()}
            >
              <div
                className={`bg-background-inset w-full animate-pulse ${GALLERY_COVER_FALLBACK_HEIGHT_CLASS}`}
              />
              <div className={GALLERY_CARD_BODY_CLASSES}>
                <div className="bg-background-inset h-4 w-3/4 animate-pulse rounded-sm" />
                <div className="bg-background-inset h-3 w-1/2 animate-pulse rounded-sm" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  },
  chart: islandChartComponent,
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
        {/* Loading skeleton — preserved as Suspense fallback.

            The card chrome comes from `computeKpiCardClasses()`, the SAME
            recipe the hydrated `KpiCard` reads, so the skeleton and the loaded
            card are byte-identical surfaces: the border, radius, fill, padding
            and column gap do not change at the moment the island mounts, and
            the label that was server-rendered does not jump. Before this wave
            the two were independent literals and the card visibly re-drew. */}
        <div
          className={`${computeKpiCardClasses()} w-full`}
          aria-label="Loading KPI..."
          role="status"
        >
          {kpiLabel ? (
            <div
              data-role="kpi-label"
              className={computeKpiLabelClasses()}
            >
              {kpiLabel}
            </div>
          ) : (
            <div className="bg-background-inset h-4 w-32 animate-pulse rounded-sm" />
          )}
          <div className="bg-background-inset h-9 w-24 animate-pulse rounded-sm" />
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
        <KanbanSkeleton elementProps={elementProps} />
      </div>
    )
  },
  // ONE entry for both table modes. `static-table` folded into `table`, and the
  // author's `dataSource` is what chooses: bind one and the grid island mounts
  // here, omit it and `staticTableComponent` serves the rows written in the
  // config as a plain `<table>` with no JavaScript at all. The same shape the
  // `comments` entry above takes for its two displays.
  //
  // The check reads `elementProps.dataSource`, which `TYPE_BUILDERS.table`
  // forwards from the component and emits ONLY in the bound mode — so the two
  // sides pick the same branch from one config value. It is read here rather
  // than off `component` because that field is optional on the renderer
  // context, and a renderer that silently fell back to the static markup
  // whenever the caller omitted it would be a footgun with no symptom.
  //
  // Declaring `tableRows` BESIDE a `dataSource` is refused at decode by
  // `component-xor-rules.ts`, so this branch never discards rows an author
  // wrote.
  table: (ctx) => {
    const { elementProps, component, tables, languages, currentLang } = ctx
    if (elementProps['dataSource'] === undefined) return staticTableComponent(ctx)
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
    // `layout: 'fill'` dresses the mount host SERVER-side, before a line of
    // JavaScript runs. The skeleton this host renders is what the reader sees
    // first, and a frame that only learned its shape at hydration would draw
    // that skeleton at its natural height and then snap to the bounded one.
    const fills = elementProps.layout === 'fill'

    const grid = (
      <div
        // `data-island` is the REGISTRY key and follows the type; the two
        // `data-component*` markers name the rendered SURFACE and deliberately
        // do NOT. Same split `timeline` took at C1 (`data-island="timeline"`,
        // `data-component="data-timeline"`): the chrome selectors and the specs
        // that address this grid are about the thing on the page, and repointing
        // them buys nothing a rename wave should be spending.
        data-island="table"
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
        // `computeTableShellClasses()` so var-fallback paints the surface
        // even when the theme layer is absent; `w-full` stays raw because
        // width is a layout / placement concern.
        //
        // Under `fill` the frame additionally grows into whatever height its
        // bounded parent left it and becomes a column, so the scroll region
        // below it has a leftover to claim. The shell's own clip is what turns
        // that from a promise into a bound — and is also exactly what CLIPPED
        // the rows before this key existed, on any page that bounded the grid
        // without telling it so. That clip is why the frame carries the floor
        // too: it is the box that would otherwise cut a surviving grid off at
        // nothing when the column has no leftover to give.
        className={`${computeTableShellClasses()} w-full${
          fills
            ? ` ${computeTableFillShellClasses({
                rowHeight: elementProps['rowHeight'] as string | undefined,
                framed: true,
              })}`
            : ''
        }`}
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
