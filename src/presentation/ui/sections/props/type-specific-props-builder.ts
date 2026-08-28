/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  resolveInterpreterString,
  resolveTranslationTokensDeep,
} from '@/domain/utils/translation-resolver'
import { declaredFieldLabel } from '@/presentation/utils/field-display'
import { resolveDataTableViews, type ResolvedDataTableView } from './resolve-data-table-views'
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

const EMPTY_RESOLVED: TypeSpecificResolvedInputs = {
  dataTableTableFields: undefined,
  dataTableFieldMeta: undefined,
  dataTablePermissions: undefined,
  dataTableViews: undefined,
  kanbanColumnOptions: undefined,
  kanbanColumnColors: undefined,
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
 * The declared field properties a read-only grid cell needs in the browser.
 *
 * `dataTableFieldMeta` used to be built as exactly `{ type, options?, required? }`,
 * so every other declared property was dropped at this boundary: a rating knew
 * neither its `max` nor its `style`, a progress bar never saw the `color` its
 * author chose, a barcode lost its symbology, a duration lost its
 * `displayFormat` and a currency lost its code — which is why every currency
 * column rendered `$` whatever the field declared. One allowlist carries all of
 * them across.
 *
 * An allowlist rather than a spread: `dataTableFieldMeta` is serialised into
 * the island's `data-island-props` attribute on every page that draws a grid,
 * so forwarding the whole field (descriptions, permissions, validation rules)
 * would put bytes on the wire that no renderer reads.
 */
const DISPLAY_META_KEYS = [
  // rating
  'max',
  'style',
  // progress
  'color',
  // barcode (also the legacy `duration.format`)
  'format',
  // duration
  'displayFormat',
  // currency
  'currency',
  'precision',
  'symbolPosition',
  'negativeFormat',
  'thousandsSeparator',
] as const

/**
 * The declared field properties an EDITABLE grid cell needs in the browser.
 *
 * A sibling allowlist to {@link DISPLAY_META_KEYS} rather than an extension of
 * it, because none of these change how a cell READS. Folding a bucket name or a
 * Tiptap toolbar into a struct called `display` would make both halves harder
 * to reason about, so they travel in their own `edit` bag.
 *
 * Every key gates an editor that cannot function without it: a record picker
 * with no `relatedTable` has nothing to search, an attachment cell with no
 * `storeMetadata` cannot know whether its column is `VARCHAR(255)` or `JSONB`,
 * and a datetime cell with no `timeZone` shows a different instant from the
 * read-only renderer beside it.
 *
 * `timezone` (lowercase) is deliberately absent: `DateTimeFieldSchema` declares
 * it, nothing reads it, and forwarding it would make the inert twin look wired.
 */
const EDIT_META_KEYS = [
  // relationship — which table to search, and the column to search it on
  'relatedTable',
  'displayField',
  'relationType',
  // relationship + user — whether the column holds one key or a list of them
  'allowMultiple',
  // attachments — the upload target and the shape its column accepts
  'bucket',
  'storeMetadata',
  'allowedFileTypes',
  'maxFileSize',
  'maxFiles',
  // rich-text — the declared editor surface
  'toolbar',
  'placeholder',
  'maxLength',
  // datetime — the zone the instant is resolved into (capital Z; see above)
  'timeZone',
] as const

function pickDeclaredKeys(
  field: Readonly<Record<string, unknown>>,
  keys: readonly string[]
): Record<string, unknown> | undefined {
  const entries = keys
    .filter((key) => field[key] !== undefined)
    .map((key) => [key, field[key]] as const)
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

/** Pick the declared display properties a field carries, or `undefined` when it carries none. */
function resolveFieldDisplayMeta(
  field: Readonly<Record<string, unknown>>
): Record<string, unknown> | undefined {
  return pickDeclaredKeys(field, DISPLAY_META_KEYS)
}

/** Pick the declared editor properties a field carries, or `undefined` when it carries none. */
function resolveFieldEditMeta(
  field: Readonly<Record<string, unknown>>
): Record<string, unknown> | undefined {
  return pickDeclaredKeys(field, EDIT_META_KEYS)
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
    colorFieldColors: undefined,
  }
}

/** An option on a select/status field: a plain string, or a `{ value, color }` object. */
type FieldOption = string | { readonly value: string; readonly color?: string }

/**
 * Build an `optionValue → hex color` map from ONE named field's declared
 * options, or `undefined` when the field declares none.
 *
 * The single resolver behind every author-declared colour a page component
 * reads: the kanban column-header accents (keyed on `kanbanGroupBy.field`) and
 * the record views' `colorField`. They differ only in which field they name, so
 * they must not differ in how a declaration is read — a second resolver is how
 * "a status option's colour" ends up meaning two things on one page.
 *
 * Plain-string options (a bare `single-select`) carry no colour and yield
 * `undefined`, which is what keeps this an opt-in.
 */
function resolveFieldOptionColors(
  table: Tables[number],
  fieldName: string | undefined
): Readonly<Record<string, string>> | undefined {
  if (!fieldName) return undefined
  const field = table.fields.find((f) => f.name === fieldName)
  if (!field || !('options' in field) || !Array.isArray(field.options)) return undefined
  const colored = (field.options as readonly FieldOption[]).flatMap((opt) =>
    typeof opt === 'string' || !opt.color ? [] : [[opt.value, opt.color] as const]
  )
  return colored.length > 0 ? Object.fromEntries(colored) : undefined
}

/**
 * Resolve the groupBy field's declared options from `app.tables`, or `undefined`
 * when the component has no `kanbanGroupBy.field` or the field carries no options.
 */
function resolveKanbanGroupByOptions(
  table: Tables[number],
  component: Component
): readonly FieldOption[] | undefined {
  const groupByField = (component as { kanbanGroupBy?: { field?: string } }).kanbanGroupBy?.field
  if (!groupByField) return undefined
  const groupField = table.fields.find((f) => f.name === groupByField)
  if (groupField && 'options' in groupField && Array.isArray(groupField.options)) {
    return groupField.options as readonly FieldOption[]
  }
  return undefined
}

/**
 * Resolve the kanban groupBy column options from `app.tables` so empty columns
 * (defined by select/status options but unused in the data) still render.
 *
 * Options are normalised to their string `value`: a `single-select` declares
 * plain strings, but a `status` field declares `{ value, color }` objects. The
 * board buckets/labels columns by string value only, so returning the raw object
 * makes each column key an object → React "object as child" crash. Mapping to
 * `.value` keeps `columnOptions` a `readonly string[]` for both field shapes.
 */
function resolveKanbanColumnOptions(
  table: Tables[number],
  component: Component
): readonly string[] | undefined {
  const options = resolveKanbanGroupByOptions(table, component)
  return options?.map((opt) => (typeof opt === 'string' ? opt : opt.value))
}

/**
 * Resolve a `columnValue → hex color` map from a colored `status` groupBy field,
 * so each column can surface its option color as a header accent. Returns
 * `undefined` for plain string options (a `single-select`), which carry no color.
 */
function resolveKanbanColumnColors(
  table: Tables[number],
  component: Component
): Readonly<Record<string, string>> | undefined {
  const groupByField = (component as { kanbanGroupBy?: { field?: string } }).kanbanGroupBy?.field
  return resolveFieldOptionColors(table, groupByField)
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
  if (type === 'data-timeline') return c.props?.colorField
  if (type === 'data-table') return c.rowColorField
  return c.colorField
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
  if (type === 'data-table') {
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

  if (type === 'kanban') {
    const table = resolveSourceTable(component, tables)
    return {
      ...EMPTY_RESOLVED,
      kanbanColumnOptions: table ? resolveKanbanColumnOptions(table, component) : undefined,
      kanbanColumnColors: table ? resolveKanbanColumnColors(table, component) : undefined,
      colorFieldColors: table
        ? resolveFieldOptionColors(table, resolveRecordViewColorField(type, component))
        : undefined,
    }
  }

  if (type === 'calendar' || type === 'data-timeline') {
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
const TYPE_BUILDERS: {
  readonly [K in ComponentType]?: (args: BuilderArgs<ComponentOfType<K>>) => Record<string, unknown>
} = {
  'data-table': ({
    baseElementPropsWithType,
    component,
    componentProps,
    resolved,
    currentLang,
    languages,
  }) => ({
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
    // Resolved, not forwarded raw. `viewLabels` moved the switcher's names out
    // of hard-coded English and into config — but a raw passthrough lets a
    // config hold only ONE language, so a bilingual app still had to choose
    // which of its audiences the switcher announced itself to. Resolving `$t:`
    // tokens here (the same treatment `triggerLabel` / `menuItems` / `navItems`
    // already get, and the same language inputs `newRecordLabel` uses four
    // lines below) lets one declaration serve `en` and `fr`:
    //   viewLabels: { grid: '$t:views.grid', kanban: '$t:views.kanban' }
    // A plain string is returned untouched, so existing configs are unaffected.
    viewLabels: resolveTranslationTokensDeep(component.viewLabels, currentLang, languages),
    kanbanGroupBy: component.kanbanGroupBy,
    dateField: component.dateField,
    toolbar: component.toolbar,
    bulkActions: component.bulkActions,
    rowHeight: component.rowHeight,
    striped: component.striped,
    // Row fill by declared option colour: the field the author named, plus the
    // `optionValue → hex` map resolved from `app.tables`. A filled row
    // suppresses its stripe and moves hover/selection off the fill channel.
    rowColorField: component.rowColorField,
    rowColorFieldColors: resolved.colorFieldColors,
    bordered: component.bordered,
    emptyMessage: component.emptyMessage,
    noMatchMessage: component.noMatchMessage,
    showRowNumbers: component.showRowNumbers,
    onRowClick: component.onRowClick,
    autoSave: component.autoSave,
    tableFields: resolved.dataTableTableFields,
    fieldMeta: resolved.dataTableFieldMeta,
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
  }),

  kanban: ({ baseElementPropsWithType, component, resolved }) => ({
    ...baseElementPropsWithType,
    dataSource: component.dataSource,
    kanbanGroupBy: component.kanbanGroupBy,
    card: component.card,
    drag: component.drag,
    emptyColumnMessage: component.emptyColumnMessage,
    colorField: component.colorField,
    columnOptions: resolved.kanbanColumnOptions,
    columnColors: resolved.kanbanColumnColors,
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

  'data-timeline': ({ baseElementPropsWithType, component, componentProps, resolved }) => ({
    ...baseElementPropsWithType,
    // The data-timeline display bindings live inside the freeform `props`
    // object (startField/endField/...); lift them to the top level so the
    // island placeholder extractor (`extractTimelineProps`) can read them.
    dataSource: component.dataSource,
    startField: componentProps?.startField,
    endField: componentProps?.endField,
    labelField: componentProps?.labelField,
    groupBy: componentProps?.groupBy,
    colorField: componentProps?.colorField,
    colorFieldColors: resolved.colorFieldColors,
    defaultZoom: componentProps?.defaultZoom,
    // `props.emptyMessage` only. The former `component.emptyMessage ?? …` read a
    // top-level key `dataTimelineFields` does not declare, so its left operand
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
}

/**
 * Build the type-specific element props forwarded to the island/component
 * renderer for a given component `type`.
 *
 * For types without a dedicated builder, the base element props (already
 * carrying `data-component-type`) are returned unchanged.
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
  return builder ? builder(args) : args.baseElementPropsWithType
}
