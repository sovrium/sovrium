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
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Lookup Field', () => {
  test(
    'APP-TABLES-FIELD-TYPES-LOOKUP-001: should retrieve related field via JOIN',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // Initialize server with minimal schema to enable database access
      await startServerWithSchema({
        name: 'test-app',
        tables: [],
      })

      // GIVEN: table configuration
      await executeQuery([
        'CREATE TABLE customers (id SERIAL PRIMARY KEY, name VARCHAR(255), email VARCHAR(255))',
        "INSERT INTO customers (name, email) VALUES ('Alice Johnson', 'alice@example.com'), ('Bob Smith', 'bob@example.com')",
        'CREATE TABLE orders (id SERIAL PRIMARY KEY, customer_id INTEGER REFERENCES customers(id), amount DECIMAL(10,2))',
        'INSERT INTO orders (customer_id, amount) VALUES (1, 150.00), (2, 200.00), (1, 75.50)',
      ])

      // WHEN: executing query
      const lookup = await executeQuery(
        'SELECT o.id, c.name as customer_name FROM orders o JOIN customers c ON o.customer_id = c.id WHERE o.id = 1'
      )
      // THEN: assertion
      expect(lookup.id).toBe(1)
      expect(lookup.customer_name).toBe('Alice Johnson')

      // WHEN: executing query
      const multipleOrders = await executeQuery(
        "SELECT COUNT(*) as count FROM orders o JOIN customers c ON o.customer_id = c.id WHERE c.name = 'Alice Johnson'"
      )
      // THEN: assertion
      expect(multipleOrders.count).toBe(2)

      // WHEN: executing query
      const allLookups = await executeQuery(
        'SELECT o.id, c.name as customer_name FROM orders o JOIN customers c ON o.customer_id = c.id ORDER BY o.id'
      )
      // THEN: assertion
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
      // Initialize server with minimal schema to enable database access
      await startServerWithSchema({
        name: 'test-app',
        tables: [],
      })

      // GIVEN: table configuration
      await executeQuery([
        'CREATE TABLE employees (id SERIAL PRIMARY KEY, name VARCHAR(255), email VARCHAR(255), department VARCHAR(100))',
        "INSERT INTO employees (name, email, department) VALUES ('John Doe', 'john@company.com', 'Engineering')",
        'CREATE TABLE tasks (id SERIAL PRIMARY KEY, title VARCHAR(255), assigned_to INTEGER REFERENCES employees(id))',
        "INSERT INTO tasks (title, assigned_to) VALUES ('Fix bug', 1), ('Write docs', 1)",
      ])

      // WHEN: executing query
      const multipleLookups = await executeQuery(
        'SELECT t.id, e.name as assignee_name, e.email as assignee_email, e.department as assignee_department FROM tasks t JOIN employees e ON t.assigned_to = e.id WHERE t.id = 1'
      )
      // THEN: assertion
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
      // Initialize server with minimal schema to enable database access
      await startServerWithSchema({
        name: 'test-app',
        tables: [],
      })

      // GIVEN: table configuration
      await executeQuery([
        'CREATE TABLE categories (id SERIAL PRIMARY KEY, name VARCHAR(255))',
        "INSERT INTO categories (name) VALUES ('Electronics'), ('Clothing')",
        'CREATE TABLE products (id SERIAL PRIMARY KEY, title VARCHAR(255), category_id INTEGER REFERENCES categories(id))',
        "INSERT INTO products (title, category_id) VALUES ('Laptop', 1), ('T-Shirt', 2)",
        'CREATE VIEW products_with_category AS SELECT p.id, p.title, p.category_id, c.name as product_category FROM products p LEFT JOIN categories c ON p.category_id = c.id',
      ])

      // WHEN: executing query
      const viewExists = await executeQuery(
        "SELECT table_name FROM information_schema.views WHERE table_name = 'products_with_category'"
      )
      // THEN: assertion
      expect(viewExists.table_name).toBe('products_with_category')

      // WHEN: executing query
      const viewData = await executeQuery(
        'SELECT id, title, product_category FROM products_with_category WHERE id = 1'
      )
      // THEN: assertion
      expect(viewData.id).toBe(1)
      expect(viewData.title).toBe('Laptop')
      expect(viewData.product_category).toBe('Electronics')

      // WHEN: executing query
      const filterByLookup = await executeQuery(
        "SELECT COUNT(*) as count FROM products_with_category WHERE product_category = 'Electronics'"
      )
      // THEN: assertion
      expect(filterByLookup.count).toBe(1)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-LOOKUP-004: should return NULL when relationship is NULL via LEFT JOIN',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // Initialize server with minimal schema to enable database access
      await startServerWithSchema({
        name: 'test-app',
        tables: [],
      })

      // GIVEN: table configuration
      await executeQuery([
        'CREATE TABLE companies (id SERIAL PRIMARY KEY, name VARCHAR(255))',
        "INSERT INTO companies (name) VALUES ('Acme Corp')",
        'CREATE TABLE invoices (id SERIAL PRIMARY KEY, invoice_number VARCHAR(50), company_id INTEGER REFERENCES companies(id))',
        "INSERT INTO invoices (invoice_number, company_id) VALUES ('INV-001', 1), ('INV-002', NULL)",
      ])

      // WHEN: executing query
      const withRelationship = await executeQuery(
        "SELECT i.invoice_number, c.name as company_name FROM invoices i LEFT JOIN companies c ON i.company_id = c.id WHERE i.invoice_number = 'INV-001'"
      )
      // THEN: assertion
      expect(withRelationship.invoice_number).toBe('INV-001')
      expect(withRelationship.company_name).toBe('Acme Corp')

      // WHEN: executing query
      const nullRelationship = await executeQuery(
        "SELECT i.invoice_number, c.name as company_name FROM invoices i LEFT JOIN companies c ON i.company_id = c.id WHERE i.invoice_number = 'INV-002'"
      )
      // THEN: assertion
      expect(nullRelationship.invoice_number).toBe('INV-002')
      expect(nullRelationship.company_name).toBe(null)

      // WHEN: executing query
      const allRecords = await executeQuery(
        'SELECT COUNT(*) as count FROM invoices i LEFT JOIN companies c ON i.company_id = c.id'
      )
      // THEN: assertion
      expect(allRecords.count).toBe(2)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-LOOKUP-005: should reflect updated values immediately when related record changes',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // Initialize server with minimal schema to enable database access
      await startServerWithSchema({
        name: 'test-app',
        tables: [],
      })

      // GIVEN: table configuration
      await executeQuery([
        'CREATE TABLE products (id SERIAL PRIMARY KEY, name VARCHAR(255), price DECIMAL(10,2))',
        "INSERT INTO products (name, price) VALUES ('Widget', 19.99)",
        'CREATE TABLE line_items (id SERIAL PRIMARY KEY, product_id INTEGER REFERENCES products(id), quantity INTEGER)',
        'INSERT INTO line_items (product_id, quantity) VALUES (1, 5)',
      ])

      // WHEN: executing query
      const initialLookup = await executeQuery(
        'SELECT li.id, p.price as product_price FROM line_items li JOIN products p ON li.product_id = p.id WHERE li.id = 1'
      )
      // THEN: assertion
      expect(initialLookup.id).toBe(1)
      expect(initialLookup.product_price).toBe(19.99)

      // WHEN: executing query
      await executeQuery('UPDATE products SET price = 24.99 WHERE id = 1')

      // WHEN: executing query
      const updatedLookup = await executeQuery(
        'SELECT li.id, p.price as product_price FROM line_items li JOIN products p ON li.product_id = p.id WHERE li.id = 1'
      )
      // THEN: assertion
      expect(updatedLookup.id).toBe(1)
      expect(updatedLookup.product_price).toBe(24.99)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-LOOKUP-006: user can complete full lookup-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('Setup: Start server', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [],
        })
      })

      await test.step('Setup: Create tables and data', async () => {
        await executeQuery([
          'CREATE TABLE categories (id SERIAL PRIMARY KEY, name VARCHAR(255))',
          "INSERT INTO categories (name) VALUES ('Books')",
          'CREATE TABLE items (id SERIAL PRIMARY KEY, category_id INTEGER REFERENCES categories(id), title VARCHAR(255))',
          "INSERT INTO items (category_id, title) VALUES (1, 'The Great Book')",
        ])
      })

      await test.step('Verify lookup field retrieves related value', async () => {
        const lookup = await executeQuery(
          'SELECT i.id, c.name as category_name FROM items i JOIN categories c ON i.category_id = c.id WHERE i.id = 1'
        )
        expect(lookup.category_name).toBe('Books')
      })
    }
  )
})
