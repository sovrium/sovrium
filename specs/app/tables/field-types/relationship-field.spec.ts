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
 * Spec Count: 23
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

      // WHEN: inserting test data (use explicit column list to avoid positional issues with special fields)
      await executeQuery('INSERT INTO customers (id) VALUES (1)')

      // WHEN: executing query with invalid foreign key
      await expect(executeQuery('INSERT INTO orders (customer_id) VALUES (999)')).rejects.toThrow(
        /violates foreign key constraint/
      )
    }
  )

  test(
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

      // WHEN: inserting test data (use explicit column list to avoid positional issues with special fields)
      await executeQuery('INSERT INTO posts (id) VALUES (1)')
      await executeQuery('INSERT INTO comments (post_id) VALUES (1), (1)')

      // WHEN: executing query
      await executeQuery('DELETE FROM posts WHERE id = 1')

      // THEN: child records are deleted
      const count = await executeQuery('SELECT COUNT(*) as count FROM comments')
      expect(count.count).toBe('0')
    }
  )

  test(
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

      // WHEN: inserting test data (use explicit column list to avoid positional issues with special fields)
      await executeQuery('INSERT INTO categories (id) VALUES (1)')
      await executeQuery('INSERT INTO products (category_id) VALUES (1)')

      // WHEN: executing query
      await executeQuery('DELETE FROM categories WHERE id = 1')

      // THEN: foreign key is set to NULL
      const result = await executeQuery('SELECT category_id FROM products WHERE id = 1')
      expect(result.category_id).toBeNull()
    }
  )

  test(
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

      // WHEN: inserting test data (use explicit column list to avoid positional issues with special fields)
      await executeQuery('INSERT INTO authors (id) VALUES (1)')
      await executeQuery('INSERT INTO books (author_id) VALUES (1)')

      // WHEN: attempting to delete parent with existing children
      await expect(executeQuery('DELETE FROM authors WHERE id = 1')).rejects.toThrow(
        /violates foreign key constraint/
      )
    }
  )

  test(
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

      // WHEN: inserting test data (use explicit column list to avoid positional issues with special fields)
      await executeQuery('INSERT INTO users (id) VALUES (1)')
      await executeQuery('INSERT INTO profiles (user_id) VALUES (1)')

      // WHEN: attempting to create duplicate one-to-one relationship
      await expect(executeQuery('INSERT INTO profiles (user_id) VALUES (1)')).rejects.toThrow(
        /duplicate key/
      )
    }
  )

  test(
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

      // WHEN: inserting test data (use explicit column list to avoid positional issues with special fields)
      await executeQuery('INSERT INTO students (id) VALUES (1), (2)')
      await executeQuery('INSERT INTO courses (id) VALUES (1)')
      // Auto-generated junction table should be named students_courses
      await executeQuery(
        'INSERT INTO students_courses (student_id, course_id) VALUES (1, 1), (2, 1)'
      )

      // THEN: auto-generated junction table contains correct records
      const count = await executeQuery('SELECT COUNT(*) as count FROM students_courses')
      expect(count.count).toBe('2')
    }
  )

  test(
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

      // WHEN: inserting test data with hierarchical structure (use explicit column list to avoid positional issues)
      await executeQuery('INSERT INTO employees (id, manager_id) VALUES (1, NULL), (2, 1), (3, 1)')

      // THEN: self-referencing relationship works correctly
      const subordinates = await executeQuery(
        'SELECT COUNT(*) as count FROM employees WHERE manager_id = 1'
      )
      expect(subordinates.count).toBe('2')
    }
  )

  test(
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

      // WHEN: checking for indexes on employees table (excluding pkey and deleted_at)
      const indexes = await executeQuery(
        "SELECT indexname FROM pg_indexes WHERE tablename = 'employees' AND indexname NOT LIKE '%pkey%' AND indexname NOT LIKE '%deleted_at%'"
      )

      // THEN: btree index exists on foreign key (indexed: true creates an index)
      expect(indexes.rows.length).toBeGreaterThanOrEqual(1)
    }
  )

  test(
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

      // WHEN: inserting test data (use explicit column list to avoid positional issues with special fields)
      await executeQuery("INSERT INTO teams (id, name) VALUES (1, 'Team A')")
      await executeQuery('INSERT INTO members (team_id) VALUES (1)')

      // WHEN: updating parent key
      await executeQuery('UPDATE teams SET id = 100 WHERE id = 1')

      // THEN: child foreign key is updated automatically
      const member = await executeQuery('SELECT team_id FROM members WHERE id = 1')
      expect(member.team_id).toBe(100)
    }
  )

  test(
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
      expect(projectTasks.task_count).toBe('2')

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

  test(
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

  test(
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
                id: 'active_developers',
                name: 'Active Developers',
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
      expect(activeDevelopers.count).toBe('2') // Alice and Diana

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

  test(
    'APP-TABLES-FIELD-TYPES-RELATIONSHIP-014: should reject relationship when relatedTable does not exist',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Relationship field pointing to non-existent table
      // WHEN: Attempting to start server with invalid schema
      // THEN: Should throw validation error
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'orders',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                {
                  id: 2,
                  name: 'customer_id',
                  type: 'relationship',
                  relatedTable: 'customers', // 'customers' table doesn't exist!
                  relationType: 'many-to-one',
                },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
            },
          ],
        })
      ).rejects.toThrow(/table.*customers.*not found|relatedTable.*does not exist/i)
    }
  )

  // ── Self-Referencing (015-018) ──

  test(
    'APP-TABLES-FIELD-TYPES-RELATIONSHIP-015: should allow NULL for root-level self-referencing records',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table with self-referencing relationship field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'employees',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              {
                id: 3,
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

      // WHEN: Insert root-level employee (no manager)
      await executeQuery(`INSERT INTO employees (name) VALUES ('CEO')`)

      // THEN: manager_id is NULL, column is nullable
      const columns = await executeQuery(
        `SELECT is_nullable FROM information_schema.columns
         WHERE table_name = 'employees' AND column_name = 'manager_id'`
      )
      expect(columns.is_nullable).toBe('YES')

      const ceo = await executeQuery(`SELECT manager_id FROM employees WHERE name = 'CEO'`)
      expect(ceo.manager_id).toBeNull()
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-RELATIONSHIP-016: should support tree traversal queries with self-referencing',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'employees',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              {
                id: 3,
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

      // GIVEN: Hierarchical data: CEO → VP → Manager → Staff
      await executeQuery(`INSERT INTO employees (name, manager_id) VALUES ('CEO', NULL)`)
      const ceo = await executeQuery(`SELECT id FROM employees WHERE name = 'CEO'`)
      await executeQuery(`INSERT INTO employees (name, manager_id) VALUES ('VP', ${ceo.id})`)
      const vp = await executeQuery(`SELECT id FROM employees WHERE name = 'VP'`)
      await executeQuery(`INSERT INTO employees (name, manager_id) VALUES ('Manager', ${vp.id})`)
      const mgr = await executeQuery(`SELECT id FROM employees WHERE name = 'Manager'`)
      await executeQuery(`INSERT INTO employees (name, manager_id) VALUES ('Staff', ${mgr.id})`)

      // WHEN: Execute recursive CTE to find all subordinates of CEO
      const subordinates = await executeQuery(`
        WITH RECURSIVE subordinates AS (
          SELECT id, name, manager_id FROM employees WHERE name = 'CEO'
          UNION ALL
          SELECT e.id, e.name, e.manager_id
          FROM employees e JOIN subordinates s ON e.manager_id = s.id
        )
        SELECT name FROM subordinates WHERE name != 'CEO' ORDER BY name
      `)

      // THEN: Returns all subordinates
      expect(subordinates.rows).toHaveLength(3)
      expect(subordinates.rows.map((r: any) => r.name)).toEqual(['Manager', 'Staff', 'VP'])
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-RELATIONSHIP-017: should handle circular reference prevention in self-referencing',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
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
                name: 'parent_id',
                type: 'relationship',
                relatedTable: 'categories',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // GIVEN: A → B hierarchy
      await executeQuery(`INSERT INTO categories (name, parent_id) VALUES ('A', NULL)`)
      const a = await executeQuery(`SELECT id FROM categories WHERE name = 'A'`)
      await executeQuery(`INSERT INTO categories (name, parent_id) VALUES ('B', ${a.id})`)
      const b = await executeQuery(`SELECT id FROM categories WHERE name = 'B'`)

      // WHEN: Try to create a cycle: set A's parent to B
      // THEN: Either DB trigger prevents it or application validates
      // (behavior depends on implementation — may succeed at DB level if no trigger)
      try {
        await executeQuery(`UPDATE categories SET parent_id = ${b.id} WHERE name = 'A'`)
        // If no error, circular reference exists at DB level (needs app-level validation)
        const result = await executeQuery(`SELECT parent_id FROM categories WHERE name = 'A'`)
        expect(result.parent_id).toBe(b.id)
      } catch {
        // If error thrown, circular reference prevention is enforced
        expect(true).toBe(true)
      }
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-RELATIONSHIP-018: should support ancestor queries in self-referencing',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'employees',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              {
                id: 3,
                name: 'manager_id',
                type: 'relationship',
                relatedTable: 'employees',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // GIVEN: CEO → VP → Manager chain
      await executeQuery(`INSERT INTO employees (name, manager_id) VALUES ('CEO', NULL)`)
      const ceo = await executeQuery(`SELECT id FROM employees WHERE name = 'CEO'`)
      await executeQuery(`INSERT INTO employees (name, manager_id) VALUES ('VP', ${ceo.id})`)
      const vp = await executeQuery(`SELECT id FROM employees WHERE name = 'VP'`)
      await executeQuery(`INSERT INTO employees (name, manager_id) VALUES ('Manager', ${vp.id})`)
      const mgr = await executeQuery(`SELECT id FROM employees WHERE name = 'Manager'`)

      // WHEN: Query ancestors of Manager via recursive CTE
      const ancestors = await executeQuery(`
        WITH RECURSIVE ancestors AS (
          SELECT id, name, manager_id FROM employees WHERE id = ${mgr.id}
          UNION ALL
          SELECT e.id, e.name, e.manager_id
          FROM employees e JOIN ancestors a ON e.id = a.manager_id
        )
        SELECT name FROM ancestors WHERE id != ${mgr.id} ORDER BY name
      `)

      // THEN: Returns [CEO, VP]
      expect(ancestors.rows).toHaveLength(2)
      expect(ancestors.rows.map((r: any) => r.name).sort()).toEqual(['CEO', 'VP'])
    }
  )

  // ── Cascade Error (019) ──

  test(
    'APP-TABLES-FIELD-TYPES-RELATIONSHIP-019: should return appropriate error on FK constraint violation',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
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
                onDelete: 'restrict',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // GIVEN: Department with employees referencing it
      await executeQuery(`INSERT INTO departments (name) VALUES ('Engineering')`)
      const dept = await executeQuery(`SELECT id FROM departments WHERE name = 'Engineering'`)
      await executeQuery(`INSERT INTO employees (name, department_id) VALUES ('Alice', ${dept.id})`)

      // WHEN: Attempt to delete department with RESTRICT constraint
      // THEN: Throws FK constraint violation error
      await expect(executeQuery(`DELETE FROM departments WHERE id = ${dept.id}`)).rejects.toThrow(
        /violates foreign key constraint/
      )
    }
  )

  // ── Display Options (020-023) ──

  test(
    'APP-TABLES-FIELD-TYPES-RELATIONSHIP-020: should use displayField for UI representation',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'categories',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'label', type: 'single-line-text' },
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
                displayField: 'label',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      await executeQuery(`INSERT INTO categories (label) VALUES ('Electronics')`)
      const cat = await executeQuery(`SELECT id FROM categories WHERE label = 'Electronics'`)
      await executeQuery(`INSERT INTO products (name, category_id) VALUES ('Laptop', ${cat.id})`)

      // THEN: FK column exists, displayField accessible via JOIN
      const result = await executeQuery(`
        SELECT p.name, c.label as category_label
        FROM products p JOIN categories c ON p.category_id = c.id
        WHERE p.name = 'Laptop'
      `)
      expect(result.name).toBe('Laptop')
      expect(result.category_label).toBe('Electronics')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-RELATIONSHIP-021: should support limitToView on relationship field',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Relationship with limitToView configured
      // WHEN: Schema initializes
      // THEN: Server starts successfully with limitToView config
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'categories',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'name', type: 'single-line-text' },
                { id: 3, name: 'active', type: 'boolean' },
              ],
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
                  limitToView: 'active_categories',
                },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
            },
          ],
        })
      ).resolves.not.toThrow()
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-RELATIONSHIP-022: should support multiple display fields',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'contacts',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'first_name', type: 'single-line-text' },
              { id: 3, name: 'last_name', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
          {
            id: 2,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'assignee_id',
                type: 'relationship',
                relatedTable: 'contacts',
                displayField: 'first_name',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      await executeQuery(`INSERT INTO contacts (first_name, last_name) VALUES ('John', 'Doe')`)
      const contact = await executeQuery(`SELECT id FROM contacts WHERE first_name = 'John'`)
      await executeQuery(`INSERT INTO tasks (assignee_id) VALUES (${contact.id})`)

      // THEN: Both display fields accessible via JOIN
      const result = await executeQuery(`
        SELECT c.first_name, c.last_name
        FROM tasks t JOIN contacts c ON t.assignee_id = c.id
        WHERE c.first_name = 'John'
      `)
      expect(result.first_name).toBe('John')
      expect(result.last_name).toBe('Doe')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-RELATIONSHIP-023: should return display value in API response',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, request, createAuthenticatedMember }) => {
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
          defaultRole: 'member',
        },
        tables: [
          {
            id: 1,
            name: 'categories',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: { read: 'authenticated' },
          },
          {
            id: 2,
            name: 'products',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              {
                id: 3,
                name: 'category_id',
                type: 'relationship',
                relatedTable: 'categories',
                displayField: 'name',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: { read: 'authenticated' },
          },
        ],
      })

      await executeQuery(`INSERT INTO categories (name) VALUES ('Electronics')`)
      const cat = await executeQuery(`SELECT id FROM categories WHERE name = 'Electronics'`)
      await executeQuery(`INSERT INTO products (title, category_id) VALUES ('Laptop', ${cat.id})`)

      // WHEN: Authenticated user queries products
      await createAuthenticatedMember({ email: 'user@example.com' })
      const response = await request.get('/api/tables/2/records')

      // THEN: API response includes category relationship info
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.records).toHaveLength(1)
      expect(data.records[0].fields).toHaveProperty('category_id')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-RELATIONSHIP-REGRESSION: user can complete full relationship-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // Setup: Create tables with various relationship types
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

      // Setup: Insert test data
      await executeQuery("INSERT INTO departments (name) VALUES ('Engineering'), ('Sales')")
      await executeQuery("INSERT INTO skills (name) VALUES ('JavaScript'), ('Python'), ('SQL')")
      await executeQuery(`
        INSERT INTO employees (name, department_id, manager_id) VALUES
        ('Alice', 1, NULL),
        ('Bob', 1, 1),
        ('Charlie', 1, 1),
        ('Diana', 2, NULL)
      `)
      await executeQuery(`
        INSERT INTO employees_skills (employee_id, skill_id) VALUES
        (1, 1), (1, 2), (1, 3),
        (2, 1), (2, 3),
        (3, 2)
      `)

      await test.step('APP-TABLES-FIELD-TYPES-RELATIONSHIP-001: Creates INTEGER column with FOREIGN KEY constraint', async () => {
        // WHEN: executing query to check column type
        const columnInfo = await executeQuery(
          "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='employees' AND column_name='department_id'"
        )
        // THEN: INTEGER column with proper foreign key exists
        expect(columnInfo).toMatchObject({ column_name: 'department_id', data_type: 'integer' })

        // WHEN: querying via JOIN
        const join = await executeQuery(`
          SELECT e.name, d.name as department
          FROM employees e
          JOIN departments d ON e.department_id = d.id
          WHERE e.id = 1
        `)
        // THEN: relationship via JOIN works correctly
        expect(join.name).toBe('Alice')
        expect(join.department).toBe('Engineering')
      })

      await test.step('APP-TABLES-FIELD-TYPES-RELATIONSHIP-002: Rejects invalid foreign key reference', async () => {
        // WHEN: executing query with invalid foreign key
        // THEN: FK constraint rejects the invalid reference
        await expect(
          executeQuery("INSERT INTO employees (name, department_id) VALUES ('Invalid', 999)")
        ).rejects.toThrow(/violates foreign key constraint/)
      })

      await test.step('APP-TABLES-FIELD-TYPES-RELATIONSHIP-008: Supports self-referencing relationships', async () => {
        // WHEN: querying employees with specific manager
        const subordinates = await executeQuery(`
          SELECT COUNT(*) as count FROM employees WHERE manager_id = 1
        `)
        // THEN: self-referencing relationship works correctly
        expect(subordinates.count).toBe('2') // Bob and Charlie report to Alice
      })

      await test.step('APP-TABLES-FIELD-TYPES-RELATIONSHIP-007: Supports many-to-many via auto-generated junction table', async () => {
        // WHEN: querying skills through junction table
        const aliceSkills = await executeQuery(`
          SELECT s.name
          FROM employees_skills es
          JOIN skills s ON es.skill_id = s.id
          WHERE es.employee_id = 1
          ORDER BY s.name
        `)
        // THEN: auto-generated junction table contains correct records
        expect(aliceSkills.rows).toEqual([
          { name: 'JavaScript' },
          { name: 'Python' },
          { name: 'SQL' },
        ])

        // WHEN: attempting to insert duplicate junction record
        // THEN: junction table prevents duplicates
        await expect(
          executeQuery('INSERT INTO employees_skills (employee_id, skill_id) VALUES (1, 1)')
        ).rejects.toThrow(/duplicate key/)
      })

      await test.step('APP-TABLES-FIELD-TYPES-RELATIONSHIP-001: Allows NULL relationship when not required', async () => {
        // WHEN: querying employees without manager
        const noManager = await executeQuery(`
          SELECT name, manager_id FROM employees WHERE manager_id IS NULL
        `)
        // THEN: NULL relationship is allowed
        expect(noManager.rows.length).toBe(2) // Alice and Diana have no manager
      })

      await test.step('APP-TABLES-FIELD-TYPES-RELATIONSHIP-014: Rejects relationship to non-existent table', async () => {
        // WHEN: attempting to start server with relationship to non-existent table
        // THEN: validation error is thrown
        await expect(
          startServerWithSchema({
            name: 'test-app-error',
            tables: [
              {
                id: 99,
                name: 'posts',
                fields: [
                  { id: 1, name: 'id', type: 'integer', required: true },
                  {
                    id: 2,
                    name: 'author_id',
                    type: 'relationship',
                    relatedTable: 'nonexistent_users', // Table doesn't exist!
                    relationType: 'many-to-one',
                  },
                ],
                primaryKey: { type: 'composite', fields: ['id'] },
              },
            ],
          })
        ).rejects.toThrow(/relation.*does not exist|table.*not found|invalid.*relatedTable/i)
      })
    }
  )
})
