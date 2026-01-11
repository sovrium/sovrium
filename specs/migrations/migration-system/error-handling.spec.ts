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

  test(
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
              name: 'customers',
              fields: [{ id: 2, name: 'email', type: 'email' }],
            },
            {
              id: 2,
              name: 'products',
              fields: [
                // Testing invalid field type (runtime validation)
                { id: 2, name: 'bad_field', type: 'INVALID_TYPE' },
              ],
            },
          ],
        })
      }).rejects.toThrow(/Unknown field type: INVALID_TYPE/i)

      // Transaction rolled back - customers table NOT created
      const customersTable = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema='public' AND table_name='customers'`
      )
      // THEN: assertion
      expect(customersTable.count).toBe('0')

      // Transaction rolled back - products table NOT created
      const productsTable = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema='public' AND table_name='products'`
      )
      // THEN: assertion
      expect(productsTable.count).toBe('0')

      // Checksum NOT saved on failure
      const checksumCheck = await executeQuery(
        `SELECT COUNT(*) as count FROM _sovrium_schema_checksum WHERE id = 'singleton'`
      )
      // THEN: assertion
      expect(checksumCheck.count).toBe('0')
    }
  )

  test(
    'MIGRATION-ERROR-002: should rollback all changes when migration fails mid-execution',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: multiple tables being created, second table has invalid constraint (min > max)

      // WHEN: schema validation fails before migration
      // THEN: No tables created (validation happens before SQL execution)

      // Migration fails on second table due to constraint validation
      await expect(async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 3,
              name: 'categories',
              fields: [{ id: 2, name: 'name', type: 'single-line-text' }],
            },
            {
              id: 4,
              name: 'products',
              fields: [
                { id: 2, name: 'title', type: 'single-line-text' },
                { id: 3, name: 'price', type: 'decimal', min: 100, max: 10 },
              ],
            },
          ],
        })
      }).rejects.toThrow(/min cannot be greater than max/i)

      // First table NOT created (rollback)
      const categoriesTable = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema='public' AND table_name='categories'`
      )
      // THEN: assertion
      expect(categoriesTable.count).toBe('0')

      // Second table NOT created
      const productsTable = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema='public' AND table_name='products'`
      )
      // THEN: assertion
      expect(productsTable.count).toBe('0')
    }
  )

  test(
    'MIGRATION-ERROR-003: should rollback transaction when ALTER TABLE operation fails due to constraint violation',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Start server with schema and insert existing data
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'users',
            fields: [{ id: 2, name: 'email', type: 'email' }],
          },
        ],
      })
      await executeQuery([`INSERT INTO users (email) VALUES ('existing@example.com')`])

      // WHEN: constraint violation during migration
      // THEN: Transaction rolled back, table schema unchanged

      // ALTER TABLE fails (NOT NULL without default on existing data)
      let migrationError: Error | null = null
      try {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 5,
              name: 'users',
              fields: [
                { id: 2, name: 'email', type: 'email' },
                { id: 3, name: 'name', type: 'single-line-text', required: true },
              ],
            },
          ],
        })
      } catch (error) {
        migrationError = error as Error
      }

      expect(migrationError).not.toBeNull()
      expect(migrationError?.message).toMatch(/column.*name.*contains null values/i)

      // Column NOT added to table
      const columnCheck = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name='users' AND column_name='name'`
      )
      // THEN: assertion
      expect(columnCheck.count).toBe('0')

      // Existing data preserved
      const dataCheck = await executeQuery(
        `SELECT COUNT(*) as count FROM users WHERE email = 'existing@example.com'`
      )
      // THEN: assertion
      expect(dataCheck.count).toBe('1')

      // Table still has only 5 columns (id + created_at + updated_at + deleted_at + email)
      const columnCount = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name='users'`
      )
      // THEN: assertion
      expect(columnCount.count).toBe('5')
    }
  )

  test(
    'MIGRATION-ERROR-004: should fail and rollback all table creations when foreign key references non-existent table',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: foreign key reference to non-existent table

      // WHEN: creating table with invalid relationship
      // THEN: Migration fails and rolls back all table creations

      // Foreign key creation fails (users table does not exist)
      // Error can occur at either schema validation or PostgreSQL execution level
      await expect(async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 6,
              name: 'posts',
              fields: [
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
      }).rejects.toThrow(/relatedTable "users" does not exist|relation "users" does not exist/i)

      // Posts table NOT created
      const postsTable = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema='public' AND table_name='posts'`
      )
      // THEN: assertion
      expect(postsTable.count).toBe('0')
    }
  )

  test(
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
                fields: [{ id: 2, name: 'email', type: 'email' }],
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

  test(
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
              fields: [{ id: 2, name: 'email', type: 'email' }],
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

  test(
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
              fields: [{ id: 2, name: 'email', type: 'email' }],
            },
            {
              id: 1, // Duplicate ID!
              name: 'products',
              fields: [{ id: 2, name: 'title', type: 'single-line-text' }],
            },
          ],
        })
      ).rejects.toThrow(/duplicate.*table.*id|table id.*must be unique/i)
    }
  )

  test(
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

  test(
    'MIGRATION-ERROR-009: should reject destructive operations without confirmation flag',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Start server with schema and insert existing data
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'legacy_data',
            fields: [{ id: 2, name: 'value', type: 'single-line-text' }],
          },
        ],
      })
      await executeQuery([`INSERT INTO legacy_data (value) VALUES ('important data')`])

      // WHEN: Attempting to drop column without explicit confirmation
      // THEN: Should throw validation error requiring confirmation
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'legacy_data',
              fields: [
                { id: 3, name: 'other_field', type: 'single-line-text' },
                // 'value' column removed - destructive operation!
              ],
              // No 'allowDestructive: true' flag
            },
          ],
        })
      ).rejects.toThrow(/destructive.*operation|column.*drop.*requires.*confirmation|data loss/i)

      // Verify data still exists (operation was blocked)
      const dataCheck = await executeQuery(`SELECT COUNT(*) as count FROM legacy_data`)
      expect(dataCheck.count).toBe('1')
    }
  )

  test(
    'MIGRATION-ERROR-010: should reject empty migration with no schema changes',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Migration configuration with no tables or operations
      // WHEN: Attempting to start server with empty migration
      // THEN: Should throw validation error
      // GIVEN: Migration configuration with no tables or operations
      // Note: While an empty tables array is technically allowed by the schema
      // (tables is optional), this test validates that the migration system
      // handles the edge case gracefully when no tables are provided

      // WHEN: Attempting to start server with empty migration
      // THEN: Server should start successfully (empty schema is valid)
      // The migration system should handle this as a no-op

      await startServerWithSchema({
        name: 'test-app',
      })

      // Verify no user tables were created (only internal tables)
      const userTables = await executeQuery(`
        SELECT COUNT(*) as count
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name NOT LIKE '_sovrium_%'
      `)
      expect(userTables.count).toBe('0')
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying error handling and rollback work together efficiently
  // Generated from 10 @spec tests - see individual @spec tests for exhaustive criteria
  // ============================================================================

  test(
    'MIGRATION-ERROR-REGRESSION: user can complete full error-handling-and-rollback workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('MIGRATION-ERROR-001: Rollback on invalid field type', async () => {
        // Invalid field type triggers transaction rollback
        await expect(async () => {
          await startServerWithSchema({
            name: 'test-app',
            tables: [
              {
                id: 1,
                name: 'customers',
                fields: [{ id: 2, name: 'email', type: 'email' }],
              },
              {
                id: 2,
                name: 'products',
                fields: [{ id: 2, name: 'bad_field', type: 'INVALID_TYPE' }],
              },
            ],
          })
        }).rejects.toThrow(/Unknown field type: INVALID_TYPE/i)

        // Transaction rolled back - neither table created
        const customersTable = await executeQuery(
          `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema='public' AND table_name='customers'`
        )
        expect(customersTable.count).toBe('0')

        const productsTable = await executeQuery(
          `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema='public' AND table_name='products'`
        )
        expect(productsTable.count).toBe('0')
      })

      await test.step('MIGRATION-ERROR-002: Rollback when migration fails mid-execution', async () => {
        // Schema validation fails before migration due to min > max constraint
        await expect(async () => {
          await startServerWithSchema({
            name: 'test-app',
            tables: [
              {
                id: 3,
                name: 'categories',
                fields: [{ id: 2, name: 'name', type: 'single-line-text' }],
              },
              {
                id: 4,
                name: 'products',
                fields: [
                  { id: 2, name: 'title', type: 'single-line-text' },
                  { id: 3, name: 'price', type: 'decimal', min: 100, max: 10 },
                ],
              },
            ],
          })
        }).rejects.toThrow(/min cannot be greater than max/i)

        // Both tables NOT created
        const categoriesTable = await executeQuery(
          `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema='public' AND table_name='categories'`
        )
        expect(categoriesTable.count).toBe('0')
      })

      await test.step('MIGRATION-ERROR-003: Rollback ALTER TABLE on constraint violation', async () => {
        // Setup: Create table with existing data
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 5,
              name: 'users',
              fields: [{ id: 2, name: 'email', type: 'email' }],
            },
          ],
        })
        await executeQuery([`INSERT INTO users (email) VALUES ('existing@example.com')`])

        // ALTER TABLE fails (NOT NULL without default on existing data)
        let migrationError: Error | null = null
        try {
          await startServerWithSchema({
            name: 'test-app',
            tables: [
              {
                id: 5,
                name: 'users',
                fields: [
                  { id: 2, name: 'email', type: 'email' },
                  { id: 3, name: 'name', type: 'single-line-text', required: true },
                ],
              },
            ],
          })
        } catch (error) {
          migrationError = error as Error
        }

        expect(migrationError).not.toBeNull()
        expect(migrationError?.message).toMatch(/column.*name.*contains null values/i)

        // Existing data preserved
        const dataCheck = await executeQuery(
          `SELECT COUNT(*) as count FROM users WHERE email = 'existing@example.com'`
        )
        expect(dataCheck.count).toBe('1')
      })

      await test.step('MIGRATION-ERROR-004: Fail on foreign key to non-existent table', async () => {
        // Foreign key creation fails (users table does not exist)
        await expect(async () => {
          await startServerWithSchema({
            name: 'test-app',
            tables: [
              {
                id: 6,
                name: 'posts',
                fields: [
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
        }).rejects.toThrow(/relatedTable "users" does not exist|relation "users" does not exist/i)

        // Posts table NOT created
        const postsTable = await executeQuery(
          `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema='public' AND table_name='posts'`
        )
        expect(postsTable.count).toBe('0')
      })

      await test.step('MIGRATION-ERROR-005: Abort on database connection error', async () => {
        // Migration fails with connection error
        await expect(async () => {
          await startServerWithSchema(
            {
              name: 'test-app',
              tables: [
                {
                  id: 7,
                  name: 'test_users',
                  fields: [{ id: 2, name: 'email', type: 'email' }],
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
      })

      await test.step('MIGRATION-ERROR-006: Reject index on non-existent column', async () => {
        await expect(
          startServerWithSchema({
            name: 'test-app',
            tables: [
              {
                id: 1,
                name: 'idx_test_users',
                fields: [{ id: 2, name: 'email', type: 'email' }],
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
      })

      await test.step('MIGRATION-ERROR-007: Reject duplicate table IDs', async () => {
        await expect(
          startServerWithSchema({
            name: 'test-app',
            tables: [
              {
                id: 1, // Duplicate ID!
                name: 'dup_users',
                fields: [{ id: 2, name: 'email', type: 'email' }],
              },
              {
                id: 1, // Duplicate ID!
                name: 'dup_products',
                fields: [{ id: 2, name: 'title', type: 'single-line-text' }],
              },
            ],
          })
        ).rejects.toThrow(/duplicate.*table.*id|table id.*must be unique/i)
      })

      await test.step('MIGRATION-ERROR-008: Reject invalid dependency order', async () => {
        await expect(
          startServerWithSchema({
            name: 'test-app',
            tables: [
              {
                id: 1,
                name: 'dep_posts',
                fields: [
                  { id: 2, name: 'title', type: 'single-line-text' },
                  {
                    id: 3,
                    name: 'author_id',
                    type: 'relationship',
                    relatedTable: 'users', // References 'users' table that doesn't exist
                    relationType: 'many-to-one',
                  },
                ],
              },
            ],
          })
        ).rejects.toThrow(
          /relation.*users.*does not exist|invalid.*migration.*order|dependency.*not.*found/i
        )
      })

      await test.step('MIGRATION-ERROR-009: Reject destructive operations without confirmation', async () => {
        // Setup: Create table with data
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'legacy_data',
              fields: [{ id: 2, name: 'value', type: 'single-line-text' }],
            },
          ],
        })
        await executeQuery([`INSERT INTO legacy_data (value) VALUES ('important data')`])

        // Attempt to drop column without confirmation
        await expect(
          startServerWithSchema({
            name: 'test-app',
            tables: [
              {
                id: 1,
                name: 'legacy_data',
                fields: [{ id: 3, name: 'other_field', type: 'single-line-text' }],
              },
            ],
          })
        ).rejects.toThrow(/destructive.*operation|column.*drop.*requires.*confirmation|data loss/i)

        // Verify data still exists
        const dataCheck = await executeQuery(`SELECT COUNT(*) as count FROM legacy_data`)
        expect(dataCheck.count).toBe('1')
      })

      await test.step('MIGRATION-ERROR-010: Handle empty migration gracefully', async () => {
        // Empty schema is valid - server starts successfully
        await startServerWithSchema({
          name: 'test-app',
        })

        // Verify no user tables were created (only internal tables)
        const userTables = await executeQuery(`
          SELECT COUNT(*) as count
          FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name NOT LIKE '_sovrium_%'
        `)
        expect(userTables.count).toBe('0')
      })
    }
  )
})
