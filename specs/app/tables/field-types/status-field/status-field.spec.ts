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
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_documents',
            name: 'documents',
            fields: [
              {
                name: 'workflow_status',
                type: 'status',
                options: [
                  { value: 'Draft', label: 'Draft', color: 'gray' },
                  { value: 'In Review', label: 'In Review', color: 'yellow' },
                  { value: 'Approved', label: 'Approved', color: 'green' },
                  { value: 'Published', label: 'Published', color: 'blue' },
                ],
              },
            ],
          },
        ],
      })

      const columnInfo = await executeQuery(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='documents' AND column_name='workflow_status'"
      )
      expect(columnInfo.column_name).toBe('workflow_status')
      expect(columnInfo.data_type).toBe('character varying')

      const checkCount = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.check_constraints WHERE constraint_name LIKE '%workflow_status%'"
      )
      expect(checkCount.count).toBe(1)

      const validInsert = await executeQuery(
        "INSERT INTO documents (workflow_status) VALUES ('Draft') RETURNING workflow_status"
      )
      expect(validInsert.workflow_status).toBe('Draft')
    }
  )

  test.fixme(
    'APP-STATUS-FIELD-002: should reject value not in status options via CHECK constraint',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_projects',
            name: 'projects',
            fields: [
              {
                name: 'project_status',
                type: 'status',
                options: [
                  { value: 'Planning', label: 'Planning' },
                  { value: 'Active', label: 'Active' },
                  { value: 'On Hold', label: 'On Hold' },
                  { value: 'Completed', label: 'Completed' },
                  { value: 'Cancelled', label: 'Cancelled' },
                ],
              },
            ],
          },
        ],
      })

      const planningStatus = await executeQuery(
        "INSERT INTO projects (project_status) VALUES ('Planning') RETURNING project_status"
      )
      expect(planningStatus.project_status).toBe('Planning')

      const activeStatus = await executeQuery(
        "INSERT INTO projects (project_status) VALUES ('Active') RETURNING project_status"
      )
      expect(activeStatus.project_status).toBe('Active')

      await expect(
        executeQuery("INSERT INTO projects (project_status) VALUES ('Invalid Status')")
      ).rejects.toThrow(/violates check constraint/)
    }
  )

  test.fixme(
    'APP-STATUS-FIELD-003: should enforce NOT NULL and UNIQUE constraints when required/unique',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_tasks',
            name: 'tasks',
            fields: [
              {
                name: 'task_status',
                type: 'status',
                options: [
                  { value: 'Todo', label: 'Todo' },
                  { value: 'In Progress', label: 'In Progress' },
                  { value: 'Blocked', label: 'Blocked' },
                  { value: 'Done', label: 'Done' },
                ],
                required: true,
                unique: true,
              },
            ],
          },
        ],
      })
      await executeQuery("INSERT INTO tasks (task_status) VALUES ('Todo')")

      const notNullCheck = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='tasks' AND column_name='task_status'"
      )
      expect(notNullCheck.is_nullable).toBe('NO')

      const uniqueCount = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='tasks' AND constraint_type='UNIQUE' AND constraint_name LIKE '%task_status%'"
      )
      expect(uniqueCount.count).toBe(1)

      await expect(executeQuery("INSERT INTO tasks (task_status) VALUES ('Todo')")).rejects.toThrow(
        /duplicate key value violates unique constraint/
      )

      await expect(executeQuery('INSERT INTO tasks (task_status) VALUES (NULL)')).rejects.toThrow(
        /violates not-null constraint/
      )
    }
  )

  test.fixme(
    'APP-STATUS-FIELD-004: should apply DEFAULT value when row inserted without providing value',
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
                name: 'order_status',
                type: 'status',
                options: [
                  { value: 'Pending', label: 'Pending' },
                  { value: 'Processing', label: 'Processing' },
                  { value: 'Shipped', label: 'Shipped' },
                  { value: 'Delivered', label: 'Delivered' },
                  { value: 'Cancelled', label: 'Cancelled' },
                ],
                default: 'Pending',
              },
            ],
          },
        ],
      })

      const defaultCheck = await executeQuery(
        "SELECT column_default FROM information_schema.columns WHERE table_name='orders' AND column_name='order_status'"
      )
      expect(defaultCheck.column_default).toBe("'Pending'::character varying")

      const defaultInsert = await executeQuery(
        'INSERT INTO orders (id) VALUES (DEFAULT) RETURNING order_status'
      )
      expect(defaultInsert.order_status).toBe('Pending')

      const explicitInsert = await executeQuery(
        "INSERT INTO orders (order_status) VALUES ('Shipped') RETURNING order_status"
      )
      expect(explicitInsert.order_status).toBe('Shipped')
    }
  )

  test.fixme(
    'APP-STATUS-FIELD-005: should create btree index for fast status filtering when indexed=true',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_requests',
            name: 'requests',
            fields: [
              {
                name: 'approval_status',
                type: 'status',
                options: [
                  { value: 'Submitted', label: 'Submitted' },
                  { value: 'Under Review', label: 'Under Review' },
                  { value: 'Approved', label: 'Approved' },
                  { value: 'Rejected', label: 'Rejected' },
                ],
                required: true,
                indexed: true,
              },
            ],
          },
        ],
      })

      const indexInfo = await executeQuery(
        "SELECT indexname, tablename FROM pg_indexes WHERE indexname = 'idx_requests_status'"
      )
      expect(indexInfo.indexname).toBe('idx_requests_status')
      expect(indexInfo.tablename).toBe('requests')

      const indexDef = await executeQuery(
        "SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_requests_status'"
      )
      expect(indexDef.indexdef).toBe(
        'CREATE INDEX idx_requests_status ON public.requests USING btree (approval_status)'
      )
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-STATUS-REGRESSION-001: user can complete full status-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_data',
            name: 'data',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              {
                name: 'status',
                type: 'status',
                options: [
                  { value: 'Draft', label: 'Draft' },
                  { value: 'Published', label: 'Published' },
                  { value: 'Archived', label: 'Archived' },
                ],
                required: true,
                indexed: true,
                default: 'Draft',
              },
            ],
          },
        ],
      })

      const defaultRecord = await executeQuery(
        'INSERT INTO data (id) VALUES (DEFAULT) RETURNING status'
      )
      expect(defaultRecord.status).toBe('Draft')

      await executeQuery("INSERT INTO data (status) VALUES ('Published')")
      const publishedRecord = await executeQuery('SELECT status FROM data WHERE id = 2')
      expect(publishedRecord.status).toBe('Published')

      const statusCounts = await executeQuery(
        'SELECT status, COUNT(*) as count FROM data GROUP BY status ORDER BY status'
      )
      expect(statusCounts).toContainEqual({ status: 'Draft', count: 1 })
      expect(statusCounts).toContainEqual({ status: 'Published', count: 1 })
    }
  )
})
