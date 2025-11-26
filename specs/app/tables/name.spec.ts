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
 * Source: specs/app/tables/name/name.schema.json
 * Domain: app
 * Spec Count: 2
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

  test.fixme(
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
      ).rejects.toThrow(/validation error/)

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
      ).rejects.toThrow(/validation error/)

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
      ).rejects.toThrow(/validation error/)
    }
  )

  test.fixme(
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

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'APP-TABLES-NAME-REGRESSION-001: user can complete full Table Name workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Application with representative table name configurations
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 7,
            name: 'users',
            fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
          },
          {
            id: 8,
            name: 'orders_2024',
            fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
          },
        ],
      })

      // WHEN/THEN: Execute representative workflow

      // 1. Valid names create tables correctly
      const usersTable = await executeQuery(
        `SELECT tablename FROM pg_tables WHERE tablename = 'users'`
      )
      // THEN: assertion
      expect(usersTable.rows[0]).toMatchObject({ tablename: 'users' })

      const ordersTable = await executeQuery(
        `SELECT tablename FROM pg_tables WHERE tablename = 'orders_2024'`
      )
      // THEN: assertion
      expect(ordersTable.rows[0]).toMatchObject({ tablename: 'orders_2024' })

      // 2. Names follow schema pattern (lowercase, underscores, starts with letter)
      const allTables = await executeQuery(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('users', 'orders_2024') ORDER BY tablename`
      )
      // THEN: assertion
      expect(allTables.rows).toHaveLength(2)
      expect(allTables.rows[0].tablename).toMatch(/^[a-z][a-z0-9_]*$/)
      expect(allTables.rows[1].tablename).toMatch(/^[a-z][a-z0-9_]*$/)

      // Workflow completes successfully
    }
  )
})
