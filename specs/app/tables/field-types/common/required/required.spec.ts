/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'
/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * E2E Tests for Required Field Property
 *
 * Source: specs/app/tables/field-types/common/required/required.schema.json
 * Domain: app
 * Spec Count: 4
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (4 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Required Field Property', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test.fixme(
    'APP-FIELD-REQUIRED-001: should reject NULL values when field has required: true',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: field with required: true
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_users',
            name: 'users',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'name', type: 'single-line-text', required: true },
              { name: 'email', type: 'email' },
            ],
          },
        ],
      })

      await executeQuery(["INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com')"])

      // WHEN: field migration creates column with NOT NULL constraint
      // THEN: PostgreSQL rejects NULL values in column
      const notNullConstraint = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='users' AND column_name='name'"
      )
      expect(notNullConstraint.is_nullable).toBe('NO')

      // NULL value should be rejected
      await expect(
        executeQuery("INSERT INTO users (name, email) VALUES (NULL, 'null@example.com')")
      ).rejects.toThrow(/null value in column "name" violates not-null constraint/)

      // Valid value should succeed
      const validInsert = await executeQuery(
        "INSERT INTO users (name, email) VALUES ('Bob', 'bob@example.com') RETURNING name"
      )
      expect(validInsert.name).toBe('Bob')
    }
  )

  test.fixme(
    'APP-FIELD-REQUIRED-002: should allow NULL values when field has required: false (default)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: field with required: false (default)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_products',
            name: 'products',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'name', type: 'single-line-text', required: true },
              { name: 'description', type: 'long-text', required: false },
            ],
          },
        ],
      })

      await executeQuery([
        "INSERT INTO products (name, description) VALUES ('Product 1', 'Description 1')",
      ])

      // WHEN: field migration creates column without NOT NULL constraint
      // THEN: PostgreSQL allows NULL values in column
      const nullable = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='products' AND column_name='description'"
      )
      expect(nullable.is_nullable).toBe('YES')

      // NULL value should be allowed
      const nullInsert = await executeQuery(
        "INSERT INTO products (name, description) VALUES ('Product 2', NULL) RETURNING id"
      )
      expect(nullInsert.id).toBe(2)

      // Non-NULL value should also be allowed
      const nonNullInsert = await executeQuery(
        "INSERT INTO products (name, description) VALUES ('Product 3', 'Some description') RETURNING description"
      )
      expect(nonNullInsert.description).toBe('Some description')
    }
  )

  test.fixme(
    'APP-FIELD-REQUIRED-003: should fail migration when attempting to add NOT NULL constraint with existing NULL values',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: required field with existing NULL values
      await executeQuery([
        'CREATE TABLE items (id SERIAL PRIMARY KEY, title VARCHAR(255))',
        "INSERT INTO items (title) VALUES ('Item 1'), (NULL), ('Item 3')",
      ])

      // WHEN: attempting to add NOT NULL constraint
      const currentlyNullable = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='items' AND column_name='title'"
      )
      expect(currentlyNullable.is_nullable).toBe('YES')

      const nullsExist = await executeQuery(
        'SELECT COUNT(*) as count FROM items WHERE title IS NULL'
      )
      expect(nullsExist.count).toBe(1)

      // THEN: PostgreSQL migration fails if existing NULLs present
      await expect(
        executeQuery('ALTER TABLE items ALTER COLUMN title SET NOT NULL')
      ).rejects.toThrow(/column "title" contains null values/)
    }
  )

  test.fixme(
    'APP-FIELD-REQUIRED-004: should reject INSERT/UPDATE missing any required field when multiple required fields in same table',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: multiple required fields in same table
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_employees',
            name: 'employees',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'first_name', type: 'single-line-text', required: true },
              { name: 'last_name', type: 'single-line-text', required: true },
              { name: 'email', type: 'email' },
              { name: 'phone', type: 'phone-number' },
            ],
          },
        ],
      })

      await executeQuery([
        "INSERT INTO employees (first_name, last_name, email) VALUES ('Alice', 'Smith', 'alice@example.com')",
      ])

      // WHEN: all required fields must have values
      // THEN: PostgreSQL rejects INSERT/UPDATE missing any required field
      const bothNotNull = await executeQuery(
        "SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name='employees' AND column_name IN ('first_name', 'last_name') ORDER BY column_name"
      )
      expect(bothNotNull).toEqual([
        { column_name: 'first_name', is_nullable: 'NO' },
        { column_name: 'last_name', is_nullable: 'NO' },
      ])

      // Missing first_name should be rejected
      await expect(
        executeQuery("INSERT INTO employees (last_name) VALUES ('Jones')")
      ).rejects.toThrow(/null value in column "first_name" violates not-null constraint/)

      // Missing last_name should be rejected
      await expect(
        executeQuery("INSERT INTO employees (first_name) VALUES ('Bob')")
      ).rejects.toThrow(/null value in column "last_name" violates not-null constraint/)

      // All required fields provided should succeed
      const validInsert = await executeQuery(
        "INSERT INTO employees (first_name, last_name) VALUES ('Bob', 'Jones') RETURNING first_name, last_name"
      )
      expect(validInsert).toEqual({ first_name: 'Bob', last_name: 'Jones' })
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'APP-TABLES-FIELD-REQUIRED-REGRESSION-001: user can complete full required-field workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: Application configured with representative required fields
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_data',
            name: 'data',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'required_field', type: 'single-line-text', required: true },
              { name: 'optional_field', type: 'single-line-text', required: false },
            ],
          },
        ],
      })

      // WHEN/THEN: Streamlined workflow testing integration points
      const constraints = await executeQuery(
        "SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name='data' AND column_name IN ('required_field', 'optional_field') ORDER BY column_name"
      )
      expect(constraints).toEqual([
        { column_name: 'optional_field', is_nullable: 'YES' },
        { column_name: 'required_field', is_nullable: 'NO' },
      ])

      // Required field must have value
      await expect(
        executeQuery("INSERT INTO data (optional_field) VALUES ('test')")
      ).rejects.toThrow(/null value in column "required_field" violates not-null constraint/)

      // Optional field can be NULL
      const validInsert = await executeQuery(
        "INSERT INTO data (required_field, optional_field) VALUES ('value', NULL) RETURNING id"
      )
      expect(validInsert.id).toBe(1)
    }
  )
})
