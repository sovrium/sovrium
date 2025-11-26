/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'
/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * E2E Tests for Phone Number Field
 *
 * Source: specs/app/tables/field-types/phone-number-field/phone-number-field.schema.json
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Phone Number Field', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test.fixme(
    'APP-FIELD-PHONE-NUMBER-001: should create PostgreSQL VARCHAR(255) column for phone number storage when table configuration has phone-number field',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with phone-number field 'phone'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'contacts',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'phone', type: 'phone-number' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: field migration creates column
      // THEN: PostgreSQL VARCHAR(255) column is created for phone number storage
      const columnInfo = await executeQuery(
        "SELECT column_name, data_type, character_maximum_length, is_nullable FROM information_schema.columns WHERE table_name='contacts' AND column_name='phone'"
      )
      // THEN: assertion
      expect(columnInfo).toEqual({
        column_name: 'phone',
        data_type: 'character varying',
        character_maximum_length: 255,
        is_nullable: 'YES',
      })

      const validInsert = await executeQuery(
        "INSERT INTO contacts (phone) VALUES ('+1-555-123-4567') RETURNING phone"
      )
      // THEN: assertion
      expect(validInsert.phone).toBe('+1-555-123-4567')
    }
  )

  test.fixme(
    'APP-FIELD-PHONE-NUMBER-002: should store all formats as-is without validation when inserting international phone numbers with different formats',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'customers' with phone-number field 'mobile'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'customers',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'mobile', type: 'phone-number' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: insert international phone numbers with different formats
      // THEN: all formats are stored as-is without validation (VARCHAR accepts any text)
      const frenchInsert = await executeQuery(
        "INSERT INTO customers (mobile) VALUES ('+33 1 23 45 67 89') RETURNING mobile"
      )
      // THEN: assertion
      expect(frenchInsert.mobile).toBe('+33 1 23 45 67 89')

      const ukInsert = await executeQuery(
        "INSERT INTO customers (mobile) VALUES ('+44 20 7123 4567') RETURNING mobile"
      )
      // THEN: assertion
      expect(ukInsert.mobile).toBe('+44 20 7123 4567')

      const japaneseInsert = await executeQuery(
        "INSERT INTO customers (mobile) VALUES ('+81 3-1234-5678') RETURNING mobile"
      )
      // THEN: assertion
      expect(japaneseInsert.mobile).toBe('+81 3-1234-5678')

      const allStored = await executeQuery(
        "SELECT COUNT(*) as count FROM customers WHERE mobile LIKE '+%'"
      )
      // THEN: assertion
      expect(allStored.count).toBe(3)
    }
  )

  test.fixme(
    'APP-FIELD-PHONE-NUMBER-003: should reject duplicate phone number when table has phone-number field with unique constraint',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'users' with phone-number field 'phone' (required, unique), existing row phone='+1-555-1234'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'users',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'phone', type: 'phone-number', unique: true, required: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // GIVEN: table configuration
      await executeQuery(["INSERT INTO users (phone) VALUES ('+1-555-1234')"])

      // WHEN: attempt to insert duplicate phone='+1-555-1234'
      // THEN: PostgreSQL UNIQUE constraint rejects insertion
      const uniqueConstraint = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='users' AND constraint_type='UNIQUE' AND constraint_name LIKE '%phone%'"
      )
      // THEN: assertion
      expect(uniqueConstraint.count).toBe(1)

      // THEN: assertion
      await expect(
        executeQuery("INSERT INTO users (phone) VALUES ('+1-555-1234')")
      ).rejects.toThrow(/duplicate key value violates unique constraint/)

      const rowCount = await executeQuery('SELECT COUNT(*) as count FROM users')
      // THEN: assertion
      expect(rowCount.count).toBe(1)
    }
  )

  test.fixme(
    'APP-FIELD-PHONE-NUMBER-004: should reject NULL value when table has required phone-number field',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'support_tickets' with required phone-number field 'contact_phone'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'support_tickets',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'contact_phone', type: 'phone-number', required: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: attempt to insert NULL value for required contact_phone
      // THEN: PostgreSQL NOT NULL constraint rejects insertion
      const notNullCheck = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='support_tickets' AND column_name='contact_phone'"
      )
      // THEN: assertion
      expect(notNullCheck.is_nullable).toBe('NO')

      const validInsert = await executeQuery(
        "INSERT INTO support_tickets (contact_phone) VALUES ('+1-800-SUPPORT') RETURNING contact_phone"
      )
      // THEN: assertion
      expect(validInsert.contact_phone).toBe('+1-800-SUPPORT')

      // THEN: assertion
      await expect(
        executeQuery('INSERT INTO support_tickets (contact_phone) VALUES (NULL)')
      ).rejects.toThrow(/violates not-null constraint/)
    }
  )

  test.fixme(
    'APP-FIELD-PHONE-NUMBER-005: should create btree index for fast phone number lookups when phone-number field has indexed=true',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with phone-number field, indexed=true
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'employees',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'phone', type: 'phone-number', unique: true, indexed: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: index is created on the phone field
      // THEN: PostgreSQL btree index exists for fast phone number lookups
      const indexExists = await executeQuery(
        "SELECT indexname, tablename FROM pg_indexes WHERE indexname = 'idx_employees_phone'"
      )
      // THEN: assertion
      expect(indexExists).toEqual({
        indexname: 'idx_employees_phone',
        tablename: 'employees',
      })

      const indexDef = await executeQuery(
        "SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_employees_phone'"
      )
      // THEN: assertion
      expect(indexDef.indexdef).toBe(
        'CREATE INDEX idx_employees_phone ON public.employees USING btree (phone)'
      )
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'APP-FIELD-PHONE-NUMBER-006: user can complete full phone-number-field workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: Application configured with representative phone-number field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 6,
            name: 'data',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'phone_field',
                type: 'phone-number',
                required: true,
                unique: true,
                indexed: true,
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN/THEN: Streamlined workflow testing integration points
      const columnInfo = await executeQuery(
        "SELECT data_type, character_maximum_length, is_nullable FROM information_schema.columns WHERE table_name='data' AND column_name='phone_field'"
      )
      // THEN: assertion
      expect(columnInfo.data_type).toBe('character varying')
      expect(columnInfo.character_maximum_length).toBe(255)
      expect(columnInfo.is_nullable).toBe('NO')

      // Test international format and uniqueness
      await executeQuery("INSERT INTO data (phone_field) VALUES ('+1-555-TEST')")
      // THEN: assertion
      await expect(
        executeQuery("INSERT INTO data (phone_field) VALUES ('+1-555-TEST')")
      ).rejects.toThrow(/duplicate key value violates unique constraint/)
    }
  )
})
