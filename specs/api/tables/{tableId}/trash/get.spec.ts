/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for GET /trash endpoint (view deleted records)
 *
 * Source: specs/api/paths/tables/{tableId}/trash/get.json
 * Domain: api
 * Spec Count: 5
 *
 * Trash Endpoint Behavior:
 * - GET /trash returns ONLY soft-deleted records (deleted_at IS NOT NULL)
 * - Excludes active records (deleted_at IS NULL)
 * - Supports pagination, filtering, and sorting
 * - Respects organization isolation and permissions
 * - Returns deleted_at timestamp for each record
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (5 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 */

test.describe('GET /trash endpoint', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test.fixme(
    'API-TABLES-TRASH-001: should return 200 with only soft-deleted records',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with mix of active and deleted records
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'contacts',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text', required: true },
              { id: 3, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      await executeQuery(`
        INSERT INTO contacts (id, name) VALUES
        (1, 'Alice'),
        (2, 'Bob'),
        (3, 'Charlie')
      `)
      await executeQuery('UPDATE contacts SET deleted_at = NOW() WHERE id IN (2, 3)')

      // WHEN: User requests trash endpoint
      const response = await request.get('/api/tables/1/trash')

      // THEN: Returns 200 with only deleted records
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.records).toHaveLength(2)

      const deletedIds = data.records.map((r: { id: number }) => r.id).sort()
      expect(deletedIds).toEqual([2, 3])

      // THEN: Each record has deleted_at timestamp
      data.records.forEach((record: { fields: { deleted_at: string | null } }) => {
        expect(record.fields.deleted_at).not.toBeNull()
      })

      // THEN: Active records are excluded
      expect(data.records.find((r: { id: number }) => r.id === 1)).toBeUndefined()
    }
  )

  test.fixme(
    'API-TABLES-TRASH-002: should return 401 Unauthorized for unauthenticated requests',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Table with deleted records
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text', required: true },
              { id: 2, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
          },
        ],
      })

      // WHEN: Unauthenticated user requests trash
      const response = await request.get('/api/tables/1/trash')

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)

      const data = await response.json()
      expect(data.error).toBeDefined()
    }
  )

  test.fixme(
    'API-TABLES-TRASH-003: should return 403 Forbidden for viewer without read access',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Viewer user with no read permission on table
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'projects',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text', required: true },
              { id: 2, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
            permissions: {
              organizationScoped: true,
              read: { type: 'roles', roles: ['member', 'admin', 'owner'] }, // Viewer excluded
            },
          },
        ],
      })

      await executeQuery(`
        INSERT INTO projects (id, name, deleted_at) VALUES (1, 'Deleted Project', NOW())
      `)

      // WHEN: Viewer attempts to access trash
      const response = await request.get('/api/tables/1/trash', {})

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data.error).toBe('Forbidden')
    }
  )

  test.fixme(
    'API-TABLES-TRASH-004: should respect organization isolation',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: User from org_123 with deleted records in org_456
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'items',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text', required: true },
              { id: 2, name: 'organization_id', type: 'single-line-text' },
              { id: 3, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
          },
        ],
      })

      await executeQuery(`
        INSERT INTO items (id, name, organization_id, deleted_at) VALUES
        (1, 'Org 123 Item', 'org_123', NOW()),
        (2, 'Org 456 Item', 'org_456', NOW())
      `)

      // WHEN: User from org_123 requests trash
      const response = await request.get('/api/tables/1/trash', {})

      // THEN: Returns 200 with only org_123 deleted records
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.records).toHaveLength(1)
      expect(data.records[0].id).toBe(1)
      expect(data.records[0].fields.organization_id).toBe('org_123')
    }
  )

  test.fixme(
    'API-TABLES-TRASH-005: should support pagination, filters, and sorting',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with multiple deleted records
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'notes',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text', required: true },
              { id: 2, name: 'status', type: 'single-line-text', required: true },
              { id: 3, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
          },
        ],
      })

      await executeQuery(`
        INSERT INTO notes (id, title, status, deleted_at) VALUES
        (1, 'Z Note', 'archived', NOW()),
        (2, 'A Note', 'archived', NOW()),
        (3, 'M Note', 'draft', NOW())
      `)

      // WHEN: User requests trash with sorting
      const sortedResponse = await request.get('/api/tables/1/trash', {
        params: {
          sort: 'title:asc',
        },
      })

      // THEN: Records are sorted by title ascending
      expect(sortedResponse.status()).toBe(200)
      const sortedData = await sortedResponse.json()
      expect(sortedData.records).toHaveLength(3)
      expect(sortedData.records[0].fields.title).toBe('A Note')
      expect(sortedData.records[2].fields.title).toBe('Z Note')

      // WHEN: User requests trash with filter
      const filteredResponse = await request.get('/api/tables/1/trash', {
        params: {
          filter: JSON.stringify({
            and: [{ field: 'status', operator: 'equals', value: 'archived' }],
          }),
        },
      })

      // THEN: Only archived deleted records are returned
      expect(filteredResponse.status()).toBe(200)
      const filteredData = await filteredResponse.json()
      expect(filteredData.records).toHaveLength(2)
      expect(
        filteredData.records.every(
          (r: { fields: { status: string } }) => r.fields.status === 'archived'
        )
      ).toBe(true)

      // WHEN: User requests trash with pagination
      const paginatedResponse = await request.get('/api/tables/1/trash', {
        params: {
          limit: '2',
          offset: '1',
        },
      })

      // THEN: Pagination is respected
      expect(paginatedResponse.status()).toBe(200)
      const paginatedData = await paginatedResponse.json()
      expect(paginatedData.records).toHaveLength(2)
      expect(paginatedData.pagination.total).toBe(3)
      expect(paginatedData.pagination.limit).toBe(2)
      expect(paginatedData.pagination.offset).toBe(1)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test.fixme(
    'API-TABLES-TRASH-REGRESSION: user can complete full trash workflow',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      await test.step('Setup: Start server with contacts table', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 6,
              name: 'contacts',
              fields: [
                { id: 1, name: 'name', type: 'single-line-text', required: true },
                { id: 2, name: 'email', type: 'email', required: true },
                { id: 3, name: 'status', type: 'single-line-text' },
                { id: 4, name: 'deleted_at', type: 'deleted-at', indexed: true },
              ],
            },
          ],
        })
      })

      await test.step('Setup: Insert mix of active and deleted records', async () => {
        await executeQuery(`
          INSERT INTO contacts (id, name, email, status) VALUES
          (1, 'Alice', 'alice@example.com', 'active'),
          (2, 'Bob', 'bob@example.com', 'active'),
          (3, 'Charlie', 'charlie@example.com', 'inactive')
        `)

        // Soft delete records 2 and 3
        await executeQuery('UPDATE contacts SET deleted_at = NOW() WHERE id IN (2, 3)')
      })

      await test.step('Verify trash shows only deleted records', async () => {
        const response = await request.get('/api/tables/1/trash', {})
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.records).toHaveLength(2)
        expect(data.records.map((r: { id: number }) => r.id).sort()).toEqual([2, 3])
      })

      await test.step('Verify normal records endpoint excludes deleted', async () => {
        const response = await request.get('/api/tables/1/records', {})
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.records).toHaveLength(1)
        expect(data.records[0].id).toBe(1)
      })

      await test.step('Filter trash by status', async () => {
        const response = await request.get('/api/tables/1/trash', {
          params: {
            filter: JSON.stringify({
              and: [{ field: 'status', operator: 'equals', value: 'inactive' }],
            }),
          },
        })
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.records).toHaveLength(1)
        expect(data.records[0].id).toBe(3)
      })

      await test.step('Restore record from trash', async () => {
        const restoreResponse = await request.post('/api/tables/1/records/2/restore', {})
        expect(restoreResponse.status()).toBe(200)

        // Verify trash count decreased
        const trashResponse = await request.get('/api/tables/1/trash', {})
        const trashData = await trashResponse.json()
        expect(trashData.records).toHaveLength(1)
        expect(trashData.records[0].id).toBe(3)

        // Verify records endpoint includes restored record
        const recordsResponse = await request.get('/api/tables/1/records', {})
        const recordsData = await recordsResponse.json()
        expect(recordsData.records).toHaveLength(2)
        expect(recordsData.records.map((r: { id: number }) => r.id).sort()).toEqual([1, 2])
      })

      await test.step('Verify trash with sorting', async () => {
        const response = await request.get('/api/tables/1/trash', {
          params: {
            sort: 'name:desc',
          },
        })
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.records).toHaveLength(1)
        expect(data.records[0].fields.name).toBe('Charlie')
      })
    }
  )
})
