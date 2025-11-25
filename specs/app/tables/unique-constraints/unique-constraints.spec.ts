/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures.ts'

/**
 * E2E Tests for Unique Constraints
 *
 * Source: specs/app/tables/unique-constraints/unique-constraints.schema.json
 * Domain: app
 * Spec Count: 7
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

  test.fixme(
    'APP-TABLES-UNIQUECONSTRAINTS-001: should reject with unique constraint violation error when attempting to insert duplicate combination',
    { tag: '@spec' },
    async ({ executeQuery }) => {
      // GIVEN: table with composite unique constraint on (email, tenant_id)
      // WHEN: attempting to insert duplicate combination
      await executeQuery(
        `CREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR(255), tenant_id INTEGER, CONSTRAINT uq_user_email_tenant UNIQUE (email, tenant_id))`
      )
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
      expect(result.rows[0]).toMatchObject({ id: 2 })
    }
  )

  test.fixme(
    'APP-TABLES-UNIQUECONSTRAINTS-002: should allow duplicates without constraint when table has empty array',
    { tag: '@spec' },
    async ({ executeQuery }) => {
      // GIVEN: table without unique constraints (empty array)
      // WHEN: inserting duplicate values
      await executeQuery(
        `CREATE TABLE products (id SERIAL PRIMARY KEY, sku VARCHAR(50), name VARCHAR(255))`
      )
      await executeQuery(`INSERT INTO products (sku, name) VALUES ('ABC123', 'Widget')`)

      // THEN: PostgreSQL allows duplicates without constraint

      // Duplicate SKU allowed when no unique constraint
      const result = await executeQuery(
        `INSERT INTO products (sku, name) VALUES ('ABC123', 'Different Widget') RETURNING id`
      )
      expect(result.rows[0]).toMatchObject({ id: 2 })
    }
  )

  test.fixme(
    'APP-TABLES-UNIQUECONSTRAINTS-FIELDS-001: should create composite unique index with 2 fields (minimum required)',
    { tag: '@spec' },
    async ({ executeQuery }) => {
      // GIVEN: unique constraint with 2 fields (minimum required)
      // WHEN: creating constraint on (last_name, first_name)
      await executeQuery(
        `CREATE TABLE contacts (id SERIAL PRIMARY KEY, first_name VARCHAR(255), last_name VARCHAR(255), CONSTRAINT uq_contacts_name UNIQUE (last_name, first_name))`
      )

      // THEN: PostgreSQL creates composite unique index

      // Constraint created successfully
      const constraint = await executeQuery(
        `SELECT conname, contype FROM pg_constraint WHERE conname = 'uq_contacts_name'`
      )
      expect(constraint.rows[0]).toMatchObject({ conname: 'uq_contacts_name', contype: 'u' })

      // Constraint enforces uniqueness on both fields
      const insert = await executeQuery(
        `INSERT INTO contacts (first_name, last_name) VALUES ('John', 'Doe'), ('John', 'Smith'), ('Jane', 'Doe') RETURNING id`
      )
      expect(insert.rows[0]).toMatchObject({ id: 3 })
    }
  )

  test.fixme(
    'APP-TABLES-UNIQUECONSTRAINTS-FIELDS-002: should create multi-column unique index with 3+ fields',
    { tag: '@spec' },
    async ({ executeQuery }) => {
      // GIVEN: unique constraint with 3+ fields
      // WHEN: creating constraint on (country, state, city)
      await executeQuery(
        `CREATE TABLE locations (id SERIAL PRIMARY KEY, country VARCHAR(100), state VARCHAR(100), city VARCHAR(100), CONSTRAINT uq_location UNIQUE (country, state, city))`
      )
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
      expect(result.rows[0]).toMatchObject({ id: 2 })
    }
  )

  test.fixme(
    'APP-TABLES-UNIQUECONSTRAINTS-NAME-001: should accept constraint name matching pattern when creating unique constraint with valid name',
    { tag: '@spec' },
    async ({ executeQuery }) => {
      // GIVEN: constraint name matching pattern '^uq_[a-z][a-z0-9_]*$'
      // WHEN: creating unique constraint with valid name
      await executeQuery(
        `CREATE TABLE items (id SERIAL PRIMARY KEY, code VARCHAR(50), category VARCHAR(50), CONSTRAINT uq_item_code_category UNIQUE (code, category))`
      )

      // THEN: PostgreSQL accepts constraint name

      // Constraint created with snake_case name
      const constraint = await executeQuery(
        `SELECT conname FROM pg_constraint WHERE conname = 'uq_item_code_category'`
      )
      expect(constraint.rows[0]).toMatchObject({ conname: 'uq_item_code_category' })
    }
  )

  test.fixme(
    'APP-TABLES-UNIQUECONSTRAINTS-NAME-002: should accept but lowercase the name when constraint name has invalid characters',
    { tag: '@spec' },
    async ({ executeQuery }) => {
      // GIVEN: constraint name with invalid characters (spaces, uppercase)
      // WHEN: attempting to create constraint
      await executeQuery(
        `CREATE TABLE test_items (id SERIAL PRIMARY KEY, field1 VARCHAR(50), field2 VARCHAR(50), CONSTRAINT "UQ_TEST" UNIQUE (field1, field2))`
      )

      // THEN: PostgreSQL accepts but lowercases the name

      // PostgreSQL stores constraint name in lowercase
      const constraint = await executeQuery(
        `SELECT conname FROM pg_constraint WHERE conname = 'UQ_TEST' OR conname = 'uq_test'`
      )
      expect(constraint.rows[0]).toMatchObject({ conname: 'UQ_TEST' })
    }
  )

  test.fixme(
    'APP-TABLES-UNIQUECONSTRAINTS-NAME-003: should preserve constraint name exactly as created when querying metadata',
    { tag: '@spec' },
    async ({ executeQuery }) => {
      // GIVEN: unique constraint with specific name
      // WHEN: querying constraint metadata
      await executeQuery(
        `CREATE TABLE preserved_names (id SERIAL PRIMARY KEY, col1 VARCHAR(50), col2 VARCHAR(50), CONSTRAINT uq_preserved_test UNIQUE (col1, col2))`
      )

      // THEN: constraint name is preserved exactly as created

      // Constraint name retrieved matches original
      const constraint = await executeQuery(
        `SELECT conname FROM pg_constraint WHERE conrelid = 'preserved_names'::regclass AND contype = 'u'`
      )
      expect(constraint.rows[0]).toMatchObject({ conname: 'uq_preserved_test' })
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'user can complete full Unique Constraints workflow',
    { tag: '@regression' },
    async ({ executeQuery }) => {
      // GIVEN: Database with representative unique constraint configurations
      await executeQuery(
        `CREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR(255), tenant_id INTEGER, CONSTRAINT uq_user_email_tenant UNIQUE (email, tenant_id))`
      )
      await executeQuery(
        `CREATE TABLE products (id SERIAL PRIMARY KEY, sku VARCHAR(50), variant_id INTEGER, CONSTRAINT uq_product_sku_variant UNIQUE (sku, variant_id))`
      )

      // WHEN/THEN: Execute representative workflow

      // 1. Composite unique constraints enforce uniqueness on combinations
      await executeQuery(`INSERT INTO users (email, tenant_id) VALUES ('alice@example.com', 1)`)
      await expect(
        executeQuery(`INSERT INTO users (email, tenant_id) VALUES ('alice@example.com', 1)`)
      ).rejects.toThrow(/unique constraint/)

      // 2. Same value allowed in different combination
      const user2 = await executeQuery(
        `INSERT INTO users (email, tenant_id) VALUES ('alice@example.com', 2) RETURNING id`
      )
      expect(user2.rows[0]).toMatchObject({ id: 2 })

      // 3. Multiple unique constraints on different tables
      await executeQuery(`INSERT INTO products (sku, variant_id) VALUES ('ABC123', 1)`)
      await expect(
        executeQuery(`INSERT INTO products (sku, variant_id) VALUES ('ABC123', 1)`)
      ).rejects.toThrow(/unique constraint/)

      // 4. Constraint names are retrievable
      const constraints = await executeQuery(
        `SELECT conname FROM pg_constraint WHERE conname LIKE 'uq_%' ORDER BY conname`
      )
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
