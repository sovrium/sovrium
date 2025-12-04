/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Unique Constraints
 *
 * Source: src/domain/models/app/table/index.ts
 * Domain: app
 * Spec Count: 9
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (7 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Validation Approach:
 * - Database assertions (executeQuery fixture)
 * - PostgreSQL unique constraint behavior (composite keys, constraint names)
 * - Constraint enforcement (duplicate rejection, multi-column uniqueness)
 */

test.describe('Unique Constraints', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test(
    'APP-TABLES-UNIQUECONSTRAINTS-001: should reject with unique constraint violation error when attempting to insert duplicate combination',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table with composite unique constraint on (email, tenant_id)
      // WHEN: attempting to insert duplicate combination
      await startServerWithSchema({
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
              },
              {
                id: 2,
                name: 'tenant_id',
                type: 'integer',
              },
            ],
            uniqueConstraints: [
              {
                name: 'uq_user_email_tenant',
                fields: ['email', 'tenant_id'],
              },
            ],
          },
        ],
      })

      await executeQuery(`INSERT INTO users (email, tenant_id) VALUES ('alice@example.com', 1)`)

      // THEN: PostgreSQL rejects with unique constraint violation error

      // Duplicate (email, tenant_id) combination rejected
      await expect(
        executeQuery(`INSERT INTO users (email, tenant_id) VALUES ('alice@example.com', 1)`)
      ).rejects.toThrow(/duplicate key value violates unique constraint "uq_user_email_tenant"/)

      // Same email with different tenant_id is allowed
      const result = await executeQuery(
        `INSERT INTO users (email, tenant_id) VALUES ('alice@example.com', 2) RETURNING id`
      )
      // THEN: assertion
      // Note: id=3 because SERIAL sequences increment even when INSERTs fail (PostgreSQL standard behavior)
      expect(result.rows[0]).toMatchObject({ id: 3 })
    }
  )

  test(
    'APP-TABLES-UNIQUECONSTRAINTS-002: should allow duplicates without constraint when table has empty array',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table without unique constraints (empty array)
      // WHEN: inserting duplicate values
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'products',
            fields: [
              {
                id: 1,
                name: 'sku',
                type: 'single-line-text',
              },
              {
                id: 2,
                name: 'name',
                type: 'single-line-text',
              },
            ],
            uniqueConstraints: [], // Empty array - no unique constraints
          },
        ],
      })

      await executeQuery(`INSERT INTO products (sku, name) VALUES ('ABC123', 'Widget')`)

      // THEN: PostgreSQL allows duplicates without constraint

      // Duplicate SKU allowed when no unique constraint
      const result = await executeQuery(
        `INSERT INTO products (sku, name) VALUES ('ABC123', 'Different Widget') RETURNING id`
      )
      // THEN: assertion
      expect(result.rows[0]).toMatchObject({ id: 2 })
    }
  )

  test(
    'APP-TABLES-UNIQUECONSTRAINTS-003: should create composite unique index with 2 fields (minimum required)',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: unique constraint with 2 fields (minimum required)
      // WHEN: creating constraint on (last_name, first_name)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'contacts',
            fields: [
              {
                id: 1,
                name: 'first_name',
                type: 'single-line-text',
              },
              {
                id: 2,
                name: 'last_name',
                type: 'single-line-text',
              },
            ],
            uniqueConstraints: [
              {
                name: 'uq_contacts_name',
                fields: ['last_name', 'first_name'],
              },
            ],
          },
        ],
      })

      // THEN: PostgreSQL creates composite unique index

      // Constraint created successfully
      const constraint = await executeQuery(
        `SELECT conname, contype FROM pg_constraint WHERE conname = 'uq_contacts_name'`
      )
      // THEN: assertion
      expect(constraint.rows[0]).toMatchObject({ conname: 'uq_contacts_name', contype: 'u' })

      // Constraint enforces uniqueness on both fields
      const insert = await executeQuery(
        `INSERT INTO contacts (first_name, last_name) VALUES ('John', 'Doe'), ('John', 'Smith'), ('Jane', 'Doe') RETURNING id`
      )
      // THEN: assertion
      expect(insert.rows[2]).toMatchObject({ id: 3 })
    }
  )

  test(
    'APP-TABLES-UNIQUECONSTRAINTS-004: should create multi-column unique index with 3+ fields',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: unique constraint with 3+ fields
      // WHEN: creating constraint on (country, state, city)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'locations',
            fields: [
              {
                id: 1,
                name: 'country',
                type: 'single-line-text',
              },
              {
                id: 2,
                name: 'state',
                type: 'single-line-text',
              },
              {
                id: 3,
                name: 'city',
                type: 'single-line-text',
              },
            ],
            uniqueConstraints: [
              {
                name: 'uq_location',
                fields: ['country', 'state', 'city'],
              },
            ],
          },
        ],
      })

      await executeQuery(
        `INSERT INTO locations (country, state, city) VALUES ('USA', 'California', 'San Francisco')`
      )

      // THEN: PostgreSQL creates multi-column unique index

      // Duplicate triple rejected
      await expect(
        executeQuery(
          `INSERT INTO locations (country, state, city) VALUES ('USA', 'California', 'San Francisco')`
        )
      ).rejects.toThrow(/duplicate key value violates unique constraint "uq_location"/)

      // Different city with same country/state allowed
      const result = await executeQuery(
        `INSERT INTO locations (country, state, city) VALUES ('USA', 'California', 'Los Angeles') RETURNING id`
      )
      // THEN: assertion
      // Note: id=3 because SERIAL sequences increment even when INSERTs fail (PostgreSQL standard behavior)
      expect(result.rows[0]).toMatchObject({ id: 3 })
    }
  )

  test(
    'APP-TABLES-UNIQUECONSTRAINTS-005: should accept constraint name matching pattern when creating unique constraint with valid name',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: constraint name matching pattern '^uq_[a-z][a-z0-9_]*$'
      // WHEN: creating unique constraint with valid name
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'items',
            fields: [
              {
                id: 1,
                name: 'code',
                type: 'single-line-text',
              },
              {
                id: 2,
                name: 'category',
                type: 'single-line-text',
              },
            ],
            uniqueConstraints: [
              {
                name: 'uq_item_code_category',
                fields: ['code', 'category'],
              },
            ],
          },
        ],
      })

      // THEN: PostgreSQL accepts constraint name

      // Constraint created with snake_case name
      const constraint = await executeQuery(
        `SELECT conname FROM pg_constraint WHERE conname = 'uq_item_code_category'`
      )
      // THEN: assertion
      expect(constraint.rows[0]).toMatchObject({ conname: 'uq_item_code_category' })
    }
  )

  test(
    'APP-TABLES-UNIQUECONSTRAINTS-006: should accept but lowercase the name when constraint name has invalid characters',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: constraint name with invalid characters (spaces, uppercase)
      // WHEN: attempting to create constraint
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 6,
            name: 'test_items',
            fields: [
              {
                id: 1,
                name: 'field1',
                type: 'single-line-text',
              },
              {
                id: 2,
                name: 'field2',
                type: 'single-line-text',
              },
            ],
            uniqueConstraints: [
              {
                name: 'UQ_TEST', // Uppercase name (will be lowercased by PostgreSQL)
                fields: ['field1', 'field2'],
              },
            ],
          },
        ],
      })

      // THEN: PostgreSQL accepts but lowercases the name

      // PostgreSQL stores constraint name in lowercase
      const constraint = await executeQuery(
        `SELECT conname FROM pg_constraint WHERE conname = 'UQ_TEST' OR conname = 'uq_test'`
      )
      // THEN: assertion
      expect(constraint.rows[0]).toMatchObject({ conname: 'uq_test' })
    }
  )

  test(
    'APP-TABLES-UNIQUECONSTRAINTS-007: should preserve constraint name exactly as created when querying metadata',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: unique constraint with specific name
      // WHEN: querying constraint metadata
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 7,
            name: 'preserved_names',
            fields: [
              {
                id: 1,
                name: 'col1',
                type: 'single-line-text',
              },
              {
                id: 2,
                name: 'col2',
                type: 'single-line-text',
              },
            ],
            uniqueConstraints: [
              {
                name: 'uq_preserved_test',
                fields: ['col1', 'col2'],
              },
            ],
          },
        ],
      })

      // THEN: constraint name is preserved exactly as created

      // Constraint name retrieved matches original
      const constraint = await executeQuery(
        `SELECT conname FROM pg_constraint WHERE conrelid = 'preserved_names'::regclass AND contype = 'u'`
      )
      // THEN: assertion
      expect(constraint.rows[0]).toMatchObject({ conname: 'uq_preserved_test' })
    }
  )

  // ============================================================================
  // Phase: Error Configuration Validation Tests (008-009)
  // ============================================================================

  test.fixme(
    'APP-TABLES-UNIQUECONSTRAINTS-008: should reject unique constraint referencing non-existent field',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Unique constraint referencing non-existent field
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
                { id: 1, name: 'name', type: 'single-line-text' },
                { id: 2, name: 'email', type: 'email' },
              ],
              uniqueConstraints: [
                {
                  name: 'uq_users_tenant_email',
                  fields: ['tenant_id', 'email'], // 'tenant_id' doesn't exist!
                },
              ],
            },
          ],
        })
      ).rejects.toThrow(
        /field.*tenant_id.*not found|unique constraint.*references.*non-existent.*field/i
      )
    }
  )

  test.fixme(
    'APP-TABLES-UNIQUECONSTRAINTS-009: should reject duplicate unique constraint names within the same table',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Table with duplicate unique constraint names
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
                { id: 1, name: 'name', type: 'single-line-text' },
                { id: 2, name: 'email', type: 'email' },
                { id: 3, name: 'phone', type: 'phone-number' },
              ],
              uniqueConstraints: [
                {
                  name: 'uq_users_contact', // Duplicate name!
                  fields: ['name', 'email'],
                },
                {
                  name: 'uq_users_contact', // Duplicate name!
                  fields: ['name', 'phone'],
                },
              ],
            },
          ],
        })
      ).rejects.toThrow(/duplicate.*constraint.*name|constraint name.*must be unique/i)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test(
    'APP-TABLES-UNIQUECONSTRAINTS-010: user can complete full Unique Constraints workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Database with representative unique constraint configurations
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 8,
            name: 'users',
            fields: [
              { id: 1, name: 'email', type: 'email' },
              { id: 2, name: 'tenant_id', type: 'integer' },
            ],
            uniqueConstraints: [
              {
                name: 'uq_user_email_tenant',
                fields: ['email', 'tenant_id'],
              },
            ],
          },
          {
            id: 9,
            name: 'products',
            fields: [
              { id: 1, name: 'sku', type: 'single-line-text' },
              { id: 2, name: 'variant_id', type: 'integer' },
            ],
            uniqueConstraints: [
              {
                name: 'uq_product_sku_variant',
                fields: ['sku', 'variant_id'],
              },
            ],
          },
        ],
      })

      // WHEN/THEN: Execute representative workflow

      // 1. Composite unique constraints enforce uniqueness on combinations
      await executeQuery(`INSERT INTO users (email, tenant_id) VALUES ('alice@example.com', 1)`)
      // THEN: assertion
      await expect(
        executeQuery(`INSERT INTO users (email, tenant_id) VALUES ('alice@example.com', 1)`)
      ).rejects.toThrow(/unique constraint/)

      // 2. Same value allowed in different combination
      const user2 = await executeQuery(
        `INSERT INTO users (email, tenant_id) VALUES ('alice@example.com', 2) RETURNING id`
      )
      // THEN: assertion
      // Note: id=3 because SERIAL sequences increment even when INSERTs fail (PostgreSQL standard behavior)
      expect(user2.rows[0]).toMatchObject({ id: 3 })

      // 3. Multiple unique constraints on different tables
      await executeQuery(`INSERT INTO products (sku, variant_id) VALUES ('ABC123', 1)`)
      // THEN: assertion
      await expect(
        executeQuery(`INSERT INTO products (sku, variant_id) VALUES ('ABC123', 1)`)
      ).rejects.toThrow(/unique constraint/)

      // 4. Constraint names are retrievable
      const constraints = await executeQuery(
        `SELECT conname FROM pg_constraint WHERE conname LIKE 'uq_%' ORDER BY conname`
      )
      // THEN: assertion
      expect(constraints.rows).toHaveLength(2)
      expect(constraints.rows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ conname: 'uq_user_email_tenant' }),
          expect.objectContaining({ conname: 'uq_product_sku_variant' }),
        ])
      )

      // Workflow completes successfully
    }
  )
})
