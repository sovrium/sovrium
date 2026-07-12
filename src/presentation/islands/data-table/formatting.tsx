/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeCurrencyDisplayClasses } from '../recipes/field-affordances-default-classes'
import { ActionButton } from './action-cell'
import { FIELD_TYPE_TO_CELL_RENDERER } from './cell-renderer-registry'
import type { FieldMetaMap } from '../hooks/use-inline-editing'
import type { TableRecord } from '../shared/types'
import type {
  ActionColumn,
  ActionColumnItem,
  CellStyleCondition,
  ColumnFormat,
  DataTableColumn,
  FieldColumn,
} from '@/domain/models/app/pages/components/data-table'
import type { CellContext, ColumnDef } from '@tanstack/react-table'

export type RowActionHandler = (
  action: ActionColumnItem,
  record: TableRecord
) => void | Promise<void>


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

export function resolvePageLocale(): string {
  if (typeof document === 'undefined') return 'en-US'
  const { lang } = document.documentElement
  return lang.length > 0 ? lang : 'en-US'
}

function formatRelativeTime(value: unknown, locale: string): string {
  const date = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(date.getTime())) return String(value)
  const diffDays = Math.round((date.getTime() - Date.now()) / 86_400_000)
  return new Intl.RelativeTimeFormat(locale, { style: 'short' }).format(diffDays, 'day')
}


function formatCellValue(value: unknown, format: ColumnFormat, locale: string): string {
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


function matchesCondition(
  operator: string,
  expected: unknown,
  strValue: string,
  numValue: number
): boolean {
  const matchers: Record<string, () => boolean> = {
    eq: () => strValue === String(expected),
    neq: () => strValue !== String(expected),
    in: () => Array.isArray(expected) && expected.some((entry) => String(entry) === strValue),
    notIn: () => Array.isArray(expected) && !expected.some((entry) => String(entry) === strValue),
    contains: () => strValue.includes(String(expected)),
    gt: () => !Number.isNaN(numValue) && numValue > Number(expected),
    lt: () => !Number.isNaN(numValue) && numValue < Number(expected),
    gte: () => !Number.isNaN(numValue) && numValue >= Number(expected),
    lte: () => !Number.isNaN(numValue) && numValue <= Number(expected),
  }
  return matchers[operator]?.() ?? false
}

function matchesConditionOperators(operators: CellStyleCondition['when'], value: unknown): boolean {
  const strValue = String(value)
  const numValue = Number(value)
  return Object.entries(operators)
    .filter(([, expected]) => expected !== undefined)
    .every(([operator, expected]) => matchesCondition(operator, expected, strValue, numValue))
}

export function evaluateCellStyle(
  value: unknown,
  conditions: readonly CellStyleCondition[]
): string {
  const matched = conditions.find((condition) => matchesConditionOperators(condition.when, value))
  return matched?.className ?? ''
}

function isActionVisible(action: ActionColumnItem, record: TableRecord): boolean {
  if (!action.visibleWhen) return true
  const { field, ...operators } = action.visibleWhen
  return matchesConditionOperators(operators, record[field])
}


const NUMERIC_DISPLAY_FORMATS = new Set<ColumnFormat>(['currency', 'percentage'])

function wrapWithClass(content: React.ReactNode, className: string): React.ReactNode {
  return className ? <span className={className}>{content}</span> : content
}

function buildFieldCellRenderer(col: FieldColumn, locale: string, fieldMeta?: FieldMetaMap) {
  const fieldTypeRenderer = fieldMeta?.[col.field]?.type
    ? FIELD_TYPE_TO_CELL_RENDERER[fieldMeta[col.field]!.type]
    : undefined

  if (!col.format && !col.cellStyle && !fieldTypeRenderer && !col.valueLabels) return undefined

  return ({ getValue }: { getValue: () => unknown }) => {
    const value = getValue()
    const conditionalClass = col.cellStyle ? evaluateCellStyle(value, col.cellStyle) : ''

    const label = col.valueLabels?.[String(value)]
    if (label !== undefined) return wrapWithClass(label, conditionalClass)

    if (col.format) {
      const displayValue = formatCellValue(value, col.format, locale)
      const numericClass = NUMERIC_DISPLAY_FORMATS.has(col.format)
        ? computeCurrencyDisplayClasses()
        : ''
      const composed = [numericClass, conditionalClass].filter(Boolean).join(' ')
      return wrapWithClass(displayValue, composed)
    }

    if (fieldTypeRenderer) return wrapWithClass(fieldTypeRenderer({ value }), conditionalClass)

    return wrapWithClass(String(value ?? ''), conditionalClass)
  }
}


function buildActionCellRenderer(col: ActionColumn, onActionClick?: RowActionHandler) {
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
          />
        ))}
    </div>
  )
}

export interface MapColumnsOptions {
  readonly locale: string
  readonly groupByField?: string
  readonly onActionClick?: RowActionHandler
  readonly fieldMeta?: FieldMetaMap
}

export function mapColumnsToColumnDefs(
  columns: readonly DataTableColumn[],
  options: MapColumnsOptions
): readonly ColumnDef<TableRecord>[] {
  const { locale, groupByField, onActionClick, fieldMeta } = options
  const visibleColumns = columns.filter((col) => !('field' in col && col.visible === false))

  return visibleColumns.map((col, index) => {
    if ('field' in col) {
      const cellRenderer = buildFieldCellRenderer(col, locale, fieldMeta)
      return {
        accessorKey: col.field,
        header: col.label ?? col.field,
        enableSorting: col.sortable !== false,
        enableColumnFilter: col.filterable !== false,
        ...(col.width && { size: col.width }),
        ...(col.minWidth && { minSize: col.minWidth }),
        ...(groupByField && col.field === groupByField && { enableGrouping: true }),
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
      cell: buildActionCellRenderer(col, onActionClick),
    } satisfies ColumnDef<TableRecord>
  })
}

function buildAutoCellRenderer(
  field: string,
  fieldMeta?: FieldMetaMap
): ((ctx: { getValue: () => unknown }) => React.ReactNode) | undefined {
  const fieldType = fieldMeta?.[field]?.type
  if (!fieldType) return undefined
  const renderer = FIELD_TYPE_TO_CELL_RENDERER[fieldType]
  if (!renderer) return undefined
  return ({ getValue }: { getValue: () => unknown }) => renderer({ value: getValue() })
}

export function autoGenerateColumns(
  records: readonly TableRecord[],
  groupByField?: string,
  editable?: boolean,
  fieldMeta?: FieldMetaMap
): readonly ColumnDef<TableRecord>[] {
  const firstRecord = records[0]
  if (!firstRecord) return []
  return Object.keys(firstRecord).map((key) => {
    const cellRenderer = buildAutoCellRenderer(key, fieldMeta)
    return {
      accessorKey: key,
      header: key,
      enableSorting: true,
      meta: { field: key, ...(editable === true && { editable: true }) },
      ...(groupByField && key === groupByField && { enableGrouping: true }),
      ...(cellRenderer && { cell: cellRenderer }),
    } satisfies ColumnDef<TableRecord>
  })
}

export function autoGenerateColumnsFromFields(
  fields: readonly string[],
  groupByField?: string,
  editable?: boolean,
  fieldMeta?: FieldMetaMap
): readonly ColumnDef<TableRecord>[] {
  return fields.map((field) => {
    const cellRenderer = buildAutoCellRenderer(field, fieldMeta)
    return {
      accessorKey: field,
      header: field,
      enableSorting: true,
      meta: { field, ...(editable === true && { editable: true }) },
      ...(groupByField && field === groupByField && { enableGrouping: true }),
      ...(cellRenderer && { cell: cellRenderer }),
    } satisfies ColumnDef<TableRecord>
  })
}
