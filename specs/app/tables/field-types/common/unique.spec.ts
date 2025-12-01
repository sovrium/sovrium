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
 * Source: src/domain/models/app/table/field-types/base-field.ts
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

  test(
    'APP-TABLES-FIELD-UNIQUE-001: should prevent duplicate values when field has unique: true',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: field with unique: true
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'email', type: 'email', unique: true, required: true },
              { id: 3, name: 'name', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      await executeQuery(["INSERT INTO users (email, name) VALUES ('alice@example.com', 'Alice')"])

      // WHEN: field migration creates UNIQUE constraint
      // THEN: PostgreSQL prevents duplicate values in column
      const uniqueConstraint = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='users' AND constraint_type='UNIQUE' AND constraint_name LIKE '%email%'"
      )
      // THEN: assertion
      expect(uniqueConstraint.count).toBe(1)

      // Duplicate value should be rejected
      // THEN: assertion
      await expect(
        executeQuery(
          "INSERT INTO users (email, name) VALUES ('alice@example.com', 'Alice Duplicate')"
        )
      ).rejects.toThrow(/duplicate key value violates unique constraint/)

      // Different value should succeed
      const validInsert = await executeQuery(
        "INSERT INTO users (email, name) VALUES ('bob@example.com', 'Bob') RETURNING email"
      )
      // THEN: assertion
      expect(validInsert.email).toBe('bob@example.com')
    }
  )

  test(
    'APP-TABLES-FIELD-UNIQUE-002: should allow duplicate values when field has unique: false (default)',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: field with unique: false (default)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'products',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text', required: true },
              { id: 3, name: 'category', type: 'single-line-text', unique: false },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
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
      // THEN: assertion
      expect(noUniqueConstraint.count).toBe(0)

      // Duplicate values should be allowed
      const duplicatesExist = await executeQuery(
        "SELECT COUNT(*) as count FROM products WHERE category = 'Electronics'"
      )
      // THEN: assertion
      expect(duplicatesExist.count).toBe(2)

      // Additional duplicate should succeed
      const additionalDuplicate = await executeQuery(
        "INSERT INTO products (name, category) VALUES ('Product 3', 'Electronics') RETURNING id"
      )
      // THEN: assertion
      expect(additionalDuplicate.id).toBe(3)
    }
  )

  test(
    'APP-TABLES-FIELD-UNIQUE-003: should fail migration when attempting to add UNIQUE constraint with existing duplicates',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: unique field with existing duplicate values
      await startServerWithSchema({
        name: 'test-app',
        tables: [],
      })
      await executeQuery([
        'DROP TABLE IF EXISTS accounts',
        'CREATE TABLE accounts (id SERIAL PRIMARY KEY, username VARCHAR(255))',
        "INSERT INTO accounts (username) VALUES ('alice'), ('bob'), ('alice')",
      ])

      // WHEN: attempting to add UNIQUE constraint
      const currentlyNonUnique = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='accounts' AND constraint_type='UNIQUE'"
      )
      // THEN: assertion
      expect(currentlyNonUnique.count).toBe(0)

      const duplicatesExist = await executeQuery(
        'SELECT username, COUNT(*) as count FROM accounts GROUP BY username HAVING COUNT(*) > 1'
      )
      // THEN: assertion
      expect(duplicatesExist.username).toBe('alice')
      expect(duplicatesExist.count).toBe(2)

      // THEN: PostgreSQL migration fails if existing duplicates present
      await expect(
        executeQuery(
          'ALTER TABLE accounts ADD CONSTRAINT accounts_username_unique UNIQUE (username)'
        )
      ).rejects.toThrow(/could not create unique index/)
    }
  )

  test(
    'APP-TABLES-FIELD-UNIQUE-004: should automatically create index for efficient lookups when UNIQUE constraint is added',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: unique constraint creates automatic index
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'sessions',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'token',
                type: 'single-line-text',
                unique: true,
                required: true,
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      await executeQuery(["INSERT INTO sessions (token) VALUES ('abc123'), ('def456')"])

      // WHEN: UNIQUE constraint is added
      // THEN: PostgreSQL automatically creates index for efficient lookups
      const uniqueConstraint = await executeQuery(
        "SELECT constraint_name FROM information_schema.table_constraints WHERE table_name='sessions' AND constraint_type='UNIQUE'"
      )
      // THEN: assertion
      expect(uniqueConstraint.constraint_name).toBe('sessions_token_key')

      const automaticIndex = await executeQuery(
        "SELECT indexname FROM pg_indexes WHERE tablename='sessions' AND indexname LIKE '%token%'"
      )
      // THEN: assertion
      expect(automaticIndex.indexname).toBe('sessions_token_key')

      const fastLookup = await executeQuery("SELECT id FROM sessions WHERE token = 'abc123'")
      // THEN: assertion
      expect(fastLookup.id).toBe(1)
    }
  )

  test(
    'APP-TABLES-FIELD-UNIQUE-005: should allow multiple NULLs when unique field allows NULL values (SQL standard)',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: unique field allows NULL values (SQL standard)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'contacts',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'phone',
                type: 'phone-number',
                unique: true,
                required: false,
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      await executeQuery(["INSERT INTO contacts (phone) VALUES (NULL), (NULL), ('555-1234')"])

      // WHEN: multiple NULL values inserted
      // THEN: PostgreSQL allows multiple NULLs (NULL != NULL)
      const uniqueConstraintExists = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='contacts' AND constraint_type='UNIQUE'"
      )
      // THEN: assertion
      expect(uniqueConstraintExists.count).toBe(1)

      const multipleNulls = await executeQuery(
        'SELECT COUNT(*) as count FROM contacts WHERE phone IS NULL'
      )
      // THEN: assertion
      expect(multipleNulls.count).toBe(2)

      // Additional NULL should succeed
      const additionalNull = await executeQuery(
        'INSERT INTO contacts (phone) VALUES (NULL) RETURNING id'
      )
      // THEN: assertion
      expect(additionalNull.id).toBe(4)

      // Duplicate non-NULL should be rejected
      // THEN: assertion
      await expect(
        executeQuery("INSERT INTO contacts (phone) VALUES ('555-1234')")
      ).rejects.toThrow(/duplicate key value violates unique constraint/)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test(
    'APP-TABLES-FIELD-UNIQUE-006: user can complete full unique-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Application configured with representative unique fields
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'data',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'unique_field',
                type: 'single-line-text',
                unique: true,
                required: true,
              },
              {
                id: 3,
                name: 'non_unique_field',
                type: 'single-line-text',
                unique: false,
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN/THEN: Streamlined workflow testing integration points
      const uniqueConstraint = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='data' AND constraint_type='UNIQUE' AND constraint_name LIKE '%unique_field%'"
      )
      // THEN: assertion
      expect(uniqueConstraint.count).toBe(1)

      // Insert first value
      await executeQuery(
        "INSERT INTO data (unique_field, non_unique_field) VALUES ('value1', 'duplicate')"
      )

      // Duplicate unique field should fail
      // THEN: assertion
      await expect(
        executeQuery("INSERT INTO data (unique_field, non_unique_field) VALUES ('value1', 'other')")
      ).rejects.toThrow(/duplicate key value violates unique constraint/)

      // Duplicate non-unique field should succeed
      const validDuplicate = await executeQuery(
        "INSERT INTO data (unique_field, non_unique_field) VALUES ('value2', 'duplicate') RETURNING id"
      )
      // THEN: assertion
      // Note: ID is 3 because failed INSERT consumed sequence value 2 (PostgreSQL behavior)
      expect(validDuplicate.id).toBe(3)
    }
  )
})
