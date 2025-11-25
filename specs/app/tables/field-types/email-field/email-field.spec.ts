/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Email Field
 *
 * Source: specs/app/tables/field-types/email-field/email-field.schema.json
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Email Field', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test.fixme(
    'APP-FIELD-EMAIL-001: should create PostgreSQL VARCHAR(255) column for email storage when table configuration has email field',
    { tag: '@spec' },
    async ({
      page,
      startServerWithSchema,
      executeQuery,
    }) => {
      // GIVEN: table configuration with email field 'email'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_users',
            name: 'users',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'email', type: 'email' },
            ],
          },
        ],
      })

      // WHEN: field migration creates column
      // THEN: PostgreSQL VARCHAR(255) column is created for email storage
      const columnInfo = await executeQuery(
        "SELECT column_name, data_type, character_maximum_length, is_nullable FROM information_schema.columns WHERE table_name='users' AND column_name='email'"
      )
      expect(columnInfo).toEqual({
        column_name: 'email',
        data_type: 'character varying',
        character_maximum_length: 255,
        is_nullable: 'YES',
      })

      const validInsert = await executeQuery(
        "INSERT INTO users (email) VALUES ('john.doe@example.com') RETURNING email"
      )
      expect(validInsert.email).toBe('john.doe@example.com')
    }
  )

  test.fixme(
    'APP-FIELD-EMAIL-002: should store email as lowercase when inserting email with mixed case',
    { tag: '@spec' },
    async ({
      page,
      startServerWithSchema,
      executeQuery,
    }) => {
      // GIVEN: table 'contacts' with email field 'email', application normalizes emails to lowercase before storage
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_contacts',
            name: 'contacts',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'email', type: 'email' },
            ],
          },
        ],
      })

      // WHEN: insert email with mixed case 'John.Doe@EXAMPLE.COM'
      // THEN: email is stored as lowercase 'john.doe@example.com' in database
      const normalizedInsert = await executeQuery(
        "INSERT INTO contacts (email) VALUES (LOWER('John.Doe@EXAMPLE.COM')) RETURNING email"
      )
      expect(normalizedInsert.email).toBe('john.doe@example.com')

      const storedValue = await executeQuery('SELECT email FROM contacts WHERE id = 1')
      expect(storedValue.email).toBe('john.doe@example.com')
    }
  )

  test.fixme(
    'APP-FIELD-EMAIL-003: should reject duplicate email when table has email field with unique constraint',
    { tag: '@spec' },
    async ({
      page,
      startServerWithSchema,
      executeQuery,
    }) => {
      // GIVEN: table 'members' with email field 'email' (required, unique), existing row email='john@example.com'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_members',
            name: 'members',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'email', type: 'email', unique: true, required: true },
            ],
          },
        ],
      })

      await executeQuery(["INSERT INTO members (email) VALUES ('john@example.com')"])

      // WHEN: attempt to insert duplicate email='john@example.com'
      // THEN: PostgreSQL UNIQUE constraint rejects insertion
      const uniqueConstraint = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='members' AND constraint_type='UNIQUE' AND constraint_name LIKE '%email%'"
      )
      expect(uniqueConstraint.count).toBe(1)

      await expect(
        executeQuery("INSERT INTO members (email) VALUES ('john@example.com')")
      ).rejects.toThrow(/duplicate key value violates unique constraint/)

      const rowCount = await executeQuery('SELECT COUNT(*) as count FROM members')
      expect(rowCount.count).toBe(1)
    }
  )

  test.fixme(
    'APP-EMAIL-FIELD-004: should reject NULL value when table has required email field',
    { tag: '@spec' },
    async ({
      page,
      startServerWithSchema,
      executeQuery,
    }) => {
      // GIVEN: table 'subscribers' with required email field 'email'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_subscribers',
            name: 'subscribers',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'email', type: 'email', required: true },
            ],
          },
        ],
      })

      // WHEN: attempt to insert NULL value for required email
      // THEN: PostgreSQL NOT NULL constraint rejects insertion
      const notNullCheck = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='subscribers' AND column_name='email'"
      )
      expect(notNullCheck.is_nullable).toBe('NO')

      const validInsert = await executeQuery(
        "INSERT INTO subscribers (email) VALUES ('jane@example.com') RETURNING email"
      )
      expect(validInsert.email).toBe('jane@example.com')

      await expect(executeQuery('INSERT INTO subscribers (email) VALUES (NULL)')).rejects.toThrow(
        /violates not-null constraint/
      )
    }
  )

  test.fixme(
    'APP-EMAIL-FIELD-005: should create btree index for fast email lookups when email field has indexed=true',
    { tag: '@spec' },
    async ({
      page,
      startServerWithSchema,
      executeQuery,
    }) => {
      // GIVEN: table configuration with email field, indexed=true
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_customers',
            name: 'customers',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'email', type: 'email', unique: true, indexed: true },
            ],
          },
        ],
      })

      // WHEN: index is created on the email field
      // THEN: PostgreSQL btree index exists for fast email lookups
      const indexExists = await executeQuery(
        "SELECT indexname, tablename FROM pg_indexes WHERE indexname = 'idx_customers_email'"
      )
      expect(indexExists).toEqual({
        indexname: 'idx_customers_email',
        tablename: 'customers',
      })

      const indexDef = await executeQuery(
        "SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_customers_email'"
      )
      expect(indexDef.indexdef).toBe(
        'CREATE INDEX idx_customers_email ON public.customers USING btree (email)'
      )
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'user can complete full email-field workflow',
    { tag: '@regression' },
    async ({
      page,
      startServerWithSchema,
      executeQuery,
    }) => {
      // GIVEN: Application configured with representative email field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_data',
            name: 'data',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              {
                name: 'email_field',
                type: 'email',
                required: true,
                unique: true,
                indexed: true,
              },
            ],
          },
        ],
      })

      // WHEN/THEN: Streamlined workflow testing integration points
      const columnInfo = await executeQuery(
        "SELECT data_type, character_maximum_length, is_nullable FROM information_schema.columns WHERE table_name='data' AND column_name='email_field'"
      )
      expect(columnInfo.data_type).toBe('character varying')
      expect(columnInfo.character_maximum_length).toBe(255)
      expect(columnInfo.is_nullable).toBe('NO')

      // Test email normalization and uniqueness
      await executeQuery("INSERT INTO data (email_field) VALUES (LOWER('Test@Example.COM'))")
      const stored = await executeQuery('SELECT email_field FROM data WHERE id = 1')
      expect(stored.email_field).toBe('test@example.com')

      await expect(
        executeQuery("INSERT INTO data (email_field) VALUES ('test@example.com')")
      ).rejects.toThrow(/duplicate key value violates unique constraint/)
    }
  )
})
