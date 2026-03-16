/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import {
  ActionColumnSchema,
  CellStyleConditionSchema,
  ColumnFormatSchema,
  DataTableBulkActionSchema,
  DataTableColumnSchema,
  DataTableGroupBySchema,
  DataTablePaginationSchema,
  DataTableSchema,
  DataTableSearchSchema,
  DataTableSelectionSchema,
  DataTableSummaryItemSchema,
  DataTableToolbarSchema,
  FieldColumnSchema,
  validateDataTableColumns,
} from './data-table'

const decode = <A, I>(schema: Schema.Schema<A, I>) => Schema.decodeUnknownSync(schema)

// ---------------------------------------------------------------------------
// ColumnFormatSchema
// ---------------------------------------------------------------------------

describe('ColumnFormatSchema', () => {
  test('should accept all format values', () => {
    const formats = [
      'truncate',
      'currency',
      'percentage',
      'compact',
      'relative-date',
      'short-date',
      'long-date',
      'datetime',
      'yes-no',
      'check-cross',
    ] as const
    for (const format of formats) {
      expect(decode(ColumnFormatSchema)(format)).toBe(format)
    }
  })

  test('should reject invalid format', () => {
    expect(() => decode(ColumnFormatSchema)('unknown-format')).toThrow()
  })
})

// ---------------------------------------------------------------------------
// CellStyleConditionSchema
// ---------------------------------------------------------------------------

describe('CellStyleConditionSchema', () => {
  // TODO: Enable when CellStyleConditionSchema is fixed
  test.skip('should accept valid condition with string value', () => {
    const result = decode(CellStyleConditionSchema)({
      when: { eq: 'shipped' },
      className: 'bg-green-50 text-green-700',
    })
    expect(result.when.eq).toBe('shipped')
    expect(result.className).toBe('bg-green-50 text-green-700')
  })

  test.skip('should accept condition with numeric value', () => {
    const result = decode(CellStyleConditionSchema)({
      when: { gt: 100 },
      className: 'font-bold',
    })
    expect(result.when.gt).toBe(100)
  })

  test.skip('should accept condition with boolean value', () => {
    const result = decode(CellStyleConditionSchema)({
      when: { eq: true },
      className: 'text-green-600',
    })
    expect(result.when.eq).toBe(true)
  })

  test('should reject invalid operator key', () => {
    expect(() =>
      decode(CellStyleConditionSchema)({
        when: { like: 'test' },
        className: 'text-red-600',
      })
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// FieldColumnSchema
// ---------------------------------------------------------------------------

describe('FieldColumnSchema', () => {
  test('should accept minimal field column', () => {
    const result = decode(FieldColumnSchema)({ field: 'name' })
    expect(result.field).toBe('name')
    expect(result.label).toBeUndefined()
    expect(result.width).toBeUndefined()
  })

  // TODO: Enable when FieldColumnSchema supports cellStyle
  test.skip('should accept fully configured field column', () => {
    const result = decode(FieldColumnSchema)({
      field: 'status',
      label: 'Order Status',
      width: 200,
      minWidth: 100,
      align: 'center',
      frozen: true,
      sortable: true,
      filterable: false,
      editable: true,
      visible: true,
      format: 'truncate',
      cellStyle: [{ when: { eq: 'active' }, className: 'bg-green-50' }],
    })
    expect(result.field).toBe('status')
    expect(result.label).toBe('Order Status')
    expect(result.width).toBe(200)
    expect(result.minWidth).toBe(100)
    expect(result.align).toBe('center')
    expect(result.frozen).toBe(true)
    expect(result.editable).toBe(true)
    expect(result.format).toBe('truncate')
    expect(result.cellStyle).toHaveLength(1)
  })

  test('should accept all alignment values', () => {
    for (const align of ['left', 'center', 'right'] as const) {
      const result = decode(FieldColumnSchema)({ field: 'test', align })
      expect(result.align).toBe(align)
    }
  })

  test('should reject zero width', () => {
    expect(() => decode(FieldColumnSchema)({ field: 'test', width: 0 })).toThrow()
  })

  test('should reject negative minWidth', () => {
    expect(() => decode(FieldColumnSchema)({ field: 'test', minWidth: -10 })).toThrow()
  })
})

// ---------------------------------------------------------------------------
// ActionColumnSchema
// ---------------------------------------------------------------------------

describe('ActionColumnSchema', () => {
  test('should accept action column with one action', () => {
    const result = decode(ActionColumnSchema)({
      type: 'actions',
      width: 80,
      actions: [
        {
          label: 'Edit',
          icon: 'pencil',
          action: { type: 'crud', operation: 'update', table: 'orders' },
        },
      ],
    })
    expect(result.type).toBe('actions')
    expect(result.actions).toHaveLength(1)
    expect(result.actions?.[0]?.label).toBe('Edit')
  })

  test('should accept action column with confirm', () => {
    const result = decode(ActionColumnSchema)({
      type: 'actions',
      actions: [
        {
          label: 'Delete',
          icon: 'trash',
          action: { type: 'crud', operation: 'delete', table: 'orders' },
          confirm: 'Are you sure?',
        },
      ],
    })
    expect(result.actions?.[0]?.confirm).toBe('Are you sure?')
  })

  test('should reject empty actions array', () => {
    expect(() =>
      decode(ActionColumnSchema)({
        type: 'actions',
        actions: [],
      })
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// DataTableColumnSchema (union)
// ---------------------------------------------------------------------------

describe('DataTableColumnSchema', () => {
  test('should accept field column', () => {
    const result = decode(DataTableColumnSchema)({ field: 'name' })
    expect('field' in result && result.field).toBe('name')
  })

  test('should accept action column', () => {
    const result = decode(DataTableColumnSchema)({
      type: 'actions',
      actions: [{ label: 'Edit', action: { type: 'crud', operation: 'update', table: 'orders' } }],
    })
    expect('type' in result && result.type).toBe('actions')
  })
})

// ---------------------------------------------------------------------------
// DataTableSelectionSchema
// ---------------------------------------------------------------------------

describe('DataTableSelectionSchema', () => {
  test('should accept all selection modes', () => {
    for (const mode of ['none', 'single', 'multiple'] as const) {
      const result = decode(DataTableSelectionSchema)({ mode })
      expect(result.mode).toBe(mode)
    }
  })

  test('should accept showCheckboxes flag', () => {
    const result = decode(DataTableSelectionSchema)({
      mode: 'multiple',
      showCheckboxes: true,
    })
    expect(result.showCheckboxes).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// DataTablePaginationSchema
// ---------------------------------------------------------------------------

describe('DataTablePaginationSchema', () => {
  test('should accept full pagination config', () => {
    const result = decode(DataTablePaginationSchema)({
      pageSize: 25,
      pageSizeOptions: [10, 25, 50],
      position: 'bottom',
      serverSide: false,
    })
    expect(result.pageSize).toBe(25)
    expect(result.pageSizeOptions).toEqual([10, 25, 50])
    expect(result.position).toBe('bottom')
  })

  test('should accept empty (all optional)', () => {
    const result = decode(DataTablePaginationSchema)({})
    expect(result.pageSize).toBeUndefined()
  })

  test('should reject zero pageSize', () => {
    expect(() => decode(DataTablePaginationSchema)({ pageSize: 0 })).toThrow()
  })

  test('should reject empty pageSizeOptions', () => {
    expect(() => decode(DataTablePaginationSchema)({ pageSizeOptions: [] })).toThrow()
  })

  test('should accept all position values', () => {
    for (const position of ['top', 'bottom', 'both'] as const) {
      const result = decode(DataTablePaginationSchema)({ position })
      expect(result.position).toBe(position)
    }
  })
})

// ---------------------------------------------------------------------------
// DataTableSearchSchema
// ---------------------------------------------------------------------------

describe('DataTableSearchSchema', () => {
  test('should accept full search config', () => {
    const result = decode(DataTableSearchSchema)({
      enabled: true,
      placeholder: 'Search orders...',
      debounceMs: 300,
    })
    expect(result.enabled).toBe(true)
    expect(result.placeholder).toBe('Search orders...')
    expect(result.debounceMs).toBe(300)
  })

  test('should accept zero debounce', () => {
    const result = decode(DataTableSearchSchema)({ debounceMs: 0 })
    expect(result.debounceMs).toBe(0)
  })

  test('should reject negative debounce', () => {
    expect(() => decode(DataTableSearchSchema)({ debounceMs: -100 })).toThrow()
  })
})

// ---------------------------------------------------------------------------
// DataTableGroupBySchema
// ---------------------------------------------------------------------------

describe('DataTableGroupBySchema', () => {
  test('should accept minimal groupBy', () => {
    const result = decode(DataTableGroupBySchema)({ field: 'status' })
    expect(result.field).toBe('status')
  })

  test('should accept full groupBy config', () => {
    const result = decode(DataTableGroupBySchema)({
      field: 'category',
      direction: 'desc',
      collapsed: true,
      hideEmpty: true,
    })
    expect(result.direction).toBe('desc')
    expect(result.collapsed).toBe(true)
    expect(result.hideEmpty).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// DataTableSummaryItemSchema
// ---------------------------------------------------------------------------

describe('DataTableSummaryItemSchema', () => {
  test('should accept all summary functions', () => {
    for (const fn of ['count', 'sum', 'avg', 'min', 'max'] as const) {
      const result = decode(DataTableSummaryItemSchema)({
        field: 'amount',
        function: fn,
      })
      expect(result.function).toBe(fn)
    }
  })

  test('should accept optional label', () => {
    const result = decode(DataTableSummaryItemSchema)({
      field: 'total',
      function: 'count',
      label: 'Total Records',
    })
    expect(result.label).toBe('Total Records')
  })

  test('should reject invalid function', () => {
    expect(() =>
      decode(DataTableSummaryItemSchema)({
        field: 'amount',
        function: 'median',
      })
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// DataTableToolbarSchema
// ---------------------------------------------------------------------------

describe('DataTableToolbarSchema', () => {
  test('should accept all toolbar flags', () => {
    const result = decode(DataTableToolbarSchema)({
      search: true,
      filters: true,
      sort: true,
      export: true,
      refresh: true,
      density: true,
      columnToggle: true,
    })
    expect(result.search).toBe(true)
    expect(result.columnToggle).toBe(true)
  })

  test('should accept empty toolbar (all optional)', () => {
    const result = decode(DataTableToolbarSchema)({})
    expect(result.search).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// DataTableBulkActionSchema
// ---------------------------------------------------------------------------

describe('DataTableBulkActionSchema', () => {
  test('should accept bulk action with confirm', () => {
    const result = decode(DataTableBulkActionSchema)({
      label: 'Delete Selected',
      icon: 'trash',
      action: { type: 'crud', operation: 'delete', table: 'orders' },
      confirm: 'Delete {count} orders?',
    })
    expect(result.label).toBe('Delete Selected')
    expect(result.confirm).toBe('Delete {count} orders?')
  })

  test('should accept bulk action without confirm', () => {
    const result = decode(DataTableBulkActionSchema)({
      label: 'Export',
      action: { type: 'crud', operation: 'update', table: 'orders' },
    })
    expect(result.confirm).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// DataTableSchema (full)
// ---------------------------------------------------------------------------

describe('DataTableSchema', () => {
  test('should accept minimal data table (dataSource only)', () => {
    const result = decode(DataTableSchema)({
      dataSource: { table: 'orders' },
    })
    expect(result.dataSource.table).toBe('orders')
    expect(result.columns).toBeUndefined()
    expect(result.selection).toBeUndefined()
  })

  test('should accept data table with view reference', () => {
    const result = decode(DataTableSchema)({
      dataSource: { table: 'orders', view: 'active-orders' },
    })
    expect(result.dataSource.view).toBe('active-orders')
  })

  // TODO: Enable when DataTableSchema composition is complete
  test.skip('should accept fully configured data table', () => {
    const result = decode(DataTableSchema)({
      dataSource: { table: 'orders', view: 'active-orders' },
      columns: [
        { field: 'name', label: 'Customer', width: 200 },
        {
          field: 'status',
          cellStyle: [{ when: { eq: 'shipped' }, className: 'bg-green-50' }],
        },
        {
          type: 'actions',
          width: 80,
          actions: [
            {
              label: 'Edit',
              icon: 'pencil',
              action: { type: 'crud', operation: 'update', table: 'orders' },
            },
          ],
        },
      ],
      rowHeight: 'medium',
      striped: true,
      bordered: true,
      emptyMessage: 'No orders found',
      showRowNumbers: false,
      selection: { mode: 'multiple', showCheckboxes: true },
      pagination: { pageSize: 25, pageSizeOptions: [10, 25, 50], position: 'bottom' },
      search: { enabled: true, placeholder: 'Search...', debounceMs: 300 },
      defaultSort: [{ field: 'createdAt', direction: 'desc' }],
      defaultFilters: [{ field: 'status', operator: 'eq', value: 'active' }],
      groupBy: { field: 'status', direction: 'asc', collapsed: false },
      summary: [
        { field: 'total', function: 'count', label: 'Total' },
        { field: 'amount', function: 'sum', label: 'Revenue' },
      ],
      toolbar: { search: true, filters: true, export: true },
      bulkActions: [
        {
          label: 'Delete Selected',
          icon: 'trash',
          action: { type: 'crud', operation: 'delete', table: 'orders' },
          confirm: 'Delete {count} orders?',
        },
      ],
      onRowClick: { type: 'crud', operation: 'update', table: 'orders' },
    })
    expect(result.columns).toHaveLength(3)
    expect(result.rowHeight).toBe('medium')
    expect(result.striped).toBe(true)
    expect(result.selection?.mode).toBe('multiple')
    expect(result.pagination?.pageSize).toBe(25)
    expect(result.search?.enabled).toBe(true)
    expect(result.groupBy?.field).toBe('status')
    expect(result.summary).toHaveLength(2)
    expect(result.toolbar?.export).toBe(true)
    expect(result.bulkActions).toHaveLength(1)
  })

  test('should accept all row heights', () => {
    for (const rowHeight of ['short', 'medium', 'tall'] as const) {
      const result = decode(DataTableSchema)({
        dataSource: { table: 'orders' },
        rowHeight,
      })
      expect(result.rowHeight).toBe(rowHeight)
    }
  })

  test('should reject empty columns array', () => {
    expect(() =>
      decode(DataTableSchema)({
        dataSource: { table: 'orders' },
        columns: [],
      })
    ).toThrow()
  })

  test('should reject missing dataSource', () => {
    expect(() => decode(DataTableSchema)({})).toThrow()
  })

  test('should reject missing dataSource.table', () => {
    expect(() => decode(DataTableSchema)({ dataSource: {} })).toThrow()
  })

  test('should accept onRowClick with auth action', () => {
    const result = decode(DataTableSchema)({
      dataSource: { table: 'users' },
      onRowClick: { type: 'auth', method: 'login', strategy: 'email' },
    })
    expect(result.onRowClick).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// validateDataTableColumns
// ---------------------------------------------------------------------------

// TODO(human): Implement the validateDataTableColumns test suite
// See guidance below the test file for what to write.

describe('validateDataTableColumns', () => {
  const tables: ReadonlyMap<string, readonly string[]> = new Map([
    ['orders', ['name', 'status', 'amount', 'total', 'createdAt']],
    ['users', ['name', 'email', 'role']],
  ])

  test('should pass for valid table with no columns', () => {
    const dt = decode(DataTableSchema)({ dataSource: { table: 'orders' } })
    const result = validateDataTableColumns(dt, tables)
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  test('should fail for unknown table', () => {
    const dt = decode(DataTableSchema)({ dataSource: { table: 'products' } })
    const result = validateDataTableColumns(dt, tables)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain("Table 'products' not found")
  })

  test('should fail for invalid column field', () => {
    const dt = decode(DataTableSchema)({
      dataSource: { table: 'orders' },
      columns: [{ field: 'nonexistent' }],
    })
    const result = validateDataTableColumns(dt, tables)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain("field 'nonexistent'")
  })

  test('should pass for action columns (no field validation)', () => {
    const dt = decode(DataTableSchema)({
      dataSource: { table: 'orders' },
      columns: [
        {
          type: 'actions',
          actions: [
            { label: 'Edit', action: { type: 'crud', operation: 'update', table: 'orders' } },
          ],
        },
      ],
    })
    const result = validateDataTableColumns(dt, tables)
    expect(result.valid).toBe(true)
  })

  test('should validate groupBy field', () => {
    const dt = decode(DataTableSchema)({
      dataSource: { table: 'orders' },
      groupBy: { field: 'badField' },
    })
    const result = validateDataTableColumns(dt, tables)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('groupBy')
  })

  test('should validate summary fields', () => {
    const dt = decode(DataTableSchema)({
      dataSource: { table: 'orders' },
      summary: [{ field: 'missing', function: 'sum' }],
    })
    const result = validateDataTableColumns(dt, tables)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('summary')
  })

  test('should validate defaultSort fields', () => {
    const dt = decode(DataTableSchema)({
      dataSource: { table: 'orders' },
      defaultSort: [{ field: 'badSort', direction: 'asc' }],
    })
    const result = validateDataTableColumns(dt, tables)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('defaultSort')
  })

  test('should validate defaultFilter fields', () => {
    const dt = decode(DataTableSchema)({
      dataSource: { table: 'orders' },
      defaultFilters: [{ field: 'badFilter', operator: 'eq', value: 'x' }],
    })
    const result = validateDataTableColumns(dt, tables)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('defaultFilters')
  })

  test('should collect multiple errors', () => {
    const dt = decode(DataTableSchema)({
      dataSource: { table: 'orders' },
      columns: [{ field: 'bad1' }],
      groupBy: { field: 'bad2' },
      summary: [{ field: 'bad3', function: 'count' }],
    })
    const result = validateDataTableColumns(dt, tables)
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBe(3)
  })

  test('should pass with all valid references', () => {
    const dt = decode(DataTableSchema)({
      dataSource: { table: 'orders' },
      columns: [{ field: 'name' }, { field: 'status' }],
      groupBy: { field: 'status' },
      summary: [{ field: 'amount', function: 'sum' }],
      defaultSort: [{ field: 'createdAt', direction: 'desc' }],
      defaultFilters: [{ field: 'status', operator: 'eq', value: 'active' }],
    })
    const result = validateDataTableColumns(dt, tables)
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })
})
