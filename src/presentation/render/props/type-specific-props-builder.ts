/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveInterpreterStringOverrides } from '@/domain/models/app/languages/translation-resolver'
import { resolveLiftedTranslationTokens } from '../i18n/translation-handler'
import {
  callerTableOf,
  withCallerWritableColumns,
  withoutInlineEditing,
} from './caller-table-inputs'
import { dataTableInterpreterStrings } from './data-table-interpreter-strings'
import { buildEmptyStateElementProps } from './empty-state-copy-builder'
import { layoutIntentProps } from './layout-intent-props'
import { withResolvedOptionLabels } from './option-labels'
import { withRelatedCreateGates } from './related-create-gates'
import { timelineResizeFields } from './timeline-resize-fields'
import { isViewBoundSource } from './view-binding-inputs'
import type { TypeSpecificResolvedInputs } from './resolve-type-specific-inputs'
import type { Languages } from '@/domain/models/app/languages'
import type {
  Component,
  ComponentOfType,
  ComponentType,
} from '@/domain/models/app/pages/components'

/**
 * Builder inputs, parameterised by the component branch the builder handles.
 *
 * `C` defaults to the whole union for the caller, which holds a component it
 * has not narrowed; each {@link TYPE_BUILDERS} entry receives its own branch,
 * so `component.columns` resolves on the data-table entry and `component.xAxis`
 * does not.
 */
type BuilderArgs<C extends Component = Component> = {
  readonly baseElementPropsWithType: Record<string, unknown>
  readonly component: C
  readonly componentProps: Component['props']
  readonly resolved: TypeSpecificResolvedInputs
  /** Active page language — used to localize interpreter-provided UI strings. */
  readonly currentLang?: string
  /** App languages configuration — author overrides for interpreter strings. */
  readonly languages?: Languages
}

/**
 * Lift a timeline's Gantt affordances out of its freeform `props` object.
 *
 * Its own function so the `timeline` builder below stays inside the complexity
 * cap, and because these three travel together: they are the keys the island
 * needs to draw the today rule and the dependency connectors.
 *
 * `showToday` is forwarded exactly as declared — `undefined` when absent — so
 * the island can tell "said nothing", which draws the marker, from "said
 * false", which does not. Collapsing it to a boolean here would lose that
 * distinction before its only reader ever sees it.
 */
function liftTimelineGanttProps(componentProps: Component['props']): Record<string, unknown> {
  return {
    showToday: componentProps?.showToday,
    showDependencies: componentProps?.showDependencies,
    dependencyField: componentProps?.dependencyField,
  }
}

/**
 * Per-type element-props builder. Each entry receives the base element props
 * (already carrying `data-component-type`) and returns the type-specific
 * element props forwarded to the island/component renderer.
 *
 * Keyed by `ComponentType` rather than by bare `string`, so each entry's
 * `component` is that ONE branch of the schema: the data-table entry may read
 * `columns` and `autoSave` and may NOT read `chartType`. That is the whole reason
 * this table is typed — every drift between a component's schema and the props
 * this file forwards to its island is now a compile error rather than a prop
 * that silently never arrives.
 */
/**
 * The five keys that say how a grid is DRAWN rather than what it is bound to:
 * the density of a row, whether the component takes its natural height or its
 * parent's leftover one, and the three switches that decide what gets painted
 * around the values.
 *
 * They are lifted out of the builder as a group rather than listed in it
 * one by one because the builder sits at its size cap and a sixth drawing
 * switch would otherwise have to displace something unrelated to earn its
 * line. Each is still read off `component` by name, so they are forwarded
 * exactly as verbatim as they read here.
 */
type GridDrawingKey = 'rowHeight' | 'layout' | 'phoneLayout' | 'striped' | 'bordered'
const gridDrawingProps = (
  component: Partial<Record<GridDrawingKey | 'showRowNumbers', unknown>>
): Record<string, unknown> => ({
  rowHeight: component.rowHeight,
  layout: component.layout,
  phoneLayout: component.phoneLayout,
  striped: component.striped,
  bordered: component.bordered,
  showRowNumbers: component.showRowNumbers,
})

/** A bound grid, as the read-only gate reads it. */
type GridWriteInput = ComponentOfType<'table'>

/**
 * A grid declared `readOnly` is a reading for every reader: no create, no
 * import, no add-row line and no editor. Presentation only — the records API
 * answers as before. Otherwise the caller's own write gate stands.
 */
const readOnlyOr = (component: GridWriteInput, gate: boolean | undefined): boolean | undefined =>
  component.readOnly === true ? false : gate

/** The grid's columns, with no inline editor where the grid or the reader forbids one. */
const gridColumns = (component: GridWriteInput) =>
  component.readOnly === true
    ? withoutInlineEditing(component.columns)
    : withCallerWritableColumns(component.columns, callerTableOf(component))

const TYPE_BUILDERS: {
  readonly [K in ComponentType]?: (args: BuilderArgs<ComponentOfType<K>>) => Record<string, unknown>
} = {
  // A `table` with no `dataSource` is the STATIC mode `static-table` became:
  // rows the author wrote, served as a plain `<table>` with no island. It needs
  // none of the grid's thirty forwarded props, so it takes the base props and
  // nothing else — which is exactly what it received as its own type, before
  // the merge. The renderer reads the same key to pick the same branch; two
  // reads of one config value, and no third notion of "is this bound".
  table: (args) => {
    if (args.component.dataSource === undefined) return args.baseElementPropsWithType
    const {
      baseElementPropsWithType,
      component,
      componentProps,
      resolved,
      currentLang,
      languages,
    } = args
    return {
      ...baseElementPropsWithType,
      dataSource: component.dataSource,
      // A grid reading through a view offers no export and no live refresh
      // (`view-binding-inputs.ts`); writes stay gated by the table's grants.
      isViewBound: isViewBoundSource(component.dataSource),
      readOnly: component.readOnly,
      // No inline input on a field the reader may not write (`caller-table-inputs.ts`).
      columns: gridColumns(component),
      selection: component.selection,
      pagination: component.pagination,
      search: component.search,
      // The grouping is the bound view's, never the component's own.
      groupBy: resolved.dataTableGroupBy,
      summary: component.summary,
      toolbar: component.toolbar,
      bulkActions: component.bulkActions,
      ...gridDrawingProps(component),
      // Row fill by declared option colour: the field the author named, plus the
      // `optionValue → hex` map resolved from `app.tables`. A filled row
      // suppresses its stripe and moves hover/selection off the fill channel.
      rowColorField: component.rowColorField,
      rowColorFieldColors: resolved.colorFieldColors,
      emptyMessage: component.emptyMessage,
      noMatchMessage: component.noMatchMessage,
      onRowClick: component.onRowClick,
      autoSave: component.autoSave,
      tableFields: resolved.dataTableTableFields,
      // Option chips read their label in the page language (`option-labels.ts`).
      fieldMeta: withRelatedCreateGates(
        withResolvedOptionLabels(resolved.dataTableFieldMeta, languages, currentLang),
        (componentProps as { _canCreateRelated?: Readonly<Record<string, boolean>> } | undefined)
          ?._canCreateRelated
      ),
      tablePermissions: resolved.dataTablePermissions,
      // Render-time create-permission gate, stamped
      // into `props._canCreate` by the data-source resolver where the session role
      // is known. Forwarded to the island so the toolbar offers the "Nouvel
      // enregistrement" create affordance only when the current role may create.
      // Absent (undefined) when auth is not configured → the island defaults to
      // offering it (full-access model).
      canCreate: readOnlyOr(component, (componentProps as { _canCreate?: boolean })?._canCreate),
      // Render-time update-permission gate, stamped by
      // the same data-source resolver. It is the permission-derived DEFAULT for a
      // column's `editable` — the one `ColumnSchema.editable` has always been
      // annotated with ("default: from table permissions"). An explicit `editable`
      // on the column still wins in both directions; absent (auth not configured,
      // or the table declares no `update` grant) the grid stays read-only.
      canUpdate: readOnlyOr(component, (componentProps as { _canUpdate?: boolean })?._canUpdate),
      // The grid's interpreter-provided strings in the page language.
      ...dataTableInterpreterStrings(currentLang, languages),
    }
  },

  kanban: ({ baseElementPropsWithType, component, resolved }) => ({
    ...baseElementPropsWithType,
    dataSource: component.dataSource,
    kanbanGroupBy: component.kanbanGroupBy,
    swimlanes: component.swimlanes,
    card: component.card,
    drag: component.drag,
    emptyColumnMessage: component.emptyColumnMessage,
    colorField: component.colorField,
    columnOptions: resolved.kanbanColumnOptions,
    columnColors: resolved.kanbanColumnColors,
    swimlaneOptions: resolved.kanbanSwimlaneOptions,
    colorFieldColors: resolved.colorFieldColors,
    fieldMeta: resolved.dataTableFieldMeta,
    search: component.search,
  }),

  calendar: ({ baseElementPropsWithType, component, resolved }) => ({
    ...baseElementPropsWithType,
    dataSource: component.dataSource,
    dateField: component.dateField,
    endDateField: component.endDateField,
    defaultView: component.defaultView,
    labelField: component.labelField,
    colorField: component.colorField,
    colorFieldColors: resolved.colorFieldColors,
    dateOnlyFields: resolved.dateOnlyFields,
    fieldTimeZones: resolved.fieldTimeZones,
    maxEventsPerDay: component.maxEventsPerDay,
    calendarEvent: component.calendarEvent,
    calendarInteraction: component.calendarInteraction,
    search: component.search,
  }),

  gallery: ({ baseElementPropsWithType, component }) => ({
    ...baseElementPropsWithType,
    dataSource: component.dataSource,
    gridColumns: component.gridColumns,
    galleryCard: component.galleryCard,
    emptyMessage: component.emptyMessage,
    layout: component.layout,
  }),

  chart: ({ baseElementPropsWithType, component, resolved }) => ({
    ...baseElementPropsWithType,
    dataSource: component.dataSource,
    chartType: component.chartType,
    xAxis: component.xAxis,
    yAxis: component.yAxis,
    series: component.series,
    legend: component.legend,
    tooltip: component.tooltip,
    chartAggregate: component.chartAggregate,
    categoryOptions: resolved.categoryOptions,
    valueCurrency: resolved.valueCurrency,
    aggregateRead: resolved.aggregateRead,
    emptyMessage: component.emptyMessage,
    // Optional NAMED empty-state region: forwarded
    // so a system-bound chart with zero rows renders an accessible `role="region"`
    // (name + title) instead of the default unnamed empty placeholder.
    emptyState: component.emptyState,
  }),

  kpi: ({ baseElementPropsWithType, component, resolved, currentLang, languages }) => ({
    ...baseElementPropsWithType,
    dataSource: component.dataSource,
    label: component.label,
    kpiAggregate: component.kpiAggregate,
    kpiFormat: component.kpiFormat,
    valueCurrency: resolved.valueCurrency,
    aggregateRead: resolved.aggregateRead,
    icon: component.icon,
    trend: component.trend,
    thresholds: component.thresholds,
    sparkline: component.sparkline,
    // The rate-limited read notice in the page language, where it differs from English.
    uiStrings: resolveInterpreterStringOverrides(['rateLimit.'], currentLang, languages),
  }),

  // `timeline`, in BOTH shapes. A record-bound one lifts its display bindings
  // for the island; a structural one has no `dataSource`, so `component.
  // dataSource` is `undefined` and every lifted key below is `undefined` too —
  // the same no-op the builder already performed for a binding-less component.
  // ONE entry, because `data-timeline` merged into `timeline` and the builder
  // map is keyed by type.
  timeline: ({ baseElementPropsWithType, component, componentProps, resolved }) => ({
    ...baseElementPropsWithType,
    // The timeline display bindings live inside the freeform `props` object
    // (startField/endField/...); lift them to the top level so the island
    // placeholder extractor (`extractTimelineProps`) can read them.
    dataSource: component.dataSource,
    startField: componentProps?.startField,
    endField: componentProps?.endField,
    labelField: componentProps?.labelField,
    groupBy: componentProps?.groupBy,
    colorField: componentProps?.colorField,
    colorFieldColors: resolved.colorFieldColors,
    defaultZoom: componentProps?.defaultZoom,
    ...liftTimelineGanttProps(componentProps),
    resizeFields: timelineResizeFields(component),
    // `props.emptyMessage` only. The former `component.emptyMessage ?? …` read a
    // top-level key `timelineFields` does not declare, so its left operand
    // was always `undefined` and the expression always collapsed to this one.
    emptyMessage: componentProps?.emptyMessage,
  }),

  // No `valueField` / `displayField`: both live INSIDE `dataSource`
  // (`SelectOptionSourceSchema`), never at the component's top level, so the
  // former top-level reads forwarded `undefined` on every render. Nothing
  // consumed them either — `buildSelectProps` reads neither, and `baseProps` is
  // a three-key allowlist.
  select: ({ baseElementPropsWithType, component }) => ({
    ...baseElementPropsWithType,
    dataSource: component.dataSource,
  }),

  // `modal` has NO entry: `modalFields` is `coreFields + visibilityFields`, so
  // the `id` / `title` / `sections` this table used to forward were all
  // undeclared and always `undefined`. The renderer reads `rawProps.id` and
  // `rawProps.title` — i.e. `component.props` — which is where every config and
  // spec actually puts them, and which reaches it untouched without this entry.

  input: ({ baseElementPropsWithType, component }) => ({
    ...baseElementPropsWithType,
    ...((component as { inputType?: string }).inputType !== undefined && {
      type: (component as { inputType?: string }).inputType,
    }),
  }),

  // `empty-state` — its two copy fields are declared BESIDE `props`, where the
  // renderer never looked. Its own module: the keys are spread conditionally so
  // the lift cannot shadow a `props`-spelled twin, and that reasoning is longer
  // than the lines it guards. See `empty-state-copy-builder.ts`.
  'empty-state': buildEmptyStateElementProps,
}

/**
 * Build the type-specific element props forwarded to the island/component
 * renderer for a given component `type`.
 *
 * For types without a dedicated builder, the base element props (already
 * carrying `data-component-type`) pass straight through.
 *
 * ONE TRANSLATION PASS, AT ONE EXIT: every field this builder lifts is a
 * SCHEMA-LEVEL field — a sibling of `props`, not a member of it — so none of
 * them were walked by `substitutePropsTranslationTokens`, which only ever sees
 * `component.props` and has already run by the time we get here. A lifted
 * string therefore reached the DOM with its `$t:` token intact unless its own
 * entry above happened to resolve one, and only a few did. That made an
 * author's token resolve or not depending on whether the field they wrote it in
 * was typed or freeform — a distinction they cannot see from the config.
 *
 * So the resolve happens over everything the lift produced, rather than being
 * hand-wired per field for the sixteenth time — see
 * `resolveLiftedTranslationTokens` for why running it over the whole record,
 * base props included, is safe. The no-builder case goes through the SAME exit:
 * it resolves nothing today, because a component with no entry here lifts no
 * schema-level field at all, but an exit that is single only on one branch is
 * one refactor away from not being single.
 *
 * It is NOT the only pass, and reading it as one sent a fix to the wrong place
 * once already. A renderer may read a typed field STRAIGHT off the component it
 * is handed — `graph` and `matrix` both read `label` and `emptyMessage` that
 * way — and no entry here can reach such a field, because the props an entry
 * writes are props that renderer never looks at.
 * `resolveComponentTranslationTokens` covers that route, upstream of this one.
 * What still lands here and nowhere else are the strings resolved from
 * `app.tables`: field labels and the kanban axes.
 *
 * Interpreter strings (`newRecordLabel`, `saveLabel`, `cancelLabel`) are a
 * different mechanism — they resolve a bare catalog key, not a `$t:` token —
 * and their output is inert to this pass.
 *
 * THE ONE CAST: `type` and `args.component` arrive as separate parameters, so
 * nothing at the type level ties the looked-up builder to the branch its
 * `component` actually is — TypeScript cannot express a correlated union
 * lookup (microsoft/TypeScript#30581). The cast is confined to this single
 * seam, where the caller destructured `type` off the very component it passes
 * (`component-renderer.tsx`); every one of the 72 property reads INSIDE the
 * table is checked against its own branch.
 *
 * @param type - The component type literal, read off `args.component.type`
 * @param args - Base element props plus the substituted component and resolved inputs
 * @returns The element props record to forward to the renderer
 */
export function buildTypeSpecificElementProps(
  type: string,
  args: BuilderArgs
): Record<string, unknown> {
  const builder = TYPE_BUILDERS[type as ComponentType] as
    ((args: BuilderArgs) => Record<string, unknown>) | undefined
  const lifted = builder ? builder(args) : args.baseElementPropsWithType
  const withIntent = { ...lifted, ...layoutIntentProps(type, args.component) }
  return resolveLiftedTranslationTokens(withIntent, args.currentLang, args.languages)
}
