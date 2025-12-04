/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Error Handling and Rollback
 *
 * Source: specs/migrations/migration-system/error-handling/error-handling.json
 * Domain: migrations
 * Spec Count: 10
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Error Handling and Rollback', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test.fixme(
    'MIGRATION-ERROR-001: should rollback PostgreSQL transaction when runtime migration attempts to generate SQL for invalid type',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with invalid field type 'INVALID_TYPE'

      // WHEN: runtime migration attempts to generate SQL for invalid type
      // THEN: PostgreSQL transaction rolls back, no tables created

      // Migration should throw error for invalid type
      await expect(async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'users',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'email', type: 'email' },
              ],
            },
            {
              id: 2,
              name: 'products',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                // @ts-expect-error - Testing invalid field type
                { id: 2, name: 'bad_field', type: 'INVALID_TYPE' },
              ],
            },
          ],
        })
      }).rejects.toThrow(/Unknown field type: INVALID_TYPE/i)

      // Transaction rolled back - users table NOT created
      const usersTable = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema='public' AND table_name='users'`
      )
      // THEN: assertion
      expect(usersTable.count).toBe(0)

      // Transaction rolled back - products table NOT created
      const productsTable = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema='public' AND table_name='products'`
      )
      // THEN: assertion
      expect(productsTable.count).toBe(0)

      // Checksum NOT saved on failure
      const checksumCheck = await executeQuery(
        `SELECT COUNT(*) as count FROM _sovrium_schema_checksum WHERE id = 'singleton'`
      )
      // THEN: assertion
      expect(checksumCheck.count).toBe(0)
    }
  )

  test.fixme(
    'MIGRATION-ERROR-002: should rollback all changes when migration fails mid-execution',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: multiple tables being created, second table has SQL syntax error

      // WHEN: migration fails mid-execution
      // THEN: All changes rolled back, first table NOT created

      // Migration fails on second table
      await expect(async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 3,
              name: 'categories',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'name', type: 'single-line-text' },
              ],
            },
            {
              id: 4,
              name: 'products',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'title', type: 'single-line-text' },
                { id: 3, name: 'price', type: 'decimal' },
              ],
            },
          ],
        })
      }).rejects.toThrow(/Invalid constraint value/i)

      // First table NOT created (rollback)
      const categoriesTable = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema='public' AND table_name='categories'`
      )
      // THEN: assertion
      expect(categoriesTable.count).toBe(0)

      // Second table NOT created
      const productsTable = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema='public' AND table_name='products'`
      )
      // THEN: assertion
      expect(productsTable.count).toBe(0)
    }
  )

  test.fixme(
    'MIGRATION-ERROR-003: should rollback transaction when ALTER TABLE operation fails due to constraint violation',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: ALTER TABLE operation fails (e.g., adding NOT NULL column without default to non-empty table)
      await executeQuery([
        `CREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR(255))`,
        `INSERT INTO users (email) VALUES ('existing@example.com')`,
      ])

      // WHEN: constraint violation during migration
      // THEN: Transaction rolled back, table schema unchanged

      // ALTER TABLE fails (NOT NULL without default on existing data)
      await expect(async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 5,
              name: 'users',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'email', type: 'email' },
                { id: 3, name: 'name', type: 'single-line-text' },
              ],
            },
          ],
        })
      }).rejects.toThrow(/column "name" contains null values/i)

      // Column NOT added to table
      const columnCheck = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name='users' AND column_name='name'`
      )
      // THEN: assertion
      expect(columnCheck.count).toBe(0)

      // Existing data preserved
      const dataCheck = await executeQuery(
        `SELECT COUNT(*) as count FROM users WHERE email = 'existing@example.com'`
      )
      // THEN: assertion
      expect(dataCheck.count).toBe(1)

      // Table still has only 2 columns (id, email)
      const columnCount = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name='users'`
      )
      // THEN: assertion
      expect(columnCount.count).toBe(2)
    }
  )

  test.fixme(
    'MIGRATION-ERROR-004: should fail and rollback all table creations when foreign key references non-existent table',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: foreign key reference to non-existent table

      // WHEN: creating table with invalid relationship
      // THEN: Migration fails and rolls back all table creations

      // Foreign key creation fails (users table does not exist)
      await expect(async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 6,
              name: 'posts',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'title', type: 'single-line-text' },
                {
                  id: 3,
                  name: 'author_id',
                  type: 'relationship',
                  relatedTable: 'users',
                  relationType: 'many-to-one',
                },
              ],
            },
          ],
        })
      }).rejects.toThrow(/relation "users" does not exist/i)

      // Posts table NOT created
      const postsTable = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema='public' AND table_name='posts'`
      )
      // THEN: assertion
      expect(postsTable.count).toBe(0)
    }
  )

  test.fixme(
    'MIGRATION-ERROR-005: should abort application startup when database connection error occurs',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: migration system connection to database fails

      // WHEN: database connection error occurs
      // THEN: Migration aborts with connection error, application does not start

      // Migration fails with connection error
      await expect(async () => {
        await startServerWithSchema(
          {
            name: 'test-app',
            tables: [
              {
                id: 7,
                name: 'users',
                fields: [
                  { id: 1, name: 'id', type: 'integer', required: true },
                  { id: 2, name: 'email', type: 'email' },
                ],
              },
            ],
          },
          {
            database: {
              url: 'postgresql://invalid_host:5432/invalid_db',
            },
          }
        )
      }).rejects.toThrow(/database connection failed|ECONNREFUSED|connection refused/i)

      // Application startup aborted (cannot proceed without database)
      // Note: Application should not start if migrations cannot connect to database
    }
  )

  // ============================================================================
  // Phase: Additional Startup Configuration Validation Tests (006-007)
  // ============================================================================

  test.fixme(
    'MIGRATION-ERROR-006: should reject schema with index on non-existent column',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Table with index referencing non-existent column
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
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'email', type: 'email' },
              ],
              indexes: [
                {
                  name: 'idx_users_status',
                  fields: ['status'], // 'status' column doesn't exist!
                },
              ],
            },
          ],
        })
      ).rejects.toThrow(/column.*status.*not found|index.*references.*non-existent.*column/i)
    }
  )

  test.fixme(
    'MIGRATION-ERROR-007: should reject schema with duplicate table IDs',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Schema with two tables having same ID
      // WHEN: Attempting to start server with invalid schema
      // THEN: Should throw validation error
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1, // Duplicate ID!
              name: 'users',
              fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
            },
            {
              id: 1, // Duplicate ID!
              name: 'products',
              fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
            },
          ],
        })
      ).rejects.toThrow(/duplicate.*table.*id|table id.*must be unique/i)
    }
  )

  test.fixme(
    'MIGRATION-ERROR-008: should reject migration with invalid dependency order',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Migration depending on non-existent previous migration
      // WHEN: Attempting to start server with invalid migration order
      // THEN: Should throw validation error
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'posts',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'title', type: 'single-line-text' },
                {
                  id: 3,
                  name: 'author_id',
                  type: 'relationship',
                  relatedTable: 'users', // References 'users' table that doesn't exist yet
                  relationType: 'many-to-one',
                },
              ],
            },
            // 'users' table should be defined BEFORE 'posts' to satisfy FK dependency
          ],
        })
      ).rejects.toThrow(
        /relation.*users.*does not exist|invalid.*migration.*order|dependency.*not.*found/i
      )
    }
  )

  test.fixme(
    'MIGRATION-ERROR-009: should reject destructive operations without confirmation flag',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Existing table with data
      await executeQuery([
        `CREATE TABLE legacy_data (id SERIAL PRIMARY KEY, value TEXT)`,
        `INSERT INTO legacy_data (value) VALUES ('important data')`,
      ])

      // WHEN: Attempting to drop column/table without explicit confirmation
      // THEN: Should throw validation error requiring confirmation
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'legacy_data',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                // 'value' column removed - destructive operation!
              ],
              // No 'allowDestructive: true' flag
            },
          ],
        })
      ).rejects.toThrow(/destructive.*operation|column.*drop.*requires.*confirmation|data loss/i)

      // Verify data still exists (operation was blocked)
      const dataCheck = await executeQuery(`SELECT COUNT(*) as count FROM legacy_data`)
      expect(dataCheck.count).toBe(1)
    }
  )

  test.fixme(
    'MIGRATION-ERROR-010: should reject empty migration with no schema changes',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Migration configuration with no tables or operations
      // WHEN: Attempting to start server with empty migration
      // THEN: Should throw validation error
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [], // Empty tables array - no operations!
        })
      ).rejects.toThrow(/empty.*migration|no.*tables.*defined|at least one table required/i)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'MIGRATION-ERROR-011: user can complete full error-handling-and-rollback workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('Test invalid field type triggers rollback', async () => {
        await expect(async () => {
          await startServerWithSchema({
            name: 'test-app',
            tables: [
              {
                id: 8,
                name: 'test',
                fields: [
                  { id: 1, name: 'id', type: 'integer', required: true },
                  // @ts-expect-error - Testing invalid field type
                  { id: 2, name: 'bad_field', type: 'INVALID_TYPE' },
                ],
              },
            ],
          })
        }).rejects.toThrow()

        // Verify table NOT created
        const tableCheck = await executeQuery(
          `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema='public' AND table_name='test'`
        )
        expect(tableCheck.count).toBe(0)
      })

      await test.step('Setup: Create table with existing data', async () => {
        await executeQuery([
          `CREATE TABLE data (id SERIAL PRIMARY KEY, value VARCHAR(255))`,
          `INSERT INTO data (value) VALUES ('existing')`,
        ])
      })

      await test.step('Test constraint violation preserves existing data', async () => {
        await expect(async () => {
          await startServerWithSchema({
            name: 'test-app',
            tables: [
              {
                id: 9,
                name: 'data',
                fields: [
                  { id: 1, name: 'id', type: 'integer', required: true },
                  { id: 2, name: 'value', type: 'single-line-text' },
                  { id: 3, name: 'required_field', type: 'single-line-text' },
                ],
              },
            ],
          })
        }).rejects.toThrow()

        // Verify existing data preserved
        const dataCheck = await executeQuery(
          `SELECT COUNT(*) as count FROM data WHERE value = 'existing'`
        )
        expect(dataCheck.count).toBe(1)
      })
    }
  )
})
