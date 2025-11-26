/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@playwright/test'

test.fixme(
  'API-VIEW-RECORDS-001: should return records filtered by view configuration',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery, request }) => {
    // GIVEN: table 'tasks' with view 'active_tasks' filtering status='active'
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
              config: {
                options: ['active', 'completed', 'archived'],
              },
            },
          ],
          views: [
            {
              id: 'view_active',
              name: 'active_tasks',
              type: 'grid',
              filters: {
                operator: 'and',
                conditions: [{ field: 'fld_status', operator: 'is', value: 'active' }],
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
    const response = await request.get('/api/tables/tbl_tasks/views/view_active/records', {
      headers: { Authorization: 'Bearer valid_token' },
    })

    // THEN: only active tasks returned
    expect(response.status()).toBe(200)
    const body = await response.json()

    expect(body.records).toHaveLength(2)
    expect(body.records.every((r) => r.fields.status === 'active')).toBe(true)

    const titles = body.records.map((r) => r.fields.title).sort()
    expect(titles).toEqual(['Task 1', 'Task 3'])
  }
)

test.fixme(
  'API-VIEW-RECORDS-002: should return records sorted by view configuration',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery, request }) => {
    // GIVEN: table 'products' with view sorted by price DESC
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_products',
          name: 'products',
          fields: [
            { id: 'fld_name', name: 'name', type: 'single-line-text' },
            { id: 'fld_price', name: 'price', type: 'decimal' },
          ],
          views: [
            {
              id: 'view_by_price',
              name: 'by_price',
              type: 'grid',
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
    const response = await request.get('/api/tables/tbl_products/views/view_by_price/records', {
      headers: { Authorization: 'Bearer valid_token' },
    })

    // THEN: records sorted by price descending
    expect(response.status()).toBe(200)
    const body = await response.json()

    expect(body.records).toHaveLength(3)

    const prices = body.records.map((r) => r.fields.price)
    expect(prices).toEqual(['50.00', '25.00', '10.00'])
  }
)

test.fixme(
  'API-VIEW-RECORDS-003: should return only visible fields configured in view',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery, request }) => {
    // GIVEN: table 'users' with view showing only name and email (hiding phone)
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_users',
          name: 'users',
          fields: [
            { id: 'fld_name', name: 'name', type: 'single-line-text' },
            { id: 'fld_email', name: 'email', type: 'email' },
            { id: 'fld_phone', name: 'phone', type: 'phone-number' },
          ],
          views: [
            {
              id: 'view_contact',
              name: 'contact_info',
              type: 'grid',
              fields: [
                { fieldId: 'fld_name', visible: true },
                { fieldId: 'fld_email', visible: true },
                { fieldId: 'fld_phone', visible: false },
              ],
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
    const response = await request.get('/api/tables/tbl_users/views/view_contact/records', {
      headers: { Authorization: 'Bearer valid_token' },
    })

    // THEN: only name and email returned (phone excluded)
    expect(response.status()).toBe(200)
    const body = await response.json()

    expect(body.records).toHaveLength(1)

    const record = body.records[0]
    expect(record.fields).toHaveProperty('name')
    expect(record.fields).toHaveProperty('email')
    expect(record.fields).not.toHaveProperty('phone')
  }
)

test.fixme(
  'API-VIEW-RECORDS-004: should return 403 when user lacks view access',
  { tag: '@spec' },
  async ({ startServerWithSchema, request }) => {
    // GIVEN: table with view restricted to admin role
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_sensitive',
          name: 'sensitive_data',
          fields: [{ id: 'fld_data', name: 'data', type: 'single-line-text' }],
          views: [
            {
              id: 'view_admin',
              name: 'admin_view',
              type: 'grid',
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
  'API-VIEW-RECORDS-REGRESSION: view API endpoints work correctly',
  { tag: '@regression' },
  async ({ startServerWithSchema, executeQuery, request }) => {
    // Basic view filtering smoke test
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_items',
          name: 'items',
          fields: [
            { id: 'fld_name', name: 'name', type: 'single-line-text' },
            { id: 'fld_active', name: 'active', type: 'checkbox' },
          ],
          views: [
            {
              id: 'view_active',
              name: 'active_items',
              type: 'grid',
              filters: {
                operator: 'and',
                conditions: [{ field: 'fld_active', operator: 'is', value: true }],
              },
            },
          ],
        },
      ],
    })

    await executeQuery(
      `INSERT INTO items (name, active) VALUES ('Item 1', true), ('Item 2', false)`
    )

    const response = await request.get('/api/tables/tbl_items/views/view_active/records', {
      headers: { Authorization: 'Bearer valid_token' },
    })

    const body = await response.json()
    expect(body.records).toHaveLength(1)
    expect(body.records[0].fields.name).toBe('Item 1')
  }
)
