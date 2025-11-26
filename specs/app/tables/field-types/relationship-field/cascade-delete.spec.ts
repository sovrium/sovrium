/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@playwright/test'

test.fixme(
  'APP-REL-CASCADE-001: should cascade delete related records when parent deleted',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery }) => {
    // GIVEN: tables 'customers' and 'orders' with relationship (CASCADE)
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_customers',
          name: 'customers',
          fields: [{ id: 'fld_name', name: 'name', type: 'single-line-text' }],
        },
        {
          id: 'tbl_orders',
          name: 'orders',
          fields: [
            {
              id: 'fld_customer',
              name: 'customer',
              type: 'relationship',
              config: {
                linkedTableId: 'tbl_customers',
                onDelete: 'CASCADE',
              },
            },
            { id: 'fld_total', name: 'total', type: 'decimal' },
          ],
        },
      ],
    })

    const customerResult = await executeQuery(`
      INSERT INTO customers (name) VALUES ('John Doe') RETURNING id
    `)
    const customerId = customerResult.id

    await executeQuery(
      `
      INSERT INTO orders (customer_id, total) VALUES
      ($1, 100.00),
      ($1, 250.00),
      ($1, 75.50)
    `,
      [customerId]
    )

    // WHEN: customer deleted
    await executeQuery(`DELETE FROM customers WHERE id = $1`, [customerId])

    // THEN: all related orders deleted automatically
    const customerCount = await executeQuery(`SELECT COUNT(*) FROM customers WHERE id = $1`, [
      customerId,
    ])
    expect(customerCount.count).toBe(0)

    const orderCount = await executeQuery(`SELECT COUNT(*) FROM orders WHERE customer_id = $1`, [
      customerId,
    ])
    expect(orderCount.count).toBe(0)

    const fkInfo = await executeQuery(`
      SELECT delete_rule
      FROM information_schema.referential_constraints
      WHERE constraint_schema='public'
      AND constraint_name LIKE '%orders_customer_id%'
    `)
    expect(fkInfo.delete_rule).toBe('CASCADE')
  }
)

test.fixme(
  'APP-REL-CASCADE-002: should set foreign key to NULL when parent deleted',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery }) => {
    // GIVEN: tables 'categories' and 'products' with relationship (SET NULL)
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_categories',
          name: 'categories',
          fields: [{ id: 'fld_name', name: 'name', type: 'single-line-text' }],
        },
        {
          id: 'tbl_products',
          name: 'products',
          fields: [
            {
              id: 'fld_category',
              name: 'category',
              type: 'relationship',
              config: {
                linkedTableId: 'tbl_categories',
                onDelete: 'SET NULL',
                required: false,
              },
            },
            { id: 'fld_name', name: 'name', type: 'single-line-text' },
          ],
        },
      ],
    })

    const categoryResult = await executeQuery(`
      INSERT INTO categories (name) VALUES ('Electronics') RETURNING id
    `)
    const categoryId = categoryResult.id

    await executeQuery(
      `
      INSERT INTO products (category_id, name) VALUES
      ($1, 'Laptop'),
      ($1, 'Phone'),
      ($1, 'Tablet')
    `,
      [categoryId]
    )

    // WHEN: category deleted
    await executeQuery(`DELETE FROM categories WHERE id = $1`, [categoryId])

    // THEN: products remain but category_id set to NULL
    const categoryCount = await executeQuery(`SELECT COUNT(*) FROM categories WHERE id = $1`, [
      categoryId,
    ])
    expect(categoryCount.count).toBe(0)

    const productCount = await executeQuery(
      `SELECT COUNT(*) FROM products WHERE name IN ('Laptop', 'Phone', 'Tablet')`
    )
    expect(productCount.count).toBe(3)

    const products = await executeQuery(
      `SELECT category_id FROM products WHERE name IN ('Laptop', 'Phone', 'Tablet')`
    )
    expect(products.every((p) => p.category_id === null)).toBe(true)
  }
)

test.fixme(
  'APP-REL-CASCADE-003: should prevent delete when related records exist (RESTRICT)',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery }) => {
    // GIVEN: tables 'projects' and 'tasks' with relationship (RESTRICT)
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_projects',
          name: 'projects',
          fields: [{ id: 'fld_name', name: 'name', type: 'single-line-text' }],
        },
        {
          id: 'tbl_tasks',
          name: 'tasks',
          fields: [
            {
              id: 'fld_project',
              name: 'project',
              type: 'relationship',
              config: {
                linkedTableId: 'tbl_projects',
                onDelete: 'RESTRICT',
                required: true,
              },
            },
            { id: 'fld_title', name: 'title', type: 'single-line-text' },
          ],
        },
      ],
    })

    const projectResult = await executeQuery(`
      INSERT INTO projects (name) VALUES ('Website Redesign') RETURNING id
    `)
    const projectId = projectResult.id

    await executeQuery(
      `
      INSERT INTO tasks (project_id, title) VALUES
      ($1, 'Design mockups'),
      ($1, 'Implement frontend')
    `,
      [projectId]
    )

    // WHEN: attempting to delete project with related tasks
    // THEN: deletion prevented with foreign key constraint error
    await expect(executeQuery(`DELETE FROM projects WHERE id = $1`, [projectId])).rejects.toThrow(
      /violates foreign key constraint/
    )

    const projectCount = await executeQuery(`SELECT COUNT(*) FROM projects WHERE id = $1`, [
      projectId,
    ])
    expect(projectCount.count).toBe(1)

    const taskCount = await executeQuery(`SELECT COUNT(*) FROM tasks WHERE project_id = $1`, [
      projectId,
    ])
    expect(taskCount.count).toBe(2)
  }
)

test.fixme(
  'APP-REL-CASCADE-004: should detect and prevent circular cascade delete',
  { tag: '@spec' },
  async ({ startServerWithSchema }) => {
    // GIVEN: attempt to create circular CASCADE relationship
    // WHEN: schema validation runs
    // THEN: circular cascade detected and rejected
    await expect(
      startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_a',
            name: 'table_a',
            fields: [
              {
                id: 'fld_b_ref',
                name: 'b_ref',
                type: 'relationship',
                config: {
                  linkedTableId: 'tbl_b',
                  onDelete: 'CASCADE',
                },
              },
            ],
          },
          {
            id: 'tbl_b',
            name: 'table_b',
            fields: [
              {
                id: 'fld_a_ref',
                name: 'a_ref',
                type: 'relationship',
                config: {
                  linkedTableId: 'tbl_a',
                  onDelete: 'CASCADE',
                },
              },
            ],
          },
        ],
      })
    ).rejects.toThrow(/circular cascade delete detected/i)
  }
)

test.fixme(
  'APP-REL-CASCADE-005: should identify orphaned records after relationship removed',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery }) => {
    // GIVEN: tables with relationship, then relationship field removed
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_authors',
          name: 'authors',
          fields: [{ id: 'fld_name', name: 'name', type: 'single-line-text' }],
        },
        {
          id: 'tbl_books',
          name: 'books',
          fields: [
            {
              id: 'fld_author',
              name: 'author',
              type: 'relationship',
              config: {
                linkedTableId: 'tbl_authors',
              },
            },
            { id: 'fld_title', name: 'title', type: 'single-line-text' },
          ],
        },
      ],
    })

    const authorResult = await executeQuery(
      `INSERT INTO authors (name) VALUES ('Jane Austen') RETURNING id`
    )
    const authorId = authorResult.id

    await executeQuery(`INSERT INTO books (author_id, title) VALUES ($1, 'Pride and Prejudice')`, [
      authorId,
    ])
    await executeQuery(`DELETE FROM authors WHERE id = $1`, [authorId])

    // WHEN: relationship field removed from schema
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_authors',
          name: 'authors',
          fields: [{ id: 'fld_name', name: 'name', type: 'single-line-text' }],
        },
        {
          id: 'tbl_books',
          name: 'books',
          fields: [{ id: 'fld_title', name: 'title', type: 'single-line-text' }],
        },
      ],
    })

    // THEN: orphaned records logged/handled
    const columnExists = await executeQuery(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name='books' AND column_name='author_id'
    `)

    if (columnExists) {
      const book = await executeQuery(
        `SELECT author_id FROM books WHERE title='Pride and Prejudice'`
      )
      expect(book.author_id).toBeNull()
    } else {
      expect(columnExists).toBeUndefined()
    }
  }
)

test.fixme(
  'APP-REL-CASCADE-REGRESSION: relationship cascade operations work correctly',
  { tag: '@regression' },
  async ({ startServerWithSchema, executeQuery }) => {
    // Basic cascade delete smoke test
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_users',
          name: 'users',
          fields: [{ id: 'fld_name', name: 'name', type: 'single-line-text' }],
        },
        {
          id: 'tbl_posts',
          name: 'posts',
          fields: [
            {
              id: 'fld_user',
              name: 'user',
              type: 'relationship',
              config: {
                linkedTableId: 'tbl_users',
                onDelete: 'CASCADE',
              },
            },
          ],
        },
      ],
    })

    const userResult = await executeQuery(
      `INSERT INTO users (name) VALUES ('Test User') RETURNING id`
    )
    await executeQuery(`INSERT INTO posts (user_id) VALUES ($1)`, [userResult.id])
    await executeQuery(`DELETE FROM users WHERE id = $1`, [userResult.id])

    const postCount = await executeQuery(`SELECT COUNT(*) FROM posts`)
    expect(postCount.count).toBe(0)
  }
)
