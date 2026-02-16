/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { generateViewSQL } from './view-generators'
import type { Table } from '@/domain/models/app/table'
import type { View } from '@/domain/models/app/table/views'

describe('generateViewSQL', () => {
  const baseTable: Table = {
    id: 1,
    name: 'projects',
    fields: [
      { id: 1, name: 'id', type: 'integer', required: true },
      { id: 2, name: 'name', type: 'single-line-text' },
      { id: 3, name: 'status', type: 'single-line-text' },
      { id: 4, name: 'priority', type: 'integer' },
    ],
    primaryKey: { type: 'composite', fields: ['id'] },
  }

  describe('SQL Injection Prevention', () => {
    test('should escape single quotes in string values', () => {
      const view: View = {
        id: 'test_view',
        name: 'Test View',
        filters: {
          and: [
            {
              field: 'name',
              operator: 'equals',
              value: "Robert'); DROP TABLE projects; --",
            },
          ],
        },
      }

      const sql = generateViewSQL(baseTable, view)

      // Single quote should be escaped (doubled) - the entire malicious payload becomes a string literal
      expect(sql).toContain("name = 'Robert''); DROP TABLE projects; --'")
      // The payload is safely contained within quotes (not executable SQL)
      expect(sql).toBe(
        "CREATE VIEW test_view AS SELECT * FROM projects WHERE name = 'Robert''); DROP TABLE projects; --'"
      )
    })

    test('should handle multiple single quotes in value', () => {
      const view: View = {
        id: 'test_view',
        name: 'Test View',
        filters: {
          and: [
            {
              field: 'description',
              operator: 'equals',
              value: "It's Alice's project",
            },
          ],
        },
      }

      const sql = generateViewSQL(baseTable, view)

      // Each single quote should be doubled
      expect(sql).toContain("description = 'It''s Alice''s project'")
    })

    test('should safely handle empty string', () => {
      const view: View = {
        id: 'test_view',
        name: 'Test View',
        filters: {
          and: [
            {
              field: 'status',
              operator: 'equals',
              value: '',
            },
          ],
        },
      }

      const sql = generateViewSQL(baseTable, view)

      expect(sql).toContain("status = ''")
    })
  })

  describe('Value Type Handling', () => {
    test('should handle string values', () => {
      const view: View = {
        id: 'test_view',
        name: 'Test View',
        filters: {
          and: [
            {
              field: 'status',
              operator: 'equals',
              value: 'active',
            },
          ],
        },
      }

      const sql = generateViewSQL(baseTable, view)

      expect(sql).toContain("status = 'active'")
    })

    test('should handle numeric values', () => {
      const view: View = {
        id: 'test_view',
        name: 'Test View',
        filters: {
          and: [
            {
              field: 'priority',
              operator: 'greaterThan',
              value: 2,
            },
          ],
        },
      }

      const sql = generateViewSQL(baseTable, view)

      expect(sql).toContain('priority > 2')
      // Numeric values should not be quoted
      expect(sql).not.toContain("priority > '2'")
    })

    test('should handle boolean values', () => {
      const view: View = {
        id: 'test_view',
        name: 'Test View',
        filters: {
          and: [
            {
              field: 'archived',
              operator: 'equals',
              value: true,
            },
          ],
        },
      }

      const sql = generateViewSQL(baseTable, view)

      expect(sql).toContain('archived = true')
    })

    test('should handle null values', () => {
      const view: View = {
        id: 'test_view',
        name: 'Test View',
        filters: {
          and: [
            {
              field: 'deleted_at',
              operator: 'equals',
              value: null,
            },
          ],
        },
      }

      const sql = generateViewSQL(baseTable, view)

      expect(sql).toContain('deleted_at = NULL')
    })

    test('should handle zero as numeric value', () => {
      const view: View = {
        id: 'test_view',
        name: 'Test View',
        filters: {
          and: [
            {
              field: 'priority',
              operator: 'equals',
              value: 0,
            },
          ],
        },
      }

      const sql = generateViewSQL(baseTable, view)

      expect(sql).toContain('priority = 0')
    })

    test('should handle negative numbers', () => {
      const view: View = {
        id: 'test_view',
        name: 'Test View',
        filters: {
          and: [
            {
              field: 'balance',
              operator: 'lessThan',
              value: -100,
            },
          ],
        },
      }

      const sql = generateViewSQL(baseTable, view)

      expect(sql).toContain('balance < -100')
    })

    test('should handle decimal numbers', () => {
      const view: View = {
        id: 'test_view',
        name: 'Test View',
        filters: {
          and: [
            {
              field: 'price',
              operator: 'greaterThanOrEqual',
              value: 99.99,
            },
          ],
        },
      }

      const sql = generateViewSQL(baseTable, view)

      expect(sql).toContain('price >= 99.99')
    })
  })

  describe('Comparison Operators', () => {
    test('should generate in operator with array of values', () => {
      const view: View = {
        id: 'test_view',
        name: 'Test View',
        filters: {
          and: [
            {
              field: 'status',
              operator: 'in',
              value: ['active', 'pending', 'review'],
            },
          ],
        },
      }

      const sql = generateViewSQL(baseTable, view)

      expect(sql).toContain("status IN ('active', 'pending', 'review')")
    })

    test('should generate in operator with numeric array', () => {
      const view: View = {
        id: 'test_view',
        name: 'Test View',
        filters: {
          and: [
            {
              field: 'priority',
              operator: 'in',
              value: [1, 2, 3],
            },
          ],
        },
      }

      const sql = generateViewSQL(baseTable, view)

      expect(sql).toContain('priority IN (1, 2, 3)')
    })

    test('should generate in operator with mixed types', () => {
      const view: View = {
        id: 'test_view',
        name: 'Test View',
        filters: {
          and: [
            {
              field: 'value',
              operator: 'in',
              value: ['text', 123, true],
            },
          ],
        },
      }

      const sql = generateViewSQL(baseTable, view)

      expect(sql).toContain("value IN ('text', 123, true)")
    })

    test('should escape single quotes in in operator values', () => {
      const view: View = {
        id: 'test_view',
        name: 'Test View',
        filters: {
          and: [
            {
              field: 'name',
              operator: 'in',
              value: ["Alice's project", "Bob's work"],
            },
          ],
        },
      }

      const sql = generateViewSQL(baseTable, view)

      expect(sql).toContain("name IN ('Alice''s project', 'Bob''s work')")
    })

    test('should generate equals operator', () => {
      const view: View = {
        id: 'test_view',
        name: 'Test View',
        filters: {
          and: [
            {
              field: 'status',
              operator: 'equals',
              value: 'active',
            },
          ],
        },
      }

      const sql = generateViewSQL(baseTable, view)

      expect(sql).toContain("status = 'active'")
    })

    test('should generate greaterThan operator', () => {
      const view: View = {
        id: 'test_view',
        name: 'Test View',
        filters: {
          and: [
            {
              field: 'priority',
              operator: 'greaterThan',
              value: 2,
            },
          ],
        },
      }

      const sql = generateViewSQL(baseTable, view)

      expect(sql).toContain('priority > 2')
    })

    test('should generate lessThan operator', () => {
      const view: View = {
        id: 'test_view',
        name: 'Test View',
        filters: {
          and: [
            {
              field: 'priority',
              operator: 'lessThan',
              value: 5,
            },
          ],
        },
      }

      const sql = generateViewSQL(baseTable, view)

      expect(sql).toContain('priority < 5')
    })

    test('should generate greaterThanOrEqual operator', () => {
      const view: View = {
        id: 'test_view',
        name: 'Test View',
        filters: {
          and: [
            {
              field: 'priority',
              operator: 'greaterThanOrEqual',
              value: 3,
            },
          ],
        },
      }

      const sql = generateViewSQL(baseTable, view)

      expect(sql).toContain('priority >= 3')
    })

    test('should generate lessThanOrEqual operator', () => {
      const view: View = {
        id: 'test_view',
        name: 'Test View',
        filters: {
          and: [
            {
              field: 'priority',
              operator: 'lessThanOrEqual',
              value: 4,
            },
          ],
        },
      }

      const sql = generateViewSQL(baseTable, view)

      expect(sql).toContain('priority <= 4')
    })
  })

  describe('Multiple AND Conditions', () => {
    test('should combine multiple conditions with AND', () => {
      const view: View = {
        id: 'test_view',
        name: 'Test View',
        filters: {
          and: [
            {
              field: 'status',
              operator: 'equals',
              value: 'active',
            },
            {
              field: 'priority',
              operator: 'greaterThan',
              value: 2,
            },
          ],
        },
      }

      const sql = generateViewSQL(baseTable, view)

      expect(sql).toContain("WHERE status = 'active' AND priority > 2")
    })

    test('should handle three conditions', () => {
      const view: View = {
        id: 'test_view',
        name: 'Test View',
        filters: {
          and: [
            {
              field: 'status',
              operator: 'equals',
              value: 'active',
            },
            {
              field: 'priority',
              operator: 'greaterThan',
              value: 2,
            },
            {
              field: 'archived',
              operator: 'equals',
              value: false,
            },
          ],
        },
      }

      const sql = generateViewSQL(baseTable, view)

      expect(sql).toContain("WHERE status = 'active' AND priority > 2 AND archived = false")
    })
  })

  describe('Edge Cases', () => {
    test('should handle view with no filters', () => {
      const view: View = {
        id: 'test_view',
        name: 'Test View',
      }

      const sql = generateViewSQL(baseTable, view)

      expect(sql).toBe('CREATE VIEW test_view AS SELECT * FROM projects')
    })

    test('should handle view with custom query', () => {
      const view: View = {
        id: 'custom_view',
        name: 'Custom View',
        query: "SELECT name, status FROM projects WHERE status = 'active'",
      }

      const sql = generateViewSQL(baseTable, view)

      expect(sql).toBe(
        "CREATE VIEW custom_view AS SELECT name, status FROM projects WHERE status = 'active'"
      )
    })

    test('should handle materialized view', () => {
      const view: View = {
        id: 'materialized_view',
        name: 'Materialized View',
        materialized: true,
        filters: {
          and: [
            {
              field: 'status',
              operator: 'equals',
              value: 'active',
            },
          ],
        },
      }

      const sql = generateViewSQL(baseTable, view)

      expect(sql).toContain('CREATE MATERIALIZED VIEW')
      expect(sql).toContain("WHERE status = 'active'")
    })

    test('should handle numeric view ID', () => {
      const view: View = {
        id: 123,
        name: 'Numeric ID View',
        filters: {
          and: [
            {
              field: 'status',
              operator: 'equals',
              value: 'active',
            },
          ],
        },
      }

      const sql = generateViewSQL(baseTable, view)

      expect(sql).toContain('CREATE VIEW 123 AS')
    })

    test('should handle view with sorts', () => {
      const view: View = {
        id: 'sorted_view',
        name: 'Sorted View',
        sorts: [
          {
            field: 'priority',
            direction: 'desc',
          },
        ],
      }

      const sql = generateViewSQL(baseTable, view)

      expect(sql).toContain('ORDER BY priority DESC')
    })

    test('should handle view with filters and sorts', () => {
      const view: View = {
        id: 'filtered_sorted_view',
        name: 'Filtered Sorted View',
        filters: {
          and: [
            {
              field: 'status',
              operator: 'equals',
              value: 'active',
            },
          ],
        },
        sorts: [
          {
            field: 'priority',
            direction: 'desc',
          },
        ],
      }

      const sql = generateViewSQL(baseTable, view)

      expect(sql).toContain("WHERE status = 'active'")
      expect(sql).toContain('ORDER BY priority DESC')
    })

    test('should handle view with specific fields', () => {
      const view: View = {
        id: 'specific_fields_view',
        name: 'Specific Fields View',
        fields: ['id', 'name', 'status'],
      }

      const sql = generateViewSQL(baseTable, view)

      expect(sql).toContain('SELECT id, name, status FROM projects')
    })
  })

  describe('Security Regression Tests', () => {
    test('should prevent SQL injection via DROP TABLE', () => {
      const view: View = {
        id: 'test_view',
        name: 'Test View',
        filters: {
          and: [
            {
              field: 'name',
              operator: 'equals',
              value: "'; DROP TABLE projects; --",
            },
          ],
        },
      }

      const sql = generateViewSQL(baseTable, view)

      // The malicious SQL should be properly escaped - single quotes are doubled
      expect(sql).toContain("name = '''; DROP TABLE projects; --'")
      // Verify the full SQL is safe - malicious payload is inside string literal
      expect(sql).toBe(
        "CREATE VIEW test_view AS SELECT * FROM projects WHERE name = '''; DROP TABLE projects; --'"
      )
    })

    test('should prevent SQL injection via UNION SELECT', () => {
      const view: View = {
        id: 'test_view',
        name: 'Test View',
        filters: {
          and: [
            {
              field: 'status',
              operator: 'equals',
              value: "active' UNION SELECT * FROM users WHERE '1'='1",
            },
          ],
        },
      }

      const sql = generateViewSQL(baseTable, view)

      // The entire malicious payload should be treated as a string value
      expect(sql).toContain("status = 'active'' UNION SELECT * FROM users WHERE ''1''=''1'")
    })

    test('should prevent SQL injection via comment injection', () => {
      const view: View = {
        id: 'test_view',
        name: 'Test View',
        filters: {
          and: [
            {
              field: 'status',
              operator: 'equals',
              value: "active' OR '1'='1' --",
            },
          ],
        },
      }

      const sql = generateViewSQL(baseTable, view)

      // The comment should be escaped as part of the string
      expect(sql).toContain("status = 'active'' OR ''1''=''1'' --'")
    })
  })
})
