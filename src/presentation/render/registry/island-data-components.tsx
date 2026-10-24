/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeTableFillShellClasses,
  computeTableShellClasses,
} from '@/presentation/design/table-default-classes'
import { TIMELINE_SHELL_CLASSES } from '@/presentation/design/timeline-anatomy-classes'
import { withGridChipPart } from '@/presentation/render/props/option-badge-paints'
import { withRecordTextProp } from '@/presentation/render/props/record-value-format'
import {
  resolveRowExpandDrawerHostProps,
  resolveRowExpandInlineProps,
  resolveRowExpandRowClick,
} from '@/presentation/render/props/resolve-row-expand'
import { hostClassName } from '@/presentation/render/registry/island-host-attributes'
import { DataTableSkeleton } from './data-table-skeleton'
import { galleryComponents } from './gallery-component'
import { islandCalendarComponent } from './island-calendar-component'
import { islandChartComponent } from './island-chart-component'
import { KanbanSkeleton } from './island-kanban-skeleton'
import { islandKpiComponent } from './island-kpi-component'
import { islandLoadingLabel, islandUiStrings } from './island-loading-label'
import { RowExpandDrawerHost } from './row-expand-drawer-host'
import { islandFallback, renderKanbanSpecimen, specimenEmpty } from './specimen-island-states'
import { renderTableSpecimen, staticTableComponent } from './static-table-component'
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
    searchSourceId: elementProps.id,
    dataSource: elementProps.dataSource,
    // A grid reading through one of its table's views offers no export and no live refresh.
    isViewBound: elementProps.isViewBound,
    readOnly: elementProps.readOnly,
    columns: elementProps.columns,
    pagination: elementProps.pagination,
    selection: elementProps.selection,
    striped: elementProps.striped,
    // Row fill by declared option colour — the grid's spelling of the record
    // views' `colorField`: the field name, plus the `optionValue → hex` map
    // resolved server-side from `app.tables` (the island only sees records).
    rowColorField: elementProps.rowColorField,
    rowColorFieldColors: elementProps.rowColorFieldColors,
    bordered: elementProps.bordered,
    emptyMessage: elementProps.emptyMessage,
    noMatchMessage: elementProps.noMatchMessage,
    // The note the bottom bar draws after the range, and the table's description.
    caption: elementProps.caption,
    showRowNumbers: elementProps.showRowNumbers,
    rowHeight: elementProps.rowHeight,
    // How the grid occupies its parent, and reads on a phone. Forwarded because
    // hydration replaces this host's contents wholesale: the scroll region, the
    // pinned heads and the phone rows are all drawn by the island.
    layout: elementProps.layout,
    phoneLayout: elementProps.phoneLayout,
    // Where the reader's view options sit: beside the pager, or in the toolbar.
    viewOptions: elementProps.viewOptions,
    bulkActions: elementProps.bulkActions,
    publishes: elementProps.publishes,
    autoSave: elementProps.autoSave,
    tableFields: elementProps.tableFields,
    fieldMeta: elementProps.fieldMeta,
    tablePermissions: elementProps.tablePermissions,
    // Render-time create-permission gate: the add-row is offered only when the
    // current role may create in the bound table.
    canCreate: elementProps.canCreate,
    // Render-time update-permission gate: the
    // permission-derived default for a column's `editable`. Read by the island;
    // `tablePermissions` above is descriptive only and gates nothing.
    canUpdate: elementProps.canUpdate,
    // Render-time delete gate: the selection's Delete is offered only when the
    // current role may delete in the bound table.
    canDelete: elementProps.canDelete,
    // The empty state naming the table, and the view switcher's words, on a
    // table-bound grid (both resolved server-side in the page language).
    tableEmptyMessage: elementProps.tableEmptyMessage,
    tableReadFailure: elementProps.tableReadFailure,
    viewSwitcher: elementProps.viewSwitcher,
    // The inline editor's commit/dismiss pair, resolved server-side against the
    // active language.
    saveLabel: elementProps.saveLabel,
    cancelLabel: elementProps.cancelLabel,
    // How the action column draws its actions: inline buttons, or a `…` menu per row.
    rowActions: elementProps.rowActions,
    // Every other string the grid writes itself, where it differs from English.
    uiStrings: elementProps.uiStrings,
    // The bound view's grouping (a grid groups only through a view).
    groupBy: elementProps.groupBy,
    summary: elementProps.summary,
    // Row-click action surfaced to the island. The schema narrows this to the
    // two variants the handler implements — `{ type: 'navigate', path }` and
    // `{ action: 'openSheet', component }` — so nothing else can arrive here.
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
    // `value → label` per axis, in the page language: a header reads the label.
    columnLabels: elementProps.columnLabels,
    swimlaneLabels: elementProps.swimlaneLabels,
    // The SECOND grouping axis and its declared lane values. Both have to pass
    // this gate AND the `kanban` entry of `type-specific-props-builder.ts`: a key
    // added to one only arrives as `undefined`, and the board silently draws flat.
    swimlanes: elementProps.swimlanes,
    swimlaneOptions: elementProps.swimlaneOptions,
    // `optionValue → hex` for the field `card.colorField` names, resolved
    // server-side from `app.tables` (the island only ever sees records).
    colorFieldColors: elementProps.colorFieldColors,
    // The declared display properties of the columns the card footer names,
    // so a `currency` footer item prints the column's own currency.
    fieldMeta: elementProps.fieldMeta,
    // The channel the board publishes the card a reader selects on.
    publishes: elementProps.publishes,
  }
}

/**
 * Extracts data-timeline island props from section component props.
 *
 * The timeline display bindings (`startField`, `endField`, `labelField`,
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
    // `optionValue → hex` for `colorField`, resolved server-side from `app.tables`.
    colorFieldColors: elementProps.colorFieldColors,
    defaultZoom: elementProps.defaultZoom,
    showToday: elementProps.showToday,
    showDependencies: elementProps.showDependencies,
    dependencyField: elementProps.dependencyField,
    emptyMessage: elementProps.emptyMessage,
    resizeFields: elementProps.resizeFields,
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
export const recordBoundTimelineComponent: ComponentRenderer = ({
  elementProps,
  currentLang,
  languages,
}) => {
  const loading = islandLoadingLabel('timeline.loading', currentLang, languages)
  const islandProps = {
    ...extractTimelineProps(elementProps),
    uiStrings: islandUiStrings('timeline', currentLang, languages),
  }
  // The host is the ONE element naming the timeline; nothing drawn inside carries either name.
  // Spelled out rather than through `namedHost`: `data-timeline` is a surface stamp, not a
  // type literal, and the stamp vocabulary finds it by its literal spelling.
  return (
    <div
      data-island="timeline"
      data-island-props={JSON.stringify(islandProps)}
      data-component="data-timeline"
      data-component-type="data-timeline"
      data-slot="timeline"
      data-testid={elementProps['data-testid'] as string | undefined}
      className={hostClassName(elementProps, TIMELINE_SHELL_CLASSES)}
    >
      {/* Loading skeleton — preserved as Suspense fallback, inside the frame
          the host draws, so nothing re-draws as the island mounts. */}
      {islandFallback(
        <div
          data-loading-status=""
          aria-label={loading.status}
          role="status"
        >
          <div className="bg-muted mb-3 h-4 w-40 animate-pulse rounded-md" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={`timeline-skeleton-${String(i)}`}
                className="bg-muted h-6 animate-pulse rounded-md"
              />
            ))}
          </div>
        </div>,
        () => specimenEmpty('timeline.empty', currentLang, languages)
      )}
    </div>
  )
}

/** Data-oriented island components: data-table, kanban, calendar */
export const islandDataComponents: Partial<Record<DispatchableComponentType, ComponentRenderer>> = {
  'event-calendar': islandCalendarComponent,
  ...galleryComponents,
  chart: islandChartComponent,
  kpi: islandKpiComponent,
  kanban: ({ elementProps, currentLang, languages, tables }) => {
    const text = { tables, languages, locale: currentLang }
    const loading = islandLoadingLabel('kanban.loading', currentLang, languages)
    const propsJson = JSON.stringify({
      ...withRecordTextProp(extractKanbanProps(elementProps), text),
      uiStrings: islandUiStrings('kanban', currentLang, languages),
    })
    return (
      <div
        id={elementProps.id as string | undefined}
        data-island="kanban"
        data-island-props={propsJson}
        data-component="kanban"
        data-component-type="kanban"
        data-testid={elementProps['data-testid'] as string | undefined}
        className={hostClassName(elementProps)}
      >
        {/* Loading skeleton — preserved as Suspense fallback */}
        {islandFallback(
          <KanbanSkeleton
            elementProps={elementProps}
            label={loading.status}
          />,
          () => renderKanbanSpecimen(elementProps, tables, text)
        )}
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
    // drawer beside the grid, opened by an `openSheet` row-click. The grid
    // island learns nothing new, and a row that expands is a row carrying a row
    // action — so it keeps its focusability and its Enter route for free.
    const expandInputs = { component, tables, languages, currentLang }
    const expandDrawer = resolveRowExpandDrawerHostProps(expandInputs)
    const expandInline = resolveRowExpandInlineProps(expandInputs)
    const expandRowClick = resolveRowExpandRowClick(component)
    const propsJson = JSON.stringify({
      ...withGridChipPart(extractDataTableProps(elementProps), ctx.designStyles?.parts?.['chip']),
      ...(expandRowClick && { onRowClick: expandRowClick }),
      ...(expandInline && { rowExpandInline: expandInline }),
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
        // guards against). The prestyled-islands rule: the shell chrome (border + radius +
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
        className={hostClassName(
          elementProps,
          `${computeTableShellClasses()} w-full${
            fills
              ? ` ${computeTableFillShellClasses({
                  rowHeight: elementProps['rowHeight'] as string | undefined,
                  framed: true,
                })}`
              : ''
          }`
        )}
      >
        {islandFallback(
          <DataTableSkeleton
            label={islandLoadingLabel('datatable.loadingTable', currentLang, languages).status}
          />,
          () => renderTableSpecimen(ctx)
        )}
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
