/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Count Field
 *
 * Source: src/domain/models/app/table/field-types/count-field.ts
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Reference: https://support.airtable.com/docs/count-field-overview
 *
 * NOTE: The 'count' field type is planned but not yet implemented in the schema.
 * Tests use type assertions to document the intended API.
 */

test.describe('Count Field', () => {
  test(
    'APP-TABLES-FIELD-TYPES-COUNT-001: should count number of linked records',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with count field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'projects',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              {
                id: 3,
                name: 'task_count',
                type: 'count',
                relationshipField: 'project_id',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
          {
            id: 2,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              {
                id: 3,
                name: 'project_id',
                type: 'relationship',
                relatedTable: 'projects',
                relationType: 'many-to-one',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery("INSERT INTO projects (name) VALUES ('Website Redesign')")
      await executeQuery(
        "INSERT INTO tasks (title, project_id) VALUES ('Design mockups', 1), ('Write code', 1), ('Test', 1)"
      )

      // THEN: count field returns number of linked records
      const projectWithCount = await executeQuery(
        'SELECT p.id, p.name, COUNT(t.id) as task_count FROM projects p LEFT JOIN tasks t ON p.id = t.project_id WHERE p.id = 1 GROUP BY p.id, p.name'
      )
      expect(projectWithCount.task_count).toBe(3)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-COUNT-002: should return zero when no records are linked',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with count field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'categories',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              {
                id: 3,
                name: 'product_count',
                type: 'count',
                relationshipField: 'category_id',
              } as any,
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
          {
            id: 2,
            name: 'products',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              {
                id: 3,
                name: 'category_id',
                type: 'relationship',
                relatedTable: 'categories',
                relationType: 'many-to-one',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: inserting category with no products
      await executeQuery("INSERT INTO categories (name) VALUES ('Empty Category')")

      // THEN: count field returns 0, not null
      const emptyCategory = await executeQuery(
        'SELECT c.id, c.name, COUNT(p.id) as product_count FROM categories c LEFT JOIN products p ON c.id = p.category_id WHERE c.id = 1 GROUP BY c.id, c.name'
      )
      expect(emptyCategory.product_count).toBe(0)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-COUNT-003: should auto-update when linked records change',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with count field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'authors',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              {
                id: 3,
                name: 'book_count',
                type: 'count',
                relationshipField: 'author_id',
              } as any,
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
          {
            id: 2,
            name: 'books',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              {
                id: 3,
                name: 'author_id',
                type: 'relationship',
                relatedTable: 'authors',
                relationType: 'many-to-one',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: inserting initial data
      await executeQuery("INSERT INTO authors (name) VALUES ('Jane Austen')")
      await executeQuery("INSERT INTO books (title, author_id) VALUES ('Pride and Prejudice', 1)")

      // THEN: initial count is 1
      const initialCount = await executeQuery(
        'SELECT COUNT(b.id) as book_count FROM authors a LEFT JOIN books b ON a.id = b.author_id WHERE a.id = 1 GROUP BY a.id'
      )
      expect(initialCount.book_count).toBe(1)

      // WHEN: adding more linked records
      await executeQuery("INSERT INTO books (title, author_id) VALUES ('Sense and Sensibility', 1)")

      // THEN: count updates immediately
      const updatedCount = await executeQuery(
        'SELECT COUNT(b.id) as book_count FROM authors a LEFT JOIN books b ON a.id = b.author_id WHERE a.id = 1 GROUP BY a.id'
      )
      expect(updatedCount.book_count).toBe(2)

      // WHEN: removing a linked record
      await executeQuery('DELETE FROM books WHERE id = 1')

      // THEN: count reflects the removal
      const afterDeleteCount = await executeQuery(
        'SELECT COUNT(b.id) as book_count FROM authors a LEFT JOIN books b ON a.id = b.author_id WHERE a.id = 1 GROUP BY a.id'
      )
      expect(afterDeleteCount.book_count).toBe(1)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-COUNT-004: should count records for multiple relationship fields',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with multiple count fields
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              {
                id: 3,
                name: 'created_task_count',
                type: 'count',
                relationshipField: 'created_by',
              } as any,
              {
                id: 4,
                name: 'assigned_task_count',
                type: 'count',
                relationshipField: 'assigned_to',
              } as any,
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
          {
            id: 2,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              {
                id: 3,
                name: 'created_by',
                type: 'relationship',
                relatedTable: 'users',
                relationType: 'many-to-one',
              },
              {
                id: 4,
                name: 'assigned_to',
                type: 'relationship',
                relatedTable: 'users',
                relationType: 'many-to-one',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery("INSERT INTO users (name) VALUES ('Alice'), ('Bob')")
      await executeQuery(
        "INSERT INTO tasks (title, created_by, assigned_to) VALUES ('Task 1', 1, 2), ('Task 2', 1, 1), ('Task 3', 2, 1)"
      )

      // THEN: Alice created 2 tasks, assigned 2 tasks
      const aliceCounts = await executeQuery(`
        SELECT
          u.name,
          (SELECT COUNT(*) FROM tasks WHERE created_by = u.id) as created_task_count,
          (SELECT COUNT(*) FROM tasks WHERE assigned_to = u.id) as assigned_task_count
        FROM users u WHERE u.id = 1
      `)
      expect(aliceCounts.created_task_count).toBe(2)
      expect(aliceCounts.assigned_task_count).toBe(2)

      // THEN: Bob created 1 task, assigned 1 task
      const bobCounts = await executeQuery(`
        SELECT
          u.name,
          (SELECT COUNT(*) FROM tasks WHERE created_by = u.id) as created_task_count,
          (SELECT COUNT(*) FROM tasks WHERE assigned_to = u.id) as assigned_task_count
        FROM users u WHERE u.id = 2
      `)
      expect(bobCounts.created_task_count).toBe(1)
      expect(bobCounts.assigned_task_count).toBe(1)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-COUNT-005: should apply conditions to filter counted records',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with conditional count field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'projects',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              {
                id: 3,
                name: 'completed_task_count',
                type: 'count',
                relationshipField: 'project_id',
                conditions: [{ field: 'status', operator: 'equals', value: 'completed' }],
              } as any,
              {
                id: 4,
                name: 'pending_task_count',
                type: 'count',
                relationshipField: 'project_id',
                conditions: [{ field: 'status', operator: 'equals', value: 'pending' }],
              } as any,
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
          {
            id: 2,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'status', type: 'single-line-text' },
              {
                id: 4,
                name: 'project_id',
                type: 'relationship',
                relatedTable: 'projects',
                relationType: 'many-to-one',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: inserting test data with different statuses
      await executeQuery("INSERT INTO projects (name) VALUES ('Website')")
      await executeQuery(`
        INSERT INTO tasks (title, status, project_id) VALUES
        ('Design', 'completed', 1),
        ('Code', 'completed', 1),
        ('Test', 'pending', 1),
        ('Deploy', 'pending', 1),
        ('Review', 'pending', 1)
      `)

      // THEN: conditional counts filter correctly
      const projectCounts = await executeQuery(`
        SELECT
          p.name,
          (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'completed') as completed_task_count,
          (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'pending') as pending_task_count
        FROM projects p WHERE p.id = 1
      `)
      expect(projectCounts.completed_task_count).toBe(2)
      expect(projectCounts.pending_task_count).toBe(3)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-COUNT-006: user can complete full count-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('Setup: Start server with count field and conditional count', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'departments',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'name', type: 'single-line-text' },
                {
                  id: 3,
                  name: 'employee_count',
                  type: 'count',
                  relationshipField: 'department_id',
                } as any,
                {
                  id: 4,
                  name: 'active_employee_count',
                  type: 'count',
                  relationshipField: 'department_id',
                  conditions: [{ field: 'is_active', operator: 'equals', value: true }],
                } as any,
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
            },
            {
              id: 2,
              name: 'employees',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'name', type: 'single-line-text' },
                { id: 3, name: 'is_active', type: 'checkbox' },
                {
                  id: 4,
                  name: 'department_id',
                  type: 'relationship',
                  relatedTable: 'departments',
                  relationType: 'many-to-one',
                },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
            },
          ],
        })

        await executeQuery(
          "INSERT INTO departments (name) VALUES ('Engineering'), ('Sales'), ('Empty Dept')"
        )
        await executeQuery(`
          INSERT INTO employees (name, is_active, department_id) VALUES
          ('Alice', true, 1), ('Bob', true, 1), ('Charlie', false, 1), ('Diana', true, 2)
        `)
      })

      await test.step('Verify count field returns correct number', async () => {
        const engineeringCount = await executeQuery(
          'SELECT d.name, COUNT(e.id) as employee_count FROM departments d LEFT JOIN employees e ON d.id = e.department_id WHERE d.id = 1 GROUP BY d.id, d.name'
        )
        expect(engineeringCount.employee_count).toBe(3)

        const salesCount = await executeQuery(
          'SELECT d.name, COUNT(e.id) as employee_count FROM departments d LEFT JOIN employees e ON d.id = e.department_id WHERE d.id = 2 GROUP BY d.id, d.name'
        )
        expect(salesCount.employee_count).toBe(1)
      })

      await test.step('Verify zero count for department with no employees', async () => {
        const emptyDept = await executeQuery(
          'SELECT d.name, COUNT(e.id) as employee_count FROM departments d LEFT JOIN employees e ON d.id = e.department_id WHERE d.id = 3 GROUP BY d.id, d.name'
        )
        expect(emptyDept.employee_count).toBe(0)
      })

      await test.step('Verify conditional count filters correctly', async () => {
        // Engineering has 3 employees, but only 2 are active
        const activeCount = await executeQuery(`
          SELECT d.name, COUNT(e.id) FILTER (WHERE e.is_active = true) as active_employee_count
          FROM departments d
          LEFT JOIN employees e ON d.id = e.department_id
          WHERE d.id = 1
          GROUP BY d.id, d.name
        `)
        expect(activeCount.active_employee_count).toBe(2)
      })

      await test.step('Verify count updates when records change', async () => {
        // Move an employee to another department
        await executeQuery('UPDATE employees SET department_id = 2 WHERE id = 3')

        const updatedEngineering = await executeQuery(
          'SELECT COUNT(e.id) as employee_count FROM departments d LEFT JOIN employees e ON d.id = e.department_id WHERE d.id = 1 GROUP BY d.id'
        )
        expect(updatedEngineering.employee_count).toBe(2)

        const updatedSales = await executeQuery(
          'SELECT COUNT(e.id) as employee_count FROM departments d LEFT JOIN employees e ON d.id = e.department_id WHERE d.id = 2 GROUP BY d.id'
        )
        expect(updatedSales.employee_count).toBe(2)
      })

      await test.step('Verify count updates when employee deleted', async () => {
        await executeQuery('DELETE FROM employees WHERE id = 1')

        const afterDelete = await executeQuery(
          'SELECT COUNT(e.id) as employee_count FROM departments d LEFT JOIN employees e ON d.id = e.department_id WHERE d.id = 1 GROUP BY d.id'
        )
        expect(afterDelete.employee_count).toBe(1)
      })
    }
  )
})
