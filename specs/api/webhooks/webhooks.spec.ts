/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@playwright/test'

test.fixme(
  'API-WEBHOOK-001: should trigger webhook when record created',
  { tag: '@spec' },
  async ({ startServerWithSchema, request, mockWebhookServer }) => {
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_orders',
          name: 'orders',
          fields: [{ id: 'fld_total', name: 'total', type: 'decimal' }],
        },
      ],
    })

    const webhookResponse = await request.post('/api/webhooks', {
      headers: { Authorization: 'Bearer valid_token' },
      data: {
        url: mockWebhookServer.url,
        events: ['record.created'],
        tableId: 'tbl_orders',
      },
    })
    expect(webhookResponse.status()).toBe(201)

    const createResponse = await request.post('/api/tables/tbl_orders/records', {
      headers: { Authorization: 'Bearer valid_token' },
      data: {
        fields: { total: 150.0 },
      },
    })
    expect(createResponse.status()).toBe(201)

    await mockWebhookServer.waitForRequest()
    const webhookPayload = mockWebhookServer.lastRequest.body

    expect(webhookPayload).toMatchObject({
      event: 'record.created',
      tableId: 'tbl_orders',
      record: {
        fields: {
          total: '150.00',
        },
      },
    })
  }
)

test.fixme(
  'API-WEBHOOK-002: should retry webhook delivery on failure with exponential backoff',
  { tag: '@spec' },
  async ({ startServerWithSchema, request, mockWebhookServer }) => {
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_events',
          name: 'events',
          fields: [{ id: 'fld_name', name: 'name', type: 'single-line-text' }],
        },
      ],
    })

    mockWebhookServer.failNextRequests(2)

    await request.post('/api/webhooks', {
      headers: { Authorization: 'Bearer valid_token' },
      data: {
        url: mockWebhookServer.url,
        events: ['record.created'],
        tableId: 'tbl_events',
        retryConfig: {
          maxRetries: 3,
          backoffMultiplier: 2,
          initialDelay: 100,
        },
      },
    })

    await request.post('/api/tables/tbl_events/records', {
      headers: { Authorization: 'Bearer valid_token' },
      data: { fields: { name: 'Event 1' } },
    })

    await mockWebhookServer.waitForRequests(3)

    const attempts = mockWebhookServer.requests
    expect(attempts).toHaveLength(3)

    const delay1 = attempts[1].timestamp - attempts[0].timestamp
    const delay2 = attempts[2].timestamp - attempts[1].timestamp

    expect(delay1).toBeGreaterThanOrEqual(100)
    expect(delay2).toBeGreaterThanOrEqual(200)
    expect(delay2 / delay1).toBeCloseTo(2, 0.5)
  }
)

test.fixme(
  'API-REALTIME-WS-001: should receive real-time updates via WebSocket',
  { tag: '@spec' },
  async ({ startServerWithSchema, request, connectWebSocket }) => {
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_chat',
          name: 'chat_messages',
          fields: [{ id: 'fld_message', name: 'message', type: 'long-text' }],
          realtime: {
            enabled: true,
          },
        },
      ],
    })

    const ws = await connectWebSocket('/api/realtime', {
      headers: { Authorization: 'Bearer valid_token' },
    })

    await ws.send(
      JSON.stringify({
        action: 'subscribe',
        tableId: 'tbl_chat',
      })
    )

    await request.post('/api/tables/tbl_chat/records', {
      headers: { Authorization: 'Bearer other_user_token' },
      data: { fields: { message: 'Hello World' } },
    })

    const message = await ws.waitForMessage()
    const payload = JSON.parse(message)

    expect(payload).toMatchObject({
      event: 'record.created',
      tableId: 'tbl_chat',
      record: {
        fields: {
          message: 'Hello World',
        },
      },
    })
  }
)

test.fixme(
  'API-REALTIME-WS-002: should receive only updates matching subscription filter',
  { tag: '@spec' },
  async ({ startServerWithSchema, request, connectWebSocket }) => {
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_notifications',
          name: 'notifications',
          fields: [
            { id: 'fld_user_id', name: 'user_id', type: 'integer' },
            { id: 'fld_message', name: 'message', type: 'single-line-text' },
          ],
          realtime: {
            enabled: true,
            filterBy: 'user_id',
          },
        },
      ],
    })

    const ws = await connectWebSocket('/api/realtime', {
      headers: { Authorization: 'Bearer user_123_token' },
    })

    await ws.send(
      JSON.stringify({
        action: 'subscribe',
        tableId: 'tbl_notifications',
        filter: { user_id: 123 },
      })
    )

    await request.post('/api/tables/tbl_notifications/records', {
      headers: { Authorization: 'Bearer admin_token' },
      data: { fields: { user_id: 123, message: 'For User 123' } },
    })

    await request.post('/api/tables/tbl_notifications/records', {
      headers: { Authorization: 'Bearer admin_token' },
      data: { fields: { user_id: 456, message: 'For User 456' } },
    })

    const message = await ws.waitForMessage(1000)
    const payload = JSON.parse(message)

    expect(payload.record.fields.user_id).toBe(123)
    expect(payload.record.fields.message).toBe('For User 123')

    await expect(ws.waitForMessage(500)).rejects.toThrow(/timeout/)
  }
)

test.fixme(
  'API-WEBHOOK-REGRESSION: webhooks and real-time updates work correctly',
  { tag: '@regression' },
  async ({ startServerWithSchema, request, mockWebhookServer }) => {
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_test',
          name: 'test',
          fields: [{ id: 'fld_value', name: 'value', type: 'single-line-text' }],
        },
      ],
    })

    await request.post('/api/webhooks', {
      headers: { Authorization: 'Bearer valid_token' },
      data: {
        url: mockWebhookServer.url,
        events: ['record.created'],
        tableId: 'tbl_test',
      },
    })

    await request.post('/api/tables/tbl_test/records', {
      headers: { Authorization: 'Bearer valid_token' },
      data: { fields: { value: 'test' } },
    })

    await mockWebhookServer.waitForRequest()
    expect(mockWebhookServer.lastRequest.body.event).toBe('record.created')
  }
)
