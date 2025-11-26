/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@playwright/test'

test.fixme(
  'APP-PERM-INHERIT-001: should inherit table permissions from workspace',
  { tag: '@spec' },
  async ({ startServerWithSchema, request }) => {
    // GIVEN: workspace with read-only permission for viewer role
    await startServerWithSchema({
      name: 'test-app',
      permissions: {
        workspace: {
          roles: [
            {
              name: 'viewer',
              permissions: {
                tables: { create: false, read: true, update: false, delete: false },
              },
            },
          ],
        },
      },
      tables: [
        {
          id: 'tbl_data',
          name: 'data',
          fields: [{ id: 'fld_value', name: 'value', type: 'single-line-text' }],
          // No explicit table permissions - should inherit from workspace
        },
      ],
    })

    // WHEN: viewer attempts to create record
    const createResponse = await request.post('/api/tables/tbl_data/records', {
      headers: { Authorization: 'Bearer viewer_token' },
      data: { fields: { value: 'test' } },
    })

    // THEN: create is forbidden (inherited from workspace)
    expect(createResponse.status()).toBe(403)

    // WHEN: viewer attempts to read records
    const readResponse = await request.get('/api/tables/tbl_data/records', {
      headers: { Authorization: 'Bearer viewer_token' },
    })

    // THEN: read is allowed (inherited from workspace)
    expect(readResponse.status()).toBe(200)
  }
)

test.fixme(
  'APP-PERM-INHERIT-002: should override workspace permissions at table level',
  { tag: '@spec' },
  async ({ startServerWithSchema, request }) => {
    // GIVEN: workspace with read-only, but table allows create for viewers
    await startServerWithSchema({
      name: 'test-app',
      permissions: {
        workspace: {
          roles: [
            {
              name: 'viewer',
              permissions: {
                tables: { create: false, read: true, update: false, delete: false },
              },
            },
          ],
        },
      },
      tables: [
        {
          id: 'tbl_feedback',
          name: 'feedback',
          fields: [{ id: 'fld_message', name: 'message', type: 'long-text' }],
          permissions: {
            roles: [
              {
                name: 'viewer',
                permissions: {
                  records: { create: true, read: true, update: false, delete: false },
                },
              },
            ],
          },
        },
      ],
    })

    // WHEN: viewer attempts to create record in feedback table
    const createResponse = await request.post('/api/tables/tbl_feedback/records', {
      headers: { Authorization: 'Bearer viewer_token' },
      data: { fields: { message: 'Great app!' } },
    })

    // THEN: create is allowed (table-level override)
    expect(createResponse.status()).toBe(201)
    const body = await createResponse.json()
    expect(body.record.fields.message).toBe('Great app!')
  }
)

test.fixme(
  'APP-PERM-REGRESSION: permission inheritance works correctly',
  { tag: '@regression' },
  async ({ startServerWithSchema, request }) => {
    await startServerWithSchema({
      name: 'test-app',
      permissions: {
        workspace: {
          roles: [
            {
              name: 'admin',
              permissions: {
                tables: { create: true, read: true, update: true, delete: true },
              },
            },
          ],
        },
      },
      tables: [
        {
          id: 'tbl_test',
          name: 'test',
          fields: [{ id: 'fld_data', name: 'data', type: 'single-line-text' }],
        },
      ],
    })

    const response = await request.post('/api/tables/tbl_test/records', {
      headers: { Authorization: 'Bearer admin_token' },
      data: { fields: { data: 'test' } },
    })

    expect(response.status()).toBe(201)
  }
)
