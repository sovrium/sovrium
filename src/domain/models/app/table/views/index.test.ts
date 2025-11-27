/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { ViewSchema, ViewsSchema } from '.'

describe('ViewSchema', () => {
  describe('Valid Views - Minimal', () => {
    test('should accept minimal view', () => {
      // GIVEN: A minimal view configuration
      const view = { id: 1, name: 'All Records' }

      // WHEN: The view is validated against the schema
      const result = Schema.decodeUnknownSync(ViewSchema)(view)

      // THEN: The view should be accepted
      expect(result).toEqual({ id: 1, name: 'All Records' })
    })

    test('should accept view with string ID', () => {
      // GIVEN: A view with string ID
      const view = { id: 'default', name: 'Default View' }

      // WHEN: The view is validated against the schema
      const result = Schema.decodeUnknownSync(ViewSchema)(view)

      // THEN: The view should be accepted
      expect(result).toEqual({ id: 'default', name: 'Default View' })
    })
  })

  describe('Valid Views - SQL Query Mode', () => {
    test('should accept SQL query view', () => {
      // GIVEN: A view with SQL query
      const view = {
        id: 'active_users',
        name: 'Active Users',
        query: 'SELECT * FROM users WHERE active = true',
      }

      // WHEN: The view is validated against the schema
      const result = Schema.decodeUnknownSync(ViewSchema)(view)

      // THEN: The view should be accepted
      expect(result).toEqual(view)
    })

    test('should accept materialized view', () => {
      // GIVEN: A materialized view
      const view = {
        id: 'order_stats',
        name: 'Order Statistics',
        query:
          'SELECT customer_id, COUNT(*) as order_count, SUM(amount) as total FROM orders GROUP BY customer_id',
        materialized: true,
      }

      // WHEN: The view is validated against the schema
      const result = Schema.decodeUnknownSync(ViewSchema)(view)

      // THEN: The view should be accepted
      expect(result).toEqual(view)
    })

    test('should accept materialized view with refreshOnMigration', () => {
      // GIVEN: A materialized view with refresh on migration
      const view = {
        id: 'daily_stats',
        name: 'Daily Statistics',
        query: 'SELECT date, COUNT(*) as count FROM events GROUP BY date',
        materialized: true,
        refreshOnMigration: true,
      }

      // WHEN: The view is validated against the schema
      const result = Schema.decodeUnknownSync(ViewSchema)(view)

      // THEN: The view should be accepted
      expect(result).toEqual(view)
    })
  })

  describe('Valid Views - JSON Config Mode', () => {
    test('should accept view with isDefault', () => {
      // GIVEN: A default view
      const view = {
        id: 1,
        name: 'Default View',
        isDefault: true,
      }

      // WHEN: The view is validated against the schema
      const result = Schema.decodeUnknownSync(ViewSchema)(view)

      // THEN: The view should be accepted
      expect(result).toEqual(view)
    })

    test('should accept view with filters', () => {
      // GIVEN: A view with filters
      const view = {
        id: 3,
        name: 'Active Items',
        filters: {
          conjunction: 'and' as const,
          conditions: [{ field: 'status', operator: 'equals', value: 'active' }],
        },
      }

      // WHEN: The view is validated against the schema
      const result = Schema.decodeUnknownSync(ViewSchema)(view)

      // THEN: The view should be accepted
      expect(result).toEqual(view)
    })

    test('should accept view with sorts', () => {
      // GIVEN: A view with sorts
      const view = {
        id: 4,
        name: 'By Date',
        sorts: [
          { field: 'createdAt', direction: 'desc' as const },
          { field: 'name', direction: 'asc' as const },
        ],
      }

      // WHEN: The view is validated against the schema
      const result = Schema.decodeUnknownSync(ViewSchema)(view)

      // THEN: The view should be accepted
      expect(result).toEqual(view)
    })

    test('should accept view with fields', () => {
      // GIVEN: A view with field names
      const view = {
        id: 5,
        name: 'Custom Fields',
        fields: ['name', 'email', 'notes'],
      }

      // WHEN: The view is validated against the schema
      const result = Schema.decodeUnknownSync(ViewSchema)(view)

      // THEN: The view should be accepted
      expect(result).toEqual(view)
    })

    test('should accept view with groupBy', () => {
      // GIVEN: A view with groupBy
      const view = {
        id: 2,
        name: 'Task Board',
        groupBy: { field: 'status' },
      }

      // WHEN: The view is validated against the schema
      const result = Schema.decodeUnknownSync(ViewSchema)(view)

      // THEN: The view should be accepted
      expect(result).toEqual(view)
    })

    test('should accept fully configured JSON view', () => {
      // GIVEN: A fully configured view
      const view = {
        id: 6,
        name: 'Complete View',
        isDefault: true,
        filters: {
          conjunction: 'and' as const,
          conditions: [{ field: 'archived', operator: 'equals', value: false }],
        },
        sorts: [{ field: 'createdAt', direction: 'desc' as const }],
        fields: ['name', 'email', 'status'],
        groupBy: { field: 'category', order: 'asc' as const },
      }

      // WHEN: The view is validated against the schema
      const result = Schema.decodeUnknownSync(ViewSchema)(view)

      // THEN: The view should be accepted
      expect(result).toEqual(view)
    })

    test('should accept view with permissions', () => {
      // GIVEN: A view with permissions
      const view = {
        id: 8,
        name: 'Admin View',
        permissions: { read: ['admin'], write: ['admin'] },
      }

      // WHEN: The view is validated against the schema
      const result = Schema.decodeUnknownSync(ViewSchema)(view)

      // THEN: The view should be accepted
      expect(result).toEqual(view)
    })
  })

  describe('Invalid Views', () => {
    test('should reject view without id', () => {
      // GIVEN: A view without id
      const view = { name: 'No ID View' }

      // WHEN/THEN: The view validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewSchema)(view)
      }).toThrow()
    })

    test('should reject view without name', () => {
      // GIVEN: A view without name
      const view = { id: 1 }

      // WHEN/THEN: The view validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewSchema)(view)
      }).toThrow()
    })

    test('should reject view with empty name', () => {
      // GIVEN: A view with empty name
      const view = { id: 1, name: '' }

      // WHEN/THEN: The view validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewSchema)(view)
      }).toThrow()
    })

    test('should reject null', () => {
      // GIVEN: A null value
      const view = null

      // WHEN/THEN: The view validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewSchema)(view)
      }).toThrow()
    })

    test('should reject view with invalid filter conjunction', () => {
      // GIVEN: A view with invalid filter conjunction
      const view = {
        id: 1,
        name: 'Invalid Filters',
        filters: { conjunction: 'xor' },
      }

      // WHEN/THEN: The view validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewSchema)(view)
      }).toThrow()
    })

    test('should reject view with invalid sort direction', () => {
      // GIVEN: A view with invalid sort direction
      const view = {
        id: 1,
        name: 'Invalid Sorts',
        sorts: [{ field: 'name', direction: 'ascending' }],
      }

      // WHEN/THEN: The view validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewSchema)(view)
      }).toThrow()
    })

    test('should reject view with non-boolean materialized', () => {
      // GIVEN: A view with non-boolean materialized
      const view = {
        id: 1,
        name: 'Invalid',
        query: 'SELECT * FROM users',
        materialized: 'yes',
      }

      // WHEN/THEN: The view validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewSchema)(view)
      }).toThrow()
    })

    test('should reject view with non-boolean isDefault', () => {
      // GIVEN: A view with non-boolean isDefault
      const view = {
        id: 1,
        name: 'Invalid',
        isDefault: 'true',
      }

      // WHEN/THEN: The view validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewSchema)(view)
      }).toThrow()
    })
  })
})

describe('ViewsSchema', () => {
  describe('Valid Views Arrays', () => {
    test('should accept empty array', () => {
      // GIVEN: An empty views array
      const views: unknown[] = []

      // WHEN: The views are validated against the schema
      const result = Schema.decodeUnknownSync(ViewsSchema)(views)

      // THEN: The views should be accepted
      expect(result).toEqual([])
    })

    test('should accept single view', () => {
      // GIVEN: A single view
      const views = [{ id: 1, name: 'Default' }]

      // WHEN: The views are validated against the schema
      const result = Schema.decodeUnknownSync(ViewsSchema)(views)

      // THEN: The views should be accepted
      expect(result).toEqual([{ id: 1, name: 'Default' }])
    })

    test('should accept multiple views with different modes', () => {
      // GIVEN: Multiple views with different modes
      const views = [
        { id: 'sql_view', name: 'SQL View', query: 'SELECT * FROM users' },
        {
          id: 2,
          name: 'Config View',
          isDefault: true,
          filters: {
            conjunction: 'and' as const,
            conditions: [{ field: 'active', operator: 'equals', value: true }],
          },
        },
        {
          id: 'mat_view',
          name: 'Materialized',
          query: 'SELECT COUNT(*) FROM orders',
          materialized: true,
        },
      ]

      // WHEN: The views are validated against the schema
      const result = Schema.decodeUnknownSync(ViewsSchema)(views)

      // THEN: The views should be accepted
      expect(result).toEqual(views)
    })

    test('should accept views with mixed ID types', () => {
      // GIVEN: Views with mixed ID types
      const views = [
        { id: 1, name: 'Numeric ID' },
        { id: 'string-id', name: 'String ID' },
      ]

      // WHEN: The views are validated against the schema
      const result = Schema.decodeUnknownSync(ViewsSchema)(views)

      // THEN: The views should be accepted
      expect(result).toEqual(views)
    })
  })

  describe('Invalid Views Arrays', () => {
    test('should reject array with invalid view', () => {
      // GIVEN: An array containing an invalid view
      const views = [{ id: 1, name: 'Valid' }, { id: 2 }] // Second view missing name

      // WHEN/THEN: The views validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewsSchema)(views)
      }).toThrow()
    })

    test('should reject non-array', () => {
      // GIVEN: A non-array value
      const views = { id: 1, name: 'Not an array' }

      // WHEN/THEN: The views validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewsSchema)(views)
      }).toThrow()
    })

    test('should reject null', () => {
      // GIVEN: A null value
      const views = null

      // WHEN/THEN: The views validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewsSchema)(views)
      }).toThrow()
    })
  })
})

describe('Type Inference', () => {
  test('should infer View type correctly for SQL view', () => {
    // GIVEN: A valid SQL view
    const view = {
      id: 'active_users',
      name: 'Active Users',
      query: 'SELECT * FROM users WHERE active = true',
      materialized: true,
    }

    // WHEN: The view is validated against the schema
    const result = Schema.decodeUnknownSync(ViewSchema)(view)

    // THEN: TypeScript should infer the correct type
    expect(result.id).toBe('active_users')
    expect(result.name).toBe('Active Users')
    expect(result.query).toBe('SELECT * FROM users WHERE active = true')
    expect(result.materialized).toBe(true)
  })

  test('should infer View type correctly for config view', () => {
    // GIVEN: A valid config view
    const view = {
      id: 1,
      name: 'Default View',
      isDefault: true,
    }

    // WHEN: The view is validated against the schema
    const result = Schema.decodeUnknownSync(ViewSchema)(view)

    // THEN: TypeScript should infer the correct type
    expect(result.id).toBe(1)
    expect(result.name).toBe('Default View')
    expect(result.isDefault).toBe(true)
  })

  test('should infer Views type correctly', () => {
    // GIVEN: Valid views
    const views = [
      { id: 1, name: 'View 1' },
      { id: 2, name: 'View 2' },
    ]

    // WHEN: The views are validated against the schema
    const result = Schema.decodeUnknownSync(ViewsSchema)(views)

    // THEN: TypeScript should infer the correct type
    expect(result).toHaveLength(2)
    expect(result[0]!.name).toBe('View 1')
  })
})
