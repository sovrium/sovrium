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
import { relativeStampOf } from '@/domain/models/app/tables/relative-stamp-service'
import { resolveColumnLabel } from '@/presentation/design/field-display'
import { resolvePageTimezone } from '../../runtime/page-timezone'
import { readDisplayLabel } from '../../runtime/record-display-label'
import { EMPTY_VALUE, isMissing } from '../cell-empty'
import { renderListCell, renderPlainCell } from '../cell-plain'
import { cellRendererOf, type FIELD_TYPE_TO_CELL_RENDERER } from '../cell-renderer-registry'
import { cellClassOf, drawsTextChip, optionChipCellClassOf } from '../column-presentation'
import { textCellContent } from '../text-chip-cell'
import { withValueLabelOptions } from '../value-label-options'
import { buildButtonCellRenderer, type ButtonCellOptions } from './button-cell'
import { buildCellFieldOptions } from './cell-field-options'
import { formatClassOf } from './format-classes'
import type { FieldMetaMap } from '../../hooks/use-inline-editing'
import type { CellFieldOptions } from '../cell-renderers'
import type { DataTableCellContext } from '../island/table-features'
import type { FieldColumn } from '@/domain/models/app/pages/components/component-types/data/table/schema'

/**
 * The value ladder of a read-only field cell: label substitution, explicit
 * format, field-type affordance, plain text. Split out of `formatting.tsx`,
 * which keeps only the column mapping, so the value half and the action half
 * of a column no longer share a module.
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

/** The slice of the column options a field cell reads. */
export interface FieldCellOptions extends ButtonCellOptions {
  readonly fieldMeta?: FieldMetaMap
}

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
export function buildFieldCellRenderer(
  col: FieldColumn,
  locale: string,
  options: FieldCellOptions,
  listFields: ReadonlySet<string>
) {
  const { fieldMeta } = options
  // A button field is an action, not a readout: it short-circuits the whole
  // format / field-type / passthrough ladder below, which has no value to show.
  const buttonRenderer = buildButtonCellRenderer(col.field, options)
  if (buttonRenderer) return buttonRenderer

  // Looked up ONCE: each re-read cost a branch against the complexity cap.
  const meta = fieldMeta?.[col.field]
  const fieldTypeRenderer = fieldTypeRendererOf(col, meta?.type)
  const baseOptions = buildCellFieldOptions(meta, locale, columnLabelOf(col, meta))
  // On an option column a `valueLabels` entry relabels the chip rather than
  // replacing it with plain text (`value-label-options.ts`).
  const chipLabels = fieldTypeRenderer && withValueLabelOptions(baseOptions, col.valueLabels)
  const fieldOptions = chipLabels || baseOptions
  const currencyOptions = resolveCurrencyOptions(meta)

  if (!fieldTypeRenderer && !shapesItsValue(col, meta?.type)) {
    return listFields.has(col.field) ? renderListCell : renderPlainCell
  }

  return ({ getValue, row }: DataTableCellContext) =>
    renderValueCell(
      getValue(),
      {
        col,
        locale,
        fieldTypeRenderer,
        fieldOptions,
        currencyOptions,
        chipLabels: !!chipLabels,
        // A `duration` field stores seconds; any other number is milliseconds.
        durationUnit: meta?.type === 'duration' ? 'seconds' : undefined,
      },
      readDisplayLabel(row.original, col.field)
    )
}

/** The heading a column is drawn under: its own label, the field's, else the readable name. */
const columnLabelOf = (col: FieldColumn, meta: { readonly label?: string } | undefined): string =>
  resolveColumnLabel(col.label, meta?.label, col.field)

/** The field type's own renderer, unless the column draws a text chip instead. */
const fieldTypeRendererOf = (col: FieldColumn, type: string | undefined) =>
  type === undefined || drawsTextChip(col, type) ? undefined : cellRendererOf(type)

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
  readonly durationUnit: 'seconds' | undefined
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
  const { col, locale, fieldTypeRenderer, fieldOptions, currencyOptions, durationUnit } = chrome
  const conditionalClass = cellClassOf(value, col)

  // valueLabels — render-only, highest precedence: a per-value label overrides the
  // chrome below; unmapped values fall through. The record itself is never changed.
  const label = chrome.chipLabels ? undefined : col.valueLabels?.[String(value)]
  if (label !== undefined) return wrapWithClass(label, conditionalClass)

  // An absent value reads as the muted dash under any format: a format shapes a
  // value, and there is none to shape (a `datetime` of nothing printed blank).
  if (col.format && isMissing(value)) return wrapWithClass(EMPTY_VALUE, conditionalClass)

  // Path 1 — explicit format override
  if (col.format) {
    const displayValue = formatCellValue(value, col.format, locale, {
      currency: currencyOptions,
      timeZone: resolvePageTimezone(),
      durationUnit,
    })
    const composed = [formatClassOf(col.format), conditionalClass].filter(Boolean).join(' ')
    // A relative reading carries its instant and its absolute moment (`time`).
    const stamp = relativeStampOf(value, col.format, locale, resolvePageTimezone())
    return wrapWithClass(
      stamp === undefined ? (
        displayValue
      ) : (
        <time
          dateTime={stamp.dateTime}
          title={stamp.title}
        >
          {displayValue}
        </time>
      ),
      composed
    )
  }

  // Path 2 — field-type-driven affordance. A resolved relationship label stands in
  // for the stored key HERE only: `valueLabels` and an explicit `format` were written
  // against the value the column stores, so substituting under them would break them.
  // The field type's own chip takes the matching tone from its wrapper.
  if (fieldTypeRenderer)
    return wrapWithClass(
      fieldTypeRenderer({ value: displayLabel ?? value, fieldOptions }),
      optionChipCellClassOf(value, col)
    )

  // Path 3 — the text, or a chip when the column asks for one (`badgeForm`)
  return wrapWithClass(textCellContent(value, col, fieldOptions), conditionalClass)
}
