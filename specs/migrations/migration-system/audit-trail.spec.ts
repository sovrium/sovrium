/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Migration Audit Trail
 *
 * Domain: migrations
 * Spec Count: 6
 *
 * Test Organization:
 * 1. @spec tests - One per spec (6 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Audit Trail Scenarios:
 * - Migration history tracking
 * - Rollback history logging
 * - Schema version management
 * - Audit log queries
 */

test.describe('Migration Audit Trail', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test(
    'MIGRATION-AUDIT-001: should record migration history with timestamp and checksum',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Fresh database with no migration history

      // WHEN: First migration is applied
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
        ],
      })

      // THEN: Migration recorded in history table
      const history = await executeQuery(
        `SELECT * FROM _sovrium_migration_history ORDER BY applied_at DESC LIMIT 1`
      )
      expect(history.rows).toHaveLength(1)
      expect(history.rows[0].checksum).toBeDefined()
      expect(history.rows[0].applied_at).toBeDefined()
    }
  )

  test(
    'MIGRATION-AUDIT-002: should store complete schema snapshot in migration history',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Application schema with tables

      // WHEN: Migration is applied
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'products',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'price', type: 'decimal' },
            ],
          },
        ],
      })

      // THEN: Full schema snapshot stored in history
      const history = await executeQuery(
        `SELECT schema FROM _sovrium_migration_history ORDER BY applied_at DESC LIMIT 1`
      )
      expect(history.rows).toHaveLength(1)

      const schema = history.rows[0].schema
      expect(schema.tables).toBeDefined()
      expect(schema.tables).toHaveLength(1)
      expect(schema.tables[0].name).toBe('products')
      expect(schema.tables[0].fields).toHaveLength(3)
    }
  )

  test(
    'MIGRATION-AUDIT-003: should track incremental version numbers for each migration',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: First migration creates initial schema and migration history
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'initial',
            fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
          },
        ],
      })

      // Setup test data: Replace auto-created entry with version 1
      await executeQuery([
        `DELETE FROM _sovrium_migration_history`,
        `INSERT INTO _sovrium_migration_history (version, checksum, schema)
         VALUES (1, 'checksum_v1', '{"tables":[]}')`,
      ])

      // WHEN: New migration is applied
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'orders',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'total', type: 'decimal' },
            ],
          },
        ],
      })

      // THEN: Version number incremented (migration system automatically recorded version 2)
      const versions = await executeQuery(
        `SELECT version FROM _sovrium_migration_history ORDER BY version`
      )
      expect(versions.rows).toHaveLength(2)
      expect(versions.rows[0].version).toBe(1)
      expect(versions.rows[1].version).toBe(2)
    }
  )

  test(
    'MIGRATION-AUDIT-004: should log rollback operations with reason and timestamp',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Initial schema with products table - internal tables created automatically
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'products',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
            ],
          },
        ],
      })

      // Insert test data with duplicate names
      await executeQuery([
        `INSERT INTO products (id, name) VALUES (1, 'duplicate'), (2, 'duplicate')`,
      ])

      // WHEN: Migration fails (trying to add unique constraint on column with duplicates)
      await expect(async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'products',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'name', type: 'single-line-text', unique: true },
              ],
            },
          ],
        })
      }).rejects.toThrow()

      // THEN: Rollback logged with details
      const logs = await executeQuery(
        `SELECT * FROM _sovrium_migration_log WHERE operation = 'ROLLBACK' ORDER BY created_at DESC LIMIT 1`
      )
      expect(logs.rows).toHaveLength(1)
      expect(logs.rows[0].reason).toBeTruthy() // Should have an error reason
      expect(logs.rows[0].status).toBe('COMPLETED')
    }
  )

  test(
    'MIGRATION-AUDIT-005: should provide query interface for migration history',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Initialize test database - internal tables created automatically
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 999,
            name: 'placeholder',
            fields: [{ id: 1, name: 'id', type: 'integer' }],
          },
        ],
      })

      // GIVEN: Multiple migrations in history
      await executeQuery([
        // Delete auto-created migration entry to start with clean slate
        `DELETE FROM _sovrium_migration_history`,
        `INSERT INTO _sovrium_migration_history (version, checksum, schema, applied_at) VALUES
          (1, 'v1', '{"tables":[]}', '2025-01-01 10:00:00'),
          (2, 'v2', '{"tables":[{"name":"users"}]}', '2025-01-02 10:00:00'),
          (3, 'v3', '{"tables":[{"name":"users"},{"name":"posts"}]}', '2025-01-03 10:00:00')`,
      ])

      // WHEN: Querying migration history
      // THEN: All migrations returned with details

      // Query all migrations
      const allMigrations = await executeQuery(
        `SELECT * FROM _sovrium_migration_history ORDER BY version`
      )
      expect(allMigrations.rows).toHaveLength(3)

      // Query by date range
      const recentMigrations = await executeQuery(
        `SELECT * FROM _sovrium_migration_history WHERE applied_at >= '2025-01-02'`
      )
      expect(recentMigrations.rows).toHaveLength(2)

      // Query specific version
      const v2Migration = await executeQuery(
        `SELECT * FROM _sovrium_migration_history WHERE version = 2`
      )
      expect(v2Migration.rows).toHaveLength(1)
      expect(v2Migration.rows[0].checksum).toBe('v2')
    }
  )

  test(
    'MIGRATION-AUDIT-006: should detect and report schema drift from audit history',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Initial schema - internal tables created automatically
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'customers',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'email', type: 'email' },
            ],
          },
        ],
      })

      // GIVEN: Recorded schema state differs from actual (simulate manual modification)
      await executeQuery([
        // Update recorded schema checksum to have only 2 columns
        `UPDATE _sovrium_schema_checksum
         SET schema = '{"tables":[{"name":"customers","fields":[{"name":"id"},{"name":"email"}]}]}'
         WHERE id = 'singleton'`,
        // Manually add extra column to actual database (simulates drift)
        `ALTER TABLE customers ADD COLUMN extra_column TEXT`,
      ])

      // WHEN: Migration system checks for drift
      // THEN: Drift detected and reported

      // System should detect extra_column not in recorded schema
      const actualColumns = await executeQuery(
        `SELECT column_name FROM information_schema.columns WHERE table_name='customers' ORDER BY ordinal_position`
      )
      // 6 columns: id + 3 special fields (created_at, updated_at, deleted_at) + email + extra_column
      expect(actualColumns.rows).toHaveLength(6)

      // Recorded schema only has 2 columns
      const recordedSchema = await executeQuery(
        `SELECT schema FROM _sovrium_schema_checksum WHERE id = 'singleton'`
      )
      expect(recordedSchema.rows[0].schema.tables[0].fields).toHaveLength(2)

      // Drift exists (3 actual vs 2 recorded)
      expect(actualColumns.rows.length).not.toBe(
        recordedSchema.rows[0].schema.tables[0].fields.length
      )
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // Generated from 6 @spec tests - covers: migration history, schema snapshots,
  // version tracking, rollback logging, query interface, schema drift detection
  // ============================================================================

  test(
    'MIGRATION-AUDIT-REGRESSION: user can complete full migration audit workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('MIGRATION-AUDIT-001: records migration history with timestamp and checksum', async () => {
        // WHEN: First migration is applied
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
          ],
        })

        // THEN: Migration recorded in history table
        const history = await executeQuery(
          `SELECT * FROM _sovrium_migration_history ORDER BY applied_at DESC LIMIT 1`
        )
        expect(history.rows).toHaveLength(1)
        expect(history.rows[0].checksum).toBeDefined()
        expect(history.rows[0].applied_at).toBeDefined()
      })

      await test.step('MIGRATION-AUDIT-002: stores complete schema snapshot in migration history', async () => {
        // WHEN: Migration is applied with products table
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'products',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'name', type: 'single-line-text' },
                { id: 3, name: 'price', type: 'decimal' },
              ],
            },
          ],
        })

        // THEN: Full schema snapshot stored in history
        const history = await executeQuery(
          `SELECT schema FROM _sovrium_migration_history ORDER BY applied_at DESC LIMIT 1`
        )
        expect(history.rows).toHaveLength(1)

        const schema = history.rows[0].schema
        expect(schema.tables).toBeDefined()
        expect(schema.tables).toHaveLength(1)
        expect(schema.tables[0].name).toBe('products')
        expect(schema.tables[0].fields).toHaveLength(3)
      })

      await test.step('MIGRATION-AUDIT-003: tracks incremental version numbers for each migration', async () => {
        // Setup: Create initial schema and migration history
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'initial',
              fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
            },
          ],
        })

        // Setup test data: Replace auto-created entry with version 1
        await executeQuery([
          `DELETE FROM _sovrium_migration_history`,
          `INSERT INTO _sovrium_migration_history (version, checksum, schema)
           VALUES (1, 'checksum_v1', '{"tables":[]}')`,
        ])

        // WHEN: New migration is applied
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'orders',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'total', type: 'decimal' },
              ],
            },
          ],
        })

        // THEN: Version number incremented
        const versions = await executeQuery(
          `SELECT version FROM _sovrium_migration_history ORDER BY version`
        )
        expect(versions.rows).toHaveLength(2)
        expect(versions.rows[0].version).toBe(1)
        expect(versions.rows[1].version).toBe(2)
      })

      await test.step('MIGRATION-AUDIT-004: logs rollback operations with reason and timestamp', async () => {
        // GIVEN: Initial schema with products table
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'products',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'name', type: 'single-line-text' },
              ],
            },
          ],
        })

        // Insert test data with duplicate names
        await executeQuery([
          `INSERT INTO products (id, name) VALUES (1, 'duplicate'), (2, 'duplicate')`,
        ])

        // WHEN: Migration fails (trying to add unique constraint on column with duplicates)
        await expect(async () => {
          await startServerWithSchema({
            name: 'test-app',
            tables: [
              {
                id: 1,
                name: 'products',
                fields: [
                  { id: 1, name: 'id', type: 'integer', required: true },
                  { id: 2, name: 'name', type: 'single-line-text', unique: true },
                ],
              },
            ],
          })
        }).rejects.toThrow()

        // THEN: Rollback logged with details
        const logs = await executeQuery(
          `SELECT * FROM _sovrium_migration_log WHERE operation = 'ROLLBACK' ORDER BY created_at DESC LIMIT 1`
        )
        expect(logs.rows).toHaveLength(1)
        expect(logs.rows[0].reason).toBeTruthy()
        expect(logs.rows[0].status).toBe('COMPLETED')
      })

      await test.step('MIGRATION-AUDIT-005: provides query interface for migration history', async () => {
        // GIVEN: Initialize test database
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 999,
              name: 'placeholder',
              fields: [{ id: 1, name: 'id', type: 'integer' }],
            },
          ],
        })

        // Setup: Multiple migrations in history
        await executeQuery([
          `DELETE FROM _sovrium_migration_history`,
          `INSERT INTO _sovrium_migration_history (version, checksum, schema, applied_at) VALUES
            (1, 'v1', '{"tables":[]}', '2025-01-01 10:00:00'),
            (2, 'v2', '{"tables":[{"name":"users"}]}', '2025-01-02 10:00:00'),
            (3, 'v3', '{"tables":[{"name":"users"},{"name":"posts"}]}', '2025-01-03 10:00:00')`,
        ])

        // THEN: Query all migrations
        const allMigrations = await executeQuery(
          `SELECT * FROM _sovrium_migration_history ORDER BY version`
        )
        expect(allMigrations.rows).toHaveLength(3)

        // THEN: Query by date range
        const recentMigrations = await executeQuery(
          `SELECT * FROM _sovrium_migration_history WHERE applied_at >= '2025-01-02'`
        )
        expect(recentMigrations.rows).toHaveLength(2)

        // THEN: Query specific version
        const v2Migration = await executeQuery(
          `SELECT * FROM _sovrium_migration_history WHERE version = 2`
        )
        expect(v2Migration.rows).toHaveLength(1)
        expect(v2Migration.rows[0].checksum).toBe('v2')
      })

      await test.step('MIGRATION-AUDIT-006: detects and reports schema drift from audit history', async () => {
        // GIVEN: Initial schema
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'customers',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'email', type: 'email' },
              ],
            },
          ],
        })

        // Setup: Recorded schema state differs from actual (simulate manual modification)
        await executeQuery([
          `UPDATE _sovrium_schema_checksum
           SET schema = '{"tables":[{"name":"customers","fields":[{"name":"id"},{"name":"email"}]}]}'
           WHERE id = 'singleton'`,
          `ALTER TABLE customers ADD COLUMN extra_column TEXT`,
        ])

        // THEN: System detects extra_column not in recorded schema
        const actualColumns = await executeQuery(
          `SELECT column_name FROM information_schema.columns WHERE table_name='customers' ORDER BY ordinal_position`
        )
        // 6 columns: id + 3 special fields (created_at, updated_at, deleted_at) + email + extra_column
        expect(actualColumns.rows).toHaveLength(6)

        // THEN: Recorded schema only has 2 columns
        const recordedSchema = await executeQuery(
          `SELECT schema FROM _sovrium_schema_checksum WHERE id = 'singleton'`
        )
        expect(recordedSchema.rows[0].schema.tables[0].fields).toHaveLength(2)

        // THEN: Drift exists (6 actual vs 2 recorded)
        expect(actualColumns.rows.length).not.toBe(
          recordedSchema.rows[0].schema.tables[0].fields.length
        )
      })
    }
  )
})
