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
import { withGridChipPart } from '@/presentation/render/props/option-badge-paints'
import {
  resolveRowExpandDrawerHostProps,
  resolveRowExpandInlineProps,
  resolveRowExpandRowClick,
} from '@/presentation/render/props/resolve-row-expand'
import { hostClassName } from '@/presentation/render/registry/island-host-attributes'
import {
  drawnGridOf,
  drawnHostMark,
  drawnGridProp,
} from '@/presentation/render/resolve/drawn-island-content'
import { GridPlaceholder } from './data-table-skeleton'
import { islandLoadingLabel } from './island-loading-label'
import { overlayLoadingLabel } from './overlay-loading-label'
import { RowExpandDrawerHost } from './row-expand-drawer-host'
import { islandFallback } from './specimen-island-states'
import { renderTableSpecimen } from './static-table-component'
import type { ComponentRenderer } from './component-dispatch-config'

/**
 * A `table` that binds a `dataSource`: the BOUND half of the merged type.
 *
 * The registry's `table` entry (`island-data-components.tsx`) picks this
 * renderer when the author binds a source, and `staticTableComponent` when the
 * rows are written in the config. This module draws the grid island's mount
 * host, its server-side frame and skeleton, and the synthesized row-expand
 * drawer beside it.
 */

// A filling grid holding no row draws at its natural height: the view rendered
// into this frame marks itself `data-fill-empty`, and the frame lets go of its
// growth and its floor while that mark is there (see `fill-empty.ts`).
const FILL_FRAME_COMPACT = 'has-[>[data-fill-empty]]:min-h-0 has-[>[data-fill-empty]]:flex-none'

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

export const boundTableComponent: ComponentRenderer = (ctx) => {
  const { elementProps, component, tables, languages, currentLang } = ctx
  // `rowExpand` resolves to the wiring an author writes by hand: a synthesized
  // drawer beside the grid, opened by an `openSheet` row-click. The grid
  // island learns nothing new, and a row that expands is a row carrying a row
  // action — so it keeps its focusability and its Enter route for free.
  const expandInputs = { component, tables, languages, currentLang }
  const expandDrawer = resolveRowExpandDrawerHostProps(expandInputs)
  const expandInline = resolveRowExpandInlineProps(expandInputs)
  const expandRowClick = resolveRowExpandRowClick(component)
  const drawn = drawnGridOf(elementProps)
  const propsJson = JSON.stringify({
    ...drawnGridProp(drawn, elementProps.columns),
    ...withGridChipPart(extractDataTableProps(elementProps), ctx.designStyles?.parts?.['chip']),
    ...(expandRowClick && { onRowClick: expandRowClick, rowExpandPanel: true }),
    ...(expandInline && { rowExpandInline: expandInline }),
    // A grid inside another component draws a compact empty state, headerless.
    ...(ctx.nested === true && { embedded: true }),
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
      {...drawnHostMark(drawn)}
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
              })} ${FILL_FRAME_COMPACT}`
            : ''
        }`
      )}
    >
      {islandFallback(
        <GridPlaceholder
          drawn={drawn}
          columns={elementProps.columns}
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
      <RowExpandDrawerHost
        props={expandDrawer}
        loadingLabel={overlayLoadingLabel({ currentLang, languages })}
      />
    </>
  )
}
