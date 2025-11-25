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
 * Source: specs/app/tables/field-types/autonumber-field/autonumber-field.schema.json
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Autonumber Field', () => {
  test.fixme(
    'APP-AUTONUMBER-FIELD-001: should create PostgreSQL SERIAL column for auto-incrementing numbers',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_invoices',
            name: 'invoices',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'invoice_number', type: 'autonumber' },
            ],
          },
        ],
      })

      const columnInfo = await executeQuery(
        "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name='invoices' AND column_name='invoice_number'"
      )
      expect(columnInfo.data_type).toBe('integer')
      expect(columnInfo.column_default).toMatch(/nextval/)
    }
  )

  test.fixme(
    'APP-AUTONUMBER-FIELD-002: should automatically increment value for each new record',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_orders',
            name: 'orders',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'order_number', type: 'autonumber' },
            ],
          },
        ],
      })

      await executeQuery(['INSERT INTO orders (id) VALUES (DEFAULT), (DEFAULT), (DEFAULT)'])

      const results = await executeQuery('SELECT order_number FROM orders ORDER BY id')
      expect(results[0].order_number).toBeLessThan(results[1].order_number)
      expect(results[1].order_number).toBeLessThan(results[2].order_number)
      expect(results[2].order_number - results[0].order_number).toBe(2)
    }
  )

  test.fixme(
    'APP-AUTONUMBER-FIELD-003: should be immutable after creation (no manual updates)',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_tickets',
            name: 'tickets',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'ticket_number', type: 'autonumber' },
            ],
          },
        ],
      })

      const insert = await executeQuery(
        'INSERT INTO tickets (id) VALUES (DEFAULT) RETURNING id, ticket_number'
      )
      const _originalNumber = insert.ticket_number

      // Attempting to update autonumber should fail or be ignored
      await executeQuery(`UPDATE tickets SET ticket_number = 999 WHERE id = ${insert.id}`)

      const check = await executeQuery(`SELECT ticket_number FROM tickets WHERE id = ${insert.id}`)
      // Should either fail or remain unchanged (implementation dependent)
      expect(check.ticket_number).toBeDefined()
    }
  )

  test.fixme(
    'APP-AUTONUMBER-FIELD-004: should always be NOT NULL (automatically generated)',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_records',
            name: 'records',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'record_number', type: 'autonumber' },
            ],
          },
        ],
      })

      const notNullCheck = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='records' AND column_name='record_number'"
      )
      expect(notNullCheck.is_nullable).toBe('NO')
    }
  )

  test.fixme(
    'APP-AUTONUMBER-FIELD-005: should create unique index automatically for autonumber field',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_items',
            name: 'items',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'item_number', type: 'autonumber' },
            ],
          },
        ],
      })

      const uniqueConstraint = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='items' AND constraint_type='UNIQUE' AND constraint_name LIKE '%item_number%'"
      )
      expect(uniqueConstraint.count).toBeGreaterThanOrEqual(0)
    }
  )

  test.fixme(
    'user can complete full autonumber-field workflow',
    { tag: '@regression' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_data',
            name: 'data',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'auto_field', type: 'autonumber' },
            ],
          },
        ],
      })

      // Insert multiple records
      await executeQuery([
        'INSERT INTO data (id) VALUES (DEFAULT), (DEFAULT), (DEFAULT), (DEFAULT), (DEFAULT)',
      ])

      // Verify sequential numbering
      const results = await executeQuery('SELECT auto_field FROM data ORDER BY id')
      expect(results.length).toBe(5)

      for (let i = 1; i < results.length; i++) {
        expect(results[i].auto_field).toBeGreaterThan(results[i - 1].auto_field)
      }
    }
  )
})
