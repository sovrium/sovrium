/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveCardBadgeClasses } from '@/presentation/design/card-badge-class-resolution'
import { TIMELINE_SHELL_CLASSES } from '@/presentation/design/timeline-anatomy-classes'
import { withRecordTextProp } from '@/presentation/render/props/record-value-format'
import { hostClassName } from '@/presentation/render/registry/island-host-attributes'
import { boundTableComponent } from './bound-table-component'
import { galleryComponents } from './gallery-component'
import { islandCalendarComponent } from './island-calendar-component'
import { islandChartComponent } from './island-chart-component'
import { KanbanSkeleton } from './island-kanban-skeleton'
import { islandKpiComponent } from './island-kpi-component'
import { islandLoadingLabel, islandUiStrings } from './island-loading-label'
import { islandFallback, renderKanbanSpecimen, specimenEmpty } from './specimen-island-states'
import { staticTableComponent } from './static-table-component'
import type { ComponentRenderer, DispatchableComponentType } from './component-dispatch-config'

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
    card: resolveCardBadgeClasses(elementProps.card),
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
  // through `boundTableComponent`, omit it and `staticTableComponent` serves the rows written in the
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
  table: (ctx) =>
    ctx.elementProps['dataSource'] === undefined
      ? staticTableComponent(ctx)
      : boundTableComponent(ctx),
}
