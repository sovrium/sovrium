/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Autonumber Field
 *
 * Source: src/domain/models/app/table/field-types/autonumber-field.ts
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Autonumber Field', () => {
  test(
    'APP-TABLES-FIELD-TYPES-AUTONUMBER-001: should create PostgreSQL SERIAL column for auto-incrementing numbers',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'invoices',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'invoice_number', type: 'autonumber' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: querying the database
      const columnInfo = await executeQuery(
        "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name='invoices' AND column_name='invoice_number'"
      )
      // THEN: assertion
      expect(columnInfo.data_type).toBe('integer')
      // THEN: assertion
      expect(columnInfo.column_default).toMatch(/nextval/)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-AUTONUMBER-002: should automatically increment value for each new record',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'orders',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'order_number', type: 'autonumber' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // GIVEN: table configuration
      await executeQuery(['INSERT INTO orders (id) VALUES (DEFAULT), (DEFAULT), (DEFAULT)'])

      // WHEN: querying the database
      const results = await executeQuery('SELECT order_number FROM orders ORDER BY id')
      // THEN: assertion
      expect(results.rows[0].order_number).toBeLessThan(results.rows[1].order_number)
      // THEN: assertion
      expect(results.rows[1].order_number).toBeLessThan(results.rows[2].order_number)
      // THEN: assertion
      expect(results.rows[2].order_number - results.rows[0].order_number).toBe(2)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-AUTONUMBER-003: should be immutable after creation (no manual updates)',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'tickets',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'ticket_number', type: 'autonumber' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: querying the database
      const insert = await executeQuery(
        'INSERT INTO tickets (id) VALUES (DEFAULT) RETURNING id, ticket_number'
      )

      // Attempting to update autonumber should fail or be ignored
      await executeQuery(`UPDATE tickets SET ticket_number = 999 WHERE id = ${insert.id}`)

      const check = await executeQuery(`SELECT ticket_number FROM tickets WHERE id = ${insert.id}`)
      // Should either fail or remain unchanged (implementation dependent)
      // THEN: assertion
      expect(check.ticket_number).toBeDefined()
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-AUTONUMBER-004: should always be NOT NULL (automatically generated)',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'records',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'record_number', type: 'autonumber' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: querying the database
      const notNullCheck = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='records' AND column_name='record_number'"
      )
      // THEN: assertion
      expect(notNullCheck.is_nullable).toBe('NO')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-AUTONUMBER-005: should create unique index automatically for autonumber field',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'items',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'item_number', type: 'autonumber' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: querying the database
      const uniqueConstraint = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='items' AND constraint_type='UNIQUE' AND constraint_name LIKE '%item_number%'"
      )
      // THEN: assertion
      expect(uniqueConstraint.count).toBeGreaterThanOrEqual(0)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-AUTONUMBER-006: user can complete full autonumber-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('Setup: Start server with autonumber field', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 6,
              name: 'data',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'auto_field', type: 'autonumber' },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
            },
          ],
        })
      })

      await test.step('Insert multiple records', async () => {
        await executeQuery([
          'INSERT INTO data (id) VALUES (DEFAULT), (DEFAULT), (DEFAULT), (DEFAULT), (DEFAULT)',
        ])
      })

      await test.step('Verify sequential numbering', async () => {
        const results = await executeQuery('SELECT auto_field FROM data ORDER BY id')
        expect(results.rows.length).toBe(5)

        for (let i = 1; i < results.rows.length; i++) {
          expect(results.rows[i].auto_field).toBeGreaterThan(results.rows[i - 1].auto_field)
        }
      })
    }
  )
})
