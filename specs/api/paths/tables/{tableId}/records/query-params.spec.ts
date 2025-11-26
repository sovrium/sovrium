/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@playwright/test'

test.fixme(
  'API-QUERY-PARAMS-001: should paginate records with limit and offset',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery, request }) => {
    // GIVEN: table 'products' with 50 records
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_products',
          name: 'products',
          fields: [{ id: 'fld_name', name: 'name', type: 'single-line-text' }],
        },
      ],
    })

    const values = Array.from({ length: 50 }, (_, i) => `('Product ${i + 1}')`).join(',')
    await executeQuery(`INSERT INTO products (name) VALUES ${values}`)

    // WHEN: GET /api/tables/tbl_products/records?limit=10&offset=20
    const response = await request.get('/api/tables/tbl_products/records?limit=10&offset=20', {
      headers: { Authorization: 'Bearer valid_token' },
    })

    // THEN: returns 10 records starting from position 20
    expect(response.status()).toBe(200)
    const body = await response.json()

    expect(body.records).toHaveLength(10)
    expect(body.records[0].fields.name).toBe('Product 21')
    expect(body.records[9].fields.name).toBe('Product 30')
    expect(body.pagination).toMatchObject({
      total: 50,
      limit: 10,
      offset: 20,
      hasMore: true,
    })
  }
)

test.fixme(
  'API-QUERY-PARAMS-002: should sort records by multiple fields',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery, request }) => {
    // GIVEN: table 'employees' with salary and department fields
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_employees',
          name: 'employees',
          fields: [
            { id: 'fld_name', name: 'name', type: 'single-line-text' },
            { id: 'fld_department', name: 'department', type: 'single-line-text' },
            { id: 'fld_salary', name: 'salary', type: 'decimal' },
          ],
        },
      ],
    })

    await executeQuery(`
      INSERT INTO employees (name, department, salary) VALUES
      ('Alice', 'Engineering', 120000),
      ('Bob', 'Engineering', 110000),
      ('Charlie', 'Sales', 90000),
      ('Diana', 'Sales', 95000)
    `)

    // WHEN: GET /api/tables/tbl_employees/records?sort=department:asc,salary:desc
    const response = await request.get(
      '/api/tables/tbl_employees/records?sort=department:asc,salary:desc',
      {
        headers: { Authorization: 'Bearer valid_token' },
      }
    )

    // THEN: records sorted by department ASC, then salary DESC
    expect(response.status()).toBe(200)
    const body = await response.json()

    expect(body.records).toHaveLength(4)
    expect(body.records[0].fields.name).toBe('Alice')
    expect(body.records[1].fields.name).toBe('Bob')
    expect(body.records[2].fields.name).toBe('Diana')
    expect(body.records[3].fields.name).toBe('Charlie')
  }
)

test.fixme(
  'API-QUERY-PARAMS-003: should filter records with complex conditions',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery, request }) => {
    // GIVEN: table 'tasks' with status and priority fields
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_tasks',
          name: 'tasks',
          fields: [
            { id: 'fld_title', name: 'title', type: 'single-line-text' },
            {
              id: 'fld_status',
              name: 'status',
              type: 'single-select',
              config: { options: ['open', 'in_progress', 'completed'] },
            },
            {
              id: 'fld_priority',
              name: 'priority',
              type: 'single-select',
              config: { options: ['low', 'medium', 'high'] },
            },
          ],
        },
      ],
    })

    await executeQuery(`
      INSERT INTO tasks (title, status, priority) VALUES
      ('Task 1', 'open', 'high'),
      ('Task 2', 'in_progress', 'high'),
      ('Task 3', 'completed', 'medium'),
      ('Task 4', 'open', 'low'),
      ('Task 5', 'in_progress', 'medium')
    `)

    // WHEN: GET /api/tables/tbl_tasks/records?filter=status:ne:completed&filter=priority:in:high,medium
    const response = await request.get(
      '/api/tables/tbl_tasks/records?filter=status:ne:completed&filter=priority:in:high,medium',
      {
        headers: { Authorization: 'Bearer valid_token' },
      }
    )

    // THEN: returns only open/in_progress tasks with high/medium priority
    expect(response.status()).toBe(200)
    const body = await response.json()

    expect(body.records).toHaveLength(3)
    const titles = body.records.map((r) => r.fields.title).sort()
    expect(titles).toEqual(['Task 1', 'Task 2', 'Task 5'])
  }
)

test.fixme(
  'API-QUERY-PARAMS-REGRESSION: query parameters work correctly',
  { tag: '@regression' },
  async ({ startServerWithSchema, executeQuery, request }) => {
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_items',
          name: 'items',
          fields: [
            { id: 'fld_name', name: 'name', type: 'single-line-text' },
            { id: 'fld_price', name: 'price', type: 'decimal' },
          ],
        },
      ],
    })

    await executeQuery(`
      INSERT INTO items (name, price) VALUES
      ('Item A', 10.00),
      ('Item B', 20.00),
      ('Item C', 30.00)
    `)

    const response = await request.get('/api/tables/tbl_items/records?limit=2&sort=price:desc', {
      headers: { Authorization: 'Bearer valid_token' },
    })

    const body = await response.json()
    expect(body.records).toHaveLength(2)
    expect(body.records[0].fields.name).toBe('Item C')
  }
)
