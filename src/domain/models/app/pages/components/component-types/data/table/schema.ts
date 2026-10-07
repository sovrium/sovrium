/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { resolvesWithoutAppTablesEntry } from '@/domain/models/app/pages/table-name-references'
import { isSystemFieldName } from '@/domain/models/app/tables/system-fields'
import { SystemSourceRefSchema } from '../../../../../system-sources'
import { RowClickActionSchema } from '../../../action'
import { AuthSourceSchema } from '../../../auth-source'
import { DataSourceSchema } from '../../../data-source'
import { DataTablePaginationSchema } from '../../../pagination'
import { optBool } from '../../../shared-schemas'
import { SystemSourceSchema } from '../../../system-source'
import { coreFields } from '../../modules/core'
import { dataBoundFields } from '../../modules/data-bound'
import { i18nFields } from '../../modules/i18n'
import { responsiveFields } from '../../modules/responsive'
import { visibilityFields } from '../../modules/visibility'
import { DataTableBulkActionSchema } from './bulk-actions'
import { validateColumnDisplayFields } from './column-display-field-validation'
import { DataTableColumnSchema } from './columns'
import { DataTableLayoutSchema } from './layout'
import { DataTableRowExpandConfigSchema } from './row-expand'
import { DataTableSelectionSchema } from './selection'
import { staticRowFields } from './static-rows'
import { DataTableSummaryItemSchema } from './summary'
import {
  collectDataTableComponents,
  collectDataTableRowColorBindings,
} from './table-components-service'
import { DataTableToolbarSchema } from './toolbar'

// Re-exported through this module — and so through the directory barrel — for
// the same reason `tableFields` was consolidated here: a data-table's config
// surface has ONE public face, and a type reachable only by its own file path is
// how a consumer ends up hand-rolling the shape instead of importing it.
export type { DataTableRowExpand } from './row-expand'
export type { DataTableLayout } from './layout'
export { DataTableLayoutSchema } from './layout'

// ---------------------------------------------------------------------------
// Row height
// ---------------------------------------------------------------------------

export const RowHeightSchema = Schema.Literals(['short', 'medium', 'tall']).annotate({
  title: 'Row Height',
  description: 'Table row height preset (default: medium)',
})

// ---------------------------------------------------------------------------
// Data source binding (discriminated: DB table OR system read endpoint)
// ---------------------------------------------------------------------------

/**
 * DB-table data source — the shared {@link DataSourceSchema}, which is what
 * actually DECODES.
 *
 * An alias, not a second hand-written schema: a separate definition driving the
 * `DataTable` TYPE and this file's cross-validator would drift from the record
 * `ComponentSchema` really decodes — a key on the type, documented and
 * cross-checked, yet REJECTED by `sovrium validate` as an unknown property.
 *
 * The name is kept so this file's validators read naturally, but it is the
 * shared definition — there is no second source to drift from.
 */
export const DataTableDbDataSourceSchema = DataSourceSchema

/**
 * System read-endpoint binding for the data-table grid.
 *
 * This is the SHARED, generalized rows-envelope `SystemSourceSchema` (lifted to
 * `components/system-source.ts` so the whole rows-oriented data-bound family can
 * reuse one definition). It is re-exported here under the data-table-specific
 * name so existing importers (`data-table/index.ts`, the presentation islands'
 * `DataTableSystemSource` type) keep their stable public names — the shape is
 * byte-identical (`endpoint`, `rowsKey?`, `idKey?`, `totalKey?`, `query?`).
 *
 * Grid-specific runtime semantics when this variant is used:
 *  - the grid fetches `system.endpoint` (merging `system.query` static params
 *    with the table's own sort/search/filter params) instead of
 *    `/api/tables/:t/records`;
 *  - the `{ [rowsKey]: [...rows] }` response envelope is normalized to the grid's
 *    `{ records, total }` (total = `[totalKey]` if present, else rows length),
 *    and config `columns` (label + field key + cell type incl. status badges via
 *    `cellStyle`) render against those rows;
 *  - `app.tables` column cross-validation is SKIPPED (the columns describe the
 *    endpoint's shape, not a declared table);
 *  - DB-table-only features are gated OFF: record CRUD writes, realtime/SSE,
 *    and CSV import. Sort / filter / search / pagination remain ON (read-only,
 *    endpoint/client-side).
 *
 * @example
 * ```yaml
 * dataSource:
 *   system:
 *     endpoint: /api/admin/automations/runs
 *     rowsKey: items        # default 'items'
 *     idKey: id             # default 'id'
 *     totalKey: total       # optional; falls back to rows length
 *     query:                # optional STATIC params merged into every request
 *       status: failed
 * ```
 */
export const DataTableSystemSourceSchema = SystemSourceSchema

/**
 * Data source binding — discriminated by which key is present:
 * - `{ table, filter?, sort?, ... }`   → DB-table binding (the shared `DataSource`)
 * - `{ system: { endpoint, ... } }`    → inline system read-endpoint binding
 * - `{ systemSource: <name> }`         → named-catalog shorthand (CAP-4): resolves
 *   to the `app.systemSources[]` entry of that name, then behaves exactly like the
 *   inline `{ system }` form. The referenced name is cross-validated against the
 *   catalog at decode time (`validateAllSystemSourceReferences`).
 *
 * This union is THE one the decoder uses: {@link tableFields} spreads it, and
 * {@link DataTableSchema} is built from those same fields. There is no second
 * copy to keep in step.
 */
export const DataTableDataSourceSchema = Schema.Union([
  DataTableDbDataSourceSchema,
  Schema.Struct({
    /** Inline system read-endpoint binding (mutually exclusive with the DB-table form) */
    system: DataTableSystemSourceSchema,
  }).annotate({
    title: 'Data Table System Data Source',
    description: 'System read-endpoint binding for the data table',
  }),
  SystemSourceRefSchema,
  AuthSourceSchema,
]).annotate({
  identifier: 'DataTableComponentDataSource',
  title: 'Data Table Data Source',
  description:
    'DB-table binding (DataSource), an inline system read-endpoint binding, a named app.systemSources reference, OR an account list the server scopes to the reader (auth)',
})

// ---------------------------------------------------------------------------
// tableFields — the ONE definition of a table's config surface
// ---------------------------------------------------------------------------

/**
 * Every key a `type: 'table'` component accepts, in BOTH of its modes.
 *
 * This record is what `ComponentSchema` DECODES (via `buildComponentUnion`) and
 * what {@link DataTableSchema} — and therefore the `DataTable` type and this
 * file's cross-validators — is built from. One list, both jobs.
 *
 * It lives in `schema.ts` rather than the sibling `index.ts` purely to break the
 * import cycle that deriving the composite would otherwise create; `index.ts`
 * re-exports it, so every existing import path is unchanged.
 *
 * ─── WHAT A GRID DOES NOT DECLARE ──────────────────────────────────────────
 *
 * A way of looking at a table is CONFIGURATION ON THE TABLE, never a feature of
 * a page component: lasting filters, sorts, grouping and the visible field set
 * are a view in `tables[].views[]`, and the grid binds it with
 * `dataSource.view`. So the grid carries no `views` switcher, no `viewLabels`,
 * no `groupBy`, no `kanbanGroupBy`/`dateField` for switched-in board and
 * calendar modes, and its toolbar no saved-views menu, density, column toggle or
 * group-by picker — a board and a calendar of the same records are a `kanban`
 * and a `calendar` component, each with its own binding. Every removed key is
 * refused at load with a message naming its replacement
 * (`removed-table-keys.ts`). Bound to a table directly, the grid may still
 * narrow it with `dataSource.filter` / `dataSource.sort`; bound to a view, the
 * view owns those and the grid must not redeclare them.
 *
 * ─── ONE BAG, TWO MODES ────────────────────────────────────────────────────
 *
 * `static-table` folded into this type, and its three keys arrive through
 * {@link staticRowFields}. `dataSource` chooses which mode renders: declare one
 * and the grid island mounts, omit it and the authored rows are served as a
 * plain `<table>`. The other mode's keys are then INERT rather than refused,
 * which is this reshape's default everywhere; the one pair refused by name is
 * `tableRows` beside `dataSource`, because there the binding wins and the
 * author's rows disappear with nothing on the page to say so
 * (`component-xor-rules.ts`).
 *
 * The NAME this record carries is load-bearing, not cosmetic:
 * `[internal ref]` reaches an island type's schema
 * only through the `<type>Fields` convention, so a `table` whose bag were still
 * called `dataTableFields` would silently stop being covered.
 */
export const tableFields = {
  ...coreFields,
  ...responsiveFields,
  ...visibilityFields,
  ...i18nFields,
  ...dataBoundFields,
  ...staticRowFields,
  /**
   * The table's `dataSource` is discriminated: the shared DB-table binding
   * (`DataSourceSchema` — `{ table, ... }`), an inline system read-endpoint
   * binding (`{ system: { endpoint, ... } }`), OR the named-catalog shorthand
   * (`{ systemSource: <name> }`, CAP-4) which resolves to an `app.systemSources[]`
   * entry. This OVERRIDES the optional `dataSource` spread by `dataBoundFields`
   * (DB-table-only) so the system variants are confined to `table` and
   * never leak onto other data-bound components.
   */
  dataSource: Schema.optional(DataTableDataSourceSchema),
  columns: Schema.optional(
    Schema.Array(DataTableColumnSchema).pipe(
      Schema.annotate({ description: 'Column definitions for table component' }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /**
   * Derive the columns from the bound table's declared fields instead of
   * authoring them.
   *
   * ─── WHAT IT IS FOR ────────────────────────────────────────────────────────
   *
   * A grid over a table named by the URL (`dataSource.table: $param.table`)
   * cannot enumerate its own columns: the page definition does not know which
   * table it will be asked for, and the operator's tables are not knowable when
   * the config is written. `columnsFrom: table` closes exactly that — ONE page
   * definition becomes a records explorer over every table the app declares.
   *
   * ─── WHY NOT A SYSTEM SOURCE INSTEAD ──────────────────────────────────────
   *
   * Re-binding such a grid to a system source over `/api/tables/:table/records`
   * looks equivalent and is not: inline edit, the typed create modal, the
   * `_canCreate` gate and the column derivation are all gated on
   * `!isSystemSource` by construction. A system source would render rows and
   * silently drop the entire record-CRUD feature set the grid exists for.
   *
   * ─── WHAT "DERIVED" MEANS ──────────────────────────────────────────────────
   *
   * One column per declared field, in declaration order, HONOURING field-level
   * read permissions for the requesting session — a field the caller may not
   * read yields no column, exactly as an authored one would be dropped. The
   * derivation is server-side, so a forbidden field's name never reaches the
   * client.
   *
   * Exclusive with `columns`, and requires a `dataSource.table`; both are decode
   * errors (`collectPageBindingViolations`).
   *
   * @example
   * ```yaml
   * path: /records/:table
   * components:
   *   - type: table
   *     dataSource: { table: $param.table }
   *     columnsFrom: table
   * ```
   */
  columnsFrom: Schema.optional(
    Schema.Literal('table').annotate({
      identifier: 'DataTableColumnsFrom',
      title: 'Data Table Derived Columns',
      description:
        'Derive one column per declared field of the bound table, honouring field-level read permissions. Mutually exclusive with columns; requires a dataSource.table.',
    })
  ),
  selection: Schema.optional(DataTableSelectionSchema),
  pagination: Schema.optional(DataTablePaginationSchema),
  summary: Schema.optional(
    Schema.Array(DataTableSummaryItemSchema).pipe(
      Schema.annotate({ description: 'Summary row with aggregate computations' }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  toolbar: Schema.optional(DataTableToolbarSchema),
  /**
   * Draw the grid as a reading, whatever the reader may write: no New record,
   * no Import, no add-row line and no in-cell editing. Search, sort, filters
   * and export stay. Presentation only — the records API answers exactly as it
   * would without it.
   */
  readOnly: optBool(
    'Draw the grid as a reading even for a reader who may write the table: no New record, Import or add-row line and no in-cell editing, while search, sort, filters and export stay. The records API is unchanged.'
  ),
  bulkActions: Schema.optional(
    Schema.Array(DataTableBulkActionSchema).pipe(
      Schema.annotate({ description: 'Actions available when rows are selected' }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  rowHeight: Schema.optional(RowHeightSchema),
  /**
   * Whether the table flows at its natural height (default) or fills a bounded
   * parent and owns its own scroll. See {@link DataTableLayoutSchema} for why
   * the pinned header and the pinned pager are consequences of this one key
   * rather than three separate ones.
   */
  layout: Schema.optional(DataTableLayoutSchema),
  striped: optBool('Alternating row colors'),
  bordered: optBool('Show cell borders'),
  /**
   * Field whose declared option colours fill each row — the grid's spelling of
   * the record views' `colorField`. See `DataTableSchema.rowColorField` for the
   * full contract (no fallback palette; a filled row suppresses striping and
   * moves selection/hover to a non-fill channel).
   */
  rowColorField: Schema.optional(
    Schema.String.annotate({
      description:
        "Field whose declared option colours fill each row. Same grammar as the record views' colorField: the fill comes from the named field's per-option color declarations, and a value declaring none is not filled (no fallback palette). A filled row suppresses striping and moves selection/hover to a non-fill channel so both stay legible over the declared hue.",
      examples: ['order_status', 'priority'],
    })
  ),
  emptyMessage: Schema.optional(
    Schema.String.annotate({ description: 'Message when no records match' })
  ),
  noMatchMessage: Schema.optional(
    Schema.String.annotate({
      description:
        'Message shown when a search/filter reduces a non-empty dataset to zero rows (the no-match state, distinct from emptyMessage). Rendered in an aria-live status region; a {query} token is replaced with the active search string so the message echoes the query. Falls back to emptyMessage when omitted.',
      examples: ['No results for "{query}"', 'Aucun utilisateur ne correspond à « {query} »'],
    })
  ),
  showRowNumbers: Schema.optional(
    Schema.Boolean.annotate({ description: 'Show row number column' })
  ),
  /**
   * Action fired when a row is clicked.
   *
   * Narrowed to the two variants the row-click handler implements
   * (`navigate` / `openDrawer`) — see `RowClickActionSchema`. Accepting the
   * full `ActionSchema` would let six variants validate and then silently do
   * nothing at runtime.
   */
  onRowClick: Schema.optional(RowClickActionSchema),
  /**
   * How the grid reads on a phone. `scroll` (the default) keeps the grid and
   * scrolls it sideways; `rows` turns each row into a two-line item — the
   * first column as its title, the next two as its second line — so a phone
   * reader scans down rather than across. Applies below the `sm` breakpoint
   * only; wider screens always draw the grid.
   */
  phoneLayout: Schema.optional(
    Schema.Literals(['scroll', 'rows']).annotate({
      description:
        'How the grid reads below the sm breakpoint: scroll (default, the grid scrolls sideways) or rows (each row becomes a two-line item, the first column as its title and the next two beneath it).',
    })
  ),
  /**
   * Expand a row into its full record — the grid's own record panel, replacing
   * the `onRowClick: openDrawer` + sibling record-bound `drawer` hand-wiring.
   *
   * `true` derives one control per declared field of the bound table. See
   * `DataTableRowExpandSchema` (`./row-expand.ts`) for what it shows, why the
   * shape is a `boolean | object` union, and where it deliberately stops short
   * of the standalone drawer.
   */
  rowExpand: Schema.optional(DataTableRowExpandConfigSchema),
} as const

/**
 * Data Table Schema — the SAME fields the decoder uses, nothing more.
 *
 * Built from {@link tableFields} rather than re-declared. A second,
 * hand-written `Schema.Struct` with nothing linking it to the decoder's record
 * would drift in both directions (a key typed but rejected at validate, or
 * decoded but absent from `keyof DataTable`). Derivation makes the class of
 * bug unrepresentable: a key added here IS
 * a key the decoder accepts, because there is only one list.
 *
 * `DataTable` (the type) is what {@link validateDataTableColumns} reads, so it
 * now sees `dataSource` as OPTIONAL — which it always was at decode time. The
 * validator already guarded that case; the type simply stopped disagreeing.
 *
 * @example
 * ```yaml
 * type: table
 * dataSource:
 *   table: orders
 * columns:
 *   - field: name
 *     label: Customer
 *     width: 200
 *   - field: status
 *     cellStyle:
 *       - when: { eq: shipped }
 *         className: bg-green-50 text-green-700
 *   - type: actions
 *     width: 80
 *     actions:
 *       - label: Edit
 *         icon: pencil
 *         action:
 *           type: crud
 *           operation: update
 *           table: orders
 * rowHeight: medium
 * striped: true
 * selection:
 *   mode: multiple
 * pagination:
 *   pageSize: 25
 *   pageSizeOptions: [10, 25, 50]
 * toolbar:
 *   search: true
 *   filters: true
 *   export: true
 * bulkActions:
 *   - label: Delete Selected
 *     icon: trash
 *     action:
 *       type: crud
 *       operation: delete
 *       table: orders
 *     confirm: "Delete {count} orders?"
 * ```
 */
export const DataTableSchema = Schema.Struct(tableFields).annotate({
  identifier: 'DataTable',
  title: 'Data Table',
  description:
    'Interactive data grid component. Binds to a table and provides columns, selection, toolbar, grouping, summary, and inline editing.',
})

// ---------------------------------------------------------------------------
// Cross-schema validation
// ---------------------------------------------------------------------------

/**
 * Validates that data table column references point to valid table fields.
 *
 * Checks:
 * - Field columns reference fields that exist in the table
 * - Summary fields exist in the table
 * - dataSource.sort fields exist in the table
 * - dataSource.filter fields exist in the table
 *
 * @param dataTable - The parsed DataTable configuration
 * @param availableTables - Map of table names to their field names
 * @returns An object with `valid: boolean` and `errors: string[]`
 */
export function validateDataTableColumns(
  dataTable: DataTable,
  availableTables: ReadonlyMap<string, readonly string[]>
): { readonly valid: boolean; readonly errors: readonly string[] } {
  // System-source binding: columns describe the endpoint envelope, NOT a declared
  // table — skip app.tables cross-validation entirely (contract requirement #3).
  // The row-expand STRUCTURE rule still applies: it is decidable without a table.
  //
  // `dataSource` is OPTIONAL, and this additionally runs against the RAW parsed
  // config (see `validateDataTableFieldReferences`), where even a declared type
  // is a promise rather than a fact — a bare `'table' in dataSource` threw a
  // TypeError on the five data-tables in `apps/website` and `templates/intranet`
  // that nest their whole config under `props`, turning a validation miss into a
  // crashed CLI. A component with no object `dataSource` binds to nothing this
  // rule can check, so it is skipped exactly as an unresolvable table name is.
  //
  // The decoder does not require `dataSource`, and neither does the type.
  const { dataSource } = dataTable
  const presenceErrors = validateRowExpand(dataTable)
  if (typeof dataSource !== 'object' || dataSource === null || !('table' in dataSource)) {
    return { valid: presenceErrors.length === 0, errors: presenceErrors }
  }
  // Narrowed to "an object carrying a `table` key" above; the field TYPES inside
  // are still unverified raw data, which is why `checkField` ignores non-strings.
  const dbResult = validateDbTableColumns(
    dataTable,
    dataSource as DataTableDbDataSource,
    availableTables
  )
  const errors = [...presenceErrors, ...dbResult.errors]
  return { valid: errors.length === 0, errors }
}

/**
 * DB-table column cross-validation (the original logic). Only reached for the
 * `{ table, ... }` data-source variant — system sources short-circuit before here.
 */
function validateDbTableColumns(
  dataTable: DataTable,
  dbSource: DataTableDbDataSource,
  availableTables: ReadonlyMap<string, readonly string[]>
): { readonly valid: boolean; readonly errors: readonly string[] } {
  // A ROUTE-REFERENCE binding (`table: $param.table`) names a table the request
  // supplies, not one the config declares — so there is nothing here to check
  // it against, and every column reference on such a grid is derived at request
  // time rather than authored. Skipping is the same posture
  // `validateComponentFieldReferences` already takes for an unresolvable table,
  // and the offline question that IS decidable — does the page's `path` declare
  // the segment? — is asked by `collectPageBindingViolations`, which names the
  // reference and the path.
  //
  // A RESERVED name — the `user_access` junction, the design-system fixture —
  // is exempt for the sibling reason: the platform serves it without an
  // `app.tables[]` entry, so its columns come from a route rather than from a
  // declared field list. Both exemptions are read through ONE predicate, shared
  // with `table-name-references.ts`, which asks the same question on every
  // other surface. Asked separately, they drifted: this grid refused the
  // design-system fixture that every other surface accepted.
  if (resolvesWithoutAppTablesEntry(dbSource.table)) return { valid: true, errors: [] }

  const declaredFields = availableTables.get(dbSource.table)

  if (declaredFields === undefined) {
    const tableNames = [...availableTables.keys()]
    return {
      valid: false,
      errors: [
        `Table '${dbSource.table}' not found. Available: ${tableNames.join(', ') || '(none)'}`,
      ],
    }
  }

  // A field reference resolves if the author DECLARED it, or if it names a
  // system column — the intrinsic DDL columns (`id` and the timestamps) and the
  // authorship columns exist without ever appearing in `fields[]`, so checking
  // `fields[]` alone rejects them. Measured against the 19 data-tables shipped
  // in `apps/` + `templates/`, that omission produced exactly one verdict and it
  // was wrong: `dataSource.filter: field 'id'` on the implicit primary key.
  // See `domain/models/app/tables/system-fields.ts` for why the namespace is
  // admitted wholesale rather than adjudicated per context.
  // A non-string `field` is malformed raw config, not a wrong field name. The
  // structural decode owns that verdict; reporting it here too would say the
  // same thing twice in two voices — and interpolating a non-string into the
  // message below would print `field 'undefined'`, which names nothing an author
  // can search for.
  const checkField = (field: unknown, context: string): readonly string[] =>
    typeof field !== 'string' || declaredFields.includes(field) || isSystemFieldName(field)
      ? []
      : [
          `${context}: field '${field}' not found in table '${dbSource.table}'. Available: ${declaredFields.join(', ')}`,
        ]

  const columnErrors: readonly string[] = (dataTable.columns ?? []).flatMap((col) => {
    if ('field' in col && typeof col.field === 'string') {
      return checkField(col.field, 'columns')
    }
    return []
  })

  const summaryErrors: readonly string[] = (dataTable.summary ?? []).flatMap((item) =>
    checkField(item.field, 'summary')
  )

  // A field named in the expanded record must exist, on the same terms as every
  // other field reference. It need NOT be a visible column — showing a field the
  // row omits is the point of expanding — so `columns[]` is not consulted.
  const rowExpandErrors: readonly string[] = declaredRowExpandFields(dataTable).flatMap(
    (field, index) => checkField(field, `rowExpand.fields[${index}]`)
  )

  const dataSourceSortErrors: readonly string[] = (dbSource.sort ?? []).flatMap((s) =>
    checkField(s.field, 'dataSource.sort')
  )

  const dataSourceFilterErrors: readonly string[] = (dbSource.filter ?? []).flatMap((f) =>
    checkField(f.field, 'dataSource.filter')
  )

  const errors = [
    ...columnErrors,
    ...summaryErrors,
    ...rowExpandErrors,
    ...dataSourceSortErrors,
    ...dataSourceFilterErrors,
  ]

  return { valid: errors.length === 0, errors }
}

/**
 * The field names a `rowExpand` DECLARES, or none.
 *
 * `rowExpand` is a `boolean | object` union, so reading `.fields` needs the
 * narrowing done once rather than inline at the call site — which is also what
 * keeps {@link validateDbTableColumns} under its complexity cap.
 */
function declaredRowExpandFields(dataTable: DataTable): readonly string[] {
  const { rowExpand } = dataTable
  return typeof rowExpand === 'object' && rowExpand !== null ? (rowExpand.fields ?? []) : []
}

/**
 * STRUCTURAL half of the row-expand contract — decidable without a table.
 *
 * Two rules, both refusals rather than silent precedence:
 *
 * **1. `rowExpand` and `onRowClick` cannot both be declared.** They are two
 * answers to one question — what a row click does — and the row has one click.
 * Letting either win silently means half of what the author wrote does nothing,
 * which is the class this file's validators exist to refuse. The author is told
 * to keep one: `rowExpand` for the grid's own panel, `onRowClick` to navigate or
 * to open a drawer they configured themselves.
 *
 * **2. A system-source grid may not declare `rowExpand`.** The panel derives its
 * controls from the bound table's field schema; a system read endpoint has none,
 * so a derived expand there would render the drawer island's EMPTY field list —
 * a panel that fetches the record and shows nothing but a Save button. That is a
 * worse failure than the hand-wiring this key replaces, so it is refused with the
 * escape hatch named: a `drawer` bound to `dataSource.system` plus
 * `onRowClick: openDrawer`, where the author's own `recordFields` describe the
 * endpoint envelope. Narrowing with `rowExpand.fields` does not rescue it —
 * `fields` carries names only, and a system entry additionally needs its `type`.
 *
 * The `fields[]` EXISTENCE check is not here: it needs the bound table and so
 * lives with the other field-reference checks in {@link validateDbTableColumns}.
 */
function validateRowExpand(dataTable: DataTable): readonly string[] {
  const { rowExpand, dataSource, onRowClick } = dataTable
  if (rowExpand === undefined || rowExpand === false) return []

  const isSystemBound =
    typeof dataSource === 'object' &&
    dataSource !== null &&
    ('system' in dataSource || 'systemSource' in dataSource)

  return [
    ...(onRowClick === undefined
      ? []
      : [
          'rowExpand and onRowClick cannot both be declared — a row has one click. Keep `rowExpand` for the grid’s own record panel, or `onRowClick` to navigate or open a drawer you configure yourself.',
        ]),
    ...(isSystemBound
      ? [
          'rowExpand is not available on a system-source table — the panel derives its controls from the bound table’s field schema, and a read endpoint has none. Use a `drawer` with `dataSource.system` and its own `recordFields`, opened with `onRowClick: { action: openDrawer, component }`.',
        ]
      : []),
  ]
}

/**
 * Build `tableName → declared field names` from a RAW parsed config.
 *
 * Reads the raw shape rather than a decoded `App` because the caller is the
 * CLI's post-decode sweep, which holds the parsed object.
 */
function collectTableFieldNames(config: unknown): ReadonlyMap<string, readonly string[]> {
  const tables = (config as { readonly tables?: unknown } | null)?.tables
  if (!Array.isArray(tables)) return new Map()
  return new Map(
    tables.flatMap((table: unknown) => {
      const t = table as { readonly name?: unknown; readonly fields?: unknown }
      if (typeof t.name !== 'string' || !Array.isArray(t.fields)) return []
      const names = t.fields.flatMap((field: unknown) => {
        const { name } = field as { readonly name?: unknown }
        return typeof name === 'string' ? [name] : []
      })
      return [[t.name, names] as const]
    })
  )
}

/**
 * Raw-config entry point for the data-table field-reference sweep — the thing
 * that makes {@link validateDataTableColumns} actually run.
 *
 * Without this entry point nothing would cross-check `columns[]`, `summary`,
 * `dataSource.sort` or `dataSource.filter` against the bound table, and a typo
 * in any of them would render an empty column and say nothing.
 *
 * RUN BY THE SHARED DECODE PIPELINE, not only by `sovrium validate`. See
 * `runSemanticChecks` in
 * `application/use-cases/config/decode-app-config.ts` for why a check that fires
 * in one command and not another is itself the divergence the config contract
 * exists to close.
 */
export function validateDataTableFieldReferences(config: unknown): readonly string[] {
  const fieldsByTable = collectTableFieldNames(config)
  return [
    ...collectDataTableComponents(config).flatMap(
      (component) =>
        validateDataTableColumns(component as unknown as DataTable, fieldsByTable).errors
    ),
    // A column's `displayField` names a field of the RELATED table, so it needs
    // field types and relations this name-only map does not carry.
    ...validateColumnDisplayFields(config),
  ]
}

/**
 * EXISTENCE half of the `rowColorField` contract — the field whose option
 * colours fill each row must exist on the bound table.
 *
 * A `rowColorField` naming a field that does not exist paints NOTHING, and
 * paints nothing in exactly the way a correctly-configured grid paints nothing
 * for an undeclared value. There is no runtime signal to tell the two apart, so
 * a typo is indistinguishable from a deliberate opt-out — which makes it a
 * silent config failure of precisely the "validates and does nothing" kind. It
 * is decidable statically, so it is refused wherever a config is read —
 * `validate`, `start` and `build` alike, via the shared decode pipeline. The
 * earlier note here calling it "a pre-flight authoring check, not a new way for
 * a running app to refuse to start" is superseded: a rule that fires under one
 * command and not another is exactly the divergence the config contract exists
 * to close, and the alternative to refusing is not a warning — it is a grid that
 * silently ignores the colour field it was given.
 *
 * Skipped for a system-source binding (`dataSource.system`), which describes an
 * endpoint envelope rather than a declared table and so has no field list to
 * check against — the same short-circuit every other cross-check here takes. An
 * unresolvable table name is skipped too: that is the table rule's error to
 * report, and repeating it here would say the same thing twice in two voices.
 */
export function validateRowColorFields(config: unknown): readonly string[] {
  const fieldsByTable = collectTableFieldNames(config)
  return collectDataTableRowColorBindings(config).flatMap((dataTable) => {
    const field = dataTable.rowColorField
    const table = dataTable.dataSource?.table
    if (field === undefined || table === undefined) return []
    const fields = fieldsByTable.get(table)
    if (fields === undefined || fields.includes(field)) return []
    return [
      `rowColorField: field '${field}' not found in table '${table}'. Available: ${fields.join(', ')}`,
    ]
  })
}

// ---------------------------------------------------------------------------
// Re-exports from extracted files
// ---------------------------------------------------------------------------

export {
  ColumnFormatSchema,
  CellStyleConditionSchema,
  ActionColumnItemSchema,
  FieldColumnSchema,
  ActionColumnSchema,
  DataTableColumnSchema,
} from './columns'
export { DataTableSelectionSchema } from './selection'
export { DataTablePaginationSchema } from '../../../pagination'
export { ComponentSearchSchema } from '../../../component-search'
export { SummaryFunctionSchema, DataTableSummaryItemSchema } from './summary'
export { DataTableToolbarSchema } from './toolbar'
export { DataTableBulkActionSchema } from './bulk-actions'
export { collectDataTableRowColorBindings } from './table-components-service'

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type { ColumnFormat, CellStyleCondition, EditSelect, ActionColumnItem } from './columns'
export type { FieldColumn, ActionColumn, DataTableColumn } from './columns'
export type { DataTableSelection } from './selection'
export type { DataTablePagination } from '../../../pagination'
export type { ComponentSearch } from '../../../component-search'
export type { SummaryFunction, DataTableSummaryItem } from './summary'
export type { DataTableToolbar } from './toolbar'
export type { DataTableBulkAction } from './bulk-actions'
export type RowHeight = Schema.Schema.Type<typeof RowHeightSchema>
export type DataTableDbDataSource = Schema.Schema.Type<typeof DataTableDbDataSourceSchema>
export type DataTableSystemSource = Schema.Schema.Type<typeof DataTableSystemSourceSchema>
export type DataTableDataSource = Schema.Schema.Type<typeof DataTableDataSourceSchema>
export type DataTable = Schema.Schema.Type<typeof DataTableSchema>
