/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import { declaredFieldLabel } from '@/presentation/design/field-display'
import { resolveLiftedTranslationTokens } from '../i18n/translation-handler'
import { buildEmptyStateElementProps } from './empty-state-copy-builder'
import { withRelatedCreateGates } from './related-create-gates'
import { resolveDataTableViews, type ResolvedDataTableView } from './resolve-data-table-views'
import { resolveFieldDisplayMeta, resolveFieldEditMeta } from './resolve-field-cell-meta'
import {
  resolveFieldOptionColors,
  resolveKanbanColumnColors,
  resolveKanbanColumnOptions,
  resolveKanbanSwimlaneOptions,
} from './resolve-option-colors'
import type { Languages } from '@/domain/models/app/languages'
import type {
  Component,
  ComponentOfType,
  ComponentType,
} from '@/domain/models/app/pages/components'
import type { Tables } from '@/domain/models/app/tables'

/**
 * Pre-resolved inputs that some component types need lifted to the top-level
 * element props (resolved from `app.tables` by the caller).
 */
export type TypeSpecificResolvedInputs = {
  readonly dataTableTableFields: readonly string[] | undefined
  readonly dataTableFieldMeta: Record<string, unknown> | undefined
  readonly dataTablePermissions: unknown
  readonly dataTableViews: ReadonlyArray<ResolvedDataTableView> | undefined
  readonly kanbanColumnOptions: readonly string[] | undefined
  readonly kanbanColumnColors: Readonly<Record<string, string>> | undefined
  /**
   * The lane axis' declared options, resolved from `swimlanes.field`. Carries
   * the same weight `kanbanColumnOptions` does for the column axis: without it
   * a lane can only appear where the data already puts one, which makes both
   * the declared-order rule and `showEmpty` unexpressible.
   */
  readonly kanbanSwimlaneOptions: readonly string[] | undefined
  /**
   * `optionValue → #RRGGBB` for the field a record view's `colorField` names,
   * so a kanban card / calendar event / timeline bar can paint the colour its
   * AUTHOR declared instead of one the platform invented ([internal ref] A7 ruling 1).
   *
   * Resolved here rather than in the island because `app.tables` is a
   * server-side input: the islands receive records, never the field schema.
   * Absent when the component declares no `colorField`, or when the named
   * field's options declare no colour — the surface then keeps whatever it
   * does today (ruling 5: an opt-in, never a repaint).
   */
  readonly colorFieldColors: Readonly<Record<string, string>> | undefined
}

/**
 * Builder inputs, parameterised by the component branch the builder handles.
 *
 * `C` defaults to the whole union for the caller, which holds a component it
 * has not narrowed; each {@link TYPE_BUILDERS} entry receives its own branch,
 * so `component.views` resolves on the data-table entry and `component.xAxis`
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

const EMPTY_RESOLVED: TypeSpecificResolvedInputs = {
  dataTableTableFields: undefined,
  dataTableFieldMeta: undefined,
  dataTablePermissions: undefined,
  dataTableViews: undefined,
  kanbanColumnOptions: undefined,
  kanbanColumnColors: undefined,
  kanbanSwimlaneOptions: undefined,
  colorFieldColors: undefined,
}

/**
 * Resolve the table referenced by a component's `dataSource` from `app.tables`.
 *
 * Exported for `resolve-record-drawer-fields.ts`, which needs the identical
 * `dataSource → app.tables` lookup and must not grow a second copy of it.
 */
export function resolveSourceTable(
  component: Component,
  tables: Tables | undefined
): Tables[number] | undefined {
  if (!tables || !('dataSource' in component) || !component.dataSource) return undefined
  const sourceTable = (component.dataSource as { readonly table: string }).table
  return tables.find((t) => t.name === sourceTable)
}

/**
 * Resolve the field-name list, field metadata (type/options/required/display),
 * permissions, and normalised views the data-table island needs from
 * `app.tables`.
 */
/**
 * Extract the client-side config of a `type: 'button'` field: what the button
 * says, what it dispatches, and which rows show it. Returns an empty overlay
 * for every other field type so the caller can spread it unconditionally.
 */
function resolveButtonFieldMeta(field: Tables[number]['fields'][number]): Record<string, unknown> {
  if (field.type !== 'button') return {}
  const button = field as unknown as {
    readonly label: string
    readonly action: string
    readonly url?: string
    readonly automation?: string
    readonly visibleWhen?: Readonly<Record<string, unknown>>
  }
  return {
    button: {
      label: button.label,
      action: button.action,
      ...(button.url === undefined ? {} : { url: button.url }),
      ...(button.automation === undefined ? {} : { automation: button.automation }),
      ...(button.visibleWhen === undefined ? {} : { visibleWhen: button.visibleWhen }),
    },
  }
}

/**
 * The field vocabulary of a grid bound to a SYSTEM read endpoint.
 *
 * A system source has no `dataSource.table`, so there is no `app.tables` entry
 * to resolve a field list from — and the filter builder's Field select is
 * populated from exactly that list. The result was an empty select under a live
 * "Add filter" button on every system-source grid, at any data volume: the
 * operator could commit a filter that narrowed nothing, and the grid answered
 * with the same rows.
 *
 * The author's DECLARED COLUMNS are the field vocabulary in that case — they
 * are what the header row already shows, so offering them is offering what the
 * operator can see. Each column's `label` rides along as its display name for
 * the same reason: a Field select naming `automationName` where the header says
 * `Automatisation` asks the operator to translate.
 *
 * Only the fields and their labels are derived. Types, options, permissions and
 * views stay absent — an endpoint row has no declared type, and inventing one
 * would put type-specific operators in front of values that may not match.
 */
function resolveSystemSourceColumnInputs(component: Component): TypeSpecificResolvedInputs {
  const source = 'dataSource' in component ? component.dataSource : undefined
  if (!source || !(typeof source === 'object' && 'system' in source)) return EMPTY_RESOLVED

  const columns = ('columns' in component ? component.columns : undefined) as
    ReadonlyArray<{ readonly field?: unknown; readonly label?: unknown }> | undefined
  const declared = (columns ?? []).filter(
    (column): column is { readonly field: string; readonly label?: string } =>
      typeof column.field === 'string' && column.field.length > 0
  )
  if (declared.length === 0) return EMPTY_RESOLVED

  return {
    ...EMPTY_RESOLVED,
    dataTableTableFields: declared.map((column) => column.field),
    dataTableFieldMeta: Object.fromEntries(
      declared.map((column) => [
        column.field,
        typeof column.label === 'string' ? { label: column.label } : {},
      ])
    ),
  }
}

function resolveDataTableInputs(table: Tables[number]): TypeSpecificResolvedInputs {
  return {
    dataTableTableFields: table.fields.map((f) => f.name),
    dataTableFieldMeta: Object.fromEntries(
      table.fields.map((f) => {
        const field = f as Readonly<Record<string, unknown>>
        const display = resolveFieldDisplayMeta(field)
        const edit = resolveFieldEditMeta(field)
        return [
          f.name,
          {
            type: f.type,
            // The field's external display name, which titles its auto-generated
            // column header in place of the raw `name`. Read through the shared
            // reader so a `button` field's `label` — its own caption — is not
            // mistaken for one.
            ...(declaredFieldLabel(field) === undefined
              ? {}
              : { label: declaredFieldLabel(field) }),
            ...('options' in f && f.options ? { options: f.options } : {}),
            ...('required' in f && f.required ? { required: true } : {}),
            ...(display ? { display } : {}),
            ...(edit ? { edit } : {}),
            ...resolveButtonFieldMeta(f),
          },
        ]
      })
    ),
    dataTablePermissions: table.permissions,
    dataTableViews: resolveDataTableViews(
      table.views as ReadonlyArray<Record<string, unknown>> | undefined
    ),
    kanbanColumnOptions: undefined,
    kanbanColumnColors: undefined,
    kanbanSwimlaneOptions: undefined,
    colorFieldColors: undefined,
  }
}

/**
 * The field a record view colours its records BY, per surface.
 *
 * Each surface is read at the spelling its own renderer reads, so the resolved
 * colour map and the value it is looked up with can never come from two
 * different fields:
 *  - kanban paints from `card.colorField` (`kanban/card-resolvers.ts`);
 *  - calendar from the top-level `colorField` (`calendar/record-to-event.ts`);
 *  - data-timeline from `props.colorField` (`timeline/timeline-compute.ts`);
 *  - data-table from `rowColorField` (`data-table/row-color.ts`), the grid's
 *    own spelling of the same idea — a fourth spelling, deliberately, because
 *    a grid already has a `colorField`-shaped decision per COLUMN and reusing
 *    the bare name there would read as "colour the cells".
 */
function resolveRecordViewColorField(type: string, component: Component): string | undefined {
  const c = component as {
    readonly colorField?: string
    readonly rowColorField?: string
    readonly card?: { readonly colorField?: string }
    readonly props?: { readonly colorField?: string }
  }
  if (type === 'kanban') return c.card?.colorField
  if (type === 'timeline') return c.props?.colorField
  if (type === 'table') return c.rowColorField
  return c.colorField
}

/**
 * The kanban board's four table-derived inputs: both axes' declared options,
 * the column axis' option colours, and the card's `colorField` palette.
 *
 * Its own function so {@link resolveTypeSpecificInputs} stays inside the
 * complexity cap — the board is the only component type needing four of these,
 * and the second axis is what tipped it over.
 */
function resolveKanbanInputs(
  component: Component,
  tables: Tables | undefined
): TypeSpecificResolvedInputs {
  const table = resolveSourceTable(component, tables)
  if (!table) return EMPTY_RESOLVED
  return {
    ...EMPTY_RESOLVED,
    kanbanColumnOptions: resolveKanbanColumnOptions(table, component),
    kanbanColumnColors: resolveKanbanColumnColors(table, component),
    kanbanSwimlaneOptions: resolveKanbanSwimlaneOptions(table, component),
    colorFieldColors: resolveFieldOptionColors(
      table,
      resolveRecordViewColorField('kanban', component)
    ),
  }
}

/**
 * Resolve the type-specific inputs (from `app.tables`) that the element-props
 * builder lifts to the top level for data-table and kanban components.
 *
 * These properties live on the Component object (not in `component.props`) and
 * need forwarding to the island placeholder renderer. For all other types the
 * empty resolved bundle is returned.
 *
 * @param type - The component type literal
 * @param component - The (variable-substituted) component
 * @param tables - The app's tables (used to resolve the referenced table)
 * @returns The resolved inputs consumed by `buildTypeSpecificElementProps`
 */
export function resolveTypeSpecificInputs(
  type: string,
  component: Component,
  tables: Tables | undefined
): TypeSpecificResolvedInputs {
  if (type === 'table') {
    const table = resolveSourceTable(component, tables)
    if (!table) return resolveSystemSourceColumnInputs(component)
    return {
      ...resolveDataTableInputs(table),
      // Same resolver, same slot as the three record views — the grid is the
      // fourth surface in the `colorField` family, not a second mechanism.
      colorFieldColors: resolveFieldOptionColors(
        table,
        resolveRecordViewColorField(type, component)
      ),
    }
  }

  if (type === 'kanban') return resolveKanbanInputs(component, tables)

  if (type === 'calendar' || type === 'timeline') {
    const table = resolveSourceTable(component, tables)
    return {
      ...EMPTY_RESOLVED,
      colorFieldColors: table
        ? resolveFieldOptionColors(table, resolveRecordViewColorField(type, component))
        : undefined,
    }
  }

  return EMPTY_RESOLVED
}

/**
 * Per-type element-props builder. Each entry receives the base element props
 * (already carrying `data-component-type`) and returns the type-specific
 * element props forwarded to the island/component renderer.
 *
 * Behaviour MUST stay byte-identical to the previous nested ternary: the same
 * keys, in the same order, with the same source expressions.
 *
 * Keyed by `ComponentType` rather than by bare `string`, so each entry's
 * `component` is that ONE branch of the schema: the data-table entry may read
 * `views` and `autoSave` and may NOT read `chartType`. That is the whole reason
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
const gridDrawingProps = (component: {
  readonly rowHeight?: unknown
  readonly layout?: unknown
  readonly striped?: unknown
  readonly bordered?: unknown
  readonly showRowNumbers?: unknown
}): Record<string, unknown> => ({
  rowHeight: component.rowHeight,
  layout: component.layout,
  striped: component.striped,
  bordered: component.bordered,
  showRowNumbers: component.showRowNumbers,
})

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
      columns: component.columns,
      selection: component.selection,
      pagination: component.pagination,
      search: component.search,
      groupBy: component.groupBy,
      summary: component.summary,
      // View-type switcher. `views` is the ordered
      // set the toolbar offers, `viewLabels` their localizable accessible names,
      // and the two bindings are what the non-grid views need in order to render.
      views: component.views,
      // Forwarded raw: `$t:` tokens in `viewLabels` are resolved for every
      // lifted field at once, at this builder's single exit. It used to resolve
      // its own tokens here, which is why the switcher could be bilingual while
      // a kpi `label` next to it could not — see `buildTypeSpecificElementProps`.
      viewLabels: component.viewLabels,
      kanbanGroupBy: component.kanbanGroupBy,
      dateField: component.dateField,
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
      fieldMeta: withRelatedCreateGates(
        resolved.dataTableFieldMeta,
        (componentProps as { _canCreateRelated?: Readonly<Record<string, boolean>> } | undefined)
          ?._canCreateRelated
      ),
      tablePermissions: resolved.dataTablePermissions,
      tableViews: resolved.dataTableViews,
      // Render-time create-permission gate, stamped
      // into `props._canCreate` by the data-source resolver where the session role
      // is known. Forwarded to the island so the toolbar offers the "Nouvel
      // enregistrement" create affordance only when the current role may create.
      // Absent (undefined) when auth is not configured → the island defaults to
      // offering it (full-access model).
      canCreate: (componentProps as { _canCreate?: boolean } | undefined)?._canCreate,
      // Render-time update-permission gate, stamped by
      // the same data-source resolver. It is the permission-derived DEFAULT for a
      // column's `editable` — the one `ColumnSchema.editable` has always been
      // annotated with ("default: from table permissions"). An explicit `editable`
      // on the column still wins in both directions; absent (auth not configured,
      // or the table declares no `update` grant) the grid stays read-only.
      canUpdate: (componentProps as { _canUpdate?: boolean } | undefined)?._canUpdate,
      // Interpreter-provided create-record label, resolved against the
      // active language: English default ("New record"), French built-in, author
      // `languages.translations['datatable.newRecord']` override wins. Consumed by
      // the toolbar create button + the create modal title/aria-label so the
      // interpreter never leaks hard-coded French onto a non-French surface.
      newRecordLabel: resolveInterpreterString('datatable.newRecord', currentLang, languages),
      // The grid's other two interpreter-provided control labels, resolved the same
      // way: the create dialog's footer pair, and the inline editor's commit /
      // dismiss pair (an `editSelect.saveLabel` still overrides the commit).
      saveLabel: resolveInterpreterString('datatable.save', currentLang, languages),
      cancelLabel: resolveInterpreterString('datatable.cancel', currentLang, languages),
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

  chart: ({ baseElementPropsWithType, component }) => ({
    ...baseElementPropsWithType,
    dataSource: component.dataSource,
    chartType: component.chartType,
    xAxis: component.xAxis,
    yAxis: component.yAxis,
    series: component.series,
    legend: component.legend,
    tooltip: component.tooltip,
    chartAggregate: component.chartAggregate,
    emptyMessage: component.emptyMessage,
    // Optional NAMED empty-state region: forwarded
    // so a system-bound chart with zero rows renders an accessible `role="region"`
    // (name + title) instead of the default unnamed empty placeholder.
    emptyState: component.emptyState,
  }),

  kpi: ({ baseElementPropsWithType, component }) => ({
    ...baseElementPropsWithType,
    dataSource: component.dataSource,
    label: component.label,
    kpiAggregate: component.kpiAggregate,
    kpiFormat: component.kpiFormat,
    icon: component.icon,
    trend: component.trend,
    thresholds: component.thresholds,
    sparkline: component.sparkline,
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
 * entry above happened to resolve one, and only `viewLabels` did. That made an
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
 * `app.tables`: field labels, view names, the kanban axes.
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
  return resolveLiftedTranslationTokens(lifted, args.currentLang, args.languages)
}
