/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  resolveCurrencyOptions,
  type CurrencyDisplayOptions,
} from '@/domain/kernel/format/currency-format'
import { formatCellValue } from '@/domain/models/app/tables/cell-value-format'
import { resolveDisplayLabel } from '@/presentation/design/field-display'
import { computeCurrencyDisplayClasses } from '../../design/field-affordances-default-classes'
import { resolvePageTimezone } from '../runtime/page-timezone'
import { RecordButton } from '../runtime/record-button'
import { readDisplayLabel } from '../runtime/record-display-label'
import {
  DEFAULT_SAVE_LABEL,
  DEFAULT_CANCEL_LABEL,
  buildActionCellRenderer,
} from './action-cell-renderer'
import { FIELD_TYPE_TO_CELL_RENDERER } from './cell-renderer-registry'
import { cellClassOf, columnPresentationMeta, drawsTextChip } from './column-presentation'
import { textCellContent } from './text-chip-cell'
import { withValueLabelOptions } from './value-label-options'
import type { ActionControlLabels } from './action-cell'
import type { CellFieldOptions } from './cell-renderers'
import type { FieldMeta, FieldMetaMap } from '../hooks/use-inline-editing'
import type { DataTableCellContext, DataTableColumnDef } from './island/table-features'
import type { TableRecord } from '../runtime/types'
import type {
  ActionColumnItem,
  ColumnFormat,
  DataTableColumn,
  FieldColumn,
} from '@/domain/models/app/pages/components/component-types/data/table/schema'

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
// Cell renderer builder
// ---------------------------------------------------------------------------

/**
 * The formats that render as a FIXED-ADVANCE readout.
 *
 * Every numeric and every date format is one, because all of them produce a
 * value a reader scans DOWN a column rather than reads across a line: a price
 * against the price above it, a byte count against a byte count, a timestamp
 * against a timestamp. Proportional digits defeat that — `1,111` is narrower
 * than `9,999` — so the column stops being comparable at a glance and the
 * decimal points wander.
 *
 * This used to hold `currency` and `percentage` alone, which is why a column of
 * `compact` counts and a column of `bytes` aligned and a column of `short-date`
 * did not, in the same table, with nothing in the config to say why.
 *
 * `truncate` is deliberately absent: it shortens PROSE, and prose in a fixed
 * face is harder to read, not easier. So are `yes-no` and `check-cross`, which
 * produce a word and a glyph.
 */
const MONO_DISPLAY_FORMATS = new Set<ColumnFormat>([
  'currency',
  'percentage',
  'compact',
  'bytes',
  'relative-date',
  'relative-time',
  'short-date',
  'long-date',
  'datetime',
])

/**
 * `check-cross` renders a 14px `✓` / `✗` and NO colour.
 *
 * A green tick and a red cross would be the platform choosing a vocabulary the
 * column never declared, and would put the whole meaning in a hue for a reader
 * who cannot separate the two. The glyphs already differ in shape, which is
 * what carries it; the extra step of size is there because a 12px tick in a
 * column of 12px words disappears into them.
 */
const GLYPH_DISPLAY_FORMATS = new Set<ColumnFormat>(['check-cross'])

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
export function buildCellFieldOptions(
  meta: FieldMeta | undefined,
  locale: string
): CellFieldOptions {
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
 * A button cell is an ACTION, not a readout, so it takes the whole row: its
 * `visibleWhen` reads the record, and an automation button needs the record id.
 */
export function buildButtonCellRenderer(
  field: string,
  options: ButtonCellOptions
): ((ctx: DataTableCellContext) => React.ReactNode) | undefined {
  const { tableName, fieldMeta, onButtonInvoked } = options
  const config = fieldMeta?.[field]?.button
  if (!config) return undefined
  return ({ row }: DataTableCellContext) => (
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

function buildFieldCellRenderer(col: FieldColumn, locale: string, options: MapColumnsOptions) {
  const { fieldMeta } = options
  // A button field is an action, not a readout: it short-circuits the whole
  // format / field-type / passthrough ladder below, which has no value to show.
  const buttonRenderer = buildButtonCellRenderer(col.field, options)
  if (buttonRenderer) return buttonRenderer

  // Looked up ONCE: each re-read cost a branch against the complexity cap.
  const meta = fieldMeta?.[col.field]
  const fieldTypeRenderer = fieldTypeRendererOf(col, meta?.type)
  const baseOptions = buildCellFieldOptions(meta, locale)
  // On an option column a `valueLabels` entry relabels the chip rather than
  // replacing it with plain text (`value-label-options.ts`).
  const chipLabels = fieldTypeRenderer && withValueLabelOptions(baseOptions, col.valueLabels)
  const fieldOptions = chipLabels || baseOptions
  const currencyOptions = resolveCurrencyOptions(meta)

  if (!fieldTypeRenderer && !shapesItsValue(col, meta?.type)) return undefined

  return ({ getValue, row }: DataTableCellContext) =>
    renderValueCell(
      getValue(),
      { col, locale, fieldTypeRenderer, fieldOptions, currencyOptions, chipLabels: !!chipLabels },
      readDisplayLabel(row.original, col.field)
    )
}

/** The field type's own renderer, unless the column draws a text chip instead. */
const fieldTypeRendererOf = (col: FieldColumn, type: string | undefined) =>
  type === undefined || drawsTextChip(col, type) ? undefined : FIELD_TYPE_TO_CELL_RENDERER[type]

/** Whether a column's own keys change how a value reads (else TanStack prints it). */
const shapesItsValue = (col: FieldColumn, type: string | undefined): boolean =>
  Boolean(col.format ?? col.cellStyle ?? col.valueLabels) || drawsTextChip(col, type)

/** The chrome {@link renderValueCell} resolves once per column, not per row. */
interface ValueCellChrome {
  readonly col: FieldColumn
  readonly locale: string
  readonly fieldTypeRenderer:
    (typeof FIELD_TYPE_TO_CELL_RENDERER)[keyof typeof FIELD_TYPE_TO_CELL_RENDERER] | undefined
  readonly fieldOptions: CellFieldOptions | undefined
  readonly currencyOptions: CurrencyDisplayOptions | undefined
  /** The column's `valueLabels` are drawn inside its option chips. */
  readonly chipLabels?: boolean
}

/**
 * The value-rendering ladder — label substitution, then explicit format, then
 * field-type affordance, then plain text, each wrapped in the `cellStyle` class.
 *
 * Split out of {@link buildFieldCellRenderer} so neither half carries the other's
 * branch count.
 */
function renderValueCell(value: unknown, chrome: ValueCellChrome, displayLabel?: unknown) {
  const { col, locale, fieldTypeRenderer, fieldOptions, currencyOptions } = chrome
  const conditionalClass = cellClassOf(value, col)

  // valueLabels — render-only, highest precedence: a per-value label overrides the
  // chrome below; unmapped values fall through. The record itself is never changed.
  const label = chrome.chipLabels ? undefined : col.valueLabels?.[String(value)]
  if (label !== undefined) return wrapWithClass(label, conditionalClass)

  // Path 1 — explicit format override
  if (col.format) {
    const displayValue = formatCellValue(value, col.format, locale, {
      currency: currencyOptions,
      timeZone: resolvePageTimezone(),
    })
    const formatClass = MONO_DISPLAY_FORMATS.has(col.format)
      ? `${computeCurrencyDisplayClasses()} font-mono`
      : GLYPH_DISPLAY_FORMATS.has(col.format)
        ? 'inline-block text-md leading-none'
        : ''
    const composed = [formatClass, conditionalClass].filter(Boolean).join(' ')
    return wrapWithClass(displayValue, composed)
  }

  // Path 2 — field-type-driven affordance. A resolved relationship label stands in
  // for the stored key HERE only: `valueLabels` and an explicit `format` were written
  // against the value the column stores, so substituting under them would break them.
  if (fieldTypeRenderer)
    return wrapWithClass(
      fieldTypeRenderer({ value: displayLabel ?? value, fieldOptions }),
      conditionalClass
    )

  // Path 3 — the text, or a chip when the column asks for one (`badgeForm`)
  return wrapWithClass(textCellContent(value, col, fieldOptions), conditionalClass)
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
): readonly DataTableColumnDef[] {
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
          ...columnPresentationMeta(col),
          field: col.field,
          editable: col.editable,
          // Carried beside `size` above so the header cell can tell an authored
          // width from TanStack's merged-in default, which `getSize()` cannot.
          authoredWidth: col.width,
          align: col.align,
        },
      } satisfies DataTableColumnDef
    }
    return {
      id: `actions-${String(index)}`,
      header: col.label ?? '',
      enableSorting: false,
      enableColumnFilter: false,
      cell: buildActionCellRenderer(col, onActionClick, actionLabels),
      // The cluster is a set of buttons, and the row renderer has to know that
      // before it decides whose click a press is.
      meta: { actions: true },
    } satisfies DataTableColumnDef
  })
}
