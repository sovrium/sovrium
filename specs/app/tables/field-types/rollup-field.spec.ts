/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Rollup Field (Airtable-style Computed Values)
 *
 * Source: src/domain/models/app/table/field-types/rollup-field.ts
 * Domain: app
 * Spec Count: 12
 *
 * Reference: https://support.airtable.com/docs/rollup-field-overview
 *
 * IMPLEMENTATION APPROACH:
 * Rollup fields should work like Airtable - computed values are directly
 * accessible as table columns, NOT manually computed via JOIN queries.
 *
 * Recommended implementation: Create database VIEWs that include aggregated
 * columns. Views automatically recalculate when related records change.
 *
 * Example:
 * CREATE VIEW customers_view AS
 * SELECT c.*, COALESCE(SUM(o.amount), 0) as total_order_amount
 * FROM customers c LEFT JOIN orders o ON c.id = o.customer_id GROUP BY c.id;
 *
 * Tests validate that computed values are directly readable, not that
 * implementations write correct SQL aggregations.
 */

/**
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (11 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 */

test.describe('Rollup Field', () => {
  test.fixme(
    'APP-TABLES-FIELD-TYPES-ROLLUP-001: should calculate SUM aggregation from related records',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Customers table with rollup field summing order amounts
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'customers',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              {
                id: 2,
                name: 'orders',
                type: 'relationship',
                relatedTable: 'orders',
                relationType: 'one-to-many',
                foreignKey: 'customer_id',
              },
              {
                id: 3,
                name: 'total_order_amount',
                type: 'rollup',
                relationshipField: 'orders',
                relatedField: 'amount',
                aggregation: 'sum',
              },
            ],
          },
          {
            id: 2,
            name: 'orders',
            fields: [
              {
                id: 1,
                name: 'customer_id',
                type: 'relationship',
                relatedTable: 'customers',
                relationType: 'many-to-one',
              },
              { id: 2, name: 'amount', type: 'decimal' },
            ],
          },
        ],
      })

      // WHEN: Inserting customers and orders
      await executeQuery("INSERT INTO customers (name) VALUES ('Alice'), ('Bob')")
      await executeQuery(
        'INSERT INTO orders (customer_id, amount) VALUES (1, 100.00), (1, 150.00), (1, 75.50), (2, 200.00)'
      )

      // THEN: Rollup field is directly accessible (Airtable-style)
      const alice = await executeQuery('SELECT * FROM customers WHERE id = 1')
      expect(alice.total_order_amount).toBe(325.5) // 100 + 150 + 75.50

      const bob = await executeQuery('SELECT * FROM customers WHERE id = 2')
      expect(bob.total_order_amount).toBe(200.0)

      // WHEN: Customer with no orders
      await executeQuery("INSERT INTO customers (name) VALUES ('Charlie')")

      // THEN: Rollup returns 0 for empty aggregation
      const charlie = await executeQuery('SELECT * FROM customers WHERE id = 3')
      expect(charlie.total_order_amount).toBe(0)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-ROLLUP-002: should return COUNT aggregation of related records',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Projects table with COUNT rollup of tasks
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'projects',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              {
                id: 2,
                name: 'tasks',
                type: 'relationship',
                relatedTable: 'tasks',
                relationType: 'one-to-many',
                foreignKey: 'project_id',
              },
              {
                id: 3,
                name: 'task_count',
                type: 'rollup',
                relationshipField: 'tasks',
                relatedField: 'id',
                aggregation: 'count',
              },
            ],
          },
          {
            id: 2,
            name: 'tasks',
            fields: [
              {
                id: 1,
                name: 'project_id',
                type: 'relationship',
                relatedTable: 'projects',
                relationType: 'many-to-one',
              },
              { id: 2, name: 'title', type: 'single-line-text' },
            ],
          },
        ],
      })

      // WHEN: Inserting projects and tasks
      await executeQuery("INSERT INTO projects (name) VALUES ('Website Redesign'), ('Mobile App')")
      await executeQuery(
        "INSERT INTO tasks (project_id, title) VALUES (1, 'Design mockups'), (1, 'Write code'), (1, 'Test'), (2, 'Setup project')"
      )

      // THEN: COUNT rollup is directly accessible
      const project1 = await executeQuery('SELECT * FROM projects WHERE id = 1')
      expect(project1.task_count).toBe(3)

      const project2 = await executeQuery('SELECT * FROM projects WHERE id = 2')
      expect(project2.task_count).toBe(1)

      // WHEN: Project with no tasks
      await executeQuery("INSERT INTO projects (name) VALUES ('Empty Project')")

      // THEN: COUNT returns 0 for empty relation
      const emptyProject = await executeQuery('SELECT * FROM projects WHERE id = 3')
      expect(emptyProject.task_count).toBe(0)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-ROLLUP-003: should support AVG, MIN, MAX statistical aggregations',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Products table with multiple statistical rollup fields
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'products',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              {
                id: 2,
                name: 'reviews',
                type: 'relationship',
                relatedTable: 'reviews',
                relationType: 'one-to-many',
                foreignKey: 'product_id',
              },
              {
                id: 3,
                name: 'avg_rating',
                type: 'rollup',
                relationshipField: 'reviews',
                relatedField: 'rating',
                aggregation: 'avg',
              },
              {
                id: 4,
                name: 'min_rating',
                type: 'rollup',
                relationshipField: 'reviews',
                relatedField: 'rating',
                aggregation: 'min',
              },
              {
                id: 5,
                name: 'max_rating',
                type: 'rollup',
                relationshipField: 'reviews',
                relatedField: 'rating',
                aggregation: 'max',
              },
            ],
          },
          {
            id: 2,
            name: 'reviews',
            fields: [
              {
                id: 1,
                name: 'product_id',
                type: 'relationship',
                relatedTable: 'products',
                relationType: 'many-to-one',
              },
              { id: 2, name: 'rating', type: 'integer' },
            ],
          },
        ],
      })

      // WHEN: Inserting product with reviews
      await executeQuery("INSERT INTO products (name) VALUES ('Laptop')")
      await executeQuery(
        'INSERT INTO reviews (product_id, rating) VALUES (1, 5), (1, 4), (1, 5), (1, 3)'
      )

      // THEN: Statistical rollup fields are directly accessible
      const product = await executeQuery('SELECT * FROM products WHERE id = 1')
      expect(product.avg_rating).toBe(4.25) // (5 + 4 + 5 + 3) / 4
      expect(product.min_rating).toBe(3)
      expect(product.max_rating).toBe(5)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-ROLLUP-004: should efficiently aggregate across multiple parent records with GROUP BY',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Departments table with salary rollup
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'departments',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              {
                id: 2,
                name: 'employees',
                type: 'relationship',
                relatedTable: 'employees',
                relationType: 'one-to-many',
                foreignKey: 'department_id',
              },
              {
                id: 3,
                name: 'total_salary',
                type: 'rollup',
                relationshipField: 'employees',
                relatedField: 'salary',
                aggregation: 'sum',
              },
            ],
          },
          {
            id: 2,
            name: 'employees',
            fields: [
              {
                id: 1,
                name: 'department_id',
                type: 'relationship',
                relatedTable: 'departments',
                relationType: 'many-to-one',
              },
              { id: 2, name: 'salary', type: 'decimal' },
            ],
          },
        ],
      })

      // WHEN: Inserting departments and employees
      await executeQuery(
        "INSERT INTO departments (name) VALUES ('Engineering'), ('Sales'), ('Marketing')"
      )
      await executeQuery(
        'INSERT INTO employees (department_id, salary) VALUES (1, 90000), (1, 85000), (1, 95000), (2, 70000), (2, 75000), (3, 60000)'
      )

      // THEN: Rollup works efficiently for all departments
      const allDepartments = await executeQuery('SELECT * FROM departments ORDER BY id')
      expect(allDepartments.rows).toEqual([
        { id: 1, name: 'Engineering', total_salary: 270_000 }, // 90k + 85k + 95k
        { id: 2, name: 'Sales', total_salary: 145_000 }, // 70k + 75k
        { id: 3, name: 'Marketing', total_salary: 60_000 },
      ])

      // THEN: Can filter departments by computed rollup value
      const highBudgetDepts = await executeQuery(
        'SELECT * FROM departments WHERE total_salary > 100000 ORDER BY id'
      )
      expect(highBudgetDepts.rows).toEqual([
        { id: 1, name: 'Engineering', total_salary: 270_000 },
        { id: 2, name: 'Sales', total_salary: 145_000 },
      ])
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-ROLLUP-005: should create VIEW to encapsulate rollup aggregation logic',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Accounts table with revenue rollup
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'accounts',
            fields: [
              { id: 1, name: 'account_name', type: 'single-line-text' },
              {
                id: 2,
                name: 'invoices',
                type: 'relationship',
                relatedTable: 'invoices',
                relationType: 'one-to-many',
                foreignKey: 'account_id',
              },
              {
                id: 3,
                name: 'revenue_total',
                type: 'rollup',
                relationshipField: 'invoices',
                relatedField: 'amount',
                aggregation: 'sum',
              },
            ],
          },
          {
            id: 2,
            name: 'invoices',
            fields: [
              {
                id: 1,
                name: 'account_id',
                type: 'relationship',
                relatedTable: 'accounts',
                relationType: 'many-to-one',
              },
              { id: 2, name: 'amount', type: 'decimal' },
            ],
          },
        ],
      })

      // WHEN: Inserting accounts and invoices
      await executeQuery("INSERT INTO accounts (account_name) VALUES ('Acme Corp'), ('Tech Inc')")
      await executeQuery(
        'INSERT INTO invoices (account_id, amount) VALUES (1, 5000.00), (1, 3000.00), (2, 10000.00)'
      )

      // THEN: View is created for rollup logic (implementation detail)
      // Note: View may be named 'accounts' (replacing table) or 'accounts_view'
      const viewExists = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.views WHERE table_schema = 'public' AND table_name LIKE '%accounts%'"
      )
      expect(viewExists.count).toBeGreaterThan(0)

      // THEN: Rollup value is directly accessible
      const acme = await executeQuery("SELECT * FROM accounts WHERE account_name = 'Acme Corp'")
      expect(acme.revenue_total).toBe(8000) // 5000 + 3000

      // THEN: Can aggregate on rollup fields
      const totalRevenue = await executeQuery('SELECT SUM(revenue_total) as total FROM accounts')
      expect(totalRevenue.total).toBe(18_000) // 8000 + 10000
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-ROLLUP-006: should count non-empty values with COUNTA aggregation',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Authors table with COUNTA rollup (counts non-empty descriptions)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'authors',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              {
                id: 2,
                name: 'books',
                type: 'relationship',
                relatedTable: 'books',
                relationType: 'one-to-many',
                foreignKey: 'author_id',
              },
              {
                id: 3,
                name: 'books_with_description_count',
                type: 'rollup',
                relationshipField: 'books',
                relatedField: 'description',
                aggregation: 'counta',
              },
            ],
          },
          {
            id: 2,
            name: 'books',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text' },
              { id: 2, name: 'description', type: 'long-text' },
              {
                id: 3,
                name: 'author_id',
                type: 'relationship',
                relatedTable: 'authors',
                relationType: 'many-to-one',
              },
            ],
          },
        ],
      })

      // WHEN: Inserting author with books (some have description, some don't)
      await executeQuery("INSERT INTO authors (name) VALUES ('Jane Austen')")
      await executeQuery(`
        INSERT INTO books (title, description, author_id) VALUES
        ('Pride and Prejudice', 'A romantic novel about Elizabeth Bennet', 1),
        ('Sense and Sensibility', NULL, 1),
        ('Emma', 'A novel about youthful hubris', 1),
        ('Persuasion', '', 1)
      `)

      // THEN: COUNTA counts only non-empty values (excludes NULL and empty strings)
      const author = await executeQuery('SELECT * FROM authors WHERE id = 1')
      expect(author.books_with_description_count).toBe(2) // Only 'Pride' and 'Emma'
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-ROLLUP-007: should count all linked records with COUNTALL including empty',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Projects table with COUNTALL rollup (counts all linked records)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'projects',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              {
                id: 2,
                name: 'tasks',
                type: 'relationship',
                relatedTable: 'tasks',
                relationType: 'one-to-many',
                foreignKey: 'project_id',
              },
              {
                id: 3,
                name: 'total_tasks',
                type: 'rollup',
                relationshipField: 'tasks',
                relatedField: 'id',
                aggregation: 'countall',
              },
            ],
          },
          {
            id: 2,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text' },
              { id: 2, name: 'notes', type: 'long-text' },
              {
                id: 3,
                name: 'project_id',
                type: 'relationship',
                relatedTable: 'projects',
                relationType: 'many-to-one',
              },
            ],
          },
        ],
      })

      // WHEN: Inserting project with tasks (some have empty fields)
      await executeQuery("INSERT INTO projects (name) VALUES ('Website')")
      await executeQuery(`
        INSERT INTO tasks (title, notes, project_id) VALUES
        ('Design', 'Create mockups', 1),
        ('Code', NULL, 1),
        ('Test', '', 1),
        ('Deploy', 'To production', 1)
      `)

      // THEN: COUNTALL counts all linked records regardless of field values
      const project = await executeQuery('SELECT * FROM projects WHERE id = 1')
      expect(project.total_tasks).toBe(4) // All 4 tasks counted
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-ROLLUP-008: should support MIN and MAX aggregation with date fields',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Projects table with date MIN/MAX rollup fields
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'projects',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              {
                id: 2,
                name: 'tasks',
                type: 'relationship',
                relatedTable: 'tasks',
                relationType: 'one-to-many',
                foreignKey: 'project_id',
              },
              {
                id: 3,
                name: 'earliest_task_date',
                type: 'rollup',
                relationshipField: 'tasks',
                relatedField: 'due_date',
                aggregation: 'min',
              },
              {
                id: 4,
                name: 'latest_task_date',
                type: 'rollup',
                relationshipField: 'tasks',
                relatedField: 'due_date',
                aggregation: 'max',
              },
            ],
          },
          {
            id: 2,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text' },
              { id: 2, name: 'due_date', type: 'date' },
              {
                id: 3,
                name: 'project_id',
                type: 'relationship',
                relatedTable: 'projects',
                relationType: 'many-to-one',
              },
            ],
          },
        ],
      })

      // WHEN: Inserting project with tasks with various dates
      await executeQuery("INSERT INTO projects (name) VALUES ('Q1 Release')")
      await executeQuery(`
        INSERT INTO tasks (title, due_date, project_id) VALUES
        ('Planning', '2024-01-15', 1),
        ('Development', '2024-02-28', 1),
        ('Testing', '2024-03-10', 1),
        ('Launch', '2024-03-31', 1)
      `)

      // THEN: MIN/MAX date rollups are directly accessible
      const project = await executeQuery('SELECT * FROM projects WHERE id = 1')
      expect(project.earliest_task_date).toEqual(new Date('2024-01-15'))
      expect(project.latest_task_date).toEqual(new Date('2024-03-31'))
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-ROLLUP-009: should apply conditions to filter rollup aggregation',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Projects table with conditional rollup (filters by status)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'projects',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              {
                id: 2,
                name: 'tasks',
                type: 'relationship',
                relatedTable: 'tasks',
                relationType: 'one-to-many',
                foreignKey: 'project_id',
              },
              {
                id: 3,
                name: 'completed_hours',
                type: 'rollup',
                relationshipField: 'tasks',
                relatedField: 'hours',
                aggregation: 'sum',
                filters: { field: 'status', operator: 'equals', value: 'completed' },
              },
              {
                id: 4,
                name: 'pending_hours',
                type: 'rollup',
                relationshipField: 'tasks',
                relatedField: 'hours',
                aggregation: 'sum',
                filters: { field: 'status', operator: 'equals', value: 'pending' },
              },
            ],
          },
          {
            id: 2,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text' },
              { id: 2, name: 'hours', type: 'decimal' },
              { id: 3, name: 'status', type: 'single-line-text' },
              {
                id: 4,
                name: 'project_id',
                type: 'relationship',
                relatedTable: 'projects',
                relationType: 'many-to-one',
              },
            ],
          },
        ],
      })

      // WHEN: Inserting project with tasks with different statuses
      await executeQuery("INSERT INTO projects (name) VALUES ('Website Redesign')")
      await executeQuery(`
        INSERT INTO tasks (title, hours, status, project_id) VALUES
        ('Design', 8.0, 'completed', 1),
        ('Frontend', 16.0, 'completed', 1),
        ('Backend', 24.0, 'pending', 1),
        ('Testing', 12.0, 'pending', 1)
      `)

      // THEN: Conditional rollup sums only matching records
      const project = await executeQuery('SELECT * FROM projects WHERE id = 1')
      expect(project.completed_hours).toBe(24.0) // 8 + 16
      expect(project.pending_hours).toBe(36.0) // 24 + 12
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-ROLLUP-010: should return unique values with ARRAYUNIQUE aggregation',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Projects table with ARRAYUNIQUE rollup (distinct assignees)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'projects',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              {
                id: 2,
                name: 'tasks',
                type: 'relationship',
                relatedTable: 'tasks',
                relationType: 'one-to-many',
                foreignKey: 'project_id',
              },
              {
                id: 3,
                name: 'unique_assignees',
                type: 'rollup',
                relationshipField: 'tasks',
                relatedField: 'assignee',
                aggregation: 'arrayunique',
              },
            ],
          },
          {
            id: 2,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text' },
              { id: 2, name: 'assignee', type: 'single-line-text' },
              {
                id: 3,
                name: 'project_id',
                type: 'relationship',
                relatedTable: 'projects',
                relationType: 'many-to-one',
              },
            ],
          },
        ],
      })

      // WHEN: Inserting project with tasks with duplicate assignees
      await executeQuery("INSERT INTO projects (name) VALUES ('Website')")
      await executeQuery(`
        INSERT INTO tasks (title, assignee, project_id) VALUES
        ('Design', 'Alice', 1),
        ('Frontend', 'Bob', 1),
        ('Backend', 'Alice', 1),
        ('Testing', 'Charlie', 1),
        ('Deploy', 'Bob', 1)
      `)

      // THEN: ARRAYUNIQUE returns distinct values as array
      const project = await executeQuery('SELECT * FROM projects WHERE id = 1')
      expect(project.unique_assignees).toEqual(['Alice', 'Bob', 'Charlie'])
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-ROLLUP-011: should reject rollup field when relationshipField does not exist',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Rollup field referencing non-existent relationship field
      // WHEN: Attempting to start server with invalid schema
      // THEN: Should throw validation error
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'customers',
              fields: [
                { id: 1, name: 'name', type: 'single-line-text' },
                {
                  id: 2,
                  name: 'total_order_amount',
                  type: 'rollup',
                  relationshipField: 'customer_id', // Does not exist - should be in orders table
                  relatedField: 'amount',
                  aggregation: 'sum',
                },
              ],
            },
          ],
        })
      ).rejects.toThrow(/relationshipField.*customer_id.*not found|invalid.*relationship/i)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-ROLLUP-012: should reject rollup field when relationshipField is not a relationship type',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Rollup field referencing a non-relationship field
      // WHEN: Attempting to start server with invalid schema
      // THEN: Should throw validation error
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'customers',
              fields: [
                { id: 1, name: 'name', type: 'single-line-text' },
                { id: 2, name: 'email', type: 'email' }, // Not a relationship field
                {
                  id: 3,
                  name: 'total_order_amount',
                  type: 'rollup',
                  relationshipField: 'email', // Points to email field, not relationship
                  relatedField: 'amount',
                  aggregation: 'sum',
                },
              ],
            },
            {
              id: 2,
              name: 'orders',
              fields: [
                {
                  id: 1,
                  name: 'customer_id',
                  type: 'relationship',
                  relatedTable: 'customers',
                  relationType: 'many-to-one',
                },
                { id: 2, name: 'amount', type: 'decimal' },
              ],
            },
          ],
        })
      ).rejects.toThrow(/relationshipField.*must.*relationship|email.*not.*relationship/i)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-ROLLUP-013: user can complete full rollup-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('Setup: Start server with multiple rollup aggregations', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'projects',
              fields: [
                { id: 1, name: 'name', type: 'single-line-text' },
                {
                  id: 2,
                  name: 'tasks',
                  type: 'relationship',
                  relatedTable: 'tasks',
                  relationType: 'one-to-many',
                  foreignKey: 'project_id',
                },
                {
                  id: 3,
                  name: 'total_hours',
                  type: 'rollup',
                  relationshipField: 'tasks',
                  relatedField: 'hours',
                  aggregation: 'sum',
                },
                {
                  id: 4,
                  name: 'task_count',
                  type: 'rollup',
                  relationshipField: 'tasks',
                  relatedField: 'id',
                  aggregation: 'count',
                },
                {
                  id: 5,
                  name: 'avg_hours',
                  type: 'rollup',
                  relationshipField: 'tasks',
                  relatedField: 'hours',
                  aggregation: 'avg',
                },
                {
                  id: 6,
                  name: 'completed_hours',
                  type: 'rollup',
                  relationshipField: 'tasks',
                  relatedField: 'hours',
                  aggregation: 'sum',
                  filters: { field: 'status', operator: 'equals', value: 'completed' },
                },
              ],
            },
            {
              id: 2,
              name: 'tasks',
              fields: [
                { id: 1, name: 'title', type: 'single-line-text' },
                { id: 2, name: 'hours', type: 'decimal' },
                { id: 3, name: 'status', type: 'single-line-text' },
                { id: 4, name: 'due_date', type: 'date' },
                {
                  id: 5,
                  name: 'project_id',
                  type: 'relationship',
                  relatedTable: 'projects',
                  relationType: 'many-to-one',
                },
              ],
            },
          ],
        })

        await executeQuery("INSERT INTO projects (name) VALUES ('Website'), ('Mobile App')")
        await executeQuery(`
          INSERT INTO tasks (title, hours, status, due_date, project_id) VALUES
          ('Design', 8.0, 'completed', '2024-01-15', 1),
          ('Frontend', 16.0, 'completed', '2024-02-28', 1),
          ('Backend', 24.0, 'pending', '2024-03-10', 1),
          ('Testing', 12.0, 'pending', '2024-03-31', 1),
          ('Setup', 4.0, 'completed', '2024-01-10', 2)
        `)
      })

      await test.step('Verify all rollup aggregations are directly accessible', async () => {
        const project = await executeQuery('SELECT * FROM projects WHERE id = 1')

        // Verify SUM aggregation
        expect(project.total_hours).toBe(60.0) // 8 + 16 + 24 + 12

        // Verify COUNT aggregation
        expect(project.task_count).toBe(4)

        // Verify AVG aggregation
        expect(project.avg_hours).toBe(15.0) // 60 / 4

        // Verify conditional rollup filtering
        expect(project.completed_hours).toBe(24.0) // 8 + 16
      })

      await test.step('Verify rollup returns zero for empty relations', async () => {
        await executeQuery("INSERT INTO projects (name) VALUES ('Empty Project')")
        const emptyProject = await executeQuery('SELECT * FROM projects WHERE id = 3')

        expect(emptyProject.total_hours).toBe(0)
        expect(emptyProject.task_count).toBe(0)
        expect(emptyProject.avg_hours).toBeNull() // AVG of empty set is NULL
        expect(emptyProject.completed_hours).toBe(0)
      })

      await test.step('Verify rollup updates when records change', async () => {
        // WHEN: Updating task status
        await executeQuery("UPDATE tasks SET status = 'completed' WHERE id = 3")

        // THEN: Computed rollup values update automatically
        const updated = await executeQuery('SELECT * FROM projects WHERE id = 1')
        expect(updated.completed_hours).toBe(48.0) // 8 + 16 + 24 (now completed)
      })

      await test.step('Verify can filter by rollup values', async () => {
        const highHourProjects = await executeQuery(
          'SELECT * FROM projects WHERE total_hours > 20 ORDER BY id'
        )
        expect(highHourProjects.rows.length).toBe(1)
        expect(highHourProjects.rows[0].name).toBe('Website')
      })
    }
  )
})
