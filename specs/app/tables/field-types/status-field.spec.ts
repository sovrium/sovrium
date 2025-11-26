/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Status Field
 *
 * Source: specs/app/tables/field-types/status-field/status-field.schema.json
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Status Field', () => {
  test.fixme(
    'APP-STATUS-FIELD-001: should create PostgreSQL VARCHAR column with CHECK constraint for status values',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'documents',
            fields: [
              {
                id: 1,
                name: 'workflow_status',
                type: 'status',
                options: [
                  { value: 'Draft', color: '#6B7280' },
                  { value: 'In Review', color: '#F59E0B' },
                  { value: 'Approved', color: '#10B981' },
                  { value: 'Published', color: '#3B82F6' },
                ],
              },
            ],
          },
        ],
      })

      // WHEN: executing query
      const columnInfo = await executeQuery(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='documents' AND column_name='workflow_status'"
      )
      // THEN: assertion
      expect(columnInfo.column_name).toBe('workflow_status')
      // THEN: assertion
      expect(columnInfo.data_type).toBe('character varying')

      // WHEN: executing query
      const checkCount = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.check_constraints WHERE constraint_name LIKE '%workflow_status%'"
      )
      // THEN: assertion
      expect(checkCount.count).toBe(1)

      // WHEN: executing query
      const validInsert = await executeQuery(
        "INSERT INTO documents (workflow_status) VALUES ('Draft') RETURNING workflow_status"
      )
      // THEN: assertion
      expect(validInsert.workflow_status).toBe('Draft')
    }
  )

  test.fixme(
    'APP-STATUS-FIELD-002: should reject value not in status options via CHECK constraint',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'projects',
            fields: [
              {
                id: 1,
                name: 'project_status',
                type: 'status',
                options: [
                  { value: 'Planning' },
                  { value: 'Active' },
                  { value: 'On Hold' },
                  { value: 'Completed' },
                  { value: 'Cancelled' },
                ],
              },
            ],
          },
        ],
      })

      // WHEN: executing query
      const planningStatus = await executeQuery(
        "INSERT INTO projects (project_status) VALUES ('Planning') RETURNING project_status"
      )
      // THEN: assertion
      expect(planningStatus.project_status).toBe('Planning')

      // WHEN: executing query
      const activeStatus = await executeQuery(
        "INSERT INTO projects (project_status) VALUES ('Active') RETURNING project_status"
      )
      // THEN: assertion
      expect(activeStatus.project_status).toBe('Active')

      // THEN: assertion
      await expect(
        executeQuery("INSERT INTO projects (project_status) VALUES ('Invalid Status')")
      ).rejects.toThrow(/violates check constraint/)
    }
  )

  test.fixme(
    'APP-STATUS-FIELD-003: should enforce NOT NULL and UNIQUE constraints when required/unique',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'tasks',
            fields: [
              {
                id: 1,
                name: 'task_status',
                type: 'status',
                options: [
                  { value: 'Todo' },
                  { value: 'In Progress' },
                  { value: 'Blocked' },
                  { value: 'Done' },
                ],
                required: true,
                unique: true,
              },
            ],
          },
        ],
      })
      // WHEN: executing query
      await executeQuery("INSERT INTO tasks (task_status) VALUES ('Todo')")

      // WHEN: executing query
      const notNullCheck = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='tasks' AND column_name='task_status'"
      )
      // THEN: assertion
      expect(notNullCheck.is_nullable).toBe('NO')

      // WHEN: executing query
      const uniqueCount = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='tasks' AND constraint_type='UNIQUE' AND constraint_name LIKE '%task_status%'"
      )
      // THEN: assertion
      expect(uniqueCount.count).toBe(1)

      // WHEN: executing query
      await expect(executeQuery("INSERT INTO tasks (task_status) VALUES ('Todo')")).rejects.toThrow(
        /duplicate key value violates unique constraint/
      )

      // WHEN: executing query
      await expect(executeQuery('INSERT INTO tasks (task_status) VALUES (NULL)')).rejects.toThrow(
        /violates not-null constraint/
      )
    }
  )

  test.fixme(
    'APP-STATUS-FIELD-004: should apply DEFAULT value when row inserted without providing value',
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
                name: 'order_status',
                type: 'status',
                options: [
                  { value: 'Pending' },
                  { value: 'Processing' },
                  { value: 'Shipped' },
                  { value: 'Delivered' },
                  { value: 'Cancelled' },
                ],
                default: 'Pending',
              },
            ],
          },
        ],
      })

      // WHEN: executing query
      const defaultCheck = await executeQuery(
        "SELECT column_default FROM information_schema.columns WHERE table_name='orders' AND column_name='order_status'"
      )
      // THEN: assertion
      expect(defaultCheck.column_default).toBe("'Pending'::character varying")

      // WHEN: executing query
      const defaultInsert = await executeQuery(
        'INSERT INTO orders (id) VALUES (DEFAULT) RETURNING order_status'
      )
      // THEN: assertion
      expect(defaultInsert.order_status).toBe('Pending')

      // WHEN: executing query
      const explicitInsert = await executeQuery(
        "INSERT INTO orders (order_status) VALUES ('Shipped') RETURNING order_status"
      )
      // THEN: assertion
      expect(explicitInsert.order_status).toBe('Shipped')
    }
  )

  test.fixme(
    'APP-STATUS-FIELD-005: should create btree index for fast status filtering when indexed=true',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'requests',
            fields: [
              {
                id: 1,
                name: 'approval_status',
                type: 'status',
                options: [
                  { value: 'Submitted' },
                  { value: 'Under Review' },
                  { value: 'Approved' },
                  { value: 'Rejected' },
                ],
                required: true,
                indexed: true,
              },
            ],
          },
        ],
      })

      // WHEN: executing query
      const indexInfo = await executeQuery(
        "SELECT indexname, tablename FROM pg_indexes WHERE indexname = 'idx_requests_status'"
      )
      // THEN: assertion
      expect(indexInfo.indexname).toBe('idx_requests_status')
      // THEN: assertion
      expect(indexInfo.tablename).toBe('requests')

      // WHEN: executing query
      const indexDef = await executeQuery(
        "SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_requests_status'"
      )
      // THEN: assertion
      expect(indexDef.indexdef).toBe(
        'CREATE INDEX idx_requests_status ON public.requests USING btree (approval_status)'
      )
    }
  )

  test.fixme(
    'APP-STATUS-FIELD-006: user can complete full status-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
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
                name: 'status',
                type: 'status',
                options: [{ value: 'Draft' }, { value: 'Published' }, { value: 'Archived' }],
                required: true,
                indexed: true,
                default: 'Draft',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: executing query
      const defaultRecord = await executeQuery(
        'INSERT INTO data (id) VALUES (DEFAULT) RETURNING status'
      )
      // THEN: assertion
      expect(defaultRecord.status).toBe('Draft')

      // WHEN: executing query
      await executeQuery("INSERT INTO data (status) VALUES ('Published')")
      // WHEN: executing query
      const publishedRecord = await executeQuery('SELECT status FROM data WHERE id = 2')
      // THEN: assertion
      expect(publishedRecord.status).toBe('Published')

      // WHEN: executing query
      const statusCounts = await executeQuery(
        'SELECT status, COUNT(*) as count FROM data GROUP BY status ORDER BY status'
      )
      // THEN: assertion
      expect(statusCounts).toContainEqual({ status: 'Draft', count: 1 })
      // THEN: assertion
      expect(statusCounts).toContainEqual({ status: 'Published', count: 1 })
    }
  )
})
