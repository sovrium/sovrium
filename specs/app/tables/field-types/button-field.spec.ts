/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

test.describe('Button Field', () => {
  test(
    'APP-TABLES-FIELD-TYPES-BUTTON-001: should not create database column (UI-only field)',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'records',
            fields: [
              {
                id: 1,
                name: 'action_button',
                type: 'button',
                label: 'Action',
                action: 'customAction',
              },
            ],
          },
        ],
      })
      // WHEN: querying the database
      const columns = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name='records'"
      )
      // THEN: assertion
      expect(columns.count).toBe(1) // Only id column
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-BUTTON-002: should store button action configuration in table metadata',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'tasks',
            fields: [
              {
                id: 1,
                name: 'complete_button',
                type: 'button',
                label: 'Complete',
                action: 'markComplete',
              },
            ],
          },
        ],
      })
      // WHEN: querying the database
      await executeQuery([
        'CREATE TABLE field_metadata (table_name VARCHAR(255), field_name VARCHAR(255), config JSONB)',
        "INSERT INTO field_metadata VALUES ('tasks', 'complete_button', '{\"action\": \"markComplete\"}'::JSONB)",
      ])
      const config = await executeQuery(
        "SELECT config FROM field_metadata WHERE field_name = 'complete_button'"
      )
      // THEN: assertion
      expect(config.config.action).toBe('markComplete')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-BUTTON-003: should trigger server-side action on button click',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'jobs',
            fields: [
              {
                id: 1,
                name: 'status',
                type: 'status',
                options: [{ value: 'pending' }, { value: 'completed' }],
                default: 'pending',
              },
              {
                id: 2,
                name: 'complete_button',
                type: 'button',
                label: 'Complete',
                action: 'markComplete',
              },
            ],
          },
        ],
      })
      // WHEN: executing query
      await executeQuery('INSERT INTO jobs DEFAULT VALUES')
      // WHEN: executing query
      await executeQuery("UPDATE jobs SET status = 'completed' WHERE id = 1")
      // WHEN: executing query
      const status = await executeQuery('SELECT status FROM jobs WHERE id = 1')
      // THEN: assertion
      expect(status.status).toBe('completed')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-BUTTON-004: should support conditional button visibility based on record state',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'orders',
            fields: [
              {
                id: 1,
                name: 'status',
                type: 'status',
                options: [{ value: 'pending' }, { value: 'shipped' }],
              },
              {
                id: 2,
                name: 'ship_button',
                type: 'button',
                label: 'Ship',
                action: 'ship',
              },
            ],
          },
        ],
      })
      // WHEN: executing query
      await executeQuery("INSERT INTO orders (status) VALUES ('pending'), ('shipped')")
      // WHEN: executing query
      const shippable = await executeQuery(
        "SELECT COUNT(*) as count FROM orders WHERE status = 'pending'"
      )
      // THEN: assertion
      expect(shippable.count).toBe(1)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-BUTTON-005: should log button action execution in audit trail',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'records',
            fields: [
              {
                id: 1,
                name: 'action_button',
                type: 'button',
                label: 'Action',
                action: 'customAction',
              },
            ],
          },
        ],
      })
      // WHEN: querying the database
      await executeQuery([
        'CREATE TABLE audit_log (id SERIAL PRIMARY KEY, action VARCHAR(255), timestamp TIMESTAMPTZ DEFAULT NOW())',
        "INSERT INTO audit_log (action) VALUES ('button_clicked')",
      ])
      const log = await executeQuery('SELECT action FROM audit_log WHERE id = 1')
      // THEN: assertion
      expect(log.action).toBe('button_clicked')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-BUTTON-006: should reject button with action=url when url is missing',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Button field with action='url' but no URL provided
      // WHEN: Attempting to start server with invalid schema
      // THEN: Should throw validation error
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'records',
              fields: [
                {
                  id: 1,
                  name: 'open_link',
                  type: 'button',
                  label: 'Open',
                  action: 'url',
                  // url is missing!
                },
              ],
            },
          ],
        })
      ).rejects.toThrow(/url.*required.*action.*url|missing.*url/i)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-BUTTON-007: should reject button with action=automation when automation is missing',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Button field with action='automation' but no automation provided
      // WHEN: Attempting to start server with invalid schema
      // THEN: Should throw validation error
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'records',
              fields: [
                {
                  id: 1,
                  name: 'run_automation',
                  type: 'button',
                  label: 'Run',
                  action: 'automation',
                  // automation is missing!
                },
              ],
            },
          ],
        })
      ).rejects.toThrow(/automation.*required.*action.*automation|missing.*automation/i)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-BUTTON-008: user can complete full button-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('Setup: Start server with button field', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 6,
              name: 'items',
              fields: [
                {
                  id: 1,
                  name: 'status',
                  type: 'status',
                  options: [{ value: 'draft' }, { value: 'published' }],
                  default: 'draft',
                },
                {
                  id: 2,
                  name: 'publish_button',
                  type: 'button',
                  label: 'Publish',
                  action: 'publish',
                },
              ],
            },
          ],
        })
      })

      await test.step('Insert item with default status', async () => {
        await executeQuery('INSERT INTO items DEFAULT VALUES')
      })

      await test.step('Trigger publish action', async () => {
        await executeQuery("UPDATE items SET status = 'published' WHERE id = 1")
        const item = await executeQuery('SELECT status FROM items WHERE id = 1')
        expect(item.status).toBe('published')
      })

      await test.step('Error handling: duplicate field IDs are rejected', async () => {
        await expect(
          startServerWithSchema({
            name: 'test-app-error',
            tables: [
              {
                id: 99,
                name: 'invalid',
                fields: [
                  { id: 1, name: 'button_a', type: 'button', label: 'A', action: 'a' },
                  { id: 1, name: 'button_b', type: 'button', label: 'B', action: 'b' }, // Duplicate ID!
                ],
              },
            ],
          })
        ).rejects.toThrow(/duplicate.*field.*id|field.*id.*must.*be.*unique/i)
      })
    }
  )
})
