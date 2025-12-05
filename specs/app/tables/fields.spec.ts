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
 * Spec Count: 16
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (14 tests) - Exhaustive acceptance criteria
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
    'APP-TABLES-FIELDS-001: should be accepted when validating input with at least 1 items',
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

  test(
    'APP-TABLES-FIELDS-002: should enforce minimum items when validating input with fewer than 1 items',
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
      ).rejects.toThrow(/Expected Collection of all supported field types/)

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
  // Phase: Error Configuration Validation Tests (003-014)
  // ============================================================================

  test.fixme(
    'APP-TABLES-FIELDS-003: should reject duplicate field IDs within same table',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Table with duplicate field IDs
      // WHEN: Attempting to start server with invalid schema
      // THEN: Should throw validation error
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'users',
              fields: [
                { id: 1, name: 'email', type: 'email' }, // Duplicate ID!
                { id: 1, name: 'name', type: 'single-line-text' }, // Duplicate ID!
              ],
            },
          ],
        })
      ).rejects.toThrow(/duplicate.*field.*id|field.*id.*must.*be.*unique/i)
    }
  )

  test(
    'APP-TABLES-FIELDS-004: should reject duplicate field names within same table',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Table with duplicate field names
      // WHEN: Attempting to start server with invalid schema
      // THEN: Should throw validation error
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'users',
              fields: [
                { id: 1, name: 'email', type: 'email' }, // Duplicate name!
                { id: 2, name: 'email', type: 'single-line-text' }, // Duplicate name!
              ],
            },
          ],
        })
      ).rejects.toThrow(/duplicate.*field.*name|field.*name.*must.*be.*unique/i)
    }
  )

  test.fixme(
    'APP-TABLES-FIELDS-005: should reject field name starting with number',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Field name starting with a number
      // WHEN: Attempting to start server with invalid schema
      // THEN: Should throw validation error
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'users',
              fields: [
                { id: 1, name: '1invalid_field', type: 'single-line-text' }, // Starts with number!
              ],
            },
          ],
        })
      ).rejects.toThrow(/invalid.*field.*name|name.*must.*start.*letter|pattern/i)
    }
  )

  test.fixme(
    'APP-TABLES-FIELDS-006: should reject field name with special characters',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Field name with special characters
      // WHEN: Attempting to start server with invalid schema
      // THEN: Should throw validation error
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'users',
              fields: [
                { id: 1, name: 'user-email!', type: 'email' }, // Special characters!
              ],
            },
          ],
        })
      ).rejects.toThrow(/invalid.*field.*name|name.*must.*match|pattern/i)
    }
  )

  test.fixme(
    'APP-TABLES-FIELDS-007: should reject field name exceeding maximum length',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Field name exceeding 63 characters (PostgreSQL identifier limit)
      // WHEN: Attempting to start server with invalid schema
      // THEN: Should throw validation error
      const longFieldName = 'f'.repeat(64) // 64 chars exceeds PostgreSQL limit
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'users',
              fields: [{ id: 1, name: longFieldName, type: 'single-line-text' }],
            },
          ],
        })
      ).rejects.toThrow(/name.*too.*long|exceeds.*maximum.*length|maxLength/i)
    }
  )

  test.fixme(
    'APP-TABLES-FIELDS-008: should reject empty field name',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Empty field name
      // WHEN: Attempting to start server with invalid schema
      // THEN: Should throw validation error
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'users',
              fields: [
                { id: 1, name: '', type: 'single-line-text' }, // Empty name!
              ],
            },
          ],
        })
      ).rejects.toThrow(/name.*required|empty.*name|minLength/i)
    }
  )

  test.fixme(
    'APP-TABLES-FIELDS-009: should reject invalid field type',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Field with invalid type
      // WHEN: Attempting to start server with invalid schema
      // THEN: Should throw validation error
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'users',
              fields: [
                // @ts-expect-error - Testing invalid field type
                { id: 1, name: 'data', type: 'nonexistent-type' },
              ],
            },
          ],
        })
      ).rejects.toThrow(/unknown.*field.*type|invalid.*type|unsupported/i)
    }
  )

  test.fixme(
    'APP-TABLES-FIELDS-010: should reject integer field with min greater than max',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Integer field with min > max
      // WHEN: Attempting to start server with invalid schema
      // THEN: Should throw validation error
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'products',
              fields: [
                {
                  id: 1,
                  name: 'quantity',
                  type: 'integer',
                  min: 500, // min > max!
                  max: 100,
                },
              ],
            },
          ],
        })
      ).rejects.toThrow(/min.*greater.*max|invalid.*range|min.*cannot.*exceed/i)
    }
  )

  test.fixme(
    'APP-TABLES-FIELDS-011: should reject decimal field with min greater than max',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Decimal field with min > max
      // WHEN: Attempting to start server with invalid schema
      // THEN: Should throw validation error
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'products',
              fields: [
                {
                  id: 1,
                  name: 'price',
                  type: 'decimal',
                  precision: 10,
                  min: 999.99, // min > max!
                  max: 0.01,
                },
              ],
            },
          ],
        })
      ).rejects.toThrow(/min.*greater.*max|invalid.*range|min.*cannot.*exceed/i)
    }
  )

  test.fixme(
    'APP-TABLES-FIELDS-012: should reject single-select field with empty options',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Single-select field with no options
      // WHEN: Attempting to start server with invalid schema
      // THEN: Should throw validation error
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'items',
              fields: [
                {
                  id: 1,
                  name: 'status',
                  type: 'single-select',
                  options: [], // Empty options!
                },
              ],
            },
          ],
        })
      ).rejects.toThrow(/options.*required|at.*least.*one.*option|minItems/i)
    }
  )

  test.fixme(
    'APP-TABLES-FIELDS-013: should reject multi-select field with empty options',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Multi-select field with no options
      // WHEN: Attempting to start server with invalid schema
      // THEN: Should throw validation error
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'items',
              fields: [
                {
                  id: 1,
                  name: 'tags',
                  type: 'multi-select',
                  options: [], // Empty options!
                },
              ],
            },
          ],
        })
      ).rejects.toThrow(/options.*required|at.*least.*one.*option|minItems/i)
    }
  )

  test.fixme(
    'APP-TABLES-FIELDS-014: should reject decimal field with negative precision',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Decimal field with negative precision
      // WHEN: Attempting to start server with invalid schema
      // THEN: Should throw validation error
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'products',
              fields: [
                {
                  id: 1,
                  name: 'price',
                  type: 'decimal',
                  precision: -5, // Negative precision!
                },
              ],
            },
          ],
        })
      ).rejects.toThrow(/invalid.*precision|precision.*must.*be.*positive|greaterThan/i)
    }
  )

  test.fixme(
    'APP-TABLES-FIELDS-015: should reject relationship field without relatedTable',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Relationship field missing relatedTable
      // WHEN: Attempting to start server with invalid schema
      // THEN: Should throw validation error
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'posts',
              fields: [
                // @ts-expect-error - Testing missing relatedTable
                {
                  id: 1,
                  name: 'author_id',
                  type: 'relationship',
                  // relatedTable missing!
                  relationType: 'many-to-one',
                },
              ],
            },
          ],
        })
      ).rejects.toThrow(/relatedTable.*required|missing.*relatedTable/i)
    }
  )

  test.fixme(
    'APP-TABLES-FIELDS-016: should reject relationship field without relationType',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Relationship field missing relationType
      // WHEN: Attempting to start server with invalid schema
      // THEN: Should throw validation error
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'users',
              fields: [{ id: 1, name: 'email', type: 'email' }],
            },
            {
              id: 2,
              name: 'posts',
              fields: [
                // @ts-expect-error - Testing missing relationType
                {
                  id: 1,
                  name: 'author_id',
                  type: 'relationship',
                  relatedTable: 'users',
                  // relationType missing!
                },
              ],
            },
          ],
        })
      ).rejects.toThrow(/relationType.*required|missing.*relationType/i)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'APP-TABLES-FIELDS-017: user can complete full Table Fields workflow',
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

      await test.step('All fields are created in database', async () => {
        const fieldCount = await executeQuery(
          `SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name = 'customers'`
        )
        expect(fieldCount.rows[0].count).toBeGreaterThanOrEqual(6) // At least 6 fields (+ auto id)
      })

      await test.step('Field types are correctly mapped to PostgreSQL types', async () => {
        const columns = await executeQuery(
          `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'customers' AND column_name IN ('email', 'name', 'age', 'balance', 'is_active', 'created_at') ORDER BY column_name`
        )
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
      })

      await test.step('Constraints are properly applied', async () => {
        const constraints = await executeQuery(
          `SELECT constraint_type, COUNT(*) as count FROM information_schema.table_constraints WHERE table_name = 'customers' GROUP BY constraint_type ORDER BY constraint_type`
        )
        expect(constraints.rows).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ constraint_type: 'PRIMARY KEY' }),
            expect.objectContaining({ constraint_type: 'UNIQUE' }), // email unique constraint
          ])
        )
      })

      await test.step('Error handling: duplicate field IDs are rejected', async () => {
        await expect(
          startServerWithSchema({
            name: 'test-app-error',
            tables: [
              {
                id: 99,
                name: 'invalid_table',
                fields: [
                  { id: 1, name: 'field_a', type: 'single-line-text' }, // Duplicate ID
                  { id: 1, name: 'field_b', type: 'email' }, // Duplicate ID
                ],
              },
            ],
          })
        ).rejects.toThrow(/duplicate.*field.*id|field.*id.*must.*be.*unique/i)
      })

      // Workflow completes successfully with proper validation
    }
  )
})
