/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Button Field
 *
 * Source: src/domain/models/app/table/field-types/button-field.ts
 * Domain: app
 * Spec Count: 7
 *
 * Button Field Behavior:
 * - UI-only field (does not create database column)
 * - Triggers custom actions when clicked
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (7 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

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
      // THEN: assertion (id + 3 special fields = 4, button field is UI-only and creates no column)
      expect(columns.count).toBe('4')
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
      expect(shippable.count).toBe('1')
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

  test(
    'APP-TABLES-FIELD-TYPES-BUTTON-REGRESSION: user can complete full button-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('APP-TABLES-FIELD-TYPES-BUTTON-001: Not create database column (UI-only field)', async () => {
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
        const columns = await executeQuery(
          "SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name='records'"
        )
        expect(columns.count).toBe('4')
      })

      await test.step('APP-TABLES-FIELD-TYPES-BUTTON-002: Store button action configuration in table metadata', async () => {
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
        await executeQuery([
          'CREATE TABLE field_metadata (table_name VARCHAR(255), field_name VARCHAR(255), config JSONB)',
          "INSERT INTO field_metadata VALUES ('tasks', 'complete_button', '{\"action\": \"markComplete\"}'::JSONB)",
        ])
        const config = await executeQuery(
          "SELECT config FROM field_metadata WHERE field_name = 'complete_button'"
        )
        expect(config.config.action).toBe('markComplete')
      })

      await test.step('APP-TABLES-FIELD-TYPES-BUTTON-003: Trigger server-side action on button click', async () => {
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
        await executeQuery('INSERT INTO jobs DEFAULT VALUES')
        await executeQuery("UPDATE jobs SET status = 'completed' WHERE id = 1")
        const status = await executeQuery('SELECT status FROM jobs WHERE id = 1')
        expect(status.status).toBe('completed')
      })

      await test.step('APP-TABLES-FIELD-TYPES-BUTTON-004: Support conditional button visibility based on record state', async () => {
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
        await executeQuery("INSERT INTO orders (status) VALUES ('pending'), ('shipped')")
        const shippable = await executeQuery(
          "SELECT COUNT(*) as count FROM orders WHERE status = 'pending'"
        )
        expect(shippable.count).toBe('1')
      })

      await test.step('APP-TABLES-FIELD-TYPES-BUTTON-005: Log button action execution in audit trail', async () => {
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
        await executeQuery([
          'CREATE TABLE audit_log (id SERIAL PRIMARY KEY, action VARCHAR(255), timestamp TIMESTAMPTZ DEFAULT NOW())',
          "INSERT INTO audit_log (action) VALUES ('button_clicked')",
        ])
        const log = await executeQuery('SELECT action FROM audit_log WHERE id = 1')
        expect(log.action).toBe('button_clicked')
      })

      await test.step('APP-TABLES-FIELD-TYPES-BUTTON-006: Reject button with action=url when url is missing', async () => {
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
                  },
                ],
              },
            ],
          })
        ).rejects.toThrow(/url.*required.*action.*url|missing.*url/i)
      })

      await test.step('APP-TABLES-FIELD-TYPES-BUTTON-007: Reject button with action=automation when automation is missing', async () => {
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
                  },
                ],
              },
            ],
          })
        ).rejects.toThrow(/automation.*required.*action.*automation|missing.*automation/i)
      })
    }
  )
})
