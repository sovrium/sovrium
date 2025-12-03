/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Primary Key
 *
 * Source: src/domain/models/app/table/index.ts
 * Domain: app
 * Spec Count: 8
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (8 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Validation Approach:
 * - Database assertions (executeQuery fixture)
 * - PostgreSQL primary key constraints (SERIAL, UUID, composite)
 * - Constraint enforcement (UNIQUE, NOT NULL, index creation)
 * - Auto-increment behavior validation
 */

test.describe('Primary Key', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test(
    'APP-TABLES-PRIMARYKEY-001: should generate sequential INTEGER values automatically with auto-increment primary key',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with auto-increment primary key (SERIAL)
      // WHEN: table is created with id field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              {
                id: 1,
                name: 'name',
                type: 'single-line-text',
              },
            ],
            // Auto-generated SERIAL primary key is default behavior
          },
        ],
      })

      // Insert test data
      await executeQuery(`INSERT INTO users (name) VALUES ('Alice'), ('Bob'), ('Charlie')`)

      // THEN: PostgreSQL generates sequential INTEGER values automatically

      // Primary key constraint exists
      const constraint = await executeQuery(
        `SELECT constraint_name FROM information_schema.table_constraints WHERE table_name='users' AND constraint_type='PRIMARY KEY'`
      )
      // THEN: assertion
      expect(constraint.rows[0]).toMatchObject({ constraint_name: 'users_pkey' })

      // id column is SERIAL (integer with sequence)
      const column = await executeQuery(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='users' AND column_name='id'`
      )
      // THEN: assertion
      expect(column.rows[0]).toMatchObject({ column_name: 'id', data_type: 'integer' })

      // Auto-increment generates sequential IDs
      const ids = await executeQuery(`SELECT id FROM users ORDER BY id`)
      // THEN: assertion
      expect(ids.rows).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }])

      // Duplicate ID rejected (UNIQUE constraint)
      // THEN: assertion
      await expect(
        executeQuery(`INSERT INTO users (id, name) VALUES (1, 'Duplicate')`)
      ).rejects.toThrow(/duplicate key value violates unique constraint/)
    }
  )

  test(
    'APP-TABLES-PRIMARYKEY-002: should generate UUID values using gen_random_uuid() with UUID primary key',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with UUID primary key
      // WHEN: table is created with uuid field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'sessions',
            primaryKey: {
              type: 'uuid', // UUID primary key instead of default SERIAL
            },
            fields: [
              {
                id: 1,
                name: 'user_id',
                type: 'integer',
              },
              {
                id: 2,
                name: 'created_at',
                type: 'created-at',
              },
            ],
          },
        ],
      })

      await executeQuery(`INSERT INTO sessions (user_id) VALUES (1), (2), (3)`)

      // THEN: PostgreSQL generates UUID values using gen_random_uuid()

      // Primary key constraint exists
      const constraint = await executeQuery(
        `SELECT constraint_name FROM information_schema.table_constraints WHERE table_name='sessions' AND constraint_type='PRIMARY KEY'`
      )
      // THEN: assertion
      expect(constraint.rows[0]).toMatchObject({ constraint_name: 'sessions_pkey' })

      // id column is UUID type
      const column = await executeQuery(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='sessions' AND column_name='id'`
      )
      // THEN: assertion
      expect(column.rows[0]).toMatchObject({ column_name: 'id', data_type: 'uuid' })

      // UUID values are generated automatically
      const count = await executeQuery(
        `SELECT COUNT(*) as count FROM sessions WHERE id IS NOT NULL`
      )
      // THEN: assertion
      expect(count.rows[0]).toMatchObject({ count: 3 })

      // UUID values are unique
      const uniqueCount = await executeQuery(
        `SELECT COUNT(DISTINCT id) as unique_count FROM sessions`
      )
      // THEN: assertion
      expect(uniqueCount.rows[0]).toMatchObject({ unique_count: 3 })
    }
  )

  test(
    'APP-TABLES-PRIMARYKEY-003: should create PRIMARY KEY constraint on both columns with composite primary key',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with composite primary key (tenant_id, user_id)
      // WHEN: table is created with multiple primary key fields
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'tenant_users',
            primaryKey: {
              type: 'composite',
              fields: ['tenant_id', 'user_id'], // Composite primary key
            },
            fields: [
              {
                id: 1,
                name: 'tenant_id',
                type: 'integer',
                required: true,
              },
              {
                id: 2,
                name: 'user_id',
                type: 'integer',
                required: true,
              },
              {
                id: 3,
                name: 'name',
                type: 'single-line-text',
              },
            ],
          },
        ],
      })

      await executeQuery(
        `INSERT INTO tenant_users (tenant_id, user_id, name) VALUES (1, 1, 'Alice'), (1, 2, 'Bob'), (2, 1, 'Charlie')`
      )

      // THEN: PostgreSQL creates PRIMARY KEY constraint on both columns

      // Composite primary key constraint exists
      const constraint = await executeQuery(
        `SELECT constraint_name FROM information_schema.table_constraints WHERE table_name='tenant_users' AND constraint_type='PRIMARY KEY'`
      )
      // THEN: assertion
      expect(constraint.rows[0]).toMatchObject({ constraint_name: 'tenant_users_pkey' })

      // Primary key includes both columns
      const keyCount = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.key_column_usage WHERE table_name='tenant_users' AND constraint_name='tenant_users_pkey'`
      )
      // THEN: assertion
      expect(keyCount.rows[0]).toMatchObject({ count: 2 })

      // Same user_id allowed in different tenants
      const sameUser = await executeQuery(
        `SELECT COUNT(*) as count FROM tenant_users WHERE user_id = 1`
      )
      // THEN: assertion
      expect(sameUser.rows[0]).toMatchObject({ count: 2 })

      // Duplicate composite key rejected
      // THEN: assertion
      await expect(
        executeQuery(
          `INSERT INTO tenant_users (tenant_id, user_id, name) VALUES (1, 1, 'Duplicate')`
        )
      ).rejects.toThrow(/duplicate key value violates unique constraint/)
    }
  )

  test(
    'APP-TABLES-PRIMARYKEY-004: should reject NULL values in primary key column',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: primary key column with NOT NULL constraint
      // WHEN: attempting to insert NULL value
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'products',
            fields: [
              {
                id: 1,
                name: 'name',
                type: 'single-line-text',
              },
            ],
            // Auto-generated SERIAL primary key (default)
          },
        ],
      })

      await executeQuery(`INSERT INTO products (name) VALUES ('Product 1')`)

      // THEN: PostgreSQL rejects NULL values in primary key column

      // Primary key column is NOT NULL
      const nullable = await executeQuery(
        `SELECT is_nullable FROM information_schema.columns WHERE table_name='products' AND column_name='id'`
      )
      // THEN: assertion
      expect(nullable.rows[0]).toMatchObject({ is_nullable: 'NO' })

      // NULL value in primary key rejected
      // THEN: assertion
      await expect(
        executeQuery(`INSERT INTO products (id, name) VALUES (NULL, 'Product 2')`)
      ).rejects.toThrow(
        /null value in column "id" of relation "products" violates not-null constraint/
      )

      // Valid auto-generated ID succeeds
      const result = await executeQuery(
        `INSERT INTO products (name) VALUES ('Product 2') RETURNING id`
      )
      // THEN: assertion
      expect(result.rows[0]).toMatchObject({ id: 2 })
    }
  )

  test(
    'APP-TABLES-PRIMARYKEY-005: should automatically create index for primary key constraint',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: primary key creates automatic UNIQUE index
      // WHEN: table is created
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'orders',
            fields: [
              {
                id: 1,
                name: 'customer_id',
                type: 'integer',
              },
              {
                id: 2,
                name: 'total',
                type: 'decimal',
              },
            ],
            // Auto-generated SERIAL primary key (default)
          },
        ],
      })

      await executeQuery(`INSERT INTO orders (customer_id, total) VALUES (1, 99.99)`)

      // THEN: PostgreSQL automatically creates index for primary key constraint

      // Primary key index automatically created
      const index = await executeQuery(
        `SELECT indexname FROM pg_indexes WHERE tablename='orders' AND indexname='orders_pkey'`
      )
      // THEN: assertion
      expect(index.rows[0]).toMatchObject({ indexname: 'orders_pkey' })

      // Index is unique
      const indexDef = await executeQuery(
        `SELECT indexdef FROM pg_indexes WHERE indexname='orders_pkey'`
      )
      // THEN: assertion
      expect(indexDef.rows[0]).toMatchObject({
        indexdef: 'CREATE UNIQUE INDEX orders_pkey ON public.orders USING btree (id)',
      })

      // Primary key lookup uses index (fast)
      const lookup = await executeQuery(`SELECT customer_id FROM orders WHERE id = 1`)
      // THEN: assertion
      expect(lookup.rows[0]).toMatchObject({ customer_id: 1 })
    }
  )

  test(
    'APP-TABLES-PRIMARYKEY-006: should allow UPDATE but new value must remain unique',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: existing record with primary key
      // WHEN: attempting to update primary key value
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 6,
            name: 'items',
            primaryKey: {
              type: 'composite',
              fields: ['id'], // Explicit INTEGER primary key (not auto-increment)
            },
            fields: [
              {
                id: 1,
                name: 'id',
                type: 'integer',
                required: true,
              },
              {
                id: 2,
                name: 'name',
                type: 'single-line-text',
              },
            ],
          },
        ],
      })

      await executeQuery(
        `INSERT INTO items (id, name) VALUES (1, 'Item 1'), (2, 'Item 2'), (3, 'Item 3')`
      )

      // THEN: PostgreSQL allows UPDATE but new value must remain unique

      // Primary key can be updated to unique value
      const update = await executeQuery(`UPDATE items SET id = 10 WHERE id = 1 RETURNING id, name`)
      // THEN: assertion
      expect(update.rows[0]).toMatchObject({ id: 10, name: 'Item 1' })

      // Updated primary key is persisted
      const select = await executeQuery(`SELECT id FROM items WHERE name = 'Item 1'`)
      // THEN: assertion
      expect(select.rows[0]).toMatchObject({ id: 10 })

      // Primary key cannot be updated to duplicate value
      // THEN: assertion
      await expect(executeQuery(`UPDATE items SET id = 2 WHERE id = 10`)).rejects.toThrow(
        /duplicate key value violates unique constraint/
      )

      // Original ID no longer exists after update
      const oldId = await executeQuery(`SELECT COUNT(*) as count FROM items WHERE id = 1`)
      // THEN: assertion
      expect(oldId.rows[0]).toMatchObject({ count: 0 })
    }
  )

  test(
    'APP-TABLES-PRIMARYKEY-007: should use BIGINT for larger auto-increment range with BIGSERIAL',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table with BIGSERIAL primary key for large datasets
      // WHEN: table is created with bigint id
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 7,
            name: 'logs',
            primaryKey: {
              type: 'bigserial', // BIGSERIAL instead of default SERIAL
            },
            fields: [
              {
                id: 1,
                name: 'message',
                type: 'long-text',
              },
              {
                id: 2,
                name: 'created_at',
                type: 'created-at',
              },
            ],
          },
        ],
      })

      await executeQuery(`INSERT INTO logs (message) VALUES ('Log 1'), ('Log 2')`)

      // THEN: PostgreSQL uses BIGINT (8 bytes) for larger auto-increment range

      // id column is BIGINT type
      const column = await executeQuery(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='logs' AND column_name='id'`
      )
      // THEN: assertion
      expect(column.rows[0]).toMatchObject({ column_name: 'id', data_type: 'bigint' })

      // BIGSERIAL generates sequential values
      const ids = await executeQuery(`SELECT id FROM logs ORDER BY id`)
      // THEN: assertion
      expect(ids.rows).toEqual([{ id: 1 }, { id: 2 }])

      // Primary key constraint exists
      const constraint = await executeQuery(
        `SELECT constraint_name FROM information_schema.table_constraints WHERE table_name='logs' AND constraint_type='PRIMARY KEY'`
      )
      // THEN: assertion
      expect(constraint.rows[0]).toMatchObject({ constraint_name: 'logs_pkey' })

      // BIGINT supports range up to 2^63-1 (vs INTEGER 2^31-1)
      const byteSize = await executeQuery(
        `SELECT pg_column_size(id) as byte_size FROM logs LIMIT 1`
      )
      // THEN: assertion
      expect(byteSize.rows[0]).toMatchObject({ byte_size: 8 })
    }
  )

  test(
    'APP-TABLES-PRIMARYKEY-008: should create PRIMARY KEY constraint on all specified columns with 3-column composite key',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: composite primary key with more than 2 fields
      // WHEN: table is created with 3-column primary key
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 8,
            name: 'audit_log',
            primaryKey: {
              type: 'composite',
              fields: ['tenant_id', 'user_id', 'timestamp'], // 3-column composite primary key
            },
            fields: [
              {
                id: 1,
                name: 'tenant_id',
                type: 'integer',
                required: true,
              },
              {
                id: 2,
                name: 'user_id',
                type: 'integer',
                required: true,
              },
              {
                id: 3,
                name: 'timestamp',
                type: 'created-at',
                required: true,
              },
              {
                id: 4,
                name: 'action',
                type: 'single-line-text',
              },
            ],
          },
        ],
      })

      await executeQuery(
        `INSERT INTO audit_log (tenant_id, user_id, timestamp, action) VALUES (1, 1, '2024-01-01 10:00:00', 'login'), (1, 1, '2024-01-01 11:00:00', 'logout')`
      )

      // THEN: PostgreSQL creates PRIMARY KEY constraint on all specified columns

      // Composite primary key includes all 3 columns
      const keyCount = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.key_column_usage WHERE table_name='audit_log' AND constraint_name='audit_log_pkey'`
      )
      // THEN: assertion
      expect(keyCount.rows[0]).toMatchObject({ count: 3 })

      // Same tenant and user allowed at different timestamps
      const sameUserTenant = await executeQuery(
        `SELECT COUNT(*) as count FROM audit_log WHERE tenant_id = 1 AND user_id = 1`
      )
      // THEN: assertion
      expect(sameUserTenant.rows[0]).toMatchObject({ count: 2 })

      // Duplicate composite key rejected
      // THEN: assertion
      await expect(
        executeQuery(
          `INSERT INTO audit_log (tenant_id, user_id, timestamp, action) VALUES (1, 1, '2024-01-01 10:00:00', 'duplicate')`
        )
      ).rejects.toThrow(/duplicate key value violates unique constraint/)

      // Different timestamp allows same tenant and user
      const newRow = await executeQuery(
        `INSERT INTO audit_log (tenant_id, user_id, timestamp, action) VALUES (1, 1, '2024-01-01 12:00:00', 'update') RETURNING action`
      )
      // THEN: assertion
      expect(newRow.rows[0]).toMatchObject({ action: 'update' })
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test(
    'APP-TABLES-PRIMARYKEY-009: user can complete full Primary Key workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Database with representative primary key configurations
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 9,
            name: 'users',
            fields: [{ id: 1, name: 'name', type: 'single-line-text' }],
            // Default SERIAL primary key
          },
          {
            id: 10,
            name: 'sessions',
            primaryKey: { type: 'uuid' },
            fields: [{ id: 1, name: 'user_id', type: 'integer' }],
          },
          {
            id: 11,
            name: 'tenant_users',
            primaryKey: { type: 'composite', fields: ['tenant_id', 'user_id'] },
            fields: [
              { id: 1, name: 'tenant_id', type: 'integer', required: true },
              { id: 2, name: 'user_id', type: 'integer', required: true },
            ],
          },
        ],
      })

      // WHEN/THEN: Execute representative workflow

      // 1. SERIAL auto-increment works
      await executeQuery(`INSERT INTO users (name) VALUES ('Alice'), ('Bob')`)
      const users = await executeQuery(`SELECT id FROM users ORDER BY id`)
      // THEN: assertion
      expect(users.rows).toEqual([{ id: 1 }, { id: 2 }])

      // 2. UUID generation works
      await executeQuery(`INSERT INTO sessions (user_id) VALUES (1), (2)`)
      const sessions = await executeQuery(`SELECT COUNT(DISTINCT id) as count FROM sessions`)
      // THEN: assertion
      expect(sessions.rows[0]).toMatchObject({ count: 2 })

      // 3. Composite primary key works
      await executeQuery(
        `INSERT INTO tenant_users (tenant_id, user_id) VALUES (1, 1), (1, 2), (2, 1)`
      )
      const tenantUsers = await executeQuery(
        `SELECT COUNT(*) as count FROM tenant_users WHERE user_id = 1`
      )
      // THEN: assertion
      expect(tenantUsers.rows[0]).toMatchObject({ count: 2 }) // Same user in different tenants

      // 4. Primary key constraints enforce uniqueness
      // THEN: assertion
      await expect(
        executeQuery(`INSERT INTO users (id, name) VALUES (1, 'Duplicate')`)
      ).rejects.toThrow(/unique constraint/)
      // THEN: assertion
      await expect(
        executeQuery(`INSERT INTO tenant_users (tenant_id, user_id) VALUES (1, 1)`)
      ).rejects.toThrow(/unique constraint/)

      // 5. Primary key indexes are created automatically
      const indexes = await executeQuery(
        `SELECT indexname FROM pg_indexes WHERE indexname IN ('users_pkey', 'sessions_pkey', 'tenant_users_pkey') ORDER BY indexname`
      )
      // THEN: assertion
      expect(indexes.rows).toHaveLength(3)

      // Workflow completes successfully
    }
  )
})
