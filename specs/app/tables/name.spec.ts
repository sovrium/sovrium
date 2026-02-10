/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Table Name
 *
 * Source: src/domain/models/app/table/index.ts
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (2 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Validation Approach:
 * - Configuration validation (validateConfig)
 * - Schema validation enforcement (Effect Schema)
 * - Pattern matching (lowercase, underscores, must start with letter)
 */

test.describe('Table Name', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test(
    'APP-TABLES-NAME-001: should meet schema requirements when validating input',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: user configures name
      // WHEN: validating input
      // THEN: value should meet schema requirements

      // Valid table names (lowercase, underscores, starts with letter)
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'users',
              fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
            },
          ],
        })
      ).resolves.not.toThrow()

      // THEN: assertion
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 2,
              name: 'products_123',
              fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
            },
          ],
        })
      ).resolves.not.toThrow()

      // Invalid table names (uppercase, spaces, special characters, starts with number)
      // THEN: assertion
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 3,
              name: 'InvalidTable',
              fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
            },
          ],
        })
      ).rejects.toThrow(/AppValidationError|ParseError/)

      // THEN: assertion
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 4,
              name: '123_table',
              fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
            },
          ],
        })
      ).rejects.toThrow(/AppValidationError|ParseError/)

      // THEN: assertion
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 5,
              name: 'table with spaces',
              fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
            },
          ],
        })
      ).rejects.toThrow(/AppValidationError|ParseError/)
    }
  )

  test(
    'APP-TABLES-NAME-002: should be used correctly when processing configuration',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: name is set
      // WHEN: processing configuration
      // THEN: value should be used correctly

      // Create table with valid name
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 6,
            name: 'customers',
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

      // Verify PostgreSQL table was created with exact name from configuration
      const tableExists = await executeQuery(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'customers'`
      )
      // THEN: assertion
      expect(tableExists.rows[0]).toMatchObject({ tablename: 'customers' })

      // Verify name is used correctly in metadata queries
      const tableInfo = await executeQuery(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customers'`
      )
      // THEN: assertion
      expect(tableInfo.rows[0]).toMatchObject({ table_name: 'customers' })
    }
  )

  test(
    'APP-TABLES-NAME-003: should use table name for PostgreSQL table name (sanitized)',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Table name with mixed case and spaces
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'My Projects',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // THEN: PostgreSQL table exists with sanitized name
      const tables = await executeQuery(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name LIKE '%project%'`
      )
      expect(tables.length).toBeGreaterThanOrEqual(1)
      // Sanitized name should be lowercase, underscored
      const tableName = tables[0].table_name
      expect(tableName).toMatch(/^[a-z_]+$/)
    }
  )

  test.fixme(
    'APP-TABLES-NAME-004: should reject empty table name with validation error',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN/WHEN: Empty table name
      // THEN: Rejects with validation error
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: '',
              fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
              primaryKey: { type: 'composite', fields: ['id'] },
            },
          ],
        })
      ).rejects.toThrow(/AppValidationError|ParseError|empty|required/i)
    }
  )

  test.fixme(
    'APP-TABLES-NAME-005: should reject duplicate table names with validation error',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN/WHEN: Two tables with same name
      // THEN: Rejects with validation error
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'duplicated',
              fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
              primaryKey: { type: 'composite', fields: ['id'] },
            },
            {
              id: 2,
              name: 'duplicated',
              fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
              primaryKey: { type: 'composite', fields: ['id'] },
            },
          ],
        })
      ).rejects.toThrow(/duplicate|already exists|unique/i)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test(
    'APP-TABLES-NAME-REGRESSION: user can complete full Table Name workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('APP-TABLES-NAME-001: Meet schema requirements when validating input', async () => {
        // Valid table names (lowercase, underscores, starts with letter)
        await expect(
          startServerWithSchema({
            name: 'test-app',
            tables: [
              {
                id: 1,
                name: 'users',
                fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
              },
            ],
          })
        ).resolves.not.toThrow()

        await expect(
          startServerWithSchema({
            name: 'test-app',
            tables: [
              {
                id: 2,
                name: 'products_123',
                fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
              },
            ],
          })
        ).resolves.not.toThrow()

        // Invalid table names
        await expect(
          startServerWithSchema({
            name: 'test-app',
            tables: [
              {
                id: 3,
                name: 'InvalidTable',
                fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
              },
            ],
          })
        ).rejects.toThrow(/AppValidationError|ParseError/)

        await expect(
          startServerWithSchema({
            name: 'test-app',
            tables: [
              {
                id: 4,
                name: '123_table',
                fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
              },
            ],
          })
        ).rejects.toThrow(/AppValidationError|ParseError/)

        await expect(
          startServerWithSchema({
            name: 'test-app',
            tables: [
              {
                id: 5,
                name: 'table with spaces',
                fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
              },
            ],
          })
        ).rejects.toThrow(/AppValidationError|ParseError/)
      })

      await test.step('APP-TABLES-NAME-002: Use name correctly when processing configuration', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 6,
              name: 'customers',
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

        const tableExists = await executeQuery(
          `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'customers'`
        )
        expect(tableExists.rows[0]).toMatchObject({ tablename: 'customers' })

        const tableInfo = await executeQuery(
          `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customers'`
        )
        expect(tableInfo.rows[0]).toMatchObject({ table_name: 'customers' })
      })
    }
  )
})
