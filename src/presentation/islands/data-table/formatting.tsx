/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  matchesConditionOperators,
  satisfiesFieldCondition,
} from '@/domain/models/shared/condition-operators'
import { formatCurrencyValue, type CurrencyDisplayOptions } from '@/domain/utils/currency-format'
import { resolveDisplayLabel } from '@/presentation/utils/field-display'
import { computeCurrencyDisplayClasses } from '../recipes/field-affordances-default-classes'
import { RecordButton } from '../shared/record-button'
import { ActionButton, type ActionControlLabels } from './action-cell'
import { FIELD_TYPE_TO_CELL_RENDERER } from './cell-renderer-registry'
import type { CellFieldOptions } from './cell-renderers'
import type { FieldMeta, FieldMetaMap } from '../hooks/use-inline-editing'
import type { TableRecord } from '../shared/types'
import type {
  ActionColumn,
  ActionColumnItem,
  CellStyleCondition,
  ColumnFormat,
  DataTableColumn,
  FieldColumn,
} from '@/domain/models/app/pages/components/component-types/data/data-table/schema'
import type { CellContext, ColumnDef } from '@tanstack/react-table'

/**
 * Callback for executing a per-row action button click.
 * The data-table island wires this to a handler that calls the API,
 * shows toast notifications, and refreshes the table.
 */
export type RowActionHandler = (
  action: ActionColumnItem,
  record: TableRecord
) => void | Promise<void>

// ---------------------------------------------------------------------------
// Date formatting helpers
// ---------------------------------------------------------------------------

function formatDate(value: unknown, options: Intl.DateTimeFormatOptions): string {
  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-US', options)
}

function formatRelativeDate(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(date.getTime())) return String(value)
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000)
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 30) return `${diffDays} days ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
  return `${Math.floor(diffDays / 365)} years ago`
}

/**
 * The active page locale for locale-aware cell formats (`relative-time`).
 *
 * Reads the `<html lang>` attribute (set from the page's `meta.lang` via
 * `resolvePageLanguage`), so a French page (`meta.lang: 'fr-FR'`) renders the
 * French short form. Falls back to `en-US` outside a DOM (defensive — data-table
 * cells only render client-side) or when no page lang is set.
 */
export function resolvePageLocale(): string {
  if (typeof document === 'undefined') return 'en-US'
  const { lang } = document.documentElement
  return lang.length > 0 ? lang : 'en-US'
}

/**
 * Signed, locale-aware relative-time format — the bidirectional counterpart to
 * the past-only English `relative-date`. A FUTURE date renders forward
 * ("dans 5 j" in fr), a PAST date backward ("il y a 5 j"), via
 * `Intl.RelativeTimeFormat(locale, { style: 'short' }).format(diffDays, 'day')`.
 * `diffDays` is positive for the future (so a grace-window "scheduled erasure"
 * date reads as a countdown) and negative for the past.
 */
function formatRelativeTime(value: unknown, locale: string): string {
  const date = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(date.getTime())) return String(value)
  const diffDays = Math.round((date.getTime() - Date.now()) / 86_400_000)
  return new Intl.RelativeTimeFormat(locale, { style: 'short' }).format(diffDays, 'day')
}

// ---------------------------------------------------------------------------
// Cell value formatting
// ---------------------------------------------------------------------------

/**
 * Formats a cell value according to the column format specification.
 *
 * `locale` is the active page locale (`resolvePageLocale()`), consumed by the
 * locale-aware `relative-time` format; the other formats are locale-independent.
 *
 * `currencyOptions` carries the bound field's declared currency treatment. It
 * used to be unreachable: this formatter hard-coded `$` and `en-US` while the
 * field's own `currency` never crossed into the browser, so a field declaring
 * `currency: 'EUR'` rendered `$0.35`. The arithmetic now lives in
 * `@/domain/utils/currency-format`, shared with the records API's
 * `?format=display` path, so a grid cell and the formatted API value agree.
 * With no declared properties it falls back to the USD / 2-decimal / comma
 * defaults this formatter always emitted.
 */
export function formatCellValue(
  value: unknown,
  format: ColumnFormat,
  locale: string,
  currencyOptions?: CurrencyDisplayOptions
): string {
  if (value === undefined || value === null) return ''
  const str = String(value)

  const formatters: Record<ColumnFormat, () => string> = {
    truncate: () => (str.length > 50 ? `${str.slice(0, 50)}…` : str),
    currency: () => {
      const num = Number(value)
      return Number.isNaN(num) ? str : formatCurrencyValue(num, currencyOptions)
    },
    percentage: () => {
      const num = Number(value)
      return Number.isNaN(num) ? str : `${num}%`
    },
    compact: () => {
      const num = Number(value)
      return Number.isNaN(num) ? str : Intl.NumberFormat('en', { notation: 'compact' }).format(num)
    },
    'relative-date': () => formatRelativeDate(value),
    // Signed, locale-aware counterpart to the past-only English `relative-date`:
    // a future date renders "dans 5 j" (fr) and a past one "il y a 5 j" via
    // `Intl.RelativeTimeFormat(<page locale>, { style: 'short' })`.
    'relative-time': () => formatRelativeTime(value, locale),
    'short-date': () => formatDate(value, { month: 'short', day: 'numeric', year: 'numeric' }),
    'long-date': () => formatDate(value, { month: 'long', day: 'numeric', year: 'numeric' }),
    datetime: () =>
      formatDate(value, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    'yes-no': () => (value ? 'Yes' : 'No'),
    'check-cross': () => (value ? '✓' : '✗'),
  }

  return formatters[format]()
}

// ---------------------------------------------------------------------------
// Conditional cell styling
// ---------------------------------------------------------------------------

/**
 * Evaluates conditional cell style rules against a cell value.
 * Returns the first matching className or empty string.
 */
export function evaluateCellStyle(
  value: unknown,
  conditions: readonly CellStyleCondition[]
): string {
  const matched = conditions.find((condition) => matchesConditionOperators(condition.when, value))
  return matched?.className ?? ''
}

/**
 * Evaluates an action item's optional `visibleWhen` predicate against a row,
 * via the shared domain matcher — the same one a `button` field's
 * `visibleWhen` spends, so the two cannot drift.
 */
function isActionVisible(action: ActionColumnItem, record: TableRecord): boolean {
  return satisfiesFieldCondition(action.visibleWhen, record)
}

// ---------------------------------------------------------------------------
// Cell renderer builder
// ---------------------------------------------------------------------------

/**
 * Currency + percentage column formats render with the prestyled
 * `tabular-nums` display recipe so a column of monetary / percentage
 * readouts aligns at the decimal point (matches the field-affordance
 * design intent shared with the CRUD-form currency input).
 */
const NUMERIC_DISPLAY_FORMATS = new Set<ColumnFormat>(['currency', 'percentage'])

/**
 * Builds a cell renderer for a field column that applies format and cellStyle.
 *
 * Resolution order for read-only cells (highest precedence first):
 *   1. `col.format` literal — explicit user override (currency / percentage / yes-no / …)
 *   2. `fieldMeta[col.field].type` — field-type-driven affordance (user pill,
 *      status pill, JSON preview, …); only dispatched when no explicit
 *      `format` is set so user overrides always win.
 *   3. `String(value ?? '')` — TanStack Table default passthrough.
 *
 * `col.cellStyle` (conditional className) composes on top of any of the
 * three paths so a status-pill cell can still receive an extra
 * conditionally-applied class without losing its pill chrome.
 */
/**
 * Wraps cell content in a styled `<span>` only when a (non-empty) conditional
 * class is present; otherwise returns the bare content. Centralizing this
 * keeps the per-path `cellStyle` composition out of the cell renderer's
 * control flow (lower complexity, single styling rule).
 */
function wrapWithClass(content: React.ReactNode, className: string): React.ReactNode {
  return className ? <span className={className}>{content}</span> : content
}

/**
 * Build the per-cell options blob a field-type renderer needs, or `undefined`
 * when the field declares nothing a renderer can read.
 *
 * This is the seam the option colour was being dropped at. Both dispatch sites
 * called `renderer({ value })` with no second argument, so `StatusPillCell`'s
 * lookup into `fieldOptions` always missed and every chip fell back to the
 * neutral tone — even though the declared options reach the island intact
 * (`type-specific-props-builder.ts` forwards `f.options` verbatim). Built ONCE
 * per column rather than per cell, so the object identity is stable across rows.
 *
 * `display` is the same story one level up: the props builder narrowed
 * `dataTableFieldMeta` to `{ type, options?, required? }`, so `rating.max`,
 * `progress.color`, `barcode.format` and `duration.displayFormat` never reached
 * the browser at all. Widening that struct is what lets the scalar renderers
 * read the field the author actually declared.
 */
function buildCellFieldOptions(meta: FieldMeta | undefined, locale: string): CellFieldOptions {
  // `timeZone` already travels to the editor; a read-only cell needs the same
  // one, or the grid shows one calendar day and opens on another.
  const timeZone = meta?.edit?.timeZone
  return {
    locale,
    ...(meta?.options ? { selectOptions: meta.options } : {}),
    ...(meta?.display ? { display: meta.display } : {}),
    ...(timeZone ? { timeZone } : {}),
  }
}

/**
 * The declared currency treatment for a column, or `undefined` when the bound
 * field declares none — in which case a `format: 'currency'` column keeps the
 * USD defaults, exactly as before.
 *
 * **A DECLARED CODE drives the symbol, not the field TYPE.** The gate used to
 * be `meta.type === 'currency'`, which is a narrower question than the one that
 * matters and got the wider one wrong: a `formula` computing
 * `unit_price * stock_on_hand` printed `$224,430.90` in the column beside the
 * `€28.63` it was multiplied from. The author had declared `format: currency`
 * on both the field and the column and could do nothing else — the code was
 * thrown away one line before it was needed. `currency` FIELDS are unaffected:
 * their code is required by `CurrencyFieldSchema`, so the first arm still
 * matches every one of them.
 *
 * Exported because the summary footer formats its aggregates through the same
 * column `format` and must apply the same rule — a `sum` under a EUR column has
 * to print `€`, and the grid cell and the total beneath it disagreeing about
 * the symbol would be worse than either being wrong alone.
 */
export function resolveCurrencyOptions(
  meta: FieldMeta | undefined
): CurrencyDisplayOptions | undefined {
  if (!meta) return undefined
  return meta.type === 'currency' || meta.display?.currency !== undefined ? meta.display : undefined
}

/**
 * The slice of the column options a button cell reads. Shared by the explicit
 * and auto-generated column paths, whose own option bags both satisfy it.
 */
interface ButtonCellOptions {
  readonly tableName?: string
  readonly fieldMeta?: FieldMetaMap
  /**
   * Refresh the grid after a run that may have written to the record. The grid
   * is the only surface a button field appears on that has a query cache, so
   * it is the only one that supplies this.
   */
  readonly onButtonInvoked?: () => void
}

/**
 * Build the cell renderer for a `type: 'button'` field, or `undefined` when
 * the field is not one.
 *
 * A button cell is the one field cell that is an ACTION rather than a
 * readout, so it takes the whole row instead of a bare value: `visibleWhen`
 * is evaluated against the record, and an automation button needs the record
 * id to invoke. Returns `undefined` for every other field type so callers can
 * fall through to their normal value-rendering path.
 */
function buildButtonCellRenderer(
  field: string,
  options: ButtonCellOptions
): ((ctx: CellContext<TableRecord, unknown>) => React.ReactNode) | undefined {
  const { tableName, fieldMeta, onButtonInvoked } = options
  const config = fieldMeta?.[field]?.button
  if (!config) return undefined
  return ({ row }: CellContext<TableRecord, unknown>) => (
    <RecordButton
      config={config}
      fieldName={field}
      record={row.original}
      {...(tableName === undefined ? {} : { table: tableName })}
      {...(row.original['id'] === undefined ? {} : { recordId: String(row.original['id']) })}
      {...(onButtonInvoked === undefined ? {} : { onInvoked: onButtonInvoked })}
    />
  )
}

/**
 * The label the records API resolved for a relationship cell, when the bound
 * field declared a `displayField`.
 *
 * A relationship column stores the related row's key, so a cell rendering the
 * stored value shows a number. `_display` carries the resolved label ALONGSIDE
 * that key — a string for a to-one column, a list for a to-many one — and is
 * absent for a column that declared nothing, which is what keeps the
 * identifier showing rather than a label the author never asked for.
 */
function readDisplayLabel(record: TableRecord, field: string): unknown {
  const display = record['_display']
  if (typeof display !== 'object' || display === null) return undefined
  return (display as Record<string, unknown>)[field]
}

function buildFieldCellRenderer(col: FieldColumn, locale: string, options: MapColumnsOptions) {
  const { fieldMeta } = options
  // A button field is an action, not a readout: it short-circuits the whole
  // format / field-type / passthrough ladder below, which has no value to show.
  const buttonRenderer = buildButtonCellRenderer(col.field, options)
  if (buttonRenderer) return buttonRenderer

  // Looked up ONCE. The same entry was previously re-read four times, each
  // optional chain costing a branch, which is what pushed this function over
  // the complexity cap once the button short-circuit above joined it.
  const meta = fieldMeta?.[col.field]
  const fieldTypeRenderer = meta?.type ? FIELD_TYPE_TO_CELL_RENDERER[meta.type] : undefined
  const fieldOptions = buildCellFieldOptions(meta, locale)
  const currencyOptions = resolveCurrencyOptions(meta)

  if (!col.format && !col.cellStyle && !fieldTypeRenderer && !col.valueLabels) return undefined

  return ({ getValue, row }: CellContext<TableRecord, unknown>) =>
    renderValueCell(
      getValue(),
      { col, locale, fieldTypeRenderer, fieldOptions, currencyOptions },
      readDisplayLabel(row.original, col.field)
    )
}

/** The chrome {@link renderValueCell} resolves once per column, not per row. */
interface ValueCellChrome {
  readonly col: FieldColumn
  readonly locale: string
  readonly fieldTypeRenderer:
    (typeof FIELD_TYPE_TO_CELL_RENDERER)[keyof typeof FIELD_TYPE_TO_CELL_RENDERER] | undefined
  readonly fieldOptions: CellFieldOptions | undefined
  readonly currencyOptions: CurrencyDisplayOptions | undefined
}

/**
 * The value-rendering ladder — label substitution, then explicit format, then
 * field-type affordance, then plain text, each wrapped in the `cellStyle` class.
 *
 * Split out of {@link buildFieldCellRenderer} so that neither half carries the
 * combined branch count of the button short-circuit AND this ladder: they were
 * added by two different changes that only met when those changes merged.
 */
function renderValueCell(value: unknown, chrome: ValueCellChrome, displayLabel?: unknown) {
  const { col, locale, fieldTypeRenderer, fieldOptions, currencyOptions } = chrome
  const conditionalClass = col.cellStyle ? evaluateCellStyle(value, col.cellStyle) : ''

  // valueLabels — render-only display-label substitution for known raw values.
  // Highest-precedence display path: an explicit per-value label overrides the
  // format / field-type chrome below. Unmapped values fall through to those
  // paths (passthrough). The record value and the records API contract are
  // never mutated — only the rendered cell text is substituted.
  const label = col.valueLabels?.[String(value)]
  if (label !== undefined) return wrapWithClass(label, conditionalClass)

  // Path 1 — explicit format override
  if (col.format) {
    const displayValue = formatCellValue(value, col.format, locale, currencyOptions)
    const numericClass = NUMERIC_DISPLAY_FORMATS.has(col.format)
      ? computeCurrencyDisplayClasses()
      : ''
    const composed = [numericClass, conditionalClass].filter(Boolean).join(' ')
    return wrapWithClass(displayValue, composed)
  }

  // Path 2 — field-type-driven affordance. A resolved relationship label stands
  // in for the stored key HERE and only here: `valueLabels` and an explicit
  // `format` were both written by an author against the value the column
  // actually stores, so substituting under them would break what they matched on.
  if (fieldTypeRenderer)
    return wrapWithClass(
      fieldTypeRenderer({ value: displayLabel ?? value, fieldOptions }),
      conditionalClass
    )

  // Path 3 — cellStyle only (no format / no field-type renderer)
  return wrapWithClass(String(value ?? ''), conditionalClass)
}

// ---------------------------------------------------------------------------
// Column mapping: Domain config → TanStack Table ColumnDef
// ---------------------------------------------------------------------------

/**
 * The locale an auto-generated column formats in. Auto-generation runs without
 * a page locale in hand, so it falls back to the same platform default the
 * formatters themselves use rather than inventing a second one.
 */
const DEFAULT_AUTO_COLUMN_LOCALE = 'en-US'

/** Platform-default (English) fallbacks when the host supplies no labels. */
const DEFAULT_SAVE_LABEL = 'Save'
const DEFAULT_CANCEL_LABEL = 'Cancel'

/**
 * Builds the per-row cell renderer for an action column. Each action button is
 * first gated by its optional `visibleWhen` predicate (see {@link isActionVisible}),
 * so a button renders only on rows whose named field value satisfies the
 * condition; actions without a predicate render on every row. Each rendered
 * action delegates to {@link ActionButton}, which arms an inline `alertdialog`
 * confirm when the action item carries a `confirm` message (the per-row analog of
 * the bulk-action confirm gate).
 */
function buildActionCellRenderer(
  col: ActionColumn,
  onActionClick: RowActionHandler | undefined,
  labels: ActionControlLabels
) {
  return ({ row }: CellContext<TableRecord, unknown>) => (
    <div className="flex gap-1">
      {col.actions
        .filter((action) => isActionVisible(action, row.original))
        .map((action, actionIndex) => (
          <ActionButton
            key={`action-${String(actionIndex)}`}
            action={action}
            record={row.original}
            onActionClick={onActionClick}
            labels={labels}
          />
        ))}
    </div>
  )
}

/**
 * Options for {@link mapColumnsToColumnDefs}. `locale` (the active page locale,
 * `<html lang>` ← `meta.lang`) drives locale-aware column formats (`relative-time`);
 * the rest mirror the prior positional parameters.
 */
export interface MapColumnsOptions {
  readonly locale: string
  readonly onActionClick?: RowActionHandler
  readonly fieldMeta?: FieldMetaMap
  /** Lets an automation button in a field column address its invoke endpoint. */
  readonly tableName?: string
  /** Re-reads the rows after a button run that may have written to one. */
  readonly onButtonInvoked?: () => void
  /**
   * Interpreter-provided commit / dismiss labels for the action column's inline
   * select-editor and confirm gate, resolved server-side against the app
   * language. Default to the English platform strings.
   */
  readonly saveLabel?: string
  readonly cancelLabel?: string
}

/**
 * Converts domain DataTableColumn configs into TanStack Table ColumnDef objects.
 *
 * Field columns: accessorKey, header, cell renderer with format/cellStyle, sort/filter flags.
 * Action columns: id, action button cell renderer.
 */
export function mapColumnsToColumnDefs(
  columns: readonly DataTableColumn[],
  options: MapColumnsOptions
): readonly ColumnDef<TableRecord>[] {
  const { locale, onActionClick } = options
  const actionLabels: ActionControlLabels = {
    save: options.saveLabel ?? DEFAULT_SAVE_LABEL,
    cancel: options.cancelLabel ?? DEFAULT_CANCEL_LABEL,
  }
  // Filter out columns with visible: false
  const visibleColumns = columns.filter((col) => !('field' in col && col.visible === false))

  return visibleColumns.map((col, index) => {
    if ('field' in col) {
      const cellRenderer = buildFieldCellRenderer(col, locale, options)
      return {
        accessorKey: col.field,
        // The column's own `label` override, then the bound field's declared
        // `label`, then the RAW field name — the same order every surface uses.
        header: resolveDisplayLabel(col.label, options.fieldMeta?.[col.field]?.label, col.field),
        enableSorting: col.sortable !== false,
        enableColumnFilter: col.filterable !== false,
        ...(col.width && { size: col.width }),
        ...(col.minWidth && { minSize: col.minWidth }),
        ...(cellRenderer && { cell: cellRenderer }),
        meta: {
          frozen: col.frozen,
          cellStyle: col.cellStyle,
          field: col.field,
          editable: col.editable,
        },
      } satisfies ColumnDef<TableRecord>
    }
    return {
      id: `actions-${String(index)}`,
      header: col.label ?? '',
      enableSorting: false,
      enableColumnFilter: false,
      cell: buildActionCellRenderer(col, onActionClick, actionLabels),
    } satisfies ColumnDef<TableRecord>
  })
}

/**
 * Builds a read-only cell renderer for an auto-generated column when the
 * field-type has a dedicated chrome (user pill, status pill, JSON preview,
 * …). Returns undefined when the field-type falls through to TanStack
 * Table's `String(value)` default — caller omits the `cell` key.
 */
function buildAutoCellRenderer(
  field: string,
  options: AutoColumnOptions
): ((ctx: CellContext<TableRecord, unknown>) => React.ReactNode) | undefined {
  const { fieldMeta } = options
  // A button field is an action, not a readout — it takes precedence over the
  // value-rendering path below, which would render its (always absent) value.
  const buttonRenderer = buildButtonCellRenderer(field, options)
  if (buttonRenderer) return buttonRenderer

  const fieldType = fieldMeta?.[field]?.type
  if (!fieldType) return undefined
  const renderer = FIELD_TYPE_TO_CELL_RENDERER[fieldType]
  if (!renderer) return undefined
  const fieldOptions = buildCellFieldOptions(fieldMeta?.[field], DEFAULT_AUTO_COLUMN_LOCALE)
  return ({ getValue, row }: CellContext<TableRecord, unknown>) =>
    renderer({ value: readDisplayLabel(row.original, field) ?? getValue(), fieldOptions })
}

/**
 * Shared options for the two auto-column generators. Bundled rather than
 * passed positionally because the pair already sat at the four-parameter cap.
 *
 * `tableName` is what lets an automation button in an auto-generated column
 * address its own invoke endpoint.
 */
export interface AutoColumnOptions {
  /**
   * Opts every generated column into inline double-click editing — used by
   * `refreshMode: 'realtime'` data tables, which are inline-editable by
   * default so optimistic updates can be exercised.
   */
  readonly editable?: boolean
  readonly fieldMeta?: FieldMetaMap
  readonly tableName?: string
  /** Re-reads the rows after a button run that may have written to one. */
  readonly onButtonInvoked?: () => void
}

/** The column def shared by both auto-generation paths. */
function buildAutoColumn(field: string, options: AutoColumnOptions): ColumnDef<TableRecord> {
  const cellRenderer = buildAutoCellRenderer(field, options)
  // A button column's header is the button's own label — `ship_button` is a
  // config identifier, not something to show a reader. Otherwise the field's
  // declared `label`, then the RAW name verbatim (never humanized: that would
  // restyle every heading in every already-shipped app with no config edit).
  const meta = options.fieldMeta?.[field]
  const header = meta?.button?.label ?? resolveDisplayLabel(undefined, meta?.label, field)
  return {
    accessorKey: field,
    header,
    enableSorting: true,
    meta: { field, ...(options.editable === true && { editable: true }) },
    ...(cellRenderer && { cell: cellRenderer }),
  } satisfies ColumnDef<TableRecord>
}

/**
 * Auto-generates column defs from record keys when no explicit columns provided
 */
export function autoGenerateColumns(
  records: readonly TableRecord[],
  options: AutoColumnOptions
): readonly ColumnDef<TableRecord>[] {
  const firstRecord = records[0]
  if (!firstRecord) return []
  // Record keys come from the database, and a button field has no column
  // there — so append the table's button fields, which would otherwise never
  // reach this path at all.
  const buttonFields = Object.keys(options.fieldMeta ?? {}).filter(
    (name) => options.fieldMeta?.[name]?.button && !(name in firstRecord)
  )
  return [...Object.keys(firstRecord), ...buttonFields].map((key) => buildAutoColumn(key, options))
}

/**
 * Auto-generates column defs from table field names when no records are available.
 * Used as a fallback when the table is empty and no explicit columns are configured.
 */
export function autoGenerateColumnsFromFields(
  fields: readonly string[],
  options: AutoColumnOptions
): readonly ColumnDef<TableRecord>[] {
  return fields.map((field) => buildAutoColumn(field, options))
}
