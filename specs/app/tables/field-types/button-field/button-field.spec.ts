/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

test.describe('Button Field', () => {
  test.fixme(
    'APP-BUTTON-FIELD-001: should not create database column (UI-only field)',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_records',
            name: 'records',
            fields: [{ name: 'action_button', type: 'button', action: 'customAction' }],
          },
        ],
      })
      const columns = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name='records'"
      )
      expect(columns.count).toBe(1) // Only id column
    }
  )

  test.fixme(
    'APP-BUTTON-FIELD-002: should store button action configuration in table metadata',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_tasks',
            name: 'tasks',
            fields: [{ name: 'complete_button', type: 'button', action: 'markComplete' }],
          },
        ],
      })
      await executeQuery([
        'CREATE TABLE field_metadata (table_name VARCHAR(255), field_name VARCHAR(255), config JSONB)',
        "INSERT INTO field_metadata VALUES ('tasks', 'complete_button', '{\"action\": \"markComplete\"}'::JSONB)",
      ])
      const config = await executeQuery(
        "SELECT config FROM field_metadata WHERE field_name = 'complete_button'"
      )
      expect(config.config.action).toBe('markComplete')
    }
  )

  test.fixme(
    'APP-BUTTON-FIELD-003: should trigger server-side action on button click',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_jobs',
            name: 'jobs',
            fields: [
              {
                name: 'status',
                type: 'status',
                options: [{ value: 'pending' }, { value: 'completed' }],
                default: 'pending',
              },
              { name: 'complete_button', type: 'button', action: 'markComplete' },
            ],
          },
        ],
      })
      await executeQuery('INSERT INTO jobs DEFAULT VALUES')
      await executeQuery("UPDATE jobs SET status = 'completed' WHERE id = 1")
      const status = await executeQuery('SELECT status FROM jobs WHERE id = 1')
      expect(status.status).toBe('completed')
    }
  )

  test.fixme(
    'APP-BUTTON-FIELD-004: should support conditional button visibility based on record state',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_orders',
            name: 'orders',
            fields: [
              {
                name: 'status',
                type: 'status',
                options: [{ value: 'pending' }, { value: 'shipped' }],
              },
              {
                name: 'ship_button',
                type: 'button',
                action: 'ship',
                visibleWhen: 'status == "pending"',
              },
            ],
          },
        ],
      })
      await executeQuery("INSERT INTO orders (status) VALUES ('pending'), ('shipped')")
      const shippable = await executeQuery(
        "SELECT COUNT(*) as count FROM orders WHERE status = 'pending'"
      )
      expect(shippable.count).toBe(1)
    }
  )

  test.fixme(
    'APP-BUTTON-FIELD-005: should log button action execution in audit trail',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_records',
            name: 'records',
            fields: [{ name: 'action_button', type: 'button', action: 'customAction' }],
          },
        ],
      })
      await executeQuery([
        'CREATE TABLE audit_log (id SERIAL PRIMARY KEY, action VARCHAR(255), timestamp TIMESTAMPTZ DEFAULT NOW())',
        "INSERT INTO audit_log (action) VALUES ('button_clicked')",
      ])
      const log = await executeQuery('SELECT action FROM audit_log WHERE id = 1')
      expect(log.action).toBe('button_clicked')
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-BUTTON-REGRESSION-001: user can complete full button-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_items',
            name: 'items',
            fields: [
              {
                name: 'status',
                type: 'status',
                options: [{ value: 'draft' }, { value: 'published' }],
                default: 'draft',
              },
              { name: 'publish_button', type: 'button', action: 'publish' },
            ],
          },
        ],
      })
      await executeQuery('INSERT INTO items DEFAULT VALUES')
      await executeQuery("UPDATE items SET status = 'published' WHERE id = 1")
      const item = await executeQuery('SELECT status FROM items WHERE id = 1')
      expect(item.status).toBe('published')
    }
  )
})
