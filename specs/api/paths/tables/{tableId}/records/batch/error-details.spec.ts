/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

test.fixme(
  'API-BATCH-ERROR-001: should return detailed errors for each failed item in batch create',
  { tag: '@spec' },
  async ({ startServerWithSchema, request }) => {
    // GIVEN: table 'products' with unique SKU field
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 1,
          name: 'products',
          fields: [
            { id: 1, name: 'name', type: 'single-line-text' },
            { id: 2, name: 'sku', type: 'single-line-text', unique: true },
            { id: 3, name: 'price', type: 'decimal' },
          ],
        },
      ],
    })

    // WHEN: batch creating records with validation errors
    const response = await request.post('/api/tables/tbl_products/records/batch', {
      headers: { Authorization: 'Bearer valid_token' },
      data: {
        records: [
          { fields: { name: 'Product A', sku: 'SKU-001', price: '10.00' } }, // valid
          { fields: { name: 'Product B', sku: 'SKU-001', price: '20.00' } }, // duplicate SKU
          { fields: { name: 'Product C', price: '30.00' } }, // missing required SKU
          { fields: { name: 'Product D', sku: 'SKU-002', price: 'invalid' } }, // invalid price
        ],
      },
    })

    // THEN: 207 Multi-Status with detailed errors per item
    expect(response.status()).toBe(207)
    const body = await response.json()

    expect(body.results).toHaveLength(4)

    // Item 0: Success
    expect(body.results[0]).toMatchObject({
      index: 0,
      status: 'success',
      record: {
        fields: { name: 'Product A', sku: 'SKU-001', price: '10.00' },
      },
    })

    // Item 1: Unique constraint violation
    expect(body.results[1]).toMatchObject({
      index: 1,
      status: 'error',
      error: {
        code: 'UNIQUE_CONSTRAINT_VIOLATION',
        message: expect.stringMatching(/sku.*already exists/i),
        field: 'sku',
      },
    })

    // Item 2: Required field missing
    expect(body.results[2]).toMatchObject({
      index: 2,
      status: 'error',
      error: {
        code: 'VALIDATION_ERROR',
        message: expect.stringMatching(/sku.*required/i),
        field: 'sku',
      },
    })

    // Item 3: Invalid value type
    expect(body.results[3]).toMatchObject({
      index: 3,
      status: 'error',
      error: {
        code: 'VALIDATION_ERROR',
        message: expect.stringMatching(/price.*must be.*number/i),
        field: 'price',
      },
    })
  }
)

test.fixme(
  'API-BATCH-ERROR-002: should provide rollback information when batch transaction fails',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery, request }) => {
    // GIVEN: table 'orders' with transaction-safe batch operations
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 2,
          name: 'orders',
          fields: [
            { id: 1, name: 'order_id', type: 'single-line-text', unique: true },
            { id: 2, name: 'amount', type: 'decimal' },
          ],
        },
      ],
    })

    await executeQuery(`INSERT INTO orders (order_id, amount) VALUES ('ORD-001', 100.00)`)

    // WHEN: batch creating with atomic:true and one duplicate
    const response = await request.post('/api/tables/tbl_orders/records/batch', {
      headers: { Authorization: 'Bearer valid_token' },
      data: {
        atomic: true,
        records: [
          { fields: { order_id: 'ORD-002', amount: '200.00' } },
          { fields: { order_id: 'ORD-001', amount: '300.00' } }, // duplicate
          { fields: { order_id: 'ORD-003', amount: '400.00' } },
        ],
      },
    })

    // THEN: 409 Conflict with rollback information
    expect(response.status()).toBe(409)
    const body = await response.json()

    expect(body).toMatchObject({
      error: 'Conflict',
      message: expect.stringMatching(/batch operation rolled back/i),
      details: {
        failedAtIndex: 1,
        reason: expect.stringMatching(/unique constraint violation/i),
        recordsProcessed: 1,
        recordsRolledBack: 1,
      },
    })

    // Verify rollback: ORD-002 should not exist
    const count = await executeQuery(`SELECT COUNT(*) as total FROM orders`)
    expect(count.total).toBe(1)
  }
)

test.fixme(
  'API-BATCH-REGRESSION: batch error handling works correctly',
  { tag: '@regression' },
  async ({ startServerWithSchema, request }) => {
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 3,
          name: 'items',
          fields: [
            { id: 1, name: 'name', type: 'single-line-text' },
            { id: 2, name: 'code', type: 'single-line-text', unique: true },
          ],
        },
      ],
    })

    const response = await request.post('/api/tables/tbl_items/records/batch', {
      headers: { Authorization: 'Bearer valid_token' },
      data: {
        records: [
          { fields: { name: 'Item 1', code: 'CODE1' } },
          { fields: { name: 'Item 2', code: 'CODE1' } },
        ],
      },
    })

    expect(response.status()).toBe(207)
    const body = await response.json()
    expect(body.results[0].status).toBe('success')
    expect(body.results[1].status).toBe('error')
  }
)
