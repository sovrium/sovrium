/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Table Fields
 *
 * Source: src/domain/models/app/table/index.ts
 * Domain: app
 * Spec Count: 2
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (2 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Validation Approach:
 * - Configuration validation (validateConfig)
 * - Array validation (minItems: 1)
 * - Field type validation (anyOf field types)
 */

test.describe('Table Fields', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test(
    'APP-TABLES-001: should be accepted when validating input with at least 1 items',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: user provides fields with at least 1 items
      // WHEN: validating input
      // THEN: array should be accepted

      // Valid: Single field
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'users',
              fields: [
                {
                  id: 1,
                  name: 'email',
                  type: 'email',
                  required: true,
                },
              ],
            },
          ],
        })
      ).resolves.not.toThrow()

      // Verify table was created with the field
      const columns = await executeQuery(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email'`
      )
      // THEN: assertion
      expect(columns.rows[0]).toMatchObject({ column_name: 'email' })

      // Valid: Multiple fields
      // THEN: assertion
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 2,
              name: 'products',
              fields: [
                {
                  id: 1,
                  name: 'title',
                  type: 'single-line-text',
                  required: true,
                },
                {
                  id: 2,
                  name: 'price',
                  type: 'decimal',
                  precision: 10,
                },
                {
                  id: 3,
                  name: 'is_active',
                  type: 'checkbox',
                  default: true,
                },
              ],
            },
          ],
        })
      ).resolves.not.toThrow()

      // Verify all fields were created
      const productColumns = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name = 'products' AND column_name IN ('id', 'title', 'price', 'is_active')`
      )
      // THEN: assertion
      expect(productColumns.rows[0]).toMatchObject({ count: 4 }) // 3 fields + auto id
    }
  )

  test.fixme(
    'APP-TABLES-002: should enforce minimum items when validating input with fewer than 1 items',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: user provides fields with fewer than 1 items
      // WHEN: validating input
      // THEN: error should enforce minimum items

      // Invalid: Empty fields array
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [{ id: 3, name: 'invalid_table', fields: [] }],
        })
      ).rejects.toThrow(/must be within the allowed range/)

      // Invalid: Missing fields property
      // THEN: assertion
      await expect(
        startServerWithSchema({
          name: 'test-app',
          // @ts-expect-error - Testing undefined fields
          tables: [{ id: 4, name: 'invalid_table', fields: undefined }],
        })
      ).rejects.toThrow()
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'APP-TABLES-003: user can complete full Table Fields workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Application with tables containing various field configurations
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'customers',
            fields: [
              {
                id: 1,
                name: 'email',
                type: 'email',
                required: true,
                unique: true,
              },
              {
                id: 2,
                name: 'name',
                type: 'single-line-text',
                required: true,
              },
              {
                id: 3,
                name: 'age',
                type: 'integer',
                min: 0,
                max: 150,
              },
              {
                id: 4,
                name: 'balance',
                type: 'decimal',
                precision: 10,
              },
              {
                id: 5,
                name: 'is_active',
                type: 'checkbox',
                default: true,
              },
              {
                id: 6,
                name: 'created_at',
                type: 'created-at',
              },
            ],
          },
        ],
      })

      // WHEN/THEN: Execute representative workflow

      // 1. All fields are created in database
      const fieldCount = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name = 'customers'`
      )
      // THEN: assertion
      expect(fieldCount.rows[0].count).toBeGreaterThanOrEqual(6) // At least 6 fields (+ auto id)

      // 2. Field types are correctly mapped to PostgreSQL types
      const columns = await executeQuery(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'customers' AND column_name IN ('email', 'name', 'age', 'balance', 'is_active', 'created_at') ORDER BY column_name`
      )
      // THEN: assertion
      expect(columns.rows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ column_name: 'email', data_type: 'character varying' }),
          expect.objectContaining({ column_name: 'name', data_type: 'character varying' }),
          expect.objectContaining({ column_name: 'age', data_type: 'integer' }),
          expect.objectContaining({ column_name: 'balance', data_type: 'numeric' }),
          expect.objectContaining({ column_name: 'is_active', data_type: 'boolean' }),
          expect.objectContaining({
            column_name: 'created_at',
            data_type: 'timestamp without time zone',
          }),
        ])
      )

      // 3. Constraints are properly applied
      const constraints = await executeQuery(
        `SELECT constraint_type, COUNT(*) as count FROM information_schema.table_constraints WHERE table_name = 'customers' GROUP BY constraint_type ORDER BY constraint_type`
      )
      // THEN: assertion
      expect(constraints.rows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ constraint_type: 'PRIMARY KEY' }),
          expect.objectContaining({ constraint_type: 'UNIQUE' }), // email unique constraint
        ])
      )

      // Workflow completes successfully
    }
  )
})
