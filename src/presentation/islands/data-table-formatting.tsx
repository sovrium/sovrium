/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { TableRecord } from './shared/types'
import type {
  CellStyleCondition,
  ColumnFormat,
  DataTableColumn,
  FieldColumn,
} from '@/domain/models/app/page/common/data-table'
import type { ColumnDef } from '@tanstack/react-table'

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

// ---------------------------------------------------------------------------
// Cell value formatting
// ---------------------------------------------------------------------------

/**
 * Formats a cell value according to the column format specification.
 */
function formatCellValue(value: unknown, format: ColumnFormat): string {
  if (value === undefined || value === null) return ''
  const str = String(value)

  const formatters: Record<ColumnFormat, () => string> = {
    truncate: () => (str.length > 50 ? `${str.slice(0, 50)}…` : str),
    currency: () => {
      const num = Number(value)
      return Number.isNaN(num)
        ? str
        : `$${num.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
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

function matchesCondition(
  operator: string,
  expected: string | number | boolean,
  strValue: string,
  numValue: number
): boolean {
  const matchers: Record<string, () => boolean> = {
    eq: () => strValue === String(expected),
    neq: () => strValue !== String(expected),
    contains: () => strValue.includes(String(expected)),
    gt: () => !Number.isNaN(numValue) && numValue > Number(expected),
    lt: () => !Number.isNaN(numValue) && numValue < Number(expected),
    gte: () => !Number.isNaN(numValue) && numValue >= Number(expected),
    lte: () => !Number.isNaN(numValue) && numValue <= Number(expected),
  }
  return matchers[operator]?.() ?? false
}

/**
 * Evaluates conditional cell style rules against a cell value.
 * Returns the first matching className or empty string.
 */
export function evaluateCellStyle(
  value: unknown,
  conditions: readonly CellStyleCondition[]
): string {
  const strValue = String(value)
  const numValue = Number(value)

  const matched = conditions.find((condition) =>
    Object.entries(condition.when)
      .filter(([, v]) => v !== undefined)
      .every(([operator, expected]) =>
        matchesCondition(operator, expected as string | number | boolean, strValue, numValue)
      )
  )
  return matched?.className ?? ''
}

// ---------------------------------------------------------------------------
// Cell renderer builder
// ---------------------------------------------------------------------------

/**
 * Builds a cell renderer for a field column that applies format and cellStyle.
 */
function buildFieldCellRenderer(col: FieldColumn) {
  if (!col.format && !col.cellStyle) return undefined

  return ({ getValue }: { getValue: () => unknown }) => {
    const value = getValue()
    const displayValue = col.format ? formatCellValue(value, col.format) : String(value ?? '')
    const conditionalClass = col.cellStyle ? evaluateCellStyle(value, col.cellStyle) : ''

    if (conditionalClass) {
      return <span className={conditionalClass}>{displayValue}</span>
    }
    return displayValue
  }
}

// ---------------------------------------------------------------------------
// Column mapping: Domain config → TanStack Table ColumnDef
// ---------------------------------------------------------------------------

/**
 * Converts domain DataTableColumn configs into TanStack Table ColumnDef objects.
 *
 * Field columns: accessorKey, header, cell renderer with format/cellStyle, sort/filter flags.
 * Action columns: id, action button cell renderer.
 */
export function mapColumnsToColumnDefs(
  columns: readonly DataTableColumn[]
): readonly ColumnDef<TableRecord>[] {
  // Filter out columns with visible: false
  const visibleColumns = columns.filter((col) => !('field' in col && col.visible === false))

  return visibleColumns.map((col, index) => {
    if ('field' in col) {
      return {
        accessorKey: col.field,
        header: col.label ?? col.field,
        enableSorting: col.sortable !== false,
        enableColumnFilter: col.filterable !== false,
        ...(col.width && { size: col.width }),
        ...(col.minWidth && { minSize: col.minWidth }),
        cell: buildFieldCellRenderer(col),
        meta: {
          frozen: col.frozen,
          cellStyle: col.cellStyle,
          field: col.field,
        },
      } satisfies ColumnDef<TableRecord>
    }
    return {
      id: `actions-${String(index)}`,
      header: col.label ?? '',
      enableSorting: false,
      enableColumnFilter: false,
      cell: () => (
        <div className="flex gap-1">
          {col.actions.map((action, actionIndex) => (
            <button
              key={`action-${String(actionIndex)}`}
              type="button"
              className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 disabled:opacity-50"
              data-action-type={action.action.type}
              disabled // TODO: Wire click handlers when action dispatch system is implemented
            >
              {action.label}
            </button>
          ))}
        </div>
      ),
    } satisfies ColumnDef<TableRecord>
  })
}

/**
 * Auto-generates column defs from record keys when no explicit columns provided
 */
export function autoGenerateColumns(
  records: readonly TableRecord[]
): readonly ColumnDef<TableRecord>[] {
  const firstRecord = records[0]
  if (!firstRecord) return []
  return Object.keys(firstRecord).map(
    (key) =>
      ({ accessorKey: key, header: key, enableSorting: true }) satisfies ColumnDef<TableRecord>
  )
}

/**
 * Auto-generates column defs from table field names when no records are available.
 * Used as a fallback when the table is empty and no explicit columns are configured.
 */
export function autoGenerateColumnsFromFields(
  fields: readonly string[]
): readonly ColumnDef<TableRecord>[] {
  return fields.map(
    (field) =>
      ({ accessorKey: field, header: field, enableSorting: true }) satisfies ColumnDef<TableRecord>
  )
}
