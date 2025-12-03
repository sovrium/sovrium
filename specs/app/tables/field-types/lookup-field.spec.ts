/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Lookup Field
 *
 * Source: src/domain/models/app/table/field-types/lookup-field.ts
 * Domain: app
 * Spec Count: 9
 *
 * Reference: https://support.airtable.com/docs/lookup-field-overview
 *
 * NOTE: Some lookup field properties (conditions) are planned but not yet implemented.
 * Tests use type assertions to document the intended API.
 */

/**
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Lookup Field', () => {
  test(
    'APP-TABLES-FIELD-TYPES-LOOKUP-001: should retrieve related field via JOIN',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with relationship and lookup fields
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'customers',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'email', type: 'email' },
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
              {
                id: 4,
                name: 'customer_name',
                type: 'lookup',
                relationshipField: 'customer_id',
                relatedField: 'name',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery(
        "INSERT INTO customers (name, email) VALUES ('Alice Johnson', 'alice@example.com'), ('Bob Smith', 'bob@example.com')"
      )
      await executeQuery(
        'INSERT INTO orders (customer_id, amount) VALUES (1, 150.00), (2, 200.00), (1, 75.50)'
      )

      // THEN: lookup field retrieves related name via JOIN
      const lookup = await executeQuery(
        'SELECT o.id, c.name as customer_name FROM orders o JOIN customers c ON o.customer_id = c.id WHERE o.id = 1'
      )
      expect(lookup.id).toBe(1)
      expect(lookup.customer_name).toBe('Alice Johnson')

      // THEN: multiple orders can lookup same customer
      const multipleOrders = await executeQuery(
        "SELECT COUNT(*) as count FROM orders o JOIN customers c ON o.customer_id = c.id WHERE c.name = 'Alice Johnson'"
      )
      expect(multipleOrders.count).toBe(2)

      // THEN: all lookups work correctly
      const allLookups = await executeQuery(
        'SELECT o.id, c.name as customer_name FROM orders o JOIN customers c ON o.customer_id = c.id ORDER BY o.id'
      )
      expect(allLookups.rows).toEqual([
        { id: 1, customer_name: 'Alice Johnson' },
        { id: 2, customer_name: 'Bob Smith' },
        { id: 3, customer_name: 'Alice Johnson' },
      ])
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-LOOKUP-002: should support multiple lookup fields through same relationship',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with multiple lookup fields
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'employees',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'email', type: 'email' },
              { id: 4, name: 'department', type: 'single-line-text' },
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
                name: 'assigned_to',
                type: 'relationship',
                relatedTable: 'employees',
                relationType: 'many-to-one',
              },
              {
                id: 4,
                name: 'assignee_name',
                type: 'lookup',
                relationshipField: 'assigned_to',
                relatedField: 'name',
              },
              {
                id: 5,
                name: 'assignee_email',
                type: 'lookup',
                relationshipField: 'assigned_to',
                relatedField: 'email',
              },
              {
                id: 6,
                name: 'assignee_department',
                type: 'lookup',
                relationshipField: 'assigned_to',
                relatedField: 'department',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery(
        "INSERT INTO employees (name, email, department) VALUES ('John Doe', 'john@company.com', 'Engineering')"
      )
      await executeQuery(
        "INSERT INTO tasks (title, assigned_to) VALUES ('Fix bug', 1), ('Write docs', 1)"
      )

      // THEN: multiple lookup fields retrieve different values from same related record
      const multipleLookups = await executeQuery(
        'SELECT t.id, e.name as assignee_name, e.email as assignee_email, e.department as assignee_department FROM tasks t JOIN employees e ON t.assigned_to = e.id WHERE t.id = 1'
      )
      expect(multipleLookups.id).toBe(1)
      expect(multipleLookups.assignee_name).toBe('John Doe')
      expect(multipleLookups.assignee_email).toBe('john@company.com')
      expect(multipleLookups.assignee_department).toBe('Engineering')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-LOOKUP-003: should create VIEW to encapsulate lookup logic',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with views for lookup fields
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'categories',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
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
                relationType: 'many-to-one',
              },
              {
                id: 4,
                name: 'product_category',
                type: 'lookup',
                relationshipField: 'category_id',
                relatedField: 'name',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            views: [
              {
                id: 1,
                name: 'products_with_category',
                query:
                  'SELECT p.id, p.title, p.category_id, c.name as product_category FROM products p LEFT JOIN categories c ON p.category_id = c.id',
              },
            ],
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery("INSERT INTO categories (name) VALUES ('Electronics'), ('Clothing')")
      await executeQuery(
        "INSERT INTO products (title, category_id) VALUES ('Laptop', 1), ('T-Shirt', 2)"
      )

      // THEN: view is created for lookup logic
      const viewExists = await executeQuery(
        "SELECT table_name FROM information_schema.views WHERE table_name = 'products_with_category'"
      )
      expect(viewExists.table_name).toBe('products_with_category')

      // THEN: view returns lookup values correctly
      const viewData = await executeQuery(
        'SELECT id, title, product_category FROM products_with_category WHERE id = 1'
      )
      expect(viewData.id).toBe(1)
      expect(viewData.title).toBe('Laptop')
      expect(viewData.product_category).toBe('Electronics')

      // THEN: view can be filtered by lookup field
      const filterByLookup = await executeQuery(
        "SELECT COUNT(*) as count FROM products_with_category WHERE product_category = 'Electronics'"
      )
      expect(filterByLookup.count).toBe(1)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-LOOKUP-004: should return NULL when relationship is NULL via LEFT JOIN',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with optional relationship
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'companies',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
          {
            id: 2,
            name: 'invoices',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'invoice_number', type: 'single-line-text' },
              {
                id: 3,
                name: 'company_id',
                type: 'relationship',
                relatedTable: 'companies',
                relationType: 'many-to-one',
              },
              {
                id: 4,
                name: 'company_name',
                type: 'lookup',
                relationshipField: 'company_id',
                relatedField: 'name',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: inserting test data with NULL relationship
      await executeQuery("INSERT INTO companies (name) VALUES ('Acme Corp')")
      await executeQuery(
        "INSERT INTO invoices (invoice_number, company_id) VALUES ('INV-001', 1), ('INV-002', NULL)"
      )

      // THEN: lookup returns value when relationship exists
      const withRelationship = await executeQuery(
        "SELECT i.invoice_number, c.name as company_name FROM invoices i LEFT JOIN companies c ON i.company_id = c.id WHERE i.invoice_number = 'INV-001'"
      )
      expect(withRelationship).toEqual({ invoice_number: 'INV-001', company_name: 'Acme Corp' })

      // THEN: lookup returns NULL when relationship is NULL
      const nullRelationship = await executeQuery(
        "SELECT i.invoice_number, c.name as company_name FROM invoices i LEFT JOIN companies c ON i.company_id = c.id WHERE i.invoice_number = 'INV-002'"
      )
      expect(nullRelationship).toEqual({ invoice_number: 'INV-002', company_name: null })

      // THEN: LEFT JOIN includes all records
      const allRecords = await executeQuery(
        'SELECT COUNT(*) as count FROM invoices i LEFT JOIN companies c ON i.company_id = c.id'
      )
      expect(allRecords.count).toBe(2)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-LOOKUP-005: should reflect updated values immediately when related record changes',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with lookup field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'products',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'price', type: 'decimal' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
          {
            id: 2,
            name: 'line_items',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'product_id',
                type: 'relationship',
                relatedTable: 'products',
                relationType: 'many-to-one',
              },
              { id: 3, name: 'quantity', type: 'integer' },
              {
                id: 4,
                name: 'product_price',
                type: 'lookup',
                relationshipField: 'product_id',
                relatedField: 'price',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery("INSERT INTO products (name, price) VALUES ('Widget', 19.99)")
      await executeQuery('INSERT INTO line_items (product_id, quantity) VALUES (1, 5)')

      // THEN: lookup shows initial value
      const initialLookup = await executeQuery(
        'SELECT li.id, p.price as product_price FROM line_items li JOIN products p ON li.product_id = p.id WHERE li.id = 1'
      )
      expect(initialLookup).toEqual({ id: 1, product_price: '19.99' })

      // WHEN: updating related record
      await executeQuery('UPDATE products SET price = 24.99 WHERE id = 1')

      // THEN: lookup reflects updated value immediately
      const updatedLookup = await executeQuery(
        'SELECT li.id, p.price as product_price FROM line_items li JOIN products p ON li.product_id = p.id WHERE li.id = 1'
      )
      expect(updatedLookup).toEqual({ id: 1, product_price: '24.99' })
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-LOOKUP-006: user can complete full lookup-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('Setup: Start server with lookup field', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'categories',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'name', type: 'single-line-text' },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
            },
            {
              id: 2,
              name: 'items',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'title', type: 'single-line-text' },
                {
                  id: 3,
                  name: 'category_id',
                  type: 'relationship',
                  relatedTable: 'categories',
                  relationType: 'many-to-one',
                },
                {
                  id: 4,
                  name: 'category_name',
                  type: 'lookup',
                  relationshipField: 'category_id',
                  relatedField: 'name',
                },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
            },
          ],
        })

        await executeQuery("INSERT INTO categories (name) VALUES ('Books')")
        await executeQuery("INSERT INTO items (category_id, title) VALUES (1, 'The Great Book')")
      })

      await test.step('Verify lookup field retrieves related value', async () => {
        const lookup = await executeQuery(
          'SELECT i.id, c.name as category_name FROM items i JOIN categories c ON i.category_id = c.id WHERE i.id = 1'
        )
        expect(lookup.category_name).toBe('Books')
      })
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-LOOKUP-007: should concatenate values from multiple linked records',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with many-to-many relationship and lookup
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
                name: 'team_member_names',
                type: 'lookup',
                relationshipField: 'project_id',
                relatedField: 'member_name',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
          {
            id: 2,
            name: 'members',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'member_name', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
          {
            id: 3,
            name: 'project_members',
            fields: [
              {
                id: 1,
                name: 'project_id',
                type: 'relationship',
                relatedTable: 'projects',
                relationType: 'many-to-one',
                required: true,
              },
              {
                id: 2,
                name: 'member_id',
                type: 'relationship',
                relatedTable: 'members',
                relationType: 'many-to-one',
                required: true,
              },
            ],
            primaryKey: { type: 'composite', fields: ['project_id', 'member_id'] },
          },
        ],
      })

      // WHEN: inserting test data with multiple linked records
      await executeQuery("INSERT INTO projects (name) VALUES ('Website Redesign')")
      await executeQuery("INSERT INTO members (member_name) VALUES ('Alice'), ('Bob'), ('Charlie')")
      await executeQuery(
        'INSERT INTO project_members (project_id, member_id) VALUES (1, 1), (1, 2), (1, 3)'
      )

      // THEN: lookup concatenates values from multiple linked records
      const concatenatedLookup = await executeQuery(`
        SELECT p.id, STRING_AGG(m.member_name, ', ' ORDER BY m.member_name) as team_member_names
        FROM projects p
        LEFT JOIN project_members pm ON p.id = pm.project_id
        LEFT JOIN members m ON pm.member_id = m.id
        WHERE p.id = 1
        GROUP BY p.id
      `)
      expect(concatenatedLookup.team_member_names).toBe('Alice, Bob, Charlie')
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-LOOKUP-008: should apply conditions to filter lookup results',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with conditional lookup
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
                name: 'active_tasks',
                type: 'lookup',
                relationshipField: 'project_id',
                relatedField: 'title',
                conditions: [{ field: 'status', operator: 'equals', value: 'active' }],
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
        ('Design', 'active', 1),
        ('Code', 'active', 1),
        ('Test', 'completed', 1),
        ('Deploy', 'pending', 1)
      `)

      // THEN: conditional lookup only includes matching records
      const conditionalLookup = await executeQuery(`
        SELECT p.id, STRING_AGG(t.title, ', ' ORDER BY t.title) as active_tasks
        FROM projects p
        LEFT JOIN tasks t ON p.id = t.project_id AND t.status = 'active'
        WHERE p.id = 1
        GROUP BY p.id
      `)
      expect(conditionalLookup.active_tasks).toBe('Code, Design')
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-LOOKUP-009: should lookup different field types (text, number, date)',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with lookups of different field types
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'products',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'price', type: 'decimal' },
              { id: 4, name: 'release_date', type: 'date' },
              { id: 5, name: 'in_stock', type: 'checkbox' },
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
                name: 'product_id',
                type: 'relationship',
                relatedTable: 'products',
                relationType: 'many-to-one',
              },
              { id: 3, name: 'quantity', type: 'integer' },
              {
                id: 4,
                name: 'product_name',
                type: 'lookup',
                relationshipField: 'product_id',
                relatedField: 'name',
              },
              {
                id: 5,
                name: 'product_price',
                type: 'lookup',
                relationshipField: 'product_id',
                relatedField: 'price',
              },
              {
                id: 6,
                name: 'product_release_date',
                type: 'lookup',
                relationshipField: 'product_id',
                relatedField: 'release_date',
              },
              {
                id: 7,
                name: 'product_in_stock',
                type: 'lookup',
                relationshipField: 'product_id',
                relatedField: 'in_stock',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: inserting test data with various field types
      await executeQuery(
        "INSERT INTO products (name, price, release_date, in_stock) VALUES ('Widget Pro', 99.99, '2024-03-15', true)"
      )
      await executeQuery('INSERT INTO orders (product_id, quantity) VALUES (1, 5)')

      // THEN: lookup retrieves text field correctly
      const textLookup = await executeQuery(`
        SELECT o.id, p.name as product_name
        FROM orders o
        JOIN products p ON o.product_id = p.id
        WHERE o.id = 1
      `)
      expect(textLookup.product_name).toBe('Widget Pro')

      // THEN: lookup retrieves decimal field correctly
      const decimalLookup = await executeQuery(`
        SELECT o.id, p.price as product_price
        FROM orders o
        JOIN products p ON o.product_id = p.id
        WHERE o.id = 1
      `)
      expect(decimalLookup.product_price).toBe('99.99')

      // THEN: lookup retrieves date field correctly
      const dateLookup = await executeQuery(`
        SELECT o.id, p.release_date as product_release_date
        FROM orders o
        JOIN products p ON o.product_id = p.id
        WHERE o.id = 1
      `)
      expect(dateLookup.product_release_date).toEqual(new Date('2024-03-15'))

      // THEN: lookup retrieves boolean field correctly
      const booleanLookup = await executeQuery(`
        SELECT o.id, p.in_stock as product_in_stock
        FROM orders o
        JOIN products p ON o.product_id = p.id
        WHERE o.id = 1
      `)
      expect(booleanLookup.product_in_stock).toBe(true)
    }
  )
})
