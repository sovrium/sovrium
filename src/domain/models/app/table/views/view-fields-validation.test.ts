/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { TableSchema } from '..'

describe('View Fields Validation', () => {
  test('should reject view with non-existent field reference', () => {
    // GIVEN: A table with views containing a field that doesn't exist
    const invalidTable = {
      name: 'products',
      fields: [
        { id: 1, name: 'id', type: 'integer', required: true },
        { id: 2, name: 'name', type: 'single-line-text' },
      ],
      views: [
        {
          id: 'custom_view',
          name: 'Custom View',
          fields: ['id', 'name', 'description'], // 'description' doesn't exist!
        },
      ],
    }

    // WHEN/THEN: Validation should fail with appropriate error message
    expect(() => {
      Schema.decodeUnknownSync(TableSchema)(invalidTable)
    }).toThrow(/field.*description.*not found|view.*fields.*non-existent/i)
  })

  test('should accept view with all valid field references', () => {
    // GIVEN: A table with views containing only valid field references
    const validTable = {
      name: 'products',
      fields: [
        { id: 1, name: 'id', type: 'integer', required: true },
        { id: 2, name: 'name', type: 'single-line-text' },
        { id: 3, name: 'description', type: 'long-text' },
      ],
      views: [
        {
          id: 'custom_view',
          name: 'Custom View',
          fields: ['id', 'name', 'description'],
        },
      ],
    }

    // WHEN: Validation is performed
    const result = Schema.decodeUnknownSync(TableSchema)(validTable)

    // THEN: The table should be accepted
    expect(result.views?.[0]?.fields).toEqual(['id', 'name', 'description'])
  })

  test('should accept view with subset of fields', () => {
    // GIVEN: A table with view showing only some fields
    const validTable = {
      name: 'users',
      fields: [
        { id: 1, name: 'id', type: 'integer', required: true },
        { id: 2, name: 'username', type: 'single-line-text' },
        { id: 3, name: 'email', type: 'single-line-text' },
        { id: 4, name: 'password', type: 'single-line-text' },
      ],
      views: [
        {
          id: 'safe_view',
          name: 'Safe View',
          fields: ['id', 'username', 'email'], // password excluded intentionally
        },
      ],
    }

    // WHEN: Validation is performed
    const result = Schema.decodeUnknownSync(TableSchema)(validTable)

    // THEN: The table should be accepted
    expect(result.views?.[0]?.fields).toEqual(['id', 'username', 'email'])
  })

  test('should accept view without fields property', () => {
    // GIVEN: A table with view that doesn't specify fields
    const validTable = {
      name: 'tasks',
      fields: [
        { id: 1, name: 'id', type: 'integer', required: true },
        { id: 2, name: 'title', type: 'single-line-text' },
      ],
      views: [
        {
          id: 'all_fields_view',
          name: 'All Fields View',
          // No fields property - should show all fields by default
        },
      ],
    }

    // WHEN: Validation is performed
    const result = Schema.decodeUnknownSync(TableSchema)(validTable)

    // THEN: The table should be accepted
    expect(result.views?.[0]?.fields).toBeUndefined()
  })
})
