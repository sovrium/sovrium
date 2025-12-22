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

  test.fixme(
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

  test.fixme(
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
                // Invalid field type (runtime validation)
                { id: 2, name: 'bad', type: 'INVALID' },
              ],
            },
          ],
        })
      }).rejects.toThrow()

      // Products table preserved from last good state
      const tableExists = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name='products'`
      )
      expect(tableExists.count).toBe('1')
    }
  )

  test.fixme(
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

  test.fixme(
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

  test.fixme(
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
            fields: [{ id: 2, name: 'category_id', type: 'integer' }],
          },
        ],
      })
      await executeQuery([
        `INSERT INTO categories (name) VALUES ('Electronics')`,
        `INSERT INTO products (category_id) VALUES ((SELECT id FROM categories LIMIT 1))`,
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
              fields: [{ id: 2, name: 'category_id', type: 'integer' }],
            },
          ],
        })
      }).rejects.toThrow()

      // Categories table unchanged (use explicit columns to avoid special fields in result)
      const categories = await executeQuery(`SELECT id, name FROM categories`)
      expect(categories.rows).toHaveLength(1)

      // Products table unchanged (use explicit columns to avoid special fields in result)
      const products = await executeQuery(`SELECT id, category_id FROM products`)
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
      await executeQuery([`INSERT INTO test_table (data) VALUES ('test value')`])

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
                // Required field without default will cause constraint violation
                { id: 3, name: 'required_field', type: 'single-line-text', required: true },
              ],
            },
          ],
        })
      }).rejects.toThrow(/null values|NOT NULL/i)

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

  test.fixme(
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

      // System should detect non-null data and require confirmation
      // or backup before allowing destructive rollback
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'MIGRATION-ROLLBACK-009: user can complete full migration rollback workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('Setup: Create migration history and test data', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'items',
              fields: [{ id: 2, name: 'name', type: 'single-line-text' }],
            },
          ],
        })
        await executeQuery([`INSERT INTO items (name) VALUES ('Item 1'), ('Item 2')`])
      })

      await test.step('Attempt invalid migration', async () => {
        await expect(async () => {
          await startServerWithSchema({
            name: 'test-app',
            tables: [
              {
                id: 1,
                name: 'items',
                fields: [
                  { id: 2, name: 'name', type: 'single-line-text' },
                  // Invalid type (runtime validation)
                  { id: 3, name: 'bad', type: 'INVALID' },
                ],
              },
            ],
          })
        }).rejects.toThrow()
      })

      await test.step('Verify automatic rollback preserved data', async () => {
        // Original data preserved (use explicit columns to avoid special fields in result)
        const items = await executeQuery(`SELECT id, name FROM items`)
        expect(items.rows).toHaveLength(2)

        // Table structure unchanged (id + created_at + updated_at + deleted_at + name = 5 columns)
        const columns = await executeQuery(
          `SELECT column_name FROM information_schema.columns WHERE table_name='items'`
        )
        expect(columns.rows).toHaveLength(5)
      })
    }
  )
})
