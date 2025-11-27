/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Data Tables
 *
 * Source: src/domain/models/app/table/index.ts
 * Domain: app
 * Spec Count: 24
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (24 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Validation Approach:
 * - Configuration validation (startServerWithSchema fixture)
 * - Database assertions (executeQuery fixture for validation)
 * - PostgreSQL behavior validation (constraints, indexes, CRUD)
 */

test.describe('Data Tables', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test(
    'APP-TABLES-001: should create PostgreSQL table with columns when table configuration is applied',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: empty PostgreSQL database
      // WHEN: table configuration {id: 'tbl_products', name: 'products', fields: [{id: 1, name: 'title', type: 'single-line-text', required: true}]} is applied
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'products',
            fields: [
              {
                id: 1,
                name: 'title',
                type: 'single-line-text',
                required: true,
              },
            ],
          },
        ],
      })

      // THEN: PostgreSQL table 'products' is created with columns: id (SERIAL PRIMARY KEY), title (VARCHAR(255) NOT NULL)
      const tableExists = await executeQuery(
        `SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'products')`
      )
      // THEN: assertion
      expect(tableExists.rows[0]).toMatchObject({ exists: true })

      const columns = await executeQuery(
        `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'products' ORDER BY ordinal_position`
      )
      // THEN: assertion
      expect(columns.rows).toEqual([
        { column_name: 'id', data_type: 'integer', is_nullable: 'NO' },
        { column_name: 'title', data_type: 'character varying', is_nullable: 'NO' },
      ])

      const primaryKey = await executeQuery(
        `SELECT constraint_name, constraint_type FROM information_schema.table_constraints WHERE table_name = 'products' AND constraint_type = 'PRIMARY KEY'`
      )
      // THEN: assertion
      expect(primaryKey.rows[0]).toMatchObject({ constraint_type: 'PRIMARY KEY' })
    }
  )

  test(
    'APP-TABLES-002: should create PostgreSQL table with correct column types for different field types',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with 5 different field types (text, email, integer, decimal, boolean)
      // WHEN: table 'customers' is created with these fields
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'customers',
            fields: [
              {
                id: 1,
                name: 'name',
                type: 'single-line-text',
                required: true,
              },
              {
                id: 2,
                name: 'email',
                type: 'email',
                required: true,
                unique: true,
              },
              {
                id: 3,
                name: 'age',
                type: 'integer',
              },
              {
                id: 4,
                name: 'balance',
                type: 'decimal',
                precision: 10,
              },
              {
                id: 5,
                name: 'is_active',
                type: 'checkbox',
              },
            ],
          },
        ],
      })

      // THEN: PostgreSQL table has correct column types: VARCHAR(255) for text/email, INTEGER, NUMERIC(10,2), BOOLEAN
      const columns = await executeQuery(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'customers' ORDER BY ordinal_position`
      )
      // THEN: assertion
      expect(columns.rows).toEqual([
        { column_name: 'id', data_type: 'integer' },
        { column_name: 'name', data_type: 'character varying' },
        { column_name: 'email', data_type: 'character varying' },
        { column_name: 'age', data_type: 'integer' },
        { column_name: 'balance', data_type: 'numeric' },
        { column_name: 'is_active', data_type: 'boolean' },
      ])

      const uniqueConstraint = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='customers' AND constraint_type='UNIQUE'`
      )
      // THEN: assertion
      expect(uniqueConstraint.rows[0]).toMatchObject({ count: 1 })
    }
  )

  test(
    'APP-TABLES-003: should create PRIMARY KEY constraint on custom primary key field',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with explicit primary key field
      // WHEN: table 'orders' is created with custom primary key 'order_id'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'orders',
            fields: [
              {
                id: 1,
                name: 'order_id',
                type: 'integer',
                required: true,
              },
            ],
            primaryKey: { type: 'composite', fields: ['order_id'] },
          },
        ],
      })

      // THEN: PostgreSQL table has PRIMARY KEY constraint on 'order_id' column
      const primaryKey = await executeQuery(
        `SELECT c.column_name, tc.constraint_type FROM information_schema.table_constraints tc JOIN information_schema.constraint_column_usage c ON tc.constraint_name = c.constraint_name WHERE tc.table_name = 'orders' AND tc.constraint_type = 'PRIMARY KEY'`
      )
      // THEN: assertion
      expect(primaryKey.rows[0]).toMatchObject({
        column_name: 'order_id',
        constraint_type: 'PRIMARY KEY',
      })

      const nullable = await executeQuery(
        `SELECT is_nullable FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'order_id'`
      )
      // THEN: assertion
      expect(nullable.rows[0]).toMatchObject({ is_nullable: 'NO' })
    }
  )

  test(
    'APP-TABLES-004: should enforce all constraints (UNIQUE, NOT NULL, CHECK)',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with multiple constraints (UNIQUE, NOT NULL, CHECK)
      // WHEN: table 'products' is created with constrained fields
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'products',
            fields: [
              {
                id: 1,
                name: 'sku',
                type: 'single-line-text',
                required: true,
                unique: true,
              },
              {
                id: 2,
                name: 'title',
                type: 'single-line-text',
                required: true,
              },
              {
                id: 3,
                name: 'price',
                type: 'decimal',
                required: true,
                min: 0.01,
              },
            ],
          },
        ],
      })

      // THEN: PostgreSQL enforces all constraints: UNIQUE on sku, NOT NULL on required fields, CHECK on price > 0
      const uniqueConstraint = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='products' AND constraint_type='UNIQUE' AND constraint_name LIKE '%sku%'`
      )
      // THEN: assertion
      expect(uniqueConstraint.rows[0]).toMatchObject({ count: 1 })

      const notNull = await executeQuery(
        `SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name='products' AND column_name IN ('sku', 'title', 'price') ORDER BY column_name`
      )
      // THEN: assertion
      expect(notNull.rows).toEqual([
        { column_name: 'price', is_nullable: 'NO' },
        { column_name: 'sku', is_nullable: 'NO' },
        { column_name: 'title', is_nullable: 'NO' },
      ])

      const checkConstraint = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.check_constraints WHERE constraint_name LIKE '%price%'`
      )
      // THEN: assertion
      expect(checkConstraint.rows[0]).toMatchObject({ count: 1 })
    }
  )

  test(
    'APP-TABLES-005: should return complete table metadata via introspection queries',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: existing table 'customers' in PostgreSQL with 3 columns
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'customers',
            fields: [
              {
                id: 1,
                name: 'email',
                type: 'email',
                required: true,
                unique: true,
              },
              {
                id: 2,
                name: 'name',
                type: 'single-line-text',
                required: true,
              },
            ],
            indexes: [
              {
                name: 'idx_customers_email',
                fields: ['email'],
              },
            ],
          },
        ],
      })

      // WHEN: schema introspection queries are executed
      // THEN: queries return complete table metadata: columns, types, constraints, indexes
      const tableInfo = await executeQuery(
        `SELECT tablename, schemaname FROM pg_tables WHERE tablename = 'customers'`
      )
      // THEN: assertion
      expect(tableInfo.rows[0]).toMatchObject({
        tablename: 'customers',
        schemaname: 'public',
      })

      const columns = await executeQuery(
        `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'customers' ORDER BY ordinal_position`
      )
      // THEN: assertion
      expect(columns.rows).toEqual([
        { column_name: 'id', data_type: 'integer', is_nullable: 'NO' },
        { column_name: 'email', data_type: 'character varying', is_nullable: 'NO' },
        { column_name: 'name', data_type: 'character varying', is_nullable: 'NO' },
      ])

      const indexes = await executeQuery(
        `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'customers' AND indexname = 'idx_customers_email'`
      )
      // THEN: assertion
      expect(indexes.rows[0]).toMatchObject({ indexname: 'idx_customers_email' })
    }
  )

  test(
    'APP-TABLES-006: should create PostgreSQL VARCHAR(255) column for single-line-text field',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with single-line-text field
      // WHEN: field migration creates column
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 6,
            name: 'items',
            fields: [
              {
                id: 1,
                name: 'title',
                type: 'single-line-text',
              },
            ],
          },
        ],
      })

      // THEN: PostgreSQL VARCHAR(255) column is created
      const column = await executeQuery(
        `SELECT column_name, data_type, character_maximum_length FROM information_schema.columns WHERE table_name='items' AND column_name='title'`
      )
      // THEN: assertion
      expect(column.rows[0]).toMatchObject({
        column_name: 'title',
        data_type: 'character varying',
        character_maximum_length: 255,
      })
    }
  )

  test(
    'APP-TABLES-007: should create PostgreSQL VARCHAR(255) column with UNIQUE and NOT NULL constraints for email field',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with email field (required, unique)
      // WHEN: field migration creates column
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 7,
            name: 'users',
            fields: [
              {
                id: 1,
                name: 'email',
                type: 'email',
                required: true,
                unique: true,
              },
            ],
          },
        ],
      })

      // THEN: PostgreSQL VARCHAR(255) column with UNIQUE and NOT NULL constraints
      const column = await executeQuery(
        `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='users' AND column_name='email'`
      )
      // THEN: assertion
      expect(column.rows[0]).toMatchObject({
        column_name: 'email',
        data_type: 'character varying',
        is_nullable: 'NO',
      })

      const uniqueConstraint = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='users' AND constraint_type='UNIQUE'`
      )
      // THEN: assertion
      expect(uniqueConstraint.rows[0]).toMatchObject({ count: 1 })
    }
  )

  test(
    'APP-TABLES-008: should create PostgreSQL INTEGER column with CHECK constraint for range',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with integer field with min/max constraints
      // WHEN: field migration creates column
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 8,
            name: 'products',
            fields: [
              {
                id: 1,
                name: 'quantity',
                type: 'integer',
                min: 0,
                max: 10_000,
              },
            ],
          },
        ],
      })

      // THEN: PostgreSQL INTEGER column with CHECK constraint for range
      const column = await executeQuery(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='products' AND column_name='quantity'`
      )
      // THEN: assertion
      expect(column.rows[0]).toMatchObject({
        column_name: 'quantity',
        data_type: 'integer',
      })

      const checkConstraint = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.check_constraints WHERE constraint_name LIKE '%quantity%'`
      )
      // THEN: assertion
      expect(checkConstraint.rows[0]).toMatchObject({ count: 1 })
    }
  )

  test(
    'APP-TABLES-009: should create PostgreSQL NUMERIC(10,2) column for decimal field',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with decimal field (precision 10, scale 2)
      // WHEN: field migration creates column
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 9,
            name: 'transactions',
            fields: [
              {
                id: 1,
                name: 'amount',
                type: 'decimal',
                precision: 10,
              },
            ],
          },
        ],
      })

      // THEN: PostgreSQL NUMERIC(10,2) column is created
      const column = await executeQuery(
        `SELECT column_name, data_type, numeric_precision, numeric_scale FROM information_schema.columns WHERE table_name='transactions' AND column_name='amount'`
      )
      // THEN: assertion
      expect(column.rows[0]).toMatchObject({
        column_name: 'amount',
        data_type: 'numeric',
        numeric_precision: 10,
        numeric_scale: 2,
      })
    }
  )

  test(
    'APP-TABLES-010: should create PostgreSQL BOOLEAN column with DEFAULT false for checkbox field',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with checkbox field
      // WHEN: field migration creates column
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 10,
            name: 'settings',
            fields: [
              {
                id: 1,
                name: 'is_active',
                type: 'checkbox',
                default: false,
              },
            ],
          },
        ],
      })

      // THEN: PostgreSQL BOOLEAN column is created with DEFAULT false
      const column = await executeQuery(
        `SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name='settings' AND column_name='is_active'`
      )
      // THEN: assertion
      expect(column.rows[0]).toMatchObject({
        column_name: 'is_active',
        data_type: 'boolean',
        column_default: 'false',
      })
    }
  )

  test.fixme(
    'APP-TABLES-011: should reject duplicate values with unique constraint violation error',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'users' with UNIQUE constraint on email column, existing row email='john@example.com'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 11,
            name: 'users',
            fields: [
              {
                id: 1,
                name: 'email',
                type: 'email',
                required: true,
                unique: true,
              },
            ],
          },
        ],
      })
      await executeQuery(`INSERT INTO users (email) VALUES ('john@example.com')`)

      // WHEN: attempt to insert duplicate email='john@example.com'
      // THEN: PostgreSQL rejects insertion with unique constraint violation error
      const firstInsertion = await executeQuery(
        `SELECT COUNT(*) as count FROM users WHERE email = 'john@example.com'`
      )
      // THEN: assertion
      expect(firstInsertion.rows[0]).toMatchObject({ count: 1 })

      // THEN: assertion
      await expect(
        executeQuery(`INSERT INTO users (email) VALUES ('john@example.com')`)
      ).rejects.toThrow(/duplicate key value violates unique constraint/)

      const finalCount = await executeQuery(`SELECT COUNT(*) as count FROM users`)
      // THEN: assertion
      expect(finalCount.rows[0]).toMatchObject({ count: 1 })
    }
  )

  test.fixme(
    'APP-TABLES-012: should reject NULL values with NOT NULL constraint violation',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'products' with NOT NULL constraint on required field 'title'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 12,
            name: 'products',
            fields: [
              {
                id: 1,
                name: 'title',
                type: 'single-line-text',
                required: true,
              },
              {
                id: 2,
                name: 'price',
                type: 'decimal',
                precision: 10,
              },
            ],
          },
        ],
      })

      // WHEN: attempt to insert NULL value for title
      // THEN: PostgreSQL rejects insertion with NOT NULL constraint violation
      const validInsertion = await executeQuery(
        `INSERT INTO products (title, price) VALUES ('MacBook Pro', 2499.99) RETURNING id, title`
      )
      // THEN: assertion
      expect(validInsertion.rows[0]).toMatchObject({ title: 'MacBook Pro' })

      // THEN: assertion
      await expect(
        executeQuery(`INSERT INTO products (title, price) VALUES (NULL, 999.99)`)
      ).rejects.toThrow(/violates not-null constraint/)
    }
  )

  test.fixme(
    'APP-TABLES-013: should enforce CHECK constraint and reject values outside range',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'inventory' with CHECK constraint (quantity >= 0 AND quantity <= 10000)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 13,
            name: 'inventory',
            fields: [
              {
                id: 1,
                name: 'item_name',
                type: 'single-line-text',
              },
              {
                id: 2,
                name: 'quantity',
                type: 'integer',
                min: 0,
                max: 10_000,
              },
            ],
          },
        ],
      })

      // WHEN: attempt to insert values outside allowed range
      // THEN: PostgreSQL enforces CHECK constraint, rejects invalid values
      const validInsertion = await executeQuery(
        `INSERT INTO inventory (item_name, quantity) VALUES ('Widget', 5000) RETURNING quantity`
      )
      // THEN: assertion
      expect(validInsertion.rows[0]).toMatchObject({ quantity: 5000 })

      // THEN: assertion
      await expect(
        executeQuery(`INSERT INTO inventory (item_name, quantity) VALUES ('Invalid', -1)`)
      ).rejects.toThrow(/violates check constraint/)

      // THEN: assertion
      await expect(
        executeQuery(`INSERT INTO inventory (item_name, quantity) VALUES ('Invalid', 10001)`)
      ).rejects.toThrow(/violates check constraint/)
    }
  )

  test.fixme(
    'APP-TABLES-014: should create index and allow querying via pg_indexes',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'users' with email field needing fast lookups
      // WHEN: index is created on email column
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 14,
            name: 'users',
            fields: [
              {
                id: 1,
                name: 'email',
                type: 'email',
                required: true,
                unique: true,
              },
            ],
            indexes: [
              {
                name: 'idx_users_email',
                fields: ['email'],
              },
            ],
          },
        ],
      })

      // THEN: PostgreSQL index exists and can be queried via pg_indexes
      const index = await executeQuery(
        `SELECT indexname, tablename FROM pg_indexes WHERE indexname = 'idx_users_email'`
      )
      // THEN: assertion
      expect(index.rows[0]).toMatchObject({
        indexname: 'idx_users_email',
        tablename: 'users',
      })
    }
  )

  test.fixme(
    'APP-TABLES-015: should alter table and add new column with correct type',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: existing table 'customers' with 2 columns
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 15,
            name: 'customers',
            fields: [
              {
                id: 1,
                name: 'name',
                type: 'single-line-text',
                required: true,
              },
            ],
          },
        ],
      })

      // WHEN: migration adds new column 'phone'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 16,
            name: 'customers',
            fields: [
              {
                id: 1,
                name: 'name',
                type: 'single-line-text',
                required: true,
              },
              {
                id: 2,
                name: 'phone',
                type: 'phone-number',
              },
            ],
          },
        ],
      })

      // THEN: table is altered, new column exists with correct type
      const column = await executeQuery(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'phone'`
      )
      // THEN: assertion
      expect(column.rows[0]).toMatchObject({
        column_name: 'phone',
        data_type: 'character varying',
      })

      const columnCount = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name = 'customers'`
      )
      // THEN: assertion
      expect(columnCount.rows[0]).toMatchObject({ count: 3 })
    }
  )

  test.fixme(
    'APP-TABLES-016: should drop column and reduce table to remaining columns',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: existing table 'temp_data' with columns id, data, status
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 17,
            name: 'temp_data',
            fields: [
              {
                id: 1,
                name: 'data',
                type: 'long-text',
              },
              {
                id: 2,
                name: 'status',
                type: 'single-line-text',
              },
            ],
          },
        ],
      })

      // WHEN: migration drops column 'status'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 18,
            name: 'temp_data',
            fields: [
              {
                id: 1,
                name: 'data',
                type: 'long-text',
              },
            ],
          },
        ],
      })

      // THEN: column is removed, table has 2 remaining columns (id + data)
      const statusColumn = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name = 'temp_data' AND column_name = 'status'`
      )
      // THEN: assertion
      expect(statusColumn.rows[0]).toMatchObject({ count: 0 })

      const remainingColumns = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name = 'temp_data'`
      )
      // THEN: assertion
      expect(remainingColumns.rows[0]).toMatchObject({ count: 2 })
    }
  )

  test.fixme(
    'APP-TABLES-017: should insert data and return row with generated ID',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'customers' with email and name fields
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 19,
            name: 'customers',
            fields: [
              {
                id: 1,
                name: 'email',
                type: 'email',
                required: true,
                unique: true,
              },
              {
                id: 2,
                name: 'name',
                type: 'single-line-text',
                required: true,
              },
            ],
          },
        ],
      })

      // WHEN: valid data is inserted
      // THEN: PostgreSQL returns inserted row with generated ID
      const insertion = await executeQuery(
        `INSERT INTO customers (email, name) VALUES ('john@example.com', 'John Doe') RETURNING id, email, name`
      )
      // THEN: assertion
      expect(insertion.rows[0]).toMatchObject({
        email: 'john@example.com',
        name: 'John Doe',
      })

      const rowCount = await executeQuery(`SELECT COUNT(*) as count FROM customers`)
      // THEN: assertion
      expect(rowCount.rows[0]).toMatchObject({ count: 1 })
    }
  )

  test.fixme(
    'APP-TABLES-018: should update row and return new value via SELECT',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'customers' with existing row (id=1, name='John Doe')
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 20,
            name: 'customers',
            fields: [
              {
                id: 1,
                name: 'email',
                type: 'email',
              },
              {
                id: 2,
                name: 'name',
                type: 'single-line-text',
              },
            ],
          },
        ],
      })
      await executeQuery(
        `INSERT INTO customers (email, name) VALUES ('john@example.com', 'John Doe')`
      )

      // WHEN: UPDATE statement changes name to 'John Smith'
      // THEN: PostgreSQL updates row, SELECT returns new value
      const update = await executeQuery(
        `UPDATE customers SET name = 'John Smith' WHERE email = 'john@example.com' RETURNING name`
      )
      // THEN: assertion
      expect(update.rows[0]).toMatchObject({ name: 'John Smith' })

      const select = await executeQuery(
        `SELECT name FROM customers WHERE email = 'john@example.com'`
      )
      // THEN: assertion
      expect(select.rows[0]).toMatchObject({ name: 'John Smith' })
    }
  )

  test.fixme(
    'APP-TABLES-019: should delete row and decrease row count',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'customers' with 3 rows
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 21,
            name: 'customers',
            fields: [
              {
                id: 1,
                name: 'email',
                type: 'email',
              },
            ],
          },
        ],
      })
      await executeQuery(
        `INSERT INTO customers (email) VALUES ('john@example.com'), ('jane@example.com'), ('bob@example.com')`
      )

      // WHEN: DELETE statement removes 1 row
      // THEN: PostgreSQL removes row, row count decreases to 2
      const initialCount = await executeQuery(`SELECT COUNT(*) as count FROM customers`)
      expect(initialCount.rows[0]).toMatchObject({ count: 3 })

      const deletion = await executeQuery(
        `DELETE FROM customers WHERE email = 'john@example.com' RETURNING email`
      )
      // THEN: assertion
      expect(deletion.rows[0]).toMatchObject({ email: 'john@example.com' })

      const finalCount = await executeQuery(`SELECT COUNT(*) as count FROM customers`)
      // THEN: assertion
      expect(finalCount.rows[0]).toMatchObject({ count: 2 })
    }
  )

  test.fixme(
    'APP-TABLES-020: should create PostgreSQL TIMESTAMP column with DEFAULT NOW()',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with created_at field (auto-timestamp)
      // WHEN: field migration creates column
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 22,
            name: 'orders',
            fields: [
              {
                id: 1,
                name: 'created_at',
                type: 'created-at',
              },
            ],
          },
        ],
      })

      // THEN: PostgreSQL TIMESTAMP column with DEFAULT NOW()
      const column = await executeQuery(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='orders' AND column_name='created_at'`
      )
      // THEN: assertion
      expect(column.rows[0]).toMatchObject({
        column_name: 'created_at',
        data_type: 'timestamp without time zone',
      })

      const defaultValue = await executeQuery(
        `SELECT column_default FROM information_schema.columns WHERE table_name='orders' AND column_name='created_at'`
      )
      // THEN: assertion
      expect(defaultValue.rows[0]).toMatchObject({ column_default: 'CURRENT_TIMESTAMP' })
    }
  )

  test.fixme(
    'APP-TABLES-021: should create VARCHAR column with CHECK constraint for enum values',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with single-select field with options ['active', 'inactive']
      // WHEN: table is created with select field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 23,
            name: 'items',
            fields: [
              {
                id: 1,
                name: 'status',
                type: 'single-select',
                options: ['active', 'inactive'],
              },
            ],
          },
        ],
      })

      // THEN: VARCHAR column with CHECK constraint for enum values is created
      const column = await executeQuery(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='items' AND column_name='status'`
      )
      // THEN: assertion
      expect(column.rows[0]).toMatchObject({
        column_name: 'status',
        data_type: 'character varying',
      })

      const checkConstraint = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.check_constraints WHERE constraint_name LIKE '%status%'`
      )
      // THEN: assertion
      expect(checkConstraint.rows[0]).toMatchObject({ count: 1 })
    }
  )

  test.fixme(
    'APP-TABLES-022: should remove table completely via DROP TABLE',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: existing table 'obsolete_data' in database
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 24,
            name: 'obsolete_data',
            fields: [
              {
                id: 1,
                name: 'data',
                type: 'long-text',
              },
            ],
          },
        ],
      })

      const existsBefore = await executeQuery(
        `SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'obsolete_data')`
      )
      expect(existsBefore.rows[0]).toMatchObject({ exists: true })

      // WHEN: migration removes table from schema
      await startServerWithSchema({
        name: 'test-app',
        tables: [],
      })

      // THEN: table is removed completely, pg_tables no longer shows it
      const existsAfter = await executeQuery(
        `SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'obsolete_data')`
      )
      // THEN: assertion
      expect(existsAfter.rows[0]).toMatchObject({ exists: false })
    }
  )

  test.fixme(
    'APP-TABLES-023: should create PRIMARY KEY constraint spanning multiple columns',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with composite primary key on (tenant_id, user_id)
      // WHEN: table 'user_tenants' is created
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 25,
            name: 'user_tenants',
            fields: [
              {
                id: 1,
                name: 'tenant_id',
                type: 'integer',
                required: true,
              },
              {
                id: 2,
                name: 'user_id',
                type: 'integer',
                required: true,
              },
            ],
            primaryKey: { type: 'composite', fields: ['tenant_id', 'user_id'] },
          },
        ],
      })

      // THEN: PRIMARY KEY constraint spans both columns
      const primaryKeyCount = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='user_tenants' AND constraint_type='PRIMARY KEY'`
      )
      // THEN: assertion
      expect(primaryKeyCount.rows[0]).toMatchObject({ count: 1 })

      const columnCount = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.key_column_usage WHERE table_name='user_tenants' AND constraint_name LIKE '%_pkey'`
      )
      // THEN: assertion
      expect(columnCount.rows[0]).toMatchObject({ count: 2 })
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'APP-TABLES-024: user can complete full Data Tables workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Database with representative table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 26,
            name: 'products',
            fields: [
              {
                id: 1,
                name: 'sku',
                type: 'single-line-text',
                required: true,
                unique: true,
              },
              {
                id: 2,
                name: 'title',
                type: 'single-line-text',
                required: true,
              },
              {
                id: 3,
                name: 'price',
                type: 'decimal',
                precision: 10,
                min: 0.01,
              },
              {
                id: 4,
                name: 'quantity',
                type: 'integer',
                min: 0,
              },
              {
                id: 5,
                name: 'is_active',
                type: 'checkbox',
                default: true,
              },
              {
                id: 6,
                name: 'created_at',
                type: 'created-at',
              },
            ],
          },
        ],
      })

      // WHEN/THEN: Execute representative workflow

      // 1. Schema introspection works
      const tableExists = await executeQuery(
        `SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'products')`
      )
      // THEN: assertion
      expect(tableExists.rows[0]).toMatchObject({ exists: true })

      // 2. CRUD operations work
      const insertion = await executeQuery(
        `INSERT INTO products (sku, title, price, quantity) VALUES ('WIDGET-001', 'Widget', 19.99, 100) RETURNING id, title`
      )
      // THEN: assertion
      expect(insertion.rows[0]).toMatchObject({ title: 'Widget' })

      const update = await executeQuery(
        `UPDATE products SET price = 24.99 WHERE sku = 'WIDGET-001' RETURNING price`
      )
      // THEN: assertion
      expect(update.rows[0]).toMatchObject({ price: 24.99 })

      const select = await executeQuery(`SELECT COUNT(*) as count FROM products`)
      // THEN: assertion
      expect(select.rows[0]).toMatchObject({ count: 1 })

      // 3. Constraints enforce data integrity
      // THEN: assertion
      await expect(
        executeQuery(
          `INSERT INTO products (sku, title, price) VALUES ('WIDGET-001', 'Duplicate', 10)`
        )
      ).rejects.toThrow(/unique constraint/)

      // THEN: assertion
      await expect(
        executeQuery(`INSERT INTO products (sku, title, price) VALUES ('NEW-001', 'Invalid', -5)`)
      ).rejects.toThrow(/check constraint/)

      // Workflow completes successfully
      const finalCount = await executeQuery(`SELECT COUNT(*) as count FROM products`)
      // THEN: assertion
      expect(finalCount.rows[0]).toMatchObject({ count: 1 })
    }
  )
})
