/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import {
  baseFieldSchema,
  fieldValueSchema,
  formattedFieldValueSchema,
  tableSchema,
  tableSummarySchema,
  recordSchema,
  listTablesResponseSchema,
  getTableResponseSchema,
  listRecordsResponseSchema,
  getRecordResponseSchema,
  batchCreateRecordsResponseSchema,
  batchDeleteRecordsResponseSchema,
  batchRestoreRecordsResponseSchema,
  getTablePermissionsResponseSchema,
  getViewResponseSchema,
} from './tables'

const validTimestamps = {
  createdAt: '2025-01-15T10:30:00Z',
  updatedAt: '2025-01-15T11:00:00Z',
}

describe('fieldValueSchema', () => {
  test('accepts string values', () => {
    expect(fieldValueSchema.parse('hello')).toBe('hello')
  })

  test('accepts number values', () => {
    expect(fieldValueSchema.parse(42)).toBe(42)
  })

  test('accepts boolean values', () => {
    expect(fieldValueSchema.parse(true)).toBe(true)
  })

  test('accepts null', () => {
    expect(fieldValueSchema.parse(null)).toBeNull()
  })

  test('accepts arrays', () => {
    const result = fieldValueSchema.parse([1, 'two', true])
    expect(result).toEqual([1, 'two', true])
  })

  test('accepts objects', () => {
    const result = fieldValueSchema.parse({ key: 'value' })
    expect(result).toEqual({ key: 'value' })
  })

  test('rejects undefined', () => {
    expect(() => fieldValueSchema.parse(undefined)).toThrow()
  })
})

describe('formattedFieldValueSchema', () => {
  test('accepts raw field values', () => {
    expect(formattedFieldValueSchema.parse('text')).toBe('text')
    expect(formattedFieldValueSchema.parse(42)).toBe(42)
  })

  test('accepts formatted value with displayValue', () => {
    const input = { value: 1000, displayValue: '$1,000.00' }
    const result = formattedFieldValueSchema.parse(input)
    expect(result).toEqual(input)
  })

  test('accepts formatted value without displayValue', () => {
    const input = { value: 42 }
    const result = formattedFieldValueSchema.parse(input)
    expect(result).toEqual({ value: 42 })
  })
})

describe('baseFieldSchema', () => {
  test('validates field with required properties', () => {
    const input = { id: 'field_1', name: 'Name', type: 'text' }
    const result = baseFieldSchema.parse(input)
    expect(result.id).toBe('field_1')
    expect(result.type).toBe('text')
  })

  test('validates field with all optional properties', () => {
    const input = {
      id: 'field_1',
      name: 'Email',
      type: 'email',
      required: true,
      unique: true,
      indexed: true,
      description: 'User email',
    }
    const result = baseFieldSchema.parse(input)
    expect(result.required).toBe(true)
    expect(result.description).toBe('User email')
  })

  test('rejects missing required properties', () => {
    expect(() => baseFieldSchema.parse({ id: 'field_1' })).toThrow()
  })
})

describe('tableSchema', () => {
  test('validates complete table', () => {
    const input = {
      id: 'tbl_1',
      name: 'Users',
      fields: [{ id: 'f1', name: 'Name', type: 'text' }],
      views: [],
      ...validTimestamps,
    }
    const result = tableSchema.parse(input)
    expect(result.name).toBe('Users')
    expect(result.fields).toHaveLength(1)
  })

  test('validates table with optional fields', () => {
    const input = {
      id: 'tbl_1',
      name: 'Users',
      description: 'User table',
      fields: [],
      primaryKey: 'id',
      views: [],
      ...validTimestamps,
    }
    const result = tableSchema.parse(input)
    expect(result.description).toBe('User table')
    expect(result.primaryKey).toBe('id')
  })
})

describe('tableSummarySchema', () => {
  test('validates table summary', () => {
    const input = {
      id: 'tbl_1',
      name: 'Users',
      fieldCount: 5,
      ...validTimestamps,
    }
    const result = tableSummarySchema.parse(input)
    expect(result.fieldCount).toBe(5)
    expect(result.recordCount).toBeUndefined()
  })
})

describe('recordSchema', () => {
  test('validates record with fields', () => {
    const input = {
      id: 'rec_1',
      fields: { name: 'John', age: 30 },
      ...validTimestamps,
    }
    const result = recordSchema.parse(input)
    expect(result.id).toBe('rec_1')
    expect(result.fields).toEqual({ name: 'John', age: 30 })
  })

  test('accepts numeric id', () => {
    const input = {
      id: 123,
      fields: {},
      ...validTimestamps,
    }
    const result = recordSchema.parse(input)
    expect(result.id).toBe(123)
  })

  test('validates optional createdBy/updatedBy', () => {
    const input = {
      id: 'rec_1',
      fields: {},
      createdBy: 'user_1',
      updatedBy: 'user_2',
      ...validTimestamps,
    }
    const result = recordSchema.parse(input)
    expect(result.createdBy).toBe('user_1')
  })
})

describe('listTablesResponseSchema', () => {
  test('validates list with tables', () => {
    const input = {
      tables: [{ id: 'tbl_1', name: 'Users', fieldCount: 3, ...validTimestamps }],
    }
    const result = listTablesResponseSchema.parse(input)
    expect(result.tables).toHaveLength(1)
  })

  test('validates empty list', () => {
    const result = listTablesResponseSchema.parse({ tables: [] })
    expect(result.tables).toEqual([])
  })
})

describe('getTableResponseSchema', () => {
  test('validates get table response', () => {
    const input = {
      table: {
        id: 'tbl_1',
        name: 'Users',
        fields: [],
        views: [],
        ...validTimestamps,
      },
    }
    const result = getTableResponseSchema.parse(input)
    expect(result.table.id).toBe('tbl_1')
  })
})

describe('listRecordsResponseSchema', () => {
  test('validates records with pagination', () => {
    const input = {
      records: [{ id: 'rec_1', fields: { name: 'John' }, ...validTimestamps }],
      pagination: {
        page: 1,
        limit: 20,
        offset: 0,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    }
    const result = listRecordsResponseSchema.parse(input)
    expect(result.records).toHaveLength(1)
    expect(result.pagination?.total).toBe(1)
  })

  test('validates with aggregations', () => {
    const input = {
      records: [],
      aggregations: { count: '42', sum: { price: 1500 } },
    }
    const result = listRecordsResponseSchema.parse(input)
    expect(result.aggregations?.count).toBe('42')
  })
})

describe('getRecordResponseSchema', () => {
  test('validates flattened record response', () => {
    const input = {
      id: 'rec_1',
      fields: { name: 'John' },
      ...validTimestamps,
    }
    const result = getRecordResponseSchema.parse(input)
    expect(result.id).toBe('rec_1')
    expect(result.fields).toEqual({ name: 'John' })
  })
})

describe('batch operation response schemas', () => {
  test('batchCreateRecordsResponseSchema validates', () => {
    const input = {
      records: [{ id: 'rec_1', fields: { name: 'John' }, ...validTimestamps }],
      created: 1,
    }
    const result = batchCreateRecordsResponseSchema.parse(input)
    expect(result.created).toBe(1)
  })

  test('batchDeleteRecordsResponseSchema validates', () => {
    const result = batchDeleteRecordsResponseSchema.parse({ deleted: 5 })
    expect(result.deleted).toBe(5)
  })

  test('batchRestoreRecordsResponseSchema validates', () => {
    const result = batchRestoreRecordsResponseSchema.parse({ success: true, restored: 3 })
    expect(result.success).toBe(true)
    expect(result.restored).toBe(3)
  })
})

describe('getTablePermissionsResponseSchema', () => {
  test('validates permissions response', () => {
    const input = {
      table: { read: true, create: true, update: false, delete: false },
      fields: {
        name: { read: true, write: true },
        secret: { read: false, write: false },
      },
    }
    const result = getTablePermissionsResponseSchema.parse(input)
    expect(result.table.read).toBe(true)
    expect(result.fields['name']?.write).toBe(true)
    expect(result.fields['secret']?.read).toBe(false)
  })
})

describe('getViewResponseSchema', () => {
  test('validates view with filters and sorts', () => {
    const input = {
      id: 'view_1',
      name: 'Active Users',
      filters: { and: [{ field: 'status', operator: 'eq', value: 'active' }] },
      sorts: [{ field: 'name', direction: 'asc' as const }],
      fields: ['name', 'email'],
    }
    const result = getViewResponseSchema.parse(input)
    expect(result.name).toBe('Active Users')
    expect(result.sorts).toHaveLength(1)
  })

  test('validates minimal view', () => {
    const input = { id: 'view_1', name: 'Default' }
    const result = getViewResponseSchema.parse(input)
    expect(result.filters).toBeUndefined()
    expect(result.sorts).toBeUndefined()
  })

  test('rejects invalid sort direction', () => {
    expect(() =>
      getViewResponseSchema.parse({
        id: 'view_1',
        name: 'Test',
        sorts: [{ field: 'name', direction: 'invalid' }],
      })
    ).toThrow()
  })
})
