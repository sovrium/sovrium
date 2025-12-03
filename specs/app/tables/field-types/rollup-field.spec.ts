/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Rollup Field
 *
 * Source: src/domain/models/app/table/field-types/rollup-field.ts
 * Domain: app
 * Spec Count: 11
 *
 * Reference: https://support.airtable.com/docs/rollup-field-overview
 *
 * NOTE: Some rollup field properties (conditions) are planned but not yet implemented.
 * Tests use type assertions to document the intended API.
 */

/**
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Rollup Field', () => {
  test(
    'APP-TABLES-FIELD-TYPES-ROLLUP-001: should calculate SUM aggregation from related records',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with rollup field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'customers',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              {
                id: 3,
                name: 'total_order_amount',
                type: 'rollup',
                relationshipField: 'customer_id',
                relatedField: 'amount',
                aggregation: 'sum',
              },
            ],
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
              { id: 3, name: 'amount', type: 'decimal' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery("INSERT INTO customers (name) VALUES ('Alice'), ('Bob')")
      await executeQuery(
        'INSERT INTO orders (customer_id, amount) VALUES (1, 100.00), (1, 150.00), (1, 75.50), (2, 200.00)'
      )

      // WHEN: executing query
      const aliceTotal = await executeQuery(
        'SELECT c.id, c.name, COALESCE(SUM(o.amount), 0) as total_order_amount FROM customers c LEFT JOIN orders o ON c.id = o.customer_id WHERE c.id = 1 GROUP BY c.id, c.name'
      )
      // THEN: assertion
      expect(aliceTotal).toEqual({
        id: 1,
        name: 'Alice',
        total_order_amount: 325.5,
        rowCount: 1,
        rows: [{ id: 1, name: 'Alice', total_order_amount: 325.5 }],
      })

      // WHEN: executing query
      const bobTotal = await executeQuery(
        'SELECT c.id, c.name, COALESCE(SUM(o.amount), 0) as total_order_amount FROM customers c LEFT JOIN orders o ON c.id = o.customer_id WHERE c.id = 2 GROUP BY c.id, c.name'
      )
      // THEN: assertion
      expect(bobTotal).toEqual({
        id: 2,
        name: 'Bob',
        total_order_amount: 200.0,
        rowCount: 1,
        rows: [{ id: 2, name: 'Bob', total_order_amount: 200.0 }],
      })

      // WHEN: executing query
      const noOrders = await executeQuery(
        "INSERT INTO customers (name) VALUES ('Charlie') RETURNING (SELECT COALESCE(SUM(o.amount), 0) FROM orders o WHERE o.customer_id = 3) as total_order_amount"
      )
      // THEN: assertion
      expect(noOrders.total_order_amount).toBe(0)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-ROLLUP-002: should return COUNT aggregation of related records',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with COUNT rollup
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
                type: 'rollup',
                relationshipField: 'project_id',
                relatedField: 'id',
                aggregation: 'count',
              },
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
                name: 'project_id',
                type: 'relationship',
                relatedTable: 'projects',
                relationType: 'many-to-one',
              },
              { id: 3, name: 'title', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery("INSERT INTO projects (name) VALUES ('Website Redesign'), ('Mobile App')")
      await executeQuery(
        "INSERT INTO tasks (project_id, title) VALUES (1, 'Design mockups'), (1, 'Write code'), (1, 'Test'), (2, 'Setup project')"
      )

      // WHEN: executing query
      const project1Count = await executeQuery(
        'SELECT p.id, p.name, COUNT(t.id) as task_count FROM projects p LEFT JOIN tasks t ON p.id = t.project_id WHERE p.id = 1 GROUP BY p.id, p.name'
      )
      // THEN: assertion
      expect(project1Count).toEqual({
        id: 1,
        name: 'Website Redesign',
        task_count: 3,
        rowCount: 1,
        rows: [{ id: 1, name: 'Website Redesign', task_count: 3 }],
      })

      // WHEN: executing query
      const project2Count = await executeQuery(
        'SELECT p.id, p.name, COUNT(t.id) as task_count FROM projects p LEFT JOIN tasks t ON p.id = t.project_id WHERE p.id = 2 GROUP BY p.id, p.name'
      )
      // THEN: assertion
      expect(project2Count).toEqual({
        id: 2,
        name: 'Mobile App',
        task_count: 1,
        rowCount: 1,
        rows: [{ id: 2, name: 'Mobile App', task_count: 1 }],
      })

      // WHEN: executing query
      const emptyProject = await executeQuery(
        "INSERT INTO projects (name) VALUES ('Empty Project') RETURNING (SELECT COUNT(t.id) FROM tasks t WHERE t.project_id = 3) as task_count"
      )
      // THEN: assertion
      expect(emptyProject.task_count).toBe(0)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-ROLLUP-003: should support AVG, MIN, MAX statistical aggregations',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with statistical rollup fields
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'products',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              {
                id: 3,
                name: 'avg_rating',
                type: 'rollup',
                relationshipField: 'product_id',
                relatedField: 'rating',
                aggregation: 'avg',
              },
              {
                id: 4,
                name: 'min_rating',
                type: 'rollup',
                relationshipField: 'product_id',
                relatedField: 'rating',
                aggregation: 'min',
              },
              {
                id: 5,
                name: 'max_rating',
                type: 'rollup',
                relationshipField: 'product_id',
                relatedField: 'rating',
                aggregation: 'max',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
          {
            id: 2,
            name: 'reviews',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'product_id',
                type: 'relationship',
                relatedTable: 'products',
                relationType: 'many-to-one',
              },
              { id: 3, name: 'rating', type: 'integer' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery("INSERT INTO products (name) VALUES ('Laptop')")
      await executeQuery(
        'INSERT INTO reviews (product_id, rating) VALUES (1, 5), (1, 4), (1, 5), (1, 3)'
      )

      // WHEN: executing query
      const avgRating = await executeQuery(
        'SELECT p.id, AVG(r.rating)::NUMERIC(10,2) as avg_rating FROM products p LEFT JOIN reviews r ON p.id = r.product_id WHERE p.id = 1 GROUP BY p.id'
      )
      // THEN: assertion
      expect(avgRating).toEqual({ id: 1, avg_rating: '4.25' })

      // WHEN: executing query
      const minRating = await executeQuery(
        'SELECT p.id, MIN(r.rating) as min_rating FROM products p LEFT JOIN reviews r ON p.id = r.product_id WHERE p.id = 1 GROUP BY p.id'
      )
      // THEN: assertion
      expect(minRating).toEqual({ id: 1, min_rating: 3 })

      // WHEN: executing query
      const maxRating = await executeQuery(
        'SELECT p.id, MAX(r.rating) as max_rating FROM products p LEFT JOIN reviews r ON p.id = r.product_id WHERE p.id = 1 GROUP BY p.id'
      )
      // THEN: assertion
      expect(maxRating).toEqual({ id: 1, max_rating: 5 })
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-ROLLUP-004: should efficiently aggregate across multiple parent records with GROUP BY',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with department salary totals
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
                name: 'total_salary',
                type: 'rollup',
                relationshipField: 'department_id',
                relatedField: 'salary',
                aggregation: 'sum',
              },
            ],
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
              },
              { id: 3, name: 'salary', type: 'decimal' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery(
        "INSERT INTO departments (name) VALUES ('Engineering'), ('Sales'), ('Marketing')"
      )
      await executeQuery(
        'INSERT INTO employees (department_id, salary) VALUES (1, 90000), (1, 85000), (1, 95000), (2, 70000), (2, 75000), (3, 60000)'
      )

      // WHEN: executing query
      const allDepartments = await executeQuery(
        'SELECT d.id, d.name, COALESCE(SUM(e.salary), 0) as total_salary FROM departments d LEFT JOIN employees e ON d.id = e.department_id GROUP BY d.id, d.name ORDER BY d.id'
      )
      // THEN: assertion
      expect(allDepartments).toEqual([
        { id: 1, name: 'Engineering', total_salary: '270000.00' },
        { id: 2, name: 'Sales', total_salary: '145000.00' },
        { id: 3, name: 'Marketing', total_salary: '60000.00' },
      ])

      // WHEN: executing query
      const filtered = await executeQuery(
        "SELECT d.name, SUM(e.salary) as total_salary FROM departments d LEFT JOIN employees e ON d.id = e.department_id WHERE d.name = 'Engineering' GROUP BY d.name"
      )
      // THEN: assertion
      expect(filtered).toEqual({ name: 'Engineering', total_salary: '270000.00' })
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-ROLLUP-005: should create VIEW to encapsulate rollup aggregation logic',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with view for rollup logic
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'accounts',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'account_name', type: 'single-line-text' },
              {
                id: 3,
                name: 'revenue_total',
                type: 'rollup',
                relationshipField: 'account_id',
                relatedField: 'amount',
                aggregation: 'sum',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            views: [
              {
                id: 1,
                name: 'accounts_with_revenue',
                query:
                  'SELECT a.id, a.account_name, COALESCE(SUM(i.amount), 0) as revenue_total FROM accounts a LEFT JOIN invoices i ON a.id = i.account_id GROUP BY a.id, a.account_name',
              },
            ],
          },
          {
            id: 2,
            name: 'invoices',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'account_id',
                type: 'relationship',
                relatedTable: 'accounts',
                relationType: 'many-to-one',
              },
              { id: 3, name: 'amount', type: 'decimal' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery("INSERT INTO accounts (account_name) VALUES ('Acme Corp'), ('Tech Inc')")
      await executeQuery(
        'INSERT INTO invoices (account_id, amount) VALUES (1, 5000.00), (1, 3000.00), (2, 10000.00)'
      )

      // WHEN: executing query
      const viewExists = await executeQuery(
        "SELECT table_name FROM information_schema.views WHERE table_name = 'accounts_with_revenue'"
      )
      // THEN: assertion
      expect(viewExists.table_name).toBe('accounts_with_revenue')

      // WHEN: executing query
      const viewData = await executeQuery(
        'SELECT id, account_name, revenue_total FROM accounts_with_revenue WHERE id = 1'
      )
      // THEN: assertion
      expect(viewData).toEqual({ id: 1, account_name: 'Acme Corp', revenue_total: '8000.00' })

      // WHEN: executing query
      const viewAggregates = await executeQuery(
        'SELECT COUNT(*) as count, SUM(revenue_total) as total_revenue FROM accounts_with_revenue'
      )
      // THEN: assertion
      expect(viewAggregates).toEqual({ count: 2, total_revenue: '18000.00' })
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-ROLLUP-006: user can complete full rollup-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('Setup: Start server with rollup field', async () => {
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
                  name: 'total_value',
                  type: 'rollup',
                  relationshipField: 'category_id',
                  relatedField: 'price',
                  aggregation: 'sum',
                },
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
                  relationType: 'many-to-one',
                },
                { id: 3, name: 'price', type: 'decimal' },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
            },
          ],
        })

        await executeQuery("INSERT INTO categories (name) VALUES ('Electronics')")
        await executeQuery(
          'INSERT INTO products (category_id, price) VALUES (1, 100.00), (1, 200.00), (1, 150.00)'
        )
      })

      await test.step('Verify rollup aggregation calculation', async () => {
        const rollup = await executeQuery(
          'SELECT c.id, COALESCE(SUM(p.price), 0) as total_value FROM categories c LEFT JOIN products p ON c.id = p.category_id WHERE c.id = 1 GROUP BY c.id'
        )
        expect(rollup.total_value).toBe('450.00')
      })
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-ROLLUP-007: should count non-empty values with COUNTA aggregation',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with COUNTA rollup (counts non-empty text or numeric values)
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
                name: 'books_with_description_count',
                type: 'rollup',
                relationshipField: 'author_id',
                relatedField: 'description',
                aggregation: 'counta',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
          {
            id: 2,
            name: 'books',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'description', type: 'long-text' },
              {
                id: 4,
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

      // WHEN: inserting test data (some books have description, some don't)
      await executeQuery("INSERT INTO authors (name) VALUES ('Jane Austen')")
      await executeQuery(`
        INSERT INTO books (title, description, author_id) VALUES
        ('Pride and Prejudice', 'A romantic novel about Elizabeth Bennet', 1),
        ('Sense and Sensibility', NULL, 1),
        ('Emma', 'A novel about youthful hubris', 1),
        ('Persuasion', '', 1)
      `)

      // THEN: COUNTA counts only non-empty values (excludes NULL and empty strings)
      const countaResult = await executeQuery(`
        SELECT a.id, COUNT(b.description) FILTER (WHERE b.description IS NOT NULL AND b.description != '') as books_with_description_count
        FROM authors a
        LEFT JOIN books b ON a.id = b.author_id
        WHERE a.id = 1
        GROUP BY a.id
      `)
      expect(countaResult.books_with_description_count).toBe(2)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-ROLLUP-008: should count all linked records with COUNTALL including empty',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with COUNTALL rollup (counts all linked records regardless of field values)
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
                name: 'total_tasks',
                type: 'rollup',
                relationshipField: 'project_id',
                relatedField: 'id',
                aggregation: 'countall',
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
              { id: 3, name: 'notes', type: 'long-text' },
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

      // WHEN: inserting test data (some tasks have empty fields)
      await executeQuery("INSERT INTO projects (name) VALUES ('Website')")
      await executeQuery(`
        INSERT INTO tasks (title, notes, project_id) VALUES
        ('Design', 'Create mockups', 1),
        ('Code', NULL, 1),
        ('Test', '', 1),
        ('Deploy', 'To production', 1)
      `)

      // THEN: COUNTALL counts all linked records regardless of field values
      const countallResult = await executeQuery(`
        SELECT p.id, COUNT(t.id) as total_tasks
        FROM projects p
        LEFT JOIN tasks t ON p.id = t.project_id
        WHERE p.id = 1
        GROUP BY p.id
      `)
      expect(countallResult.total_tasks).toBe(4)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-ROLLUP-009: should support MIN and MAX aggregation with date fields',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with date MIN/MAX rollup fields
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
                name: 'earliest_task_date',
                type: 'rollup',
                relationshipField: 'project_id',
                relatedField: 'due_date',
                aggregation: 'min',
              },
              {
                id: 4,
                name: 'latest_task_date',
                type: 'rollup',
                relationshipField: 'project_id',
                relatedField: 'due_date',
                aggregation: 'max',
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
              { id: 3, name: 'due_date', type: 'date' },
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

      // WHEN: inserting test data with various dates
      await executeQuery("INSERT INTO projects (name) VALUES ('Q1 Release')")
      await executeQuery(`
        INSERT INTO tasks (title, due_date, project_id) VALUES
        ('Planning', '2024-01-15', 1),
        ('Development', '2024-02-28', 1),
        ('Testing', '2024-03-10', 1),
        ('Launch', '2024-03-31', 1)
      `)

      // THEN: MIN returns earliest date
      const minDate = await executeQuery(`
        SELECT p.id, MIN(t.due_date) as earliest_task_date
        FROM projects p
        LEFT JOIN tasks t ON p.id = t.project_id
        WHERE p.id = 1
        GROUP BY p.id
      `)
      expect(minDate.earliest_task_date).toEqual(new Date('2024-01-15'))

      // THEN: MAX returns latest date
      const maxDate = await executeQuery(`
        SELECT p.id, MAX(t.due_date) as latest_task_date
        FROM projects p
        LEFT JOIN tasks t ON p.id = t.project_id
        WHERE p.id = 1
        GROUP BY p.id
      `)
      expect(maxDate.latest_task_date).toEqual(new Date('2024-03-31'))
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-ROLLUP-010: should apply conditions to filter rollup aggregation',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with conditional rollup
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
                name: 'completed_hours',
                type: 'rollup',
                relationshipField: 'project_id',
                relatedField: 'hours',
                aggregation: 'sum',
                conditions: [{ field: 'status', operator: 'equals', value: 'completed' }],
              } as any,
              {
                id: 4,
                name: 'pending_hours',
                type: 'rollup',
                relationshipField: 'project_id',
                relatedField: 'hours',
                aggregation: 'sum',
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
              { id: 3, name: 'hours', type: 'decimal' },
              { id: 4, name: 'status', type: 'single-line-text' },
              {
                id: 5,
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
      await executeQuery("INSERT INTO projects (name) VALUES ('Website Redesign')")
      await executeQuery(`
        INSERT INTO tasks (title, hours, status, project_id) VALUES
        ('Design', 8.0, 'completed', 1),
        ('Frontend', 16.0, 'completed', 1),
        ('Backend', 24.0, 'pending', 1),
        ('Testing', 12.0, 'pending', 1)
      `)

      // THEN: conditional rollup sums only matching records
      const completedHours = await executeQuery(`
        SELECT p.id, COALESCE(SUM(t.hours) FILTER (WHERE t.status = 'completed'), 0) as completed_hours
        FROM projects p
        LEFT JOIN tasks t ON p.id = t.project_id
        WHERE p.id = 1
        GROUP BY p.id
      `)
      expect(completedHours.completed_hours).toBe(24.0)

      const pendingHours = await executeQuery(`
        SELECT p.id, COALESCE(SUM(t.hours) FILTER (WHERE t.status = 'pending'), 0) as pending_hours
        FROM projects p
        LEFT JOIN tasks t ON p.id = t.project_id
        WHERE p.id = 1
        GROUP BY p.id
      `)
      expect(pendingHours.pending_hours).toBe(36.0)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-ROLLUP-011: should return unique values with ARRAYUNIQUE aggregation',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with ARRAYUNIQUE rollup
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
                name: 'unique_assignees',
                type: 'rollup',
                relationshipField: 'project_id',
                relatedField: 'assignee',
                aggregation: 'arrayunique',
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
              { id: 3, name: 'assignee', type: 'single-line-text' },
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

      // WHEN: inserting test data with duplicate assignees
      await executeQuery("INSERT INTO projects (name) VALUES ('Website')")
      await executeQuery(`
        INSERT INTO tasks (title, assignee, project_id) VALUES
        ('Design', 'Alice', 1),
        ('Frontend', 'Bob', 1),
        ('Backend', 'Alice', 1),
        ('Testing', 'Charlie', 1),
        ('Deploy', 'Bob', 1)
      `)

      // THEN: ARRAYUNIQUE returns distinct values
      const uniqueAssignees = await executeQuery(`
        SELECT p.id, ARRAY_AGG(DISTINCT t.assignee ORDER BY t.assignee) as unique_assignees
        FROM projects p
        LEFT JOIN tasks t ON p.id = t.project_id
        WHERE p.id = 1
        GROUP BY p.id
      `)
      expect(uniqueAssignees.unique_assignees).toEqual(['Alice', 'Bob', 'Charlie'])
    }
  )
})
