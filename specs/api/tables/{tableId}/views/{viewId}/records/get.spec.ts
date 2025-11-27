/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

test.fixme(
  'API-TABLES-VIEW-RECORDS-001: should return records filtered by view configuration',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery, request }) => {
    // GIVEN: table 'tasks' with view 'active_tasks' filtering status='active'
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 1,
          name: 'tasks',
          fields: [
            { id: 1, name: 'title', type: 'single-line-text' },
            {
              id: 2,
              name: 'status',
              type: 'single-select',
              options: ['active', 'completed'],
            },
          ],
          views: [
            {
              id: 'view_active',
              name: 'active_tasks',
              filters: {
                and: [{ field: 'fld_status', operator: 'is', value: 'active' }],
              },
            },
          ],
        },
      ],
    })

    await executeQuery(`
      INSERT INTO tasks (title, status) VALUES
      ('Task 1', 'active'),
      ('Task 2', 'completed'),
      ('Task 3', 'active'),
      ('Task 4', 'archived')
    `)

    // WHEN: GET /api/tables/tbl_tasks/views/view_active/records
    const response = await request.get('/api/tables/tbl_tasks/views/view_active/records', {})

    // THEN: only active tasks returned
    expect(response.status()).toBe(200)
    const body = await response.json()

    // THEN: assertion
    expect(body.records).toHaveLength(2)
    expect(
      body.records.every((r: { fields: { status: string } }) => r.fields.status === 'active')
    ).toBe(true)

    const titles = body.records.map((r: { fields: { title: string } }) => r.fields.title).sort()
    // THEN: assertion
    expect(titles).toEqual(['Task 1', 'Task 3'])
  }
)

test.fixme(
  'API-TABLES-VIEW-RECORDS-002: should return records sorted by view configuration',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery, request }) => {
    // GIVEN: table 'products' with view sorted by price DESC
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 2,
          name: 'products',
          fields: [
            { id: 1, name: 'name', type: 'single-line-text' },
            { id: 2, name: 'price', type: 'decimal' },
          ],
          views: [
            {
              id: 'view_by_price',
              name: 'by_price',
              sorts: [{ field: 'fld_price', direction: 'desc' }],
            },
          ],
        },
      ],
    })

    await executeQuery(`
      INSERT INTO products (name, price) VALUES
      ('Product A', 10.00),
      ('Product B', 50.00),
      ('Product C', 25.00)
    `)

    // WHEN: GET /api/tables/tbl_products/views/view_by_price/records
    const response = await request.get('/api/tables/tbl_products/views/view_by_price/records', {})

    // THEN: records sorted by price descending
    expect(response.status()).toBe(200)
    const body = await response.json()

    // THEN: assertion
    expect(body.records).toHaveLength(3)

    const prices = body.records.map((r: { fields: { price: string } }) => r.fields.price)
    // THEN: assertion
    expect(prices).toEqual(['50.00', '25.00', '10.00'])
  }
)

test.fixme(
  'API-TABLES-VIEW-RECORDS-003: should return only visible fields configured in view',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery, request }) => {
    // GIVEN: table 'users' with view showing only name and email (hiding phone)
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 3,
          name: 'users',
          fields: [
            { id: 1, name: 'name', type: 'single-line-text' },
            { id: 2, name: 'email', type: 'email' },
            { id: 3, name: 'phone', type: 'phone-number' },
          ],
          views: [
            {
              id: 'view_contact',
              name: 'contact_info',
              fields: ['fld_name', 'fld_email'],
            },
          ],
        },
      ],
    })

    await executeQuery(`
      INSERT INTO users (name, email, phone) VALUES
      ('John Doe', 'john@example.com', '+1234567890')
    `)

    // WHEN: GET /api/tables/tbl_users/views/view_contact/records
    const response = await request.get('/api/tables/tbl_users/views/view_contact/records', {})

    // THEN: only name and email returned (phone excluded)
    expect(response.status()).toBe(200)
    const body = await response.json()

    // THEN: assertion
    expect(body.records).toHaveLength(1)

    const record = body.records[0]
    // THEN: assertion
    expect(record.fields).toHaveProperty('name')
    expect(record.fields).toHaveProperty('email')
    expect(record.fields).not.toHaveProperty('phone')
  }
)

test.fixme(
  'API-TABLES-VIEW-RECORDS-004: should return 403 when user lacks view access',
  { tag: '@spec' },
  async ({ startServerWithSchema, request }) => {
    // GIVEN: table with view restricted to admin role
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 4,
          name: 'sensitive_data',
          fields: [{ id: 1, name: 'data', type: 'single-line-text' }],
          views: [
            {
              id: 'view_admin',
              name: 'admin_view',
              permissions: {
                allowedRoles: ['admin'],
              },
            },
          ],
        },
      ],
    })

    // WHEN: viewer user attempts to access admin view
    const response = await request.get('/api/tables/tbl_sensitive/views/view_admin/records', {
      headers: { Authorization: 'Bearer viewer_token' },
    })

    // THEN: 403 Forbidden
    expect(response.status()).toBe(403)
    const body = await response.json()
    expect(body.error).toBe('Forbidden')
    expect(body.message).toMatch(/insufficient permissions/i)
  }
)

test.fixme(
  'API-TABLES-VIEW-RECORDS-005: API-VIEW-RECORDS-REGRESSION: view API endpoints work correctly',
  { tag: '@regression' },
  async ({ startServerWithSchema, executeQuery, request }) => {
    // Basic view filtering smoke test
    // GIVEN: app configuration
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 5,
          name: 'items',
          fields: [
            { id: 1, name: 'name', type: 'single-line-text' },
            { id: 2, name: 'active', type: 'checkbox' },
          ],
          views: [
            {
              id: 'view_active',
              name: 'active_items',
              filters: {
                and: [{ field: 'fld_active', operator: 'is', value: true }],
              },
            },
          ],
        },
      ],
    })

    await executeQuery(
      `INSERT INTO items (name, active) VALUES ('Item 1', true), ('Item 2', false)`
    )

    const response = await request.get('/api/tables/tbl_items/views/view_active/records', {})

    const body = await response.json()
    expect(body.records).toHaveLength(1)
    expect(body.records[0].fields.name).toBe('Item 1')
  }
)
