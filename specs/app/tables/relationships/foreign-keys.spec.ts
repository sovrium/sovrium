/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Foreign Key Relationships
 *
 * Source: src/domain/models/app/table/index.ts
 * Domain: app
 * Spec Count: 14
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (14 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Validation Approach:
 * - Database assertions (executeQuery fixture)
 * - PostgreSQL foreign key constraints (REFERENCES, CASCADE, SET NULL)
 * - Referential integrity enforcement (INSERT rejection, DELETE behavior)
 * - Self-referential and many-to-many relationship support
 */

test.describe('Foreign Key Relationships', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test(
    'APP-TABLES-FK-001: should create foreign key constraint when relationship field references parent table',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: two tables with many-to-one relationship (orders -> customers)
      // WHEN: relationship field configured with relatedTable
      await startServerWithSchema({
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
              { id: 1, name: 'total', type: 'decimal' },
              {
                id: 2,
                name: 'customer_id',
                type: 'relationship',
                relatedTable: 'customers',
                relationType: 'many-to-one',
              },
            ],
          },
        ],
      })

      // THEN: PostgreSQL creates FOREIGN KEY constraint

      // Foreign key constraint exists
      const fkCheck = await executeQuery(
        `SELECT conname, contype FROM pg_constraint WHERE conrelid = 'orders'::regclass AND contype = 'f'`
      )
      // THEN: assertion
      expect(fkCheck.rows[0]).toMatchObject({ contype: 'f' }) // 'f' = foreign key

      // Foreign key references correct table and column
      const fkDetails = await executeQuery(
        `SELECT
          tc.constraint_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
        WHERE tc.table_name = 'orders' AND tc.constraint_type = 'FOREIGN KEY'`
      )
      // THEN: assertion
      expect(fkDetails.rows[0]).toMatchObject({
        column_name: 'customer_id',
        foreign_table_name: 'customers',
        foreign_column_name: 'id',
      })
    }
  )

  test(
    'APP-TABLES-FK-002: should reject INSERT when foreign key references non-existent parent record',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: orders table with foreign key to customers, no customers exist
      // WHEN: attempting to insert order with non-existent customer_id
      await startServerWithSchema({
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
              { id: 1, name: 'total', type: 'decimal' },
              {
                id: 2,
                name: 'customer_id',
                type: 'relationship',
                relatedTable: 'customers',
                relationType: 'many-to-one',
              },
            ],
          },
        ],
      })

      // THEN: PostgreSQL rejects with foreign key violation

      await expect(
        executeQuery(`INSERT INTO orders (total, customer_id) VALUES (100.00, 999)`)
      ).rejects.toThrow(/violates foreign key constraint/)

      // Valid customer allows order insertion
      await executeQuery(`INSERT INTO customers (name) VALUES ('Alice')`)
      const validOrder = await executeQuery(
        `INSERT INTO orders (total, customer_id) VALUES (100.00, 1) RETURNING customer_id`
      )
      // THEN: assertion
      expect(validOrder.rows[0]).toMatchObject({ customer_id: 1 })
    }
  )

  test(
    'APP-TABLES-FK-003: should reject DELETE of parent record when child records exist with RESTRICT behavior',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: customer with existing orders (default ON DELETE RESTRICT)
      // WHEN: attempting to delete customer with existing orders
      await startServerWithSchema({
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
              { id: 1, name: 'total', type: 'decimal' },
              {
                id: 2,
                name: 'customer_id',
                type: 'relationship',
                relatedTable: 'customers',
                relationType: 'many-to-one',
                onDelete: 'restrict', // Default behavior
              },
            ],
          },
        ],
      })

      await executeQuery(`INSERT INTO customers (name) VALUES ('Alice')`)
      await executeQuery(`INSERT INTO orders (total, customer_id) VALUES (100.00, 1)`)

      // THEN: PostgreSQL rejects with foreign key violation

      await expect(executeQuery(`DELETE FROM customers WHERE id = 1`)).rejects.toThrow(
        /violates foreign key constraint/
      )

      // Customer deletion succeeds after removing dependent orders
      await executeQuery(`DELETE FROM orders WHERE id = 1`)
      const deletedCustomer = await executeQuery(`DELETE FROM customers WHERE id = 1 RETURNING id`)
      // THEN: assertion
      expect(deletedCustomer.rows[0]).toMatchObject({ id: 1 })
    }
  )

  test(
    'APP-TABLES-FK-004: should CASCADE DELETE child records when parent is deleted',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: orders with CASCADE DELETE on customer relationship
      // WHEN: deleting parent customer
      await startServerWithSchema({
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
              { id: 1, name: 'total', type: 'decimal' },
              {
                id: 2,
                name: 'customer_id',
                type: 'relationship',
                relatedTable: 'customers',
                relationType: 'many-to-one',
                onDelete: 'cascade', // CASCADE behavior
              },
            ],
          },
        ],
      })

      await executeQuery(`INSERT INTO customers (name) VALUES ('Alice')`)
      await executeQuery(
        `INSERT INTO orders (total, customer_id) VALUES (100.00, 1), (200.00, 1), (150.00, 1)`
      )

      // THEN: PostgreSQL CASCADE deletes all child orders

      const deletedCustomer = await executeQuery(`DELETE FROM customers WHERE id = 1 RETURNING id`)
      // THEN: assertion
      expect(deletedCustomer.rows[0]).toMatchObject({ id: 1 })

      // Child orders automatically deleted
      const remainingOrders = await executeQuery(`SELECT COUNT(*) as count FROM orders`)
      // THEN: assertion
      expect(remainingOrders.rows[0]).toMatchObject({ count: 0 })
    }
  )

  test(
    'APP-TABLES-FK-005: should SET NULL on child records when parent is deleted',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: orders with SET NULL on customer relationship
      // WHEN: deleting parent customer
      await startServerWithSchema({
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
              { id: 1, name: 'total', type: 'decimal' },
              {
                id: 2,
                name: 'customer_id',
                type: 'relationship',
                relatedTable: 'customers',
                relationType: 'many-to-one',
                onDelete: 'set-null', // SET NULL behavior
                required: false, // Must be nullable for SET NULL
              },
            ],
          },
        ],
      })

      await executeQuery(`INSERT INTO customers (name) VALUES ('Alice')`)
      await executeQuery(`INSERT INTO orders (total, customer_id) VALUES (100.00, 1)`)

      // THEN: PostgreSQL sets customer_id to NULL

      await executeQuery(`DELETE FROM customers WHERE id = 1`)

      const orphanedOrder = await executeQuery(`SELECT id, customer_id FROM orders WHERE id = 1`)
      // THEN: assertion
      expect(orphanedOrder.rows[0]).toMatchObject({ id: 1, customer_id: null })
    }
  )

  test(
    'APP-TABLES-FK-006: should support self-referential relationships for tree structures',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: categories table with parent_id self-reference
      // WHEN: creating hierarchical categories
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'categories',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text', required: true },
              {
                id: 2,
                name: 'parent_id',
                type: 'relationship',
                relatedTable: 'categories', // Self-reference
                relationType: 'many-to-one',
                required: false, // NULL for root categories
              },
            ],
          },
        ],
      })

      // THEN: PostgreSQL allows self-referential foreign keys

      // Root category (no parent)
      await executeQuery(`INSERT INTO categories (name, parent_id) VALUES ('Electronics', NULL)`)

      // Child category
      await executeQuery(`INSERT INTO categories (name, parent_id) VALUES ('Laptops', 1)`)

      // Grandchild category
      await executeQuery(`INSERT INTO categories (name, parent_id) VALUES ('Gaming Laptops', 2)`)

      // Verify hierarchy
      const laptops = await executeQuery(`SELECT name, parent_id FROM categories WHERE id = 2`)
      // THEN: assertion
      expect(laptops.rows[0]).toMatchObject({ name: 'Laptops', parent_id: 1 })

      // Reject invalid parent_id
      await expect(
        executeQuery(`INSERT INTO categories (name, parent_id) VALUES ('Invalid', 999)`)
      ).rejects.toThrow(/violates foreign key constraint/)
    }
  )

  test(
    'APP-TABLES-FK-007: should allow circular dependencies with deferred constraint checking',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: departments and managers with circular potential
      // WHEN: creating circular references
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
                name: 'manager_id',
                type: 'relationship',
                relatedTable: 'managers',
                relationType: 'many-to-one',
                required: false,
              },
            ],
          },
          {
            id: 2,
            name: 'managers',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              {
                id: 2,
                name: 'department_id',
                type: 'relationship',
                relatedTable: 'departments',
                relationType: 'many-to-one',
                required: false,
              },
            ],
          },
        ],
      })

      // THEN: PostgreSQL allows circular reference creation via UPDATE

      // Create department with NULL manager
      await executeQuery(`INSERT INTO departments (name, manager_id) VALUES ('Engineering', NULL)`)

      // Create manager with department reference
      await executeQuery(`INSERT INTO managers (name, department_id) VALUES ('Alice', 1)`)

      // Update department to reference manager (completes circle)
      await executeQuery(`UPDATE departments SET manager_id = 1 WHERE id = 1`)

      // Verify circular reference exists
      const dept = await executeQuery(`SELECT manager_id FROM departments WHERE id = 1`)
      // THEN: assertion
      expect(dept.rows[0]).toMatchObject({ manager_id: 1 })

      const mgr = await executeQuery(`SELECT department_id FROM managers WHERE id = 1`)
      // THEN: assertion
      expect(mgr.rows[0]).toMatchObject({ department_id: 1 })
    }
  )

  test(
    'APP-TABLES-FK-008: should create index on foreign key column for query performance',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: orders table with foreign key to customers
      // WHEN: foreign key is created
      await startServerWithSchema({
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
              { id: 1, name: 'total', type: 'decimal' },
              {
                id: 2,
                name: 'customer_id',
                type: 'relationship',
                relatedTable: 'customers',
                relationType: 'many-to-one',
              },
            ],
          },
        ],
      })

      // THEN: PostgreSQL automatically creates index on foreign key column

      // Index exists on customer_id
      const indexCheck = await executeQuery(
        `SELECT indexname FROM pg_indexes WHERE tablename = 'orders' AND indexdef LIKE '%customer_id%'`
      )
      // THEN: assertion
      expect(indexCheck.rows.length).toBeGreaterThan(0)
    }
  )

  test(
    'APP-TABLES-FK-009: should support composite foreign keys on multi-column references',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: tenant_users with composite primary key (tenant_id, user_id)
      // WHEN: permissions table references composite key
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'tenant_users',
            fields: [
              { id: 1, name: 'tenant_id', type: 'integer', required: true },
              { id: 2, name: 'user_id', type: 'integer', required: true },
              { id: 3, name: 'name', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['tenant_id', 'user_id'] },
          },
          {
            id: 2,
            name: 'permissions',
            fields: [
              { id: 1, name: 'tenant_id', type: 'integer', required: true },
              { id: 2, name: 'user_id', type: 'integer', required: true },
              { id: 3, name: 'resource', type: 'single-line-text' },
            ],
            foreignKeys: [
              {
                name: 'fk_permissions_tenant_user',
                fields: ['tenant_id', 'user_id'],
                referencedTable: 'tenant_users',
                referencedFields: ['tenant_id', 'user_id'],
              },
            ],
          },
        ],
      })

      // THEN: PostgreSQL validates composite foreign key

      await executeQuery(
        `INSERT INTO tenant_users (tenant_id, user_id, name) VALUES (1, 1, 'Alice')`
      )

      const validPermission = await executeQuery(
        `INSERT INTO permissions (tenant_id, user_id, resource) VALUES (1, 1, 'read') RETURNING tenant_id`
      )
      // THEN: assertion
      expect(validPermission.rows[0]).toMatchObject({ tenant_id: 1 })

      // Invalid composite foreign key rejected
      await expect(
        executeQuery(
          `INSERT INTO permissions (tenant_id, user_id, resource) VALUES (1, 999, 'read')`
        )
      ).rejects.toThrow(/violates foreign key constraint/)
    }
  )

  test(
    'APP-TABLES-FK-010: should reject foreign key creation when referenced table does not exist',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: orders table referencing non-existent customers table
      // WHEN: attempting to create foreign key to missing table
      // THEN: Schema validation rejects

      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'orders',
              fields: [
                { id: 1, name: 'total', type: 'decimal' },
                {
                  id: 2,
                  name: 'customer_id',
                  type: 'relationship',
                  relatedTable: 'customers', // Table doesn't exist!
                  relationType: 'many-to-one',
                },
              ],
            },
          ],
        })
      ).rejects.toThrow(/relation.*customers.*does not exist|table.*not found|relatedTable/)
    }
  )

  test(
    'APP-TABLES-FK-011: should reject foreign key when referenced column is not primary or unique key',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: foreign key referencing non-unique column
      // WHEN: attempting to create foreign key
      // THEN: PostgreSQL rejects (foreign keys must reference unique/primary keys)

      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'customers',
              fields: [
                { id: 1, name: 'email', type: 'email' }, // Not unique!
              ],
            },
            {
              id: 2,
              name: 'orders',
              fields: [
                { id: 1, name: 'total', type: 'decimal' },
                {
                  id: 2,
                  name: 'customer_email',
                  type: 'relationship',
                  relatedTable: 'customers',
                  relatedField: 'email', // References non-unique column!
                  relationType: 'many-to-one',
                },
              ],
            },
          ],
        })
      ).rejects.toThrow(/referenced column.*must.*unique|primary key|no unique constraint/)
    }
  )

  test(
    'APP-TABLES-FK-012: should CASCADE UPDATE child records when parent primary key changes',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: orders with CASCADE UPDATE on customer relationship
      // WHEN: updating parent customer's primary key
      await startServerWithSchema({
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
              { id: 1, name: 'total', type: 'decimal' },
              {
                id: 2,
                name: 'customer_id',
                type: 'relationship',
                relatedTable: 'customers',
                relationType: 'many-to-one',
                onUpdate: 'cascade', // CASCADE UPDATE behavior
              },
            ],
          },
        ],
      })

      await executeQuery(`INSERT INTO customers (name) VALUES ('Alice')`)
      await executeQuery(`INSERT INTO orders (total, customer_id) VALUES (100.00, 1)`)

      // THEN: PostgreSQL CASCADE updates child order's customer_id

      await executeQuery(`UPDATE customers SET id = 100 WHERE id = 1`)

      const updatedOrder = await executeQuery(`SELECT customer_id FROM orders WHERE id = 1`)
      // THEN: assertion
      expect(updatedOrder.rows[0]).toMatchObject({ customer_id: 100 })
    }
  )

  test(
    'APP-TABLES-FK-013: should support one-to-one relationships with UNIQUE constraint on foreign key',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: users and profiles with one-to-one relationship
      // WHEN: attempting to create second profile for same user
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [{ id: 1, name: 'email', type: 'email', unique: true }],
          },
          {
            id: 2,
            name: 'profiles',
            fields: [
              {
                id: 1,
                name: 'user_id',
                type: 'relationship',
                relatedTable: 'users',
                relationType: 'one-to-one',
                unique: true, // Enforces one-to-one
              },
              { id: 2, name: 'bio', type: 'long-text' },
            ],
          },
        ],
      })

      await executeQuery(`INSERT INTO users (email) VALUES ('alice@example.com')`)
      await executeQuery(`INSERT INTO profiles (user_id, bio) VALUES (1, 'Software engineer')`)

      // THEN: PostgreSQL rejects with unique constraint violation

      await expect(
        executeQuery(`INSERT INTO profiles (user_id, bio) VALUES (1, 'Duplicate profile')`)
      ).rejects.toThrow(/violates unique constraint/)
    }
  )

  test(
    'APP-TABLES-FK-014: should support many-to-many relationships via junction table',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: students and courses with junction table enrollments
      // WHEN: enrolling students in courses
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'students',
            fields: [{ id: 1, name: 'name', type: 'single-line-text' }],
          },
          {
            id: 2,
            name: 'courses',
            fields: [{ id: 1, name: 'title', type: 'single-line-text' }],
          },
          {
            id: 3,
            name: 'enrollments',
            fields: [
              {
                id: 1,
                name: 'student_id',
                type: 'relationship',
                relatedTable: 'students',
                relationType: 'many-to-one',
                required: true,
              },
              {
                id: 2,
                name: 'course_id',
                type: 'relationship',
                relatedTable: 'courses',
                relationType: 'many-to-one',
                required: true,
              },
              { id: 3, name: 'enrolled_at', type: 'created-at' },
            ],
            primaryKey: { type: 'composite', fields: ['student_id', 'course_id'] },
          },
        ],
      })

      // THEN: PostgreSQL enforces foreign keys and composite primary key

      await executeQuery(`INSERT INTO students (name) VALUES ('Alice'), ('Bob')`)
      await executeQuery(`INSERT INTO courses (title) VALUES ('Math 101'), ('CS 101')`)

      // Alice enrolls in Math and CS
      await executeQuery(`INSERT INTO enrollments (student_id, course_id) VALUES (1, 1), (1, 2)`)

      // Bob enrolls in CS
      await executeQuery(`INSERT INTO enrollments (student_id, course_id) VALUES (2, 2)`)

      // Verify many-to-many relationship
      const aliceEnrollments = await executeQuery(
        `SELECT course_id FROM enrollments WHERE student_id = 1 ORDER BY course_id`
      )
      // THEN: assertion
      expect(aliceEnrollments.rows).toEqual([{ course_id: 1 }, { course_id: 2 }])

      const cs101Students = await executeQuery(
        `SELECT student_id FROM enrollments WHERE course_id = 2 ORDER BY student_id`
      )
      // THEN: assertion
      expect(cs101Students.rows).toEqual([{ student_id: 1 }, { student_id: 2 }])

      // Duplicate enrollment rejected (composite PK)
      await expect(
        executeQuery(`INSERT INTO enrollments (student_id, course_id) VALUES (1, 1)`)
      ).rejects.toThrow(/duplicate key value violates unique constraint/)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration workflow
  // ============================================================================

  test(
    'APP-TABLES-FK-015: user can complete full foreign-key workflow with CASCADE behaviors',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('Setup: Create tables with various FK relationships', async () => {
        await startServerWithSchema({
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
                { id: 1, name: 'total', type: 'decimal' },
                {
                  id: 2,
                  name: 'customer_id',
                  type: 'relationship',
                  relatedTable: 'customers',
                  relationType: 'many-to-one',
                  onDelete: 'cascade',
                },
              ],
            },
          ],
        })

        await executeQuery(`INSERT INTO customers (name) VALUES ('Alice')`)
        await executeQuery(
          `INSERT INTO orders (total, customer_id) VALUES (100.00, 1), (200.00, 1)`
        )
      })

      await test.step('Verify foreign key constraint enforcement', async () => {
        await expect(
          executeQuery(`INSERT INTO orders (total, customer_id) VALUES (50.00, 999)`)
        ).rejects.toThrow(/foreign key/)
      })

      await test.step('Verify CASCADE DELETE behavior', async () => {
        await executeQuery(`DELETE FROM customers WHERE id = 1`)
        const remainingOrders = await executeQuery(`SELECT COUNT(*) as count FROM orders`)
        expect(remainingOrders.rows[0]).toMatchObject({ count: '0' })
      })
    }
  )
})
