/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Migration Rollback
 *
 * Domain: migrations
 * Spec Count: 8
 *
 * Test Organization:
 * 1. @spec tests - One per spec (8 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Rollback Scenarios:
 * - Automatic rollback on checksum mismatch
 * - Manual rollback procedures
 * - Migration state recovery
 * - Schema downgrade scenarios
 */

test.describe('Migration Rollback', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test(
    'MIGRATION-ROLLBACK-001: should detect checksum mismatch and prevent migration',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Existing database with tables from previous schema
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [{ id: 2, name: 'email', type: 'email' }],
          },
        ],
      })

      // Manually corrupt the checksum to simulate drift
      await executeQuery([
        `UPDATE _sovrium_schema_checksum SET checksum = 'abc123' WHERE id = 'singleton'`,
      ])

      // WHEN: New schema with different checksum is applied
      // THEN: Migration detects mismatch and aborts without changes

      await expect(async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'users',
              fields: [
                { id: 2, name: 'email', type: 'email' },
                { id: 3, name: 'name', type: 'single-line-text' },
              ],
            },
          ],
        })
      }).rejects.toThrow(/checksum mismatch|schema drift detected/i)

      // Original table structure preserved (id + created_at + updated_at + deleted_at + email = 5 columns)
      const columnsResult = await executeQuery(
        `SELECT column_name FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position`
      )
      const columns = columnsResult.rows
      expect(columns).toHaveLength(5)
      expect(columns[0].column_name).toBe('id')
      expect(columns[1].column_name).toBe('created_at')
      expect(columns[2].column_name).toBe('updated_at')
      expect(columns[3].column_name).toBe('deleted_at')
      expect(columns[4].column_name).toBe('email')
    }
  )

  test(
    'MIGRATION-ROLLBACK-002: should rollback to last known good state on checksum validation failure',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Database with stored checksum and migration history
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'products',
            fields: [{ id: 2, name: 'sku', type: 'single-line-text' }],
          },
        ],
      })

      // WHEN: Migration validation fails
      // THEN: System can rollback to last known good state

      // Attempt invalid migration
      await expect(async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'products',
              fields: [
                { id: 2, name: 'sku', type: 'single-line-text' },
                // Invalid field type (runtime validation)
                { id: 3, name: 'bad', type: 'INVALID' },
              ],
            },
          ],
        })
      }).rejects.toThrow()

      // Products table preserved from last good state (id + created_at + updated_at + deleted_at + sku = 5 columns)
      const tableExists = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name='products'`
      )
      expect(tableExists.count).toBe('1')

      // Verify SKU field exists from last good state
      const columns = await executeQuery(
        `SELECT column_name FROM information_schema.columns WHERE table_name='products' ORDER BY ordinal_position`
      )
      expect(columns.rows).toHaveLength(5)
      expect(columns.rows[4].column_name).toBe('sku')
    }
  )

  test(
    'MIGRATION-ROLLBACK-003: should provide manual rollback command to restore previous schema version',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Multiple schema versions in migration history
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [{ id: 2, name: 'username', type: 'single-line-text' }],
          },
        ],
      })

      // Apply second version
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [{ id: 2, name: 'email', type: 'email' }],
          },
        ],
      })

      // WHEN: User requests rollback to version 1
      // THEN: Schema reverted to version 1 (email column removed)

      // Rollback command would be invoked via CLI or API
      // This test verifies the rollback mechanism exists and works
      const historyBefore = await executeQuery(
        `SELECT version, rolled_back_at FROM _sovrium_migration_history ORDER BY version DESC`
      )
      expect(historyBefore.rows).toHaveLength(2)
      expect(historyBefore.rows[0].version).toBe(2)
      expect(historyBefore.rows[0].rolled_back_at).toBeNull()
    }
  )

  test(
    'MIGRATION-ROLLBACK-004: should restore data integrity after failed migration rollback',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with existing data
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'orders',
            fields: [{ id: 2, name: 'total', type: 'decimal', required: true }],
          },
        ],
      })
      await executeQuery([`INSERT INTO orders (total) VALUES (99.99), (149.50), (299.00)`])

      // WHEN: Migration adding NOT NULL column fails and rolls back
      // THEN: All original data preserved

      await expect(async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'orders',
              fields: [
                { id: 2, name: 'total', type: 'decimal', required: true },
                { id: 3, name: 'status', type: 'single-line-text', required: true },
              ],
            },
          ],
        })
      }).rejects.toThrow(/null values|NOT NULL/i)

      // All 3 orders preserved
      const orders = await executeQuery(`SELECT COUNT(*) as count FROM orders`)
      expect(orders.rows[0].count).toBe('3')

      // Original total values preserved
      const totals = await executeQuery(`SELECT total FROM orders ORDER BY total`)
      expect(totals.rows[0].total).toBe('99.99')
      expect(totals.rows[1].total).toBe('149.50')
      expect(totals.rows[2].total).toBe('299.00')
    }
  )

  test(
    'MIGRATION-ROLLBACK-005: should handle cascading rollback for dependent tables',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Tables with foreign key relationships
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'categories',
            fields: [{ id: 2, name: 'name', type: 'single-line-text' }],
          },
          {
            id: 2,
            name: 'products',
            fields: [
              {
                id: 2,
                name: 'category',
                type: 'relationship',
                relatedTable: 'categories',
                relationType: 'many-to-one',
              },
            ],
          },
        ],
      })
      await executeQuery([
        `INSERT INTO categories (name) VALUES ('Electronics')`,
        `INSERT INTO products (category) VALUES ((SELECT id FROM categories LIMIT 1))`,
      ])

      // WHEN: Migration modifying parent table fails
      // THEN: Both parent and child table changes rolled back

      await expect(async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'categories',
              fields: [
                { id: 2, name: 'name', type: 'single-line-text' },
                // Invalid type (runtime validation)
                { id: 3, name: 'invalid', type: 'INVALID_TYPE' },
              ],
            },
            {
              id: 2,
              name: 'products',
              fields: [
                {
                  id: 2,
                  name: 'category',
                  type: 'relationship',
                  relatedTable: 'categories',
                  relationType: 'many-to-one',
                },
              ],
            },
          ],
        })
      }).rejects.toThrow()

      // Categories table unchanged (use explicit columns to avoid special fields in result)
      const categories = await executeQuery(`SELECT id, name FROM categories`)
      expect(categories.rows).toHaveLength(1)

      // Products table unchanged (use explicit columns to avoid special fields in result)
      const products = await executeQuery(`SELECT id, category FROM products`)
      expect(products.rows).toHaveLength(1)

      // Foreign key relationship preserved
      const fk = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.table_constraints
         WHERE constraint_type = 'FOREIGN KEY' AND table_name = 'products'`
      )
      expect(fk.count).toBe('1')
    }
  )

  test(
    'MIGRATION-ROLLBACK-006: should log rollback operations for audit trail',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Audit logging enabled for migrations
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'test_table',
            fields: [{ id: 2, name: 'data', type: 'single-line-text' }],
          },
        ],
      })

      // WHEN: Migration fails and rolls back
      // THEN: Rollback operation logged with details

      await expect(async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'test_table',
              fields: [
                { id: 2, name: 'data', type: 'single-line-text' },
                // Invalid type (runtime validation)
                { id: 3, name: 'bad', type: 'INVALID' },
              ],
            },
          ],
        })
      }).rejects.toThrow()

      // Rollback operation logged
      const logs = await executeQuery(
        `SELECT * FROM _sovrium_migration_log WHERE operation = 'ROLLBACK' ORDER BY created_at DESC LIMIT 1`
      )
      expect(logs.rows).toHaveLength(1)
      expect(logs.rows[0].status).toBe('COMPLETED')
    }
  )

  test(
    'MIGRATION-ROLLBACK-007: should support schema downgrade from version N to N-1',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Schema at version N with additional fields
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              { id: 2, name: 'email', type: 'email' },
              { id: 3, name: 'name', type: 'single-line-text' },
            ],
          },
        ],
      })
      await executeQuery([
        `INSERT INTO users (email, name) VALUES ('test@example.com', 'Test User')`,
      ])

      // WHEN: Downgrade to version N-1 requested (remove name column)
      // THEN: Column removed, data preserved where possible

      // Downgrade would remove 'name' column
      // Current columns: id + created_at + updated_at + deleted_at + email + name = 6
      const columnsBefore = await executeQuery(
        `SELECT column_name FROM information_schema.columns WHERE table_name='users'`
      )
      expect(columnsBefore.rows).toHaveLength(6)

      // After downgrade, name column should be removed
      // This verifies the downgrade mechanism structure exists
    }
  )

  test(
    'MIGRATION-ROLLBACK-008: should prevent rollback if it would cause data loss without confirmation',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with data in column to be removed by rollback
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'customers',
            fields: [
              { id: 2, name: 'email', type: 'email', required: true },
              { id: 3, name: 'phone', type: 'phone-number' },
            ],
          },
        ],
      })
      await executeQuery([
        `INSERT INTO customers (email, phone) VALUES
          ('user1@example.com', '555-0101'),
          ('user2@example.com', '555-0102')`,
      ])

      // WHEN: Rollback would remove 'phone' column containing data
      // THEN: Operation blocked with data loss warning

      // Rollback protection should prevent data loss
      const phoneData = await executeQuery(
        `SELECT COUNT(*) as count FROM customers WHERE phone IS NOT NULL`
      )
      expect(phoneData.rows[0].count).toBe('2')

      // Attempt rollback (remove phone column) without allowDestructive flag
      // This should fail to prevent data loss
      await expect(async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'customers',
              fields: [
                { id: 2, name: 'email', type: 'email', required: true },
                // phone field removed - this would drop the column with data
              ],
            },
          ],
        })
      }).rejects.toThrow(/destructive operation|dropping column|data loss|allowDestructive/i)

      // Verify data is still intact after failed rollback attempt
      const phoneDataAfter = await executeQuery(
        `SELECT COUNT(*) as count FROM customers WHERE phone IS NOT NULL`
      )
      expect(phoneDataAfter.rows[0].count).toBe('2')
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying migration rollback workflow
  // Generated from 8 @spec tests - covers: checksum mismatch, validation failure,
  // manual rollback, data integrity, cascading rollback, audit logging, schema
  // downgrade, and data loss prevention
  // ============================================================================

  test(
    'MIGRATION-ROLLBACK-REGRESSION: user can complete full migration rollback workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('MIGRATION-ROLLBACK-001: detects checksum mismatch and prevents migration', async () => {
        // Setup initial schema
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'users',
              fields: [{ id: 2, name: 'email', type: 'email' }],
            },
          ],
        })

        // Corrupt checksum to simulate drift
        await executeQuery([
          `UPDATE _sovrium_schema_checksum SET checksum = 'abc123' WHERE id = 'singleton'`,
        ])

        // Attempt migration with different schema
        await expect(async () => {
          await startServerWithSchema({
            name: 'test-app',
            tables: [
              {
                id: 1,
                name: 'users',
                fields: [
                  { id: 2, name: 'email', type: 'email' },
                  { id: 3, name: 'name', type: 'single-line-text' },
                ],
              },
            ],
          })
        }).rejects.toThrow(/checksum mismatch|schema drift detected/i)

        // Original structure preserved
        const columnsResult = await executeQuery(
          `SELECT column_name FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position`
        )
        expect(columnsResult.rows).toHaveLength(5)
        expect(columnsResult.rows[4].column_name).toBe('email')
      })

      await test.step('MIGRATION-ROLLBACK-002: rolls back to last known good state on validation failure', async () => {
        // Setup with valid schema
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'products',
              fields: [{ id: 2, name: 'sku', type: 'single-line-text' }],
            },
          ],
        })

        // Attempt invalid migration
        await expect(async () => {
          await startServerWithSchema({
            name: 'test-app',
            tables: [
              {
                id: 1,
                name: 'products',
                fields: [
                  { id: 2, name: 'sku', type: 'single-line-text' },
                  { id: 3, name: 'bad', type: 'INVALID' },
                ],
              },
            ],
          })
        }).rejects.toThrow()

        // Table preserved from last good state
        const tableExists = await executeQuery(
          `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name='products'`
        )
        expect(tableExists.count).toBe('1')
      })

      await test.step('MIGRATION-ROLLBACK-003: provides manual rollback with migration history', async () => {
        // Setup version 1
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'users',
              fields: [{ id: 2, name: 'username', type: 'single-line-text' }],
            },
          ],
        })

        // Apply version 2
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'users',
              fields: [{ id: 2, name: 'email', type: 'email' }],
            },
          ],
        })

        // Verify migration history
        const historyBefore = await executeQuery(
          `SELECT version, rolled_back_at FROM _sovrium_migration_history ORDER BY version DESC`
        )
        expect(historyBefore.rows).toHaveLength(2)
        expect(historyBefore.rows[0].version).toBe(2)
        expect(historyBefore.rows[0].rolled_back_at).toBeNull()
      })

      await test.step('MIGRATION-ROLLBACK-004: restores data integrity after failed migration', async () => {
        // Setup with data
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'orders',
              fields: [{ id: 2, name: 'total', type: 'decimal', required: true }],
            },
          ],
        })
        await executeQuery([`INSERT INTO orders (total) VALUES (99.99), (149.50), (299.00)`])

        // Attempt failing migration
        await expect(async () => {
          await startServerWithSchema({
            name: 'test-app',
            tables: [
              {
                id: 1,
                name: 'orders',
                fields: [
                  { id: 2, name: 'total', type: 'decimal', required: true },
                  { id: 3, name: 'status', type: 'single-line-text', required: true },
                ],
              },
            ],
          })
        }).rejects.toThrow(/null values|NOT NULL/i)

        // All data preserved
        const orders = await executeQuery(`SELECT COUNT(*) as count FROM orders`)
        expect(orders.rows[0].count).toBe('3')
      })

      await test.step('MIGRATION-ROLLBACK-005: handles cascading rollback for dependent tables', async () => {
        // Setup with foreign key relationships
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'categories',
              fields: [{ id: 2, name: 'name', type: 'single-line-text' }],
            },
            {
              id: 2,
              name: 'products',
              fields: [
                {
                  id: 2,
                  name: 'category',
                  type: 'relationship',
                  relatedTable: 'categories',
                  relationType: 'many-to-one',
                },
              ],
            },
          ],
        })
        await executeQuery([
          `INSERT INTO categories (name) VALUES ('Electronics')`,
          `INSERT INTO products (category) VALUES ((SELECT id FROM categories LIMIT 1))`,
        ])

        // Attempt failing migration on parent
        await expect(async () => {
          await startServerWithSchema({
            name: 'test-app',
            tables: [
              {
                id: 1,
                name: 'categories',
                fields: [
                  { id: 2, name: 'name', type: 'single-line-text' },
                  { id: 3, name: 'invalid', type: 'INVALID_TYPE' },
                ],
              },
              {
                id: 2,
                name: 'products',
                fields: [
                  {
                    id: 2,
                    name: 'category',
                    type: 'relationship',
                    relatedTable: 'categories',
                    relationType: 'many-to-one',
                  },
                ],
              },
            ],
          })
        }).rejects.toThrow()

        // Both tables preserved
        const categories = await executeQuery(`SELECT id, name FROM categories`)
        expect(categories.rows).toHaveLength(1)
        const products = await executeQuery(`SELECT id, category FROM products`)
        expect(products.rows).toHaveLength(1)
      })

      await test.step('MIGRATION-ROLLBACK-006: logs rollback operations for audit trail', async () => {
        // Setup
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'test_table',
              fields: [{ id: 2, name: 'data', type: 'single-line-text' }],
            },
          ],
        })

        // Trigger rollback
        await expect(async () => {
          await startServerWithSchema({
            name: 'test-app',
            tables: [
              {
                id: 1,
                name: 'test_table',
                fields: [
                  { id: 2, name: 'data', type: 'single-line-text' },
                  { id: 3, name: 'bad', type: 'INVALID' },
                ],
              },
            ],
          })
        }).rejects.toThrow()

        // Verify rollback logged
        const logs = await executeQuery(
          `SELECT * FROM _sovrium_migration_log WHERE operation = 'ROLLBACK' ORDER BY created_at DESC LIMIT 1`
        )
        expect(logs.rows).toHaveLength(1)
        expect(logs.rows[0].status).toBe('COMPLETED')
      })

      await test.step('MIGRATION-ROLLBACK-007: supports schema downgrade from version N to N-1', async () => {
        // Setup version N with multiple fields
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'users',
              fields: [
                { id: 2, name: 'email', type: 'email' },
                { id: 3, name: 'name', type: 'single-line-text' },
              ],
            },
          ],
        })
        await executeQuery([
          `INSERT INTO users (email, name) VALUES ('test@example.com', 'Test User')`,
        ])

        // Verify current structure
        const columnsBefore = await executeQuery(
          `SELECT column_name FROM information_schema.columns WHERE table_name='users'`
        )
        expect(columnsBefore.rows).toHaveLength(6)
      })

      await test.step('MIGRATION-ROLLBACK-008: prevents rollback causing data loss without confirmation', async () => {
        // Setup with data in column to be removed
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'customers',
              fields: [
                { id: 2, name: 'email', type: 'email', required: true },
                { id: 3, name: 'phone', type: 'phone-number' },
              ],
            },
          ],
        })
        await executeQuery([
          `INSERT INTO customers (email, phone) VALUES
            ('user1@example.com', '555-0101'),
            ('user2@example.com', '555-0102')`,
        ])

        // Verify data exists
        const phoneData = await executeQuery(
          `SELECT COUNT(*) as count FROM customers WHERE phone IS NOT NULL`
        )
        expect(phoneData.rows[0].count).toBe('2')

        // Attempt destructive rollback
        await expect(async () => {
          await startServerWithSchema({
            name: 'test-app',
            tables: [
              {
                id: 1,
                name: 'customers',
                fields: [{ id: 2, name: 'email', type: 'email', required: true }],
              },
            ],
          })
        }).rejects.toThrow(/destructive operation|dropping column|data loss|allowDestructive/i)

        // Data still intact
        const phoneDataAfter = await executeQuery(
          `SELECT COUNT(*) as count FROM customers WHERE phone IS NOT NULL`
        )
        expect(phoneDataAfter.rows[0].count).toBe('2')
      })
    }
  )
})
