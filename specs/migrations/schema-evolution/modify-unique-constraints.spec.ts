/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Modify Unique Constraints Migration
 *
 * Source: specs/migrations/schema-evolution/modify-unique-constraints/modify-unique-constraints.json
 * Domain: migrations
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Modify Unique Constraints Migration', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test(
    'MIGRATION-MODIFY-UNIQUE-001: should alter table add constraint unique creates constraint',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'users' with email field (not unique)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              { id: 2, name: 'name', type: 'single-line-text', required: true },
              { id: 3, name: 'email', type: 'email' },
            ],
          },
        ],
      })
      await executeQuery([
        `INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com')`,
        `INSERT INTO users (name, email) VALUES ('Bob', 'bob@example.com')`,
      ])

      // WHEN: unique constraint added to email field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              { id: 2, name: 'name', type: 'single-line-text', required: true },
              { id: 3, name: 'email', type: 'email', unique: true },
            ],
          },
        ],
      })

      // THEN: ALTER TABLE ADD CONSTRAINT UNIQUE creates constraint

      // Unique constraint exists
      const constraintCheck = await executeQuery(
        `SELECT constraint_name FROM information_schema.table_constraints WHERE table_name='users' AND constraint_type='UNIQUE'`
      )
      expect(constraintCheck.constraint_name).toBe('users_email_key')

      // Duplicate email rejected
      await expect(async () => {
        await executeQuery(
          `INSERT INTO users (name, email) VALUES ('Charlie', 'alice@example.com')`
        )
      }).rejects.toThrow(/duplicate key|unique constraint/i)

      // Unique email accepted
      const newUser = await executeQuery(
        `INSERT INTO users (name, email) VALUES ('Charlie', 'charlie@example.com') RETURNING email`
      )
      expect(newUser.email).toBe('charlie@example.com')
    }
  )

  test(
    'MIGRATION-MODIFY-UNIQUE-002: should alter table drop constraint removes constraint',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'accounts' with existing unique constraint on username
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'accounts',
            fields: [
              { id: 2, name: 'username', type: 'single-line-text', required: true, unique: true },
            ],
          },
        ],
      })
      await executeQuery([
        `INSERT INTO accounts (username) VALUES ('alice')`,
        `INSERT INTO accounts (username) VALUES ('bob')`,
      ])

      // WHEN: unique constraint removed from username field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'accounts',
            fields: [
              { id: 2, name: 'username', type: 'single-line-text', required: true }, // No unique
            ],
          },
        ],
      })

      // THEN: ALTER TABLE DROP CONSTRAINT removes constraint

      // Unique constraint removed
      const constraintCheck = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='accounts' AND constraint_type='UNIQUE' AND constraint_name LIKE '%username%'`
      )
      expect(constraintCheck.count).toBe('0')

      // Duplicate username now allowed
      await executeQuery(`INSERT INTO accounts (username) VALUES ('alice')`)
      const duplicates = await executeQuery(
        `SELECT COUNT(*) as count FROM accounts WHERE username = 'alice'`
      )
      expect(duplicates.count).toBe('2')
    }
  )

  test(
    'MIGRATION-MODIFY-UNIQUE-003: should alter table add constraint unique (col1, col2) enforces multi-column uniqueness',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'tenant_users' with no unique constraints
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'tenant_users',
            fields: [
              { id: 2, name: 'tenant_id', type: 'integer', required: true },
              { id: 3, name: 'email', type: 'email', required: true },
            ],
          },
        ],
      })
      await executeQuery([
        `INSERT INTO tenant_users (tenant_id, email) VALUES (1, 'alice@example.com')`,
        `INSERT INTO tenant_users (tenant_id, email) VALUES (2, 'alice@example.com')`,
      ])

      // WHEN: composite unique constraint on (tenant_id, email) added
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'tenant_users',
            fields: [
              { id: 2, name: 'tenant_id', type: 'integer', required: true },
              { id: 3, name: 'email', type: 'email', required: true },
            ],
            uniqueConstraints: [
              { name: 'uq_tenant_users_tenant_email', fields: ['tenant_id', 'email'] },
            ],
          },
        ],
      })

      // THEN: ALTER TABLE ADD CONSTRAINT UNIQUE (col1, col2) enforces multi-column uniqueness

      // Same email in different tenants allowed
      const differentTenant = await executeQuery(
        `INSERT INTO tenant_users (tenant_id, email) VALUES (3, 'alice@example.com') RETURNING email`
      )
      expect(differentTenant.email).toBe('alice@example.com')

      // Same email in same tenant rejected
      await expect(async () => {
        await executeQuery(
          `INSERT INTO tenant_users (tenant_id, email) VALUES (1, 'alice@example.com')`
        )
      }).rejects.toThrow(/duplicate key|unique constraint/i)
    }
  )

  test(
    'MIGRATION-MODIFY-UNIQUE-004: should migration fails with data validation error and rolls back',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'products' with duplicate data in 'sku' field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'products',
            fields: [
              { id: 2, name: 'name', type: 'single-line-text', required: true },
              { id: 3, name: 'sku', type: 'single-line-text' },
            ],
          },
        ],
      })
      await executeQuery([
        `INSERT INTO products (name, sku) VALUES ('Widget A', 'SKU-001')`,
        `INSERT INTO products (name, sku) VALUES ('Widget B', 'SKU-001')`, // Duplicates
      ])

      // WHEN: attempting to add unique constraint on field with duplicates
      // THEN: Migration fails with data validation error and rolls back
      await expect(async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 4,
              name: 'products',
              fields: [
                { id: 2, name: 'name', type: 'single-line-text', required: true },
                { id: 3, name: 'sku', type: 'single-line-text', unique: true },
              ],
            },
          ],
        })
      }).rejects.toThrow(/duplicate key|unique constraint|already exists/i)

      // Original data unchanged (migration rolled back)
      const duplicates = await executeQuery(
        `SELECT COUNT(*) as count FROM products WHERE sku = 'SKU-001'`
      )
      expect(duplicates.count).toBe('2')

      // No unique constraint added
      const constraintCheck = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='products' AND constraint_type='UNIQUE' AND constraint_name LIKE '%sku%'`
      )
      expect(constraintCheck.count).toBe('0')
    }
  )

  test(
    'MIGRATION-MODIFY-UNIQUE-005: should drop old constraint and add new composite constraint',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'orders' with existing unique constraint on order_number
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'orders',
            fields: [
              {
                id: 2,
                name: 'order_number',
                type: 'single-line-text',
                required: true,
                unique: true,
              },
              { id: 3, name: 'tenant_id', type: 'integer', required: true },
            ],
          },
        ],
      })
      await executeQuery([
        `INSERT INTO orders (order_number, tenant_id) VALUES ('ORD-001', 1)`,
        `INSERT INTO orders (order_number, tenant_id) VALUES ('ORD-002', 1)`,
      ])

      // WHEN: constraint fields modified from (order_number) to (order_number, tenant_id)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'orders',
            fields: [
              {
                id: 2,
                name: 'order_number',
                type: 'single-line-text',
                required: true,
              },
              { id: 3, name: 'tenant_id', type: 'integer', required: true },
            ],
            uniqueConstraints: [
              { name: 'uq_orders_number_tenant', fields: ['order_number', 'tenant_id'] },
            ],
          },
        ],
      })

      // THEN: DROP old constraint and ADD new composite constraint

      // Old single-column constraint removed
      const oldConstraint = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='orders' AND constraint_type='UNIQUE' AND constraint_name LIKE '%order_number%' AND constraint_name NOT LIKE '%tenant%'`
      )
      expect(oldConstraint.count).toBe('0')

      // Same order_number in different tenants now allowed
      await executeQuery(`INSERT INTO orders (order_number, tenant_id) VALUES ('ORD-001', 2)`)
      const sameOrderDifferentTenant = await executeQuery(
        `SELECT COUNT(*) as count FROM orders WHERE order_number = 'ORD-001'`
      )
      expect(sameOrderDifferentTenant.count).toBe('2')

      // Same order_number in same tenant still rejected
      await expect(async () => {
        await executeQuery(`INSERT INTO orders (order_number, tenant_id) VALUES ('ORD-001', 1)`)
      }).rejects.toThrow(/duplicate key|unique constraint/i)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test(
    'MIGRATION-MODIFY-UNIQUE-REGRESSION: user can complete full modify-unique-constraints workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('Setup: create items table without unique constraint', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 6,
              name: 'items',
              fields: [
                { id: 2, name: 'name', type: 'single-line-text', required: true },
                { id: 3, name: 'code', type: 'single-line-text' },
                { id: 4, name: 'org_id', type: 'integer', required: true },
              ],
            },
          ],
        })
        await executeQuery([
          `INSERT INTO items (name, code, org_id) VALUES ('Item A', 'CODE-001', 1)`,
          `INSERT INTO items (name, code, org_id) VALUES ('Item B', 'CODE-002', 1)`,
        ])
      })

      await test.step('Add composite unique constraint on (code, org_id)', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 6,
              name: 'items',
              fields: [
                { id: 2, name: 'name', type: 'single-line-text', required: true },
                { id: 3, name: 'code', type: 'single-line-text' },
                { id: 4, name: 'org_id', type: 'integer', required: true },
              ],
              uniqueConstraints: [{ name: 'uq_items_code_org', fields: ['code', 'org_id'] }],
            },
          ],
        })
      })

      await test.step('Verify composite uniqueness enforced', async () => {
        // Same code in different org allowed
        const differentOrg = await executeQuery(
          `INSERT INTO items (name, code, org_id) VALUES ('Item C', 'CODE-001', 2) RETURNING code`
        )
        expect(differentOrg.code).toBe('CODE-001')

        // Same code in same org rejected
        await expect(async () => {
          await executeQuery(
            `INSERT INTO items (name, code, org_id) VALUES ('Item D', 'CODE-001', 1)`
          )
        }).rejects.toThrow(/duplicate key|unique constraint/i)
      })
    }
  )
})
