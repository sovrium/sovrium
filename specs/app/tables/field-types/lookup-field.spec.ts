/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Lookup Field (Airtable-style Computed Values)
 *
 * Source: src/domain/models/app/table/field-types/lookup-field.ts
 * Domain: app
 * Spec Count: 11
 *
 * Reference: https://support.airtable.com/docs/lookup-field-overview
 *
 * IMPLEMENTATION APPROACH:
 * Lookup fields should work like Airtable - computed values are directly
 * accessible as table columns, NOT manually computed via JOIN queries.
 *
 * Recommended implementation: Create database VIEWs that include looked-up
 * columns via JOINs. Views automatically reflect updates to related records.
 *
 * Example:
 * CREATE VIEW orders_view AS
 * SELECT o.*, c.name as customer_name, c.email as customer_email
 * FROM orders o LEFT JOIN customers c ON o.customer_id = c.id;
 *
 * Tests validate that lookup values are directly readable, not that
 * implementations write correct JOIN SQL.
 */

/**
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (9 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 */

test.describe('Lookup Field', () => {
  test.fixme(
    'APP-TABLES-FIELD-TYPES-LOOKUP-001: should retrieve related field via JOIN',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Orders table with lookup field to customer name
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'customers',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'email', type: 'email' },
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
              {
                id: 3,
                name: 'customer_name',
                type: 'lookup',
                relationshipField: 'customer_id',
                relatedField: 'name',
              },
            ],
          },
        ],
      })

      // WHEN: Inserting customers and orders
      await executeQuery(
        "INSERT INTO customers (name, email) VALUES ('Alice Johnson', 'alice@example.com'), ('Bob Smith', 'bob@example.com')"
      )
      await executeQuery(
        'INSERT INTO orders (customer_id, amount) VALUES (1, 150.00), (2, 200.00), (1, 75.50)'
      )

      // THEN: Lookup field is directly accessible (Airtable-style)
      const order1 = await executeQuery('SELECT * FROM orders WHERE id = 1')
      expect(order1.customer_name).toBe('Alice Johnson')

      const order2 = await executeQuery('SELECT * FROM orders WHERE id = 2')
      expect(order2.customer_name).toBe('Bob Smith')

      const order3 = await executeQuery('SELECT * FROM orders WHERE id = 3')
      expect(order3.customer_name).toBe('Alice Johnson')

      // THEN: Can query all orders with lookup values
      const allOrders = await executeQuery('SELECT * FROM orders ORDER BY id')
      expect(allOrders.rows).toEqual([
        { id: 1, customer_id: 1, amount: 150.0, customer_name: 'Alice Johnson' },
        { id: 2, customer_id: 2, amount: 200.0, customer_name: 'Bob Smith' },
        { id: 3, customer_id: 1, amount: 75.5, customer_name: 'Alice Johnson' },
      ])
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-LOOKUP-002: should support multiple lookup fields through same relationship',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Tasks table with multiple lookup fields from employees
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'email', type: 'email' },
              { id: 3, name: 'department', type: 'single-line-text' },
            ],
          },
          {
            id: 2,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text' },
              {
                id: 2,
                name: 'assigned_to',
                type: 'relationship',
                relatedTable: 'employees',
                relationType: 'many-to-one',
              },
              {
                id: 3,
                name: 'assignee_name',
                type: 'lookup',
                relationshipField: 'assigned_to',
                relatedField: 'name',
              },
              {
                id: 4,
                name: 'assignee_email',
                type: 'lookup',
                relationshipField: 'assigned_to',
                relatedField: 'email',
              },
              {
                id: 5,
                name: 'assignee_department',
                type: 'lookup',
                relationshipField: 'assigned_to',
                relatedField: 'department',
              },
            ],
          },
        ],
      })

      // WHEN: Inserting employee and tasks
      await executeQuery(
        "INSERT INTO employees (name, email, department) VALUES ('John Doe', 'john@company.com', 'Engineering')"
      )
      await executeQuery(
        "INSERT INTO tasks (title, assigned_to) VALUES ('Fix bug', 1), ('Write docs', 1)"
      )

      // THEN: Multiple lookup fields retrieve different values from same related record
      const task = await executeQuery('SELECT * FROM tasks WHERE id = 1')
      expect(task.assignee_name).toBe('John Doe')
      expect(task.assignee_email).toBe('john@company.com')
      expect(task.assignee_department).toBe('Engineering')
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-LOOKUP-003: should create VIEW to encapsulate lookup logic',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Products table with category lookup
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'categories',
            fields: [{ id: 1, name: 'name', type: 'single-line-text' }],
          },
          {
            id: 2,
            name: 'products',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text' },
              {
                id: 2,
                name: 'category_id',
                type: 'relationship',
                relatedTable: 'categories',
                relationType: 'many-to-one',
              },
              {
                id: 3,
                name: 'product_category',
                type: 'lookup',
                relationshipField: 'category_id',
                relatedField: 'name',
              },
            ],
          },
        ],
      })

      // WHEN: Inserting categories and products
      await executeQuery("INSERT INTO categories (name) VALUES ('Electronics'), ('Clothing')")
      await executeQuery(
        "INSERT INTO products (title, category_id) VALUES ('Laptop', 1), ('T-Shirt', 2)"
      )

      // THEN: View is created for lookup logic (implementation detail)
      // Note: View may be named 'products' (replacing table) or 'products_view'
      const viewExists = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.views WHERE table_schema = 'public' AND table_name LIKE '%products%'"
      )
      expect(viewExists.count).toBeGreaterThan(0)

      // THEN: Lookup value is directly accessible
      const laptop = await executeQuery("SELECT * FROM products WHERE title = 'Laptop'")
      expect(laptop.product_category).toBe('Electronics')

      // THEN: Can filter by lookup field
      const electronics = await executeQuery(
        "SELECT * FROM products WHERE product_category = 'Electronics'"
      )
      expect(electronics.rows.length).toBe(1)
      expect(electronics.rows[0].title).toBe('Laptop')
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-LOOKUP-004: should return NULL when relationship is NULL via LEFT JOIN',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Invoices table with optional company relationship
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'companies',
            fields: [{ id: 1, name: 'name', type: 'single-line-text' }],
          },
          {
            id: 2,
            name: 'invoices',
            fields: [
              { id: 1, name: 'invoice_number', type: 'single-line-text' },
              {
                id: 2,
                name: 'company_id',
                type: 'relationship',
                relatedTable: 'companies',
                relationType: 'many-to-one',
              },
              {
                id: 3,
                name: 'company_name',
                type: 'lookup',
                relationshipField: 'company_id',
                relatedField: 'name',
              },
            ],
          },
        ],
      })

      // WHEN: Inserting company and invoices (one without company)
      await executeQuery("INSERT INTO companies (name) VALUES ('Acme Corp')")
      await executeQuery(
        "INSERT INTO invoices (invoice_number, company_id) VALUES ('INV-001', 1), ('INV-002', NULL)"
      )

      // THEN: Lookup returns value when relationship exists
      const inv1 = await executeQuery("SELECT * FROM invoices WHERE invoice_number = 'INV-001'")
      expect(inv1.company_name).toBe('Acme Corp')

      // THEN: Lookup returns NULL when relationship is NULL
      const inv2 = await executeQuery("SELECT * FROM invoices WHERE invoice_number = 'INV-002'")
      expect(inv2.company_name).toBeNull()

      // THEN: Can query all invoices including those with NULL lookup
      const allInvoices = await executeQuery('SELECT COUNT(*) as count FROM invoices')
      expect(allInvoices.count).toBe(2)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-LOOKUP-005: should reflect updated values immediately when related record changes',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Line items table with product price lookup
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'products',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'price', type: 'decimal' },
            ],
          },
          {
            id: 2,
            name: 'line_items',
            fields: [
              {
                id: 1,
                name: 'product_id',
                type: 'relationship',
                relatedTable: 'products',
                relationType: 'many-to-one',
              },
              { id: 2, name: 'quantity', type: 'integer' },
              {
                id: 3,
                name: 'product_price',
                type: 'lookup',
                relationshipField: 'product_id',
                relatedField: 'price',
              },
            ],
          },
        ],
      })

      // WHEN: Inserting product and line item
      await executeQuery("INSERT INTO products (name, price) VALUES ('Widget', 19.99)")
      await executeQuery('INSERT INTO line_items (product_id, quantity) VALUES (1, 5)')

      // THEN: Lookup shows initial value
      const initialItem = await executeQuery('SELECT * FROM line_items WHERE id = 1')
      expect(initialItem.product_price).toBe(19.99)

      // WHEN: Updating related product price
      await executeQuery('UPDATE products SET price = 24.99 WHERE id = 1')

      // THEN: Lookup reflects updated value immediately (view-based)
      const updatedItem = await executeQuery('SELECT * FROM line_items WHERE id = 1')
      expect(updatedItem.product_price).toBe(24.99)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-LOOKUP-006: should concatenate values from multiple linked records',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Projects table with many-to-many relationship to members
      // NOTE: Junction table should be auto-generated by startServerWithSchema
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
                name: 'members',
                type: 'relationship',
                relatedTable: 'members',
                relationType: 'many-to-many',
              },
              {
                id: 3,
                name: 'team_member_names',
                type: 'lookup',
                relationshipField: 'members',
                relatedField: 'member_name',
              },
            ],
          },
          {
            id: 2,
            name: 'members',
            fields: [{ id: 1, name: 'member_name', type: 'single-line-text' }],
          },
        ],
      })

      // WHEN: Inserting project with multiple team members
      await executeQuery("INSERT INTO projects (name) VALUES ('Website Redesign')")
      await executeQuery("INSERT INTO members (member_name) VALUES ('Alice'), ('Bob'), ('Charlie')")
      // Auto-generated junction table should be used here
      await executeQuery(
        'INSERT INTO projects_members (project_id, member_id) VALUES (1, 1), (1, 2), (1, 3)'
      )

      // THEN: Lookup concatenates values from multiple linked records
      const project = await executeQuery('SELECT * FROM projects WHERE id = 1')
      // Airtable returns comma-separated string for multi-record lookups
      expect(project.team_member_names).toBe('Alice, Bob, Charlie')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-LOOKUP-007: should apply conditions to filter lookup results',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Projects table with conditional lookup (only active tasks)
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
                name: 'active_tasks',
                type: 'lookup',
                relationshipField: 'project_id',
                relatedField: 'title',
                filters: { field: 'status', operator: 'equals', value: 'active' },
              },
            ],
          },
          {
            id: 2,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text' },
              { id: 2, name: 'status', type: 'single-line-text' },
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

      // WHEN: Inserting project with tasks of different statuses
      await executeQuery("INSERT INTO projects (name) VALUES ('Website')")
      await executeQuery(`
        INSERT INTO tasks (title, status, project_id) VALUES
        ('Design', 'active', 1),
        ('Code', 'active', 1),
        ('Test', 'completed', 1),
        ('Deploy', 'pending', 1)
      `)

      // THEN: Conditional lookup only includes matching records
      const project = await executeQuery('SELECT * FROM projects WHERE id = 1')
      // Multiple active tasks concatenated
      expect(project.active_tasks).toBe('Code, Design') // Alphabetical order
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-LOOKUP-008: should lookup different field types (text, number, date)',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Orders table with lookups of different field types
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'products',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'price', type: 'decimal' },
              { id: 3, name: 'release_date', type: 'date' },
              { id: 4, name: 'in_stock', type: 'checkbox' },
            ],
          },
          {
            id: 2,
            name: 'orders',
            fields: [
              {
                id: 1,
                name: 'product_id',
                type: 'relationship',
                relatedTable: 'products',
                relationType: 'many-to-one',
              },
              { id: 2, name: 'quantity', type: 'integer' },
              {
                id: 3,
                name: 'product_name',
                type: 'lookup',
                relationshipField: 'product_id',
                relatedField: 'name',
              },
              {
                id: 4,
                name: 'product_price',
                type: 'lookup',
                relationshipField: 'product_id',
                relatedField: 'price',
              },
              {
                id: 5,
                name: 'product_release_date',
                type: 'lookup',
                relationshipField: 'product_id',
                relatedField: 'release_date',
              },
              {
                id: 6,
                name: 'product_in_stock',
                type: 'lookup',
                relationshipField: 'product_id',
                relatedField: 'in_stock',
              },
            ],
          },
        ],
      })

      // WHEN: Inserting product and order
      await executeQuery(
        "INSERT INTO products (name, price, release_date, in_stock) VALUES ('Widget Pro', 99.99, '2024-03-15', true)"
      )
      await executeQuery('INSERT INTO orders (product_id, quantity) VALUES (1, 5)')

      // THEN: All lookup field types are directly accessible
      const order = await executeQuery('SELECT * FROM orders WHERE id = 1')
      expect(order.product_name).toBe('Widget Pro') // text
      expect(order.product_price).toBe(99.99) // decimal
      expect(order.product_release_date).toBe('2024-03-15') // date (returned as ISO string by pg fixtures)
      expect(order.product_in_stock).toBe(true) // boolean
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-LOOKUP-009: should reject lookup field when relationshipField does not exist',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Lookup field referencing non-existent relationship field
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
                { id: 1, name: 'amount', type: 'decimal' },
                {
                  id: 2,
                  name: 'customer_name',
                  type: 'lookup',
                  relationshipField: 'customer_id', // Does not exist in this table
                  relatedField: 'name',
                },
              ],
            },
          ],
        })
      ).rejects.toThrow(/relationshipField.*customer_id.*not found|invalid.*relationship/i)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-LOOKUP-010: should reject lookup field when relationshipField is not a relationship type',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Lookup field referencing a non-relationship field
      // WHEN: Attempting to start server with invalid schema
      // THEN: Should throw validation error
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'customers',
              fields: [{ id: 1, name: 'name', type: 'single-line-text' }],
            },
            {
              id: 2,
              name: 'orders',
              fields: [
                { id: 1, name: 'customer_email', type: 'email' }, // Not a relationship field
                { id: 2, name: 'amount', type: 'decimal' },
                {
                  id: 3,
                  name: 'customer_name',
                  type: 'lookup',
                  relationshipField: 'customer_email', // Points to email field, not relationship
                  relatedField: 'name',
                },
              ],
            },
          ],
        })
      ).rejects.toThrow(/relationshipField.*must.*relationship|customer_email.*not.*relationship/i)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-LOOKUP-011: should reject lookup when relatedField does not exist in related table',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Lookup field pointing to non-existent field in related table
      // WHEN: Attempting to start server with invalid schema
      // THEN: Should throw validation error
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'customers',
              fields: [{ id: 1, name: 'name', type: 'single-line-text' }],
            },
            {
              id: 2,
              name: 'orders',
              fields: [
                { id: 1, name: 'amount', type: 'decimal' },
                {
                  id: 2,
                  name: 'customer_id',
                  type: 'relationship',
                  relatedTable: 'customers',
                  relationType: 'many-to-one',
                },
                {
                  id: 3,
                  name: 'customer_name',
                  type: 'lookup',
                  relationshipField: 'customer_id',
                  relatedField: 'full_name', // 'full_name' doesn't exist in customers!
                },
              ],
            },
          ],
        })
      ).rejects.toThrow(/relatedField.*full_name.*not found|field.*does not exist.*related table/i)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-LOOKUP-012: user can complete full lookup-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('Setup: Start server with multiple lookup fields of different types', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'products',
              fields: [
                { id: 1, name: 'name', type: 'single-line-text' },
                { id: 2, name: 'price', type: 'decimal' },
                { id: 3, name: 'release_date', type: 'date' },
                { id: 4, name: 'in_stock', type: 'checkbox' },
              ],
            },
            {
              id: 2,
              name: 'orders',
              fields: [
                { id: 1, name: 'quantity', type: 'integer' },
                {
                  id: 2,
                  name: 'product_id',
                  type: 'relationship',
                  relatedTable: 'products',
                  relationType: 'many-to-one',
                },
                {
                  id: 3,
                  name: 'product_name',
                  type: 'lookup',
                  relationshipField: 'product_id',
                  relatedField: 'name',
                },
                {
                  id: 4,
                  name: 'product_price',
                  type: 'lookup',
                  relationshipField: 'product_id',
                  relatedField: 'price',
                },
                {
                  id: 5,
                  name: 'product_release_date',
                  type: 'lookup',
                  relationshipField: 'product_id',
                  relatedField: 'release_date',
                },
                {
                  id: 6,
                  name: 'product_in_stock',
                  type: 'lookup',
                  relationshipField: 'product_id',
                  relatedField: 'in_stock',
                },
              ],
            },
          ],
        })

        await executeQuery(`
          INSERT INTO products (name, price, release_date, in_stock) VALUES
          ('Widget Pro', 99.99, '2024-03-15', true),
          ('Gadget Plus', 149.99, '2024-06-01', false)
        `)
        await executeQuery(`
          INSERT INTO orders (product_id, quantity) VALUES (1, 5), (2, 3), (NULL, 1)
        `)
      })

      await test.step('Verify all lookup field types are directly accessible', async () => {
        const order = await executeQuery('SELECT * FROM orders WHERE id = 1')

        expect(order.product_name).toBe('Widget Pro')
        expect(order.product_price).toBe(99.99)
        expect(order.product_release_date).toBe('2024-03-15')
        expect(order.product_in_stock).toBe(true)
      })

      await test.step('Verify NULL relationship returns NULL via LEFT JOIN', async () => {
        const nullOrder = await executeQuery('SELECT * FROM orders WHERE id = 3')

        expect(nullOrder.product_name).toBeNull()
        expect(nullOrder.product_price).toBeNull()
        expect(nullOrder.product_release_date).toBeNull()
        expect(nullOrder.product_in_stock).toBeNull()
      })

      await test.step('Verify lookup updates when related record changes', async () => {
        // WHEN: Updating product name
        await executeQuery("UPDATE products SET name = 'Widget Pro Max' WHERE id = 1")

        // THEN: Lookup reflects updated value immediately
        const updated = await executeQuery('SELECT * FROM orders WHERE id = 1')
        expect(updated.product_name).toBe('Widget Pro Max')
      })

      await test.step('Verify multiple lookups from same relationship', async () => {
        const order = await executeQuery('SELECT * FROM orders WHERE id = 2')

        expect(order.product_name).toBe('Gadget Plus')
        expect(order.product_price).toBe(149.99)
        expect(order.product_in_stock).toBe(false)
      })

      await test.step('Verify can filter by lookup values', async () => {
        const expensiveOrders = await executeQuery(
          'SELECT * FROM orders WHERE product_price > 100 ORDER BY id'
        )

        expect(expensiveOrders.rows.length).toBe(1)
        expect(expensiveOrders.rows[0].id).toBe(2)
      })
    }
  )
})
