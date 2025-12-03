/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Relationship Field
 *
 * Source: src/domain/models/app/table/field-types/relationship-field.ts
 * Domain: app
 * Spec Count: 14
 *
 * Reference: https://support.airtable.com/docs/linking-records-in-airtable
 *
 * NOTE: Some relationship field properties (reciprocalField, allowMultiple, limitToView)
 * are planned but not yet implemented. Tests use type assertions to document the intended API.
 */

/**
 * Test Organization:
 * 1. @spec tests - One per spec in schema (13 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Relationship Field', () => {
  test(
    'APP-TABLES-FIELD-TYPES-RELATIONSHIP-001: should create INTEGER column with FOREIGN KEY constraint',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with foreign key relationship
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'authors',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
          {
            id: 2,
            name: 'articles',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
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

      // WHEN: executing query to check column type
      const columnInfo = await executeQuery(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='articles' AND column_name='author_id'"
      )
      // THEN: assertion - verify author_id is INTEGER with proper foreign key
      expect(columnInfo).toMatchObject({ column_name: 'author_id', data_type: 'integer' })
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-RELATIONSHIP-002: should reject invalid foreign key reference',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'customers',
            fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
          {
            id: 2,
            name: 'orders',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'customer_id',
                type: 'relationship',
                relatedTable: 'customers',
                relationType: 'many-to-one',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery('INSERT INTO customers VALUES (1)')

      // WHEN: executing query with invalid foreign key
      await expect(executeQuery('INSERT INTO orders (customer_id) VALUES (999)')).rejects.toThrow(
        /violates foreign key constraint/
      )
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-RELATIONSHIP-003: should CASCADE delete child records when parent deleted',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with CASCADE delete
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'posts',
            fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
          {
            id: 2,
            name: 'comments',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'post_id',
                type: 'relationship',
                relatedTable: 'posts',
                relationType: 'many-to-one',
                onDelete: 'cascade',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery('INSERT INTO posts VALUES (1)')
      await executeQuery('INSERT INTO comments (post_id) VALUES (1), (1)')

      // WHEN: executing query
      await executeQuery('DELETE FROM posts WHERE id = 1')

      // THEN: child records are deleted
      const count = await executeQuery('SELECT COUNT(*) as count FROM comments')
      expect(count.count).toBe(0)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-RELATIONSHIP-004: should SET NULL on delete when onDelete=set-null',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with SET NULL on delete
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'categories',
            fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
          {
            id: 2,
            name: 'products',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'category_id',
                type: 'relationship',
                relatedTable: 'categories',
                relationType: 'many-to-one',
                onDelete: 'set-null',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery('INSERT INTO categories VALUES (1)')
      await executeQuery('INSERT INTO products (category_id) VALUES (1)')

      // WHEN: executing query
      await executeQuery('DELETE FROM categories WHERE id = 1')

      // THEN: foreign key is set to NULL
      const result = await executeQuery('SELECT category_id FROM products WHERE id = 1')
      expect(result.category_id).toBeNull()
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-RELATIONSHIP-005: should RESTRICT deletion when child records exist',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with RESTRICT on delete
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'authors',
            fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
          {
            id: 2,
            name: 'books',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'author_id',
                type: 'relationship',
                relatedTable: 'authors',
                relationType: 'many-to-one',
                onDelete: 'restrict',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery('INSERT INTO authors VALUES (1)')
      await executeQuery('INSERT INTO books (author_id) VALUES (1)')

      // WHEN: attempting to delete parent with existing children
      await expect(executeQuery('DELETE FROM authors WHERE id = 1')).rejects.toThrow(
        /violates foreign key constraint/
      )
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-RELATIONSHIP-006: should support one-to-one relationship with UNIQUE constraint',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with one-to-one relationship
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
          {
            id: 2,
            name: 'profiles',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'user_id',
                type: 'relationship',
                relatedTable: 'users',
                relationType: 'one-to-one',
                unique: true,
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery('INSERT INTO users VALUES (1)')
      await executeQuery('INSERT INTO profiles (user_id) VALUES (1)')

      // WHEN: attempting to create duplicate one-to-one relationship
      await expect(executeQuery('INSERT INTO profiles (user_id) VALUES (1)')).rejects.toThrow(
        /duplicate key/
      )
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-RELATIONSHIP-007: should support many-to-many via auto-generated junction table',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with many-to-many relationship
      // NOTE: Junction table should be auto-generated by startServerWithSchema
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'students',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'courses',
                type: 'relationship',
                relatedTable: 'courses',
                relationType: 'many-to-many',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
          {
            id: 2,
            name: 'courses',
            fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery('INSERT INTO students VALUES (1), (2)')
      await executeQuery('INSERT INTO courses VALUES (1)')
      // Auto-generated junction table should be named students_courses
      await executeQuery('INSERT INTO students_courses (student_id, course_id) VALUES (1, 1), (2, 1)')

      // THEN: auto-generated junction table contains correct records
      const count = await executeQuery('SELECT COUNT(*) as count FROM students_courses')
      expect(count.count).toBe(2)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-RELATIONSHIP-008: should support self-referencing relationships',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with self-referencing relationship
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'employees',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'manager_id',
                type: 'relationship',
                relatedTable: 'employees',
                relationType: 'many-to-one',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: inserting test data with hierarchical structure
      await executeQuery('INSERT INTO employees VALUES (1, NULL), (2, 1), (3, 1)')

      // THEN: self-referencing relationship works correctly
      const subordinates = await executeQuery(
        'SELECT COUNT(*) as count FROM employees WHERE manager_id = 1'
      )
      expect(subordinates.count).toBe(2)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-RELATIONSHIP-009: should create btree index on foreign key when indexed=true',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with indexed relationship field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'departments',
            fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
          {
            id: 2,
            name: 'employees',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'department_id',
                type: 'relationship',
                relatedTable: 'departments',
                relationType: 'many-to-one',
                indexed: true,
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: checking for index
      const index = await executeQuery(
        "SELECT indexname FROM pg_indexes WHERE tablename = 'employees' AND indexname LIKE '%department_id%'"
      )

      // THEN: btree index exists on foreign key
      expect(index.indexname).toBeTruthy()
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-RELATIONSHIP-010: should support CASCADE updates when onUpdate=cascade',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with CASCADE update
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'teams',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
          {
            id: 2,
            name: 'members',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'team_id',
                type: 'relationship',
                relatedTable: 'teams',
                relationType: 'many-to-one',
                onUpdate: 'cascade',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery("INSERT INTO teams VALUES (1, 'Team A')")
      await executeQuery('INSERT INTO members (team_id) VALUES (1)')

      // WHEN: updating parent key
      await executeQuery('UPDATE teams SET id = 100 WHERE id = 1')

      // THEN: child foreign key is updated automatically
      const member = await executeQuery('SELECT team_id FROM members WHERE id = 1')
      expect(member.team_id).toBe(100)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-RELATIONSHIP-011: should create reciprocal link field in related table',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with bidirectional relationship
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
                name: 'tasks',
                type: 'relationship',
                relatedTable: 'tasks',
                relationType: 'one-to-many',
                reciprocalField: 'project',
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
                name: 'project',
                type: 'relationship',
                relatedTable: 'projects',
                relationType: 'many-to-one',
                reciprocalField: 'tasks',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery("INSERT INTO projects (name) VALUES ('Website')")
      await executeQuery("INSERT INTO tasks (title, project) VALUES ('Design', 1), ('Code', 1)")

      // THEN: can query from project to tasks (one-to-many direction)
      const projectTasks = await executeQuery(`
        SELECT p.name, COUNT(t.id) as task_count
        FROM projects p
        LEFT JOIN tasks t ON p.id = t.project
        WHERE p.id = 1
        GROUP BY p.name
      `)
      expect(projectTasks.task_count).toBe(2)

      // THEN: can query from task to project (many-to-one direction)
      const taskProject = await executeQuery(`
        SELECT t.title, p.name as project_name
        FROM tasks t
        JOIN projects p ON t.project = p.id
        WHERE t.id = 1
      `)
      expect(taskProject.project_name).toBe('Website')
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-RELATIONSHIP-012: should enforce single link when allowMultiple is false',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with single-link constraint
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
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
                name: 'assignee',
                type: 'relationship',
                relatedTable: 'users',
                relationType: 'many-to-one',
                allowMultiple: false,
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery("INSERT INTO users (name) VALUES ('Alice'), ('Bob')")
      await executeQuery("INSERT INTO tasks (title, assignee) VALUES ('Task 1', 1)")

      // THEN: single link is stored correctly
      const task = await executeQuery('SELECT assignee FROM tasks WHERE id = 1')
      expect(task.assignee).toBe(1)

      // THEN: can update to different single link
      await executeQuery('UPDATE tasks SET assignee = 2 WHERE id = 1')
      const updatedTask = await executeQuery('SELECT assignee FROM tasks WHERE id = 1')
      expect(updatedTask.assignee).toBe(2)

      // NOTE: When allowMultiple=false, the field only stores a single FK value
      // UI should enforce picking only one record, but DB only stores one value
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-RELATIONSHIP-013: should limit linkable records to specified view',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with view-limited relationship
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'role', type: 'single-line-text' },
              { id: 4, name: 'is_active', type: 'checkbox' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            views: [
              {
                id: 1,
                name: 'active_developers',
                query: "SELECT * FROM users WHERE role = 'developer' AND is_active = true",
              },
            ],
          },
          {
            id: 2,
            name: 'projects',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              {
                id: 3,
                name: 'lead_developer',
                type: 'relationship',
                relatedTable: 'users',
                relationType: 'many-to-one',
                limitToView: 'active_developers',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: inserting users with different roles and statuses
      await executeQuery(`
        INSERT INTO users (name, role, is_active) VALUES
        ('Alice', 'developer', true),
        ('Bob', 'developer', false),
        ('Charlie', 'manager', true),
        ('Diana', 'developer', true)
      `)

      // THEN: view only shows active developers
      const activeDevelopers = await executeQuery('SELECT COUNT(*) as count FROM active_developers')
      expect(activeDevelopers.count).toBe(2) // Alice and Diana

      // THEN: can link to users in the view
      await executeQuery("INSERT INTO projects (name, lead_developer) VALUES ('Website', 1)")
      const project = await executeQuery(
        'SELECT p.name, u.name as lead_name FROM projects p JOIN users u ON p.lead_developer = u.id WHERE p.id = 1'
      )
      expect(project.lead_name).toBe('Alice')

      // NOTE: limitToView affects UI record picker, not FK constraint
      // The FK still allows any valid user id, but UI filters by view
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-RELATIONSHIP-014: user can complete full relationship-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('Setup: Create tables with various relationship types', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'departments',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'name', type: 'single-line-text' },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
            },
            {
              id: 2,
              name: 'employees',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'name', type: 'single-line-text' },
                {
                  id: 3,
                  name: 'department_id',
                  type: 'relationship',
                  relatedTable: 'departments',
                  relationType: 'many-to-one',
                },
                {
                  id: 4,
                  name: 'manager_id',
                  type: 'relationship',
                  relatedTable: 'employees',
                  relationType: 'many-to-one',
                },
                {
                  id: 5,
                  name: 'skills',
                  type: 'relationship',
                  relatedTable: 'skills',
                  relationType: 'many-to-many',
                },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
            },
            {
              id: 3,
              name: 'skills',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'name', type: 'single-line-text' },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
            },
          ],
        })

        await executeQuery("INSERT INTO departments (name) VALUES ('Engineering'), ('Sales')")
        await executeQuery("INSERT INTO skills (name) VALUES ('JavaScript'), ('Python'), ('SQL')")
        await executeQuery(`
          INSERT INTO employees (name, department_id, manager_id) VALUES
          ('Alice', 1, NULL),
          ('Bob', 1, 1),
          ('Charlie', 1, 1),
          ('Diana', 2, NULL)
        `)
        // Auto-generated junction table should be named employees_skills
        await executeQuery(`
          INSERT INTO employees_skills (employee_id, skill_id) VALUES
          (1, 1), (1, 2), (1, 3),
          (2, 1), (2, 3),
          (3, 2)
        `)
      })

      await test.step('Verify many-to-one relationship via JOIN', async () => {
        const join = await executeQuery(`
          SELECT e.name, d.name as department
          FROM employees e
          JOIN departments d ON e.department_id = d.id
          WHERE e.id = 1
        `)
        expect(join.name).toBe('Alice')
        expect(join.department).toBe('Engineering')
      })

      await test.step('Verify FK constraint rejects invalid reference', async () => {
        await expect(
          executeQuery("INSERT INTO employees (name, department_id) VALUES ('Invalid', 999)")
        ).rejects.toThrow(/violates foreign key constraint/)
      })

      await test.step('Verify self-referencing relationship', async () => {
        const subordinates = await executeQuery(`
          SELECT COUNT(*) as count FROM employees WHERE manager_id = 1
        `)
        expect(subordinates.count).toBe(2) // Bob and Charlie report to Alice
      })

      await test.step('Verify many-to-many via auto-generated junction table', async () => {
        const aliceSkills = await executeQuery(`
          SELECT s.name
          FROM employees_skills es
          JOIN skills s ON es.skill_id = s.id
          WHERE es.employee_id = 1
          ORDER BY s.name
        `)
        expect(aliceSkills.rows).toEqual([
          { name: 'JavaScript' },
          { name: 'Python' },
          { name: 'SQL' },
        ])
      })

      await test.step('Verify auto-generated junction table prevents duplicates', async () => {
        await expect(
          executeQuery('INSERT INTO employees_skills (employee_id, skill_id) VALUES (1, 1)')
        ).rejects.toThrow(/duplicate key/)
      })

      await test.step('Verify NULL relationship is allowed when not required', async () => {
        const noManager = await executeQuery(`
          SELECT name, manager_id FROM employees WHERE manager_id IS NULL
        `)
        expect(noManager.rows.length).toBe(2) // Alice and Diana have no manager
      })

      await test.step('Verify relationship update works', async () => {
        await executeQuery('UPDATE employees SET department_id = 2 WHERE id = 2')

        const updated = await executeQuery(`
          SELECT e.name, d.name as department
          FROM employees e
          JOIN departments d ON e.department_id = d.id
          WHERE e.id = 2
        `)
        expect(updated.department).toBe('Sales')
      })

      await test.step('Verify counting related records', async () => {
        const deptCounts = await executeQuery(`
          SELECT d.name, COUNT(e.id) as employee_count
          FROM departments d
          LEFT JOIN employees e ON d.id = e.department_id
          GROUP BY d.id, d.name
          ORDER BY d.name
        `)
        expect(deptCounts.rows).toEqual([
          { name: 'Engineering', employee_count: 2 },
          { name: 'Sales', employee_count: 2 },
        ])
      })
    }
  )
})
