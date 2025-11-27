/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import {
  createRecordRequestSchema,
  updateRecordRequestSchema,
  batchCreateRecordsRequestSchema,
  batchUpdateRecordsRequestSchema,
  batchDeleteRecordsRequestSchema,
  upsertRecordsRequestSchema,
} from './request-schemas'

describe('createRecordRequestSchema', () => {
  describe('valid inputs', () => {
    test('validates empty fields object', () => {
      const input = { fields: {} }
      const result = createRecordRequestSchema.parse(input)
      expect(result.fields).toEqual({})
    })

    test('validates fields with string values', () => {
      const input = { fields: { name: 'John Doe', title: 'Developer' } }
      const result = createRecordRequestSchema.parse(input)
      expect(result.fields).toEqual({ name: 'John Doe', title: 'Developer' })
    })

    test('validates fields with number values', () => {
      const input = { fields: { age: 30, salary: 50_000.5 } }
      const result = createRecordRequestSchema.parse(input)
      expect(result.fields).toEqual({ age: 30, salary: 50_000.5 })
    })

    test('validates fields with boolean values', () => {
      const input = { fields: { active: true, verified: false } }
      const result = createRecordRequestSchema.parse(input)
      expect(result.fields).toEqual({ active: true, verified: false })
    })

    test('validates fields with null values', () => {
      const input = { fields: { optional: null } }
      const result = createRecordRequestSchema.parse(input)
      expect(result.fields).toEqual({ optional: null })
    })

    test('validates fields with array values', () => {
      const input = { fields: { tags: ['tag1', 'tag2'], numbers: [1, 2, 3] } }
      const result = createRecordRequestSchema.parse(input)
      expect(result.fields).toEqual({ tags: ['tag1', 'tag2'], numbers: [1, 2, 3] })
    })

    test('validates fields with object values', () => {
      const input = { fields: { metadata: { key: 'value', nested: { deep: true } } } }
      const result = createRecordRequestSchema.parse(input)
      expect(result.fields).toEqual({ metadata: { key: 'value', nested: { deep: true } } })
    })

    test('validates mixed field types', () => {
      const input = {
        fields: {
          name: 'John',
          age: 30,
          active: true,
          tags: ['a', 'b'],
          metadata: { key: 'value' },
          optional: null,
        },
      }
      const result = createRecordRequestSchema.parse(input)
      expect(result.fields).toEqual(input.fields)
    })

    test('applies default empty object when fields is missing', () => {
      const input = {}
      const result = createRecordRequestSchema.parse(input)
      expect(result.fields).toEqual({})
    })

    test('applies default empty object when fields is undefined', () => {
      const input = { fields: undefined }
      const result = createRecordRequestSchema.parse(input)
      expect(result.fields).toEqual({})
    })
  })

  describe('invalid inputs', () => {
    test('rejects non-object input', () => {
      expect(() => createRecordRequestSchema.parse('invalid')).toThrow()
      expect(() => createRecordRequestSchema.parse(123)).toThrow()
      expect(() => createRecordRequestSchema.parse(null)).toThrow()
    })

    test('rejects fields with invalid types', () => {
      const input = { fields: { key: Symbol('invalid') } }
      expect(() => createRecordRequestSchema.parse(input)).toThrow()
    })
  })
})

describe('updateRecordRequestSchema', () => {
  test('has same validation rules as createRecordRequestSchema', () => {
    const input = { fields: { name: 'Updated Name', age: 31 } }
    const result = updateRecordRequestSchema.parse(input)
    expect(result.fields).toEqual({ name: 'Updated Name', age: 31 })
  })

  test('applies default empty object when fields is missing', () => {
    const result = updateRecordRequestSchema.parse({})
    expect(result.fields).toEqual({})
  })
})

describe('batchCreateRecordsRequestSchema', () => {
  describe('valid inputs', () => {
    test('validates single record', () => {
      const input = {
        records: [{ fields: { name: 'John' } }],
      }
      const result = batchCreateRecordsRequestSchema.parse(input)
      expect(result.records).toHaveLength(1)
      expect(result.records[0]?.fields).toEqual({ name: 'John' })
    })

    test('validates multiple records', () => {
      const input = {
        records: [{ fields: { name: 'John' } }, { fields: { name: 'Jane' } }],
      }
      const result = batchCreateRecordsRequestSchema.parse(input)
      expect(result.records).toHaveLength(2)
    })

    test('validates exactly 100 records (maximum)', () => {
      const input = {
        records: Array.from({ length: 100 }, (_, i) => ({
          fields: { index: i },
        })),
      }
      const result = batchCreateRecordsRequestSchema.parse(input)
      expect(result.records).toHaveLength(100)
    })

    test('applies default empty fields to records without fields', () => {
      const input = {
        records: [{}],
      }
      const result = batchCreateRecordsRequestSchema.parse(input)
      expect(result.records[0]?.fields).toEqual({})
    })

    test('validates records with mixed field types', () => {
      const input = {
        records: [
          { fields: { name: 'John', age: 30 } },
          { fields: { active: true, tags: ['a', 'b'] } },
        ],
      }
      const result = batchCreateRecordsRequestSchema.parse(input)
      expect(result.records).toHaveLength(2)
    })
  })

  describe('invalid inputs', () => {
    test('rejects empty records array', () => {
      const input = { records: [] }
      expect(() => batchCreateRecordsRequestSchema.parse(input)).toThrow(
        'At least one record is required'
      )
    })

    test('rejects more than 100 records', () => {
      const input = {
        records: Array.from({ length: 101 }, (_, i) => ({
          fields: { index: i },
        })),
      }
      expect(() => batchCreateRecordsRequestSchema.parse(input)).toThrow(
        'Maximum 100 records per batch'
      )
    })

    test('rejects non-array records', () => {
      const input = { records: 'invalid' }
      expect(() => batchCreateRecordsRequestSchema.parse(input)).toThrow()
    })

    test('rejects missing records field', () => {
      expect(() => batchCreateRecordsRequestSchema.parse({})).toThrow()
    })
  })
})

describe('batchUpdateRecordsRequestSchema', () => {
  describe('valid inputs', () => {
    test('validates single record with id', () => {
      const input = {
        records: [{ id: 'rec123', fields: { name: 'Updated' } }],
      }
      const result = batchUpdateRecordsRequestSchema.parse(input)
      expect(result.records).toHaveLength(1)
      expect(result.records[0]?.id).toBe('rec123')
      expect(result.records[0]?.fields).toEqual({ name: 'Updated' })
    })

    test('validates multiple records with ids', () => {
      const input = {
        records: [
          { id: 'rec123', fields: { name: 'John' } },
          { id: 'rec456', fields: { name: 'Jane' } },
        ],
      }
      const result = batchUpdateRecordsRequestSchema.parse(input)
      expect(result.records).toHaveLength(2)
      expect(result.records[0]!.id).toBe('rec123')
      expect(result.records[1]!.id).toBe('rec456')
    })

    test('validates exactly 100 records (maximum)', () => {
      const input = {
        records: Array.from({ length: 100 }, (_, i) => ({
          id: `rec${i}`,
          fields: { index: i },
        })),
      }
      const result = batchUpdateRecordsRequestSchema.parse(input)
      expect(result.records).toHaveLength(100)
    })

    test('applies default empty fields when fields is missing', () => {
      const input = {
        records: [{ id: 'rec123' }],
      }
      const result = batchUpdateRecordsRequestSchema.parse(input)
      expect(result.records[0]?.fields).toEqual({})
    })
  })

  describe('invalid inputs', () => {
    test('rejects empty records array', () => {
      const input = { records: [] }
      expect(() => batchUpdateRecordsRequestSchema.parse(input)).toThrow(
        'At least one record is required'
      )
    })

    test('rejects more than 100 records', () => {
      const input = {
        records: Array.from({ length: 101 }, (_, i) => ({
          id: `rec${i}`,
          fields: { index: i },
        })),
      }
      expect(() => batchUpdateRecordsRequestSchema.parse(input)).toThrow(
        'Maximum 100 records per batch'
      )
    })

    test('rejects record without id', () => {
      const input = {
        records: [{ fields: { name: 'No ID' } }],
      }
      expect(() => batchUpdateRecordsRequestSchema.parse(input)).toThrow()
    })

    test('rejects record with empty id', () => {
      const input = {
        records: [{ id: '', fields: { name: 'Empty ID' } }],
      }
      expect(() => batchUpdateRecordsRequestSchema.parse(input)).toThrow('Record ID is required')
    })

    test('rejects missing records field', () => {
      expect(() => batchUpdateRecordsRequestSchema.parse({})).toThrow()
    })
  })
})

describe('batchDeleteRecordsRequestSchema', () => {
  describe('valid inputs', () => {
    test('validates single id', () => {
      const input = { ids: ['rec123'] }
      const result = batchDeleteRecordsRequestSchema.parse(input)
      expect(result.ids).toEqual(['rec123'])
    })

    test('validates multiple ids', () => {
      const input = { ids: ['rec123', 'rec456', 'rec789'] }
      const result = batchDeleteRecordsRequestSchema.parse(input)
      expect(result.ids).toHaveLength(3)
    })

    test('validates exactly 100 ids (maximum)', () => {
      const input = {
        ids: Array.from({ length: 100 }, (_, i) => `rec${i}`),
      }
      const result = batchDeleteRecordsRequestSchema.parse(input)
      expect(result.ids).toHaveLength(100)
    })

    test('validates ids with various formats', () => {
      const input = {
        ids: ['rec_abc123', 'uuid-format', '12345', 'custom-id-format'],
      }
      const result = batchDeleteRecordsRequestSchema.parse(input)
      expect(result.ids).toEqual(input.ids)
    })
  })

  describe('invalid inputs', () => {
    test('rejects empty ids array', () => {
      const input = { ids: [] }
      expect(() => batchDeleteRecordsRequestSchema.parse(input)).toThrow(
        'At least one ID is required'
      )
    })

    test('rejects more than 100 ids', () => {
      const input = {
        ids: Array.from({ length: 101 }, (_, i) => `rec${i}`),
      }
      expect(() => batchDeleteRecordsRequestSchema.parse(input)).toThrow(
        'Maximum 100 IDs per batch'
      )
    })

    test('rejects empty string ids', () => {
      const input = { ids: ['rec123', '', 'rec456'] }
      expect(() => batchDeleteRecordsRequestSchema.parse(input)).toThrow(
        'Record ID cannot be empty'
      )
    })

    test('rejects non-string ids', () => {
      const input = { ids: [123, 456] }
      expect(() => batchDeleteRecordsRequestSchema.parse(input)).toThrow()
    })

    test('rejects non-array ids', () => {
      const input = { ids: 'invalid' }
      expect(() => batchDeleteRecordsRequestSchema.parse(input)).toThrow()
    })

    test('rejects missing ids field', () => {
      expect(() => batchDeleteRecordsRequestSchema.parse({})).toThrow()
    })
  })
})

describe('upsertRecordsRequestSchema', () => {
  describe('valid inputs', () => {
    test('validates record with id (update mode)', () => {
      const input = {
        records: [{ id: 'rec123', fields: { name: 'Updated' } }],
      }
      const result = upsertRecordsRequestSchema.parse(input)
      expect(result.records[0]?.id).toBe('rec123')
    })

    test('validates record without id (create mode)', () => {
      const input = {
        records: [{ fields: { name: 'New Record' } }],
      }
      const result = upsertRecordsRequestSchema.parse(input)
      expect(result.records[0]?.id).toBeUndefined()
    })

    test('validates mixed records with and without ids', () => {
      const input = {
        records: [
          { id: 'rec123', fields: { name: 'Update' } },
          { fields: { name: 'Create' } },
          { id: 'rec456', fields: { name: 'Another Update' } },
        ],
      }
      const result = upsertRecordsRequestSchema.parse(input)
      expect(result.records).toHaveLength(3)
      expect(result.records[0]!.id).toBe('rec123')
      expect(result.records[1]!.id).toBeUndefined()
      expect(result.records[2]!.id).toBe('rec456')
    })

    test('validates exactly 100 records (maximum)', () => {
      const input = {
        records: Array.from({ length: 100 }, (_, i) => ({
          id: i % 2 === 0 ? `rec${i}` : undefined,
          fields: { index: i },
        })),
      }
      const result = upsertRecordsRequestSchema.parse(input)
      expect(result.records).toHaveLength(100)
    })

    test('applies default empty fields when fields is missing', () => {
      const input = {
        records: [{ id: 'rec123' }],
      }
      const result = upsertRecordsRequestSchema.parse(input)
      expect(result.records[0]?.fields).toEqual({})
    })
  })

  describe('invalid inputs', () => {
    test('rejects empty records array', () => {
      const input = { records: [] }
      expect(() => upsertRecordsRequestSchema.parse(input)).toThrow(
        'At least one record is required'
      )
    })

    test('rejects more than 100 records', () => {
      const input = {
        records: Array.from({ length: 101 }, (_, i) => ({
          id: `rec${i}`,
          fields: { index: i },
        })),
      }
      expect(() => upsertRecordsRequestSchema.parse(input)).toThrow(
        'Maximum 100 records per batch'
      )
    })

    test('rejects non-array records', () => {
      const input = { records: 'invalid' }
      expect(() => upsertRecordsRequestSchema.parse(input)).toThrow()
    })

    test('rejects missing records field', () => {
      expect(() => upsertRecordsRequestSchema.parse({})).toThrow()
    })
  })
})

describe('schema type inference', () => {
  test('CreateRecordRequest type matches schema output', () => {
    const input = { fields: { name: 'Test' } }
    const result = createRecordRequestSchema.parse(input)

    // Type assertion to verify type compatibility
    const typed: typeof result = {
      fields: { name: 'Test' },
    }
    expect(typed).toEqual(result)
  })

  test('UpdateRecordRequest type matches schema output', () => {
    const input = { fields: { name: 'Updated' } }
    const result = updateRecordRequestSchema.parse(input)

    const typed: typeof result = {
      fields: { name: 'Updated' },
    }
    expect(typed).toEqual(result)
  })

  test('BatchCreateRecordsRequest type matches schema output', () => {
    const input = { records: [{ fields: { name: 'Test' } }] }
    const result = batchCreateRecordsRequestSchema.parse(input)

    const typed: typeof result = {
      records: [{ fields: { name: 'Test' } }],
    }
    expect(typed).toEqual(result)
  })

  test('BatchUpdateRecordsRequest type matches schema output', () => {
    const input = { records: [{ id: 'rec123', fields: { name: 'Test' } }] }
    const result = batchUpdateRecordsRequestSchema.parse(input)

    const typed: typeof result = {
      records: [{ id: 'rec123', fields: { name: 'Test' } }],
    }
    expect(typed).toEqual(result)
  })

  test('BatchDeleteRecordsRequest type matches schema output', () => {
    const input = { ids: ['rec123', 'rec456'] }
    const result = batchDeleteRecordsRequestSchema.parse(input)

    const typed: typeof result = {
      ids: ['rec123', 'rec456'],
    }
    expect(typed).toEqual(result)
  })

  test('UpsertRecordsRequest type matches schema output', () => {
    const input = {
      records: [
        { id: 'rec123', fields: { name: 'Update' } },
        { fields: { name: 'Create' } },
      ],
    }
    const result = upsertRecordsRequestSchema.parse(input)

    const typed: typeof result = {
      records: [
        { id: 'rec123', fields: { name: 'Update' } },
        { fields: { name: 'Create' } },
      ],
    }
    expect(typed).toEqual(result)
  })
})
