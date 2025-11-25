/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Unique Field Property
 *
 * Source: specs/app/tables/field-types/common/unique/unique.schema.json
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Unique Field Property', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test.fixme(
    'APP-FIELD-UNIQUE-001: should prevent duplicate values when field has unique: true',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      // GIVEN: field with unique: true
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_users',
            name: 'users',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'email', type: 'email', unique: true, required: true },
              { name: 'name', type: 'single-line-text' },
            ],
          },
        ],
      })

      await executeQuery(["INSERT INTO users (email, name) VALUES ('alice@example.com', 'Alice')"])

      // WHEN: field migration creates UNIQUE constraint
      // THEN: PostgreSQL prevents duplicate values in column
      const uniqueConstraint = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='users' AND constraint_type='UNIQUE' AND constraint_name LIKE '%email%'"
      )
      expect(uniqueConstraint.count).toBe(1)

      // Duplicate value should be rejected
      await expect(
        executeQuery(
          "INSERT INTO users (email, name) VALUES ('alice@example.com', 'Alice Duplicate')"
        )
      ).rejects.toThrow(/duplicate key value violates unique constraint/)

      // Different value should succeed
      const validInsert = await executeQuery(
        "INSERT INTO users (email, name) VALUES ('bob@example.com', 'Bob') RETURNING email"
      )
      expect(validInsert.email).toBe('bob@example.com')
    }
  )

  test.fixme(
    'APP-FIELD-UNIQUE-002: should allow duplicate values when field has unique: false (default)',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      // GIVEN: field with unique: false (default)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_products',
            name: 'products',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'name', type: 'single-line-text', required: true },
              { name: 'category', type: 'single-line-text', unique: false },
            ],
          },
        ],
      })

      await executeQuery([
        "INSERT INTO products (name, category) VALUES ('Product 1', 'Electronics'), ('Product 2', 'Electronics')",
      ])

      // WHEN: field migration creates column without UNIQUE constraint
      // THEN: PostgreSQL allows duplicate values in column
      const noUniqueConstraint = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='products' AND constraint_type='UNIQUE' AND constraint_name LIKE '%category%'"
      )
      expect(noUniqueConstraint.count).toBe(0)

      // Duplicate values should be allowed
      const duplicatesExist = await executeQuery(
        "SELECT COUNT(*) as count FROM products WHERE category = 'Electronics'"
      )
      expect(duplicatesExist.count).toBe(2)

      // Additional duplicate should succeed
      const additionalDuplicate = await executeQuery(
        "INSERT INTO products (name, category) VALUES ('Product 3', 'Electronics') RETURNING id"
      )
      expect(additionalDuplicate.id).toBe(3)
    }
  )

  test.fixme(
    'APP-FIELD-UNIQUE-003: should fail migration when attempting to add UNIQUE constraint with existing duplicates',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      // GIVEN: unique field with existing duplicate values
      await executeQuery([
        'CREATE TABLE accounts (id SERIAL PRIMARY KEY, username VARCHAR(255))',
        "INSERT INTO accounts (username) VALUES ('alice'), ('bob'), ('alice')",
      ])

      // WHEN: attempting to add UNIQUE constraint
      const currentlyNonUnique = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='accounts' AND constraint_type='UNIQUE'"
      )
      expect(currentlyNonUnique.count).toBe(0)

      const duplicatesExist = await executeQuery(
        'SELECT username, COUNT(*) as count FROM accounts GROUP BY username HAVING COUNT(*) > 1'
      )
      expect(duplicatesExist).toEqual({ username: 'alice', count: 2 })

      // THEN: PostgreSQL migration fails if existing duplicates present
      await expect(
        executeQuery(
          'ALTER TABLE accounts ADD CONSTRAINT accounts_username_unique UNIQUE (username)'
        )
      ).rejects.toThrow(/could not create unique index/)
    }
  )

  test.fixme(
    'APP-FIELD-UNIQUE-004: should automatically create index for efficient lookups when UNIQUE constraint is added',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      // GIVEN: unique constraint creates automatic index
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_sessions',
            name: 'sessions',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'token', type: 'single-line-text', unique: true, required: true },
            ],
          },
        ],
      })

      await executeQuery(["INSERT INTO sessions (token) VALUES ('abc123'), ('def456')"])

      // WHEN: UNIQUE constraint is added
      // THEN: PostgreSQL automatically creates index for efficient lookups
      const uniqueConstraint = await executeQuery(
        "SELECT constraint_name FROM information_schema.table_constraints WHERE table_name='sessions' AND constraint_type='UNIQUE'"
      )
      expect(uniqueConstraint.constraint_name).toBe('sessions_token_key')

      const automaticIndex = await executeQuery(
        "SELECT indexname FROM pg_indexes WHERE tablename='sessions' AND indexname LIKE '%token%'"
      )
      expect(automaticIndex.indexname).toBe('sessions_token_key')

      const fastLookup = await executeQuery("SELECT id FROM sessions WHERE token = 'abc123'")
      expect(fastLookup.id).toBe(1)
    }
  )

  test.fixme(
    'APP-FIELD-UNIQUE-005: should allow multiple NULLs when unique field allows NULL values (SQL standard)',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      // GIVEN: unique field allows NULL values (SQL standard)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_contacts',
            name: 'contacts',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'phone', type: 'phone-number', unique: true, required: false },
            ],
          },
        ],
      })

      await executeQuery(["INSERT INTO contacts (phone) VALUES (NULL), (NULL), ('555-1234')"])

      // WHEN: multiple NULL values inserted
      // THEN: PostgreSQL allows multiple NULLs (NULL != NULL)
      const uniqueConstraintExists = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='contacts' AND constraint_type='UNIQUE'"
      )
      expect(uniqueConstraintExists.count).toBe(1)

      const multipleNulls = await executeQuery(
        'SELECT COUNT(*) as count FROM contacts WHERE phone IS NULL'
      )
      expect(multipleNulls.count).toBe(2)

      // Additional NULL should succeed
      const additionalNull = await executeQuery(
        'INSERT INTO contacts (phone) VALUES (NULL) RETURNING id'
      )
      expect(additionalNull.id).toBe(4)

      // Duplicate non-NULL should be rejected
      await expect(
        executeQuery("INSERT INTO contacts (phone) VALUES ('555-1234')")
      ).rejects.toThrow(/duplicate key value violates unique constraint/)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'user can complete full unique-field workflow',
    { tag: '@regression' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      // GIVEN: Application configured with representative unique fields
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_data',
            name: 'data',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'unique_field', type: 'single-line-text', unique: true, required: true },
              { name: 'non_unique_field', type: 'single-line-text', unique: false },
            ],
          },
        ],
      })

      // WHEN/THEN: Streamlined workflow testing integration points
      const uniqueConstraint = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='data' AND constraint_type='UNIQUE' AND constraint_name LIKE '%unique_field%'"
      )
      expect(uniqueConstraint.count).toBe(1)

      // Insert first value
      await executeQuery(
        "INSERT INTO data (unique_field, non_unique_field) VALUES ('value1', 'duplicate')"
      )

      // Duplicate unique field should fail
      await expect(
        executeQuery("INSERT INTO data (unique_field, non_unique_field) VALUES ('value1', 'other')")
      ).rejects.toThrow(/duplicate key value violates unique constraint/)

      // Duplicate non-unique field should succeed
      const validDuplicate = await executeQuery(
        "INSERT INTO data (unique_field, non_unique_field) VALUES ('value2', 'duplicate') RETURNING id"
      )
      expect(validDuplicate.id).toBe(2)
    }
  )
})
