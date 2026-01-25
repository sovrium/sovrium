/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Include Deleted query parameter
 *
 * Source: specs/api/paths/tables/{tableId}/records/get.json
 * Domain: api
 * Spec Count: 4
 *
 * Include Deleted Behavior:
 * - By default (includeDeleted absent or false), soft-deleted records are excluded
 * - With includeDeleted=true, soft-deleted records are included in results
 * - Pagination counts should reflect the filtered or unfiltered totals
 * - All role types (member, viewer) can use includeDeleted for read operations
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (4 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Include Deleted query parameter', () => {
  // ============================================================================
  // @spec tests (one per spec) - EXHAUSTIVE coverage
  // ============================================================================

  test(
    'API-TABLES-RECORDS-INCLUDE-DELETED-001: should exclude deleted records by default',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with mix of active and soft-deleted records
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 1,
            name: 'documents',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text', required: true },
              { id: 2, name: 'content', type: 'long-text' },
              { id: 3, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
          },
        ],
      })
      await createAuthenticatedUser()
      await executeQuery(`
        INSERT INTO documents (id, title, content, deleted_at) VALUES
          (1, 'Active Doc 1', 'Content 1', NULL),
          (2, 'Deleted Doc', 'Content 2', NOW()),
          (3, 'Active Doc 2', 'Content 3', NULL),
          (4, 'Another Deleted', 'Content 4', NOW()),
          (5, 'Active Doc 3', 'Content 5', NULL)
      `)

      // WHEN: User requests records without includeDeleted parameter
      const response = await request.get('/api/tables/1/records', {})

      // THEN: Returns 200 with only active records
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: Only 3 active records returned
      expect(data.records).toHaveLength(3)
      expect(data.pagination.total).toBe(3)

      // THEN: No soft-deleted records in response
      const ids = data.records.map((r: { id: number }) => r.id)
      expect(ids).toEqual(expect.arrayContaining([1, 3, 5]))
      expect(ids).not.toContain(2)
      expect(ids).not.toContain(4)
    }
  )

  test(
    'API-TABLES-RECORDS-INCLUDE-DELETED-002: should include deleted with includeDeleted=true',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with mix of active and soft-deleted records
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 2,
            name: 'notes',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text', required: true },
              { id: 2, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
          },
        ],
      })
      await createAuthenticatedUser()
      await executeQuery(`
        INSERT INTO notes (id, title, deleted_at) VALUES
          (1, 'Note 1', NULL),
          (2, 'Note 2 (deleted)', NOW()),
          (3, 'Note 3', NULL)
      `)

      // WHEN: User requests records with includeDeleted=true
      const response = await request.get('/api/tables/1/records', {
        params: {
          includeDeleted: 'true',
        },
      })

      // THEN: Returns 200 with all records (including deleted)
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: All 3 records returned
      expect(data.records).toHaveLength(3)
      expect(data.pagination.total).toBe(3)

      // THEN: Deleted records have deleted_at populated
      const deletedRecord = data.records.find((r: { id: number }) => r.id === 2)
      expect(deletedRecord).toBeDefined()
      expect(deletedRecord.fields.deleted_at).toBeTruthy()
    }
  )

  test(
    'API-TABLES-RECORDS-INCLUDE-DELETED-003: should allow member to use includeDeleted',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedMember }) => {
      // GIVEN: Member user accessing records with includeDeleted
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 3,
            name: 'items',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text', required: true },
              { id: 2, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
          },
        ],
      })
      await createAuthenticatedMember()
      await executeQuery(`
        INSERT INTO items (id, name, deleted_at) VALUES
          (1, 'Active Item', NULL),
          (2, 'Deleted Item', NOW())
      `)

      // WHEN: Member requests records with includeDeleted=true
      const response = await request.get('/api/tables/1/records', {
        params: {
          includeDeleted: 'true',
        },
      })

      // THEN: Returns 200 with all records (member can use includeDeleted)
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.records).toHaveLength(2)

      // THEN: Both active and deleted records are returned
      const ids = data.records.map((r: { id: number }) => r.id)
      expect(ids).toContain(1)
      expect(ids).toContain(2)
    }
  )

  test(
    'API-TABLES-RECORDS-INCLUDE-DELETED-004: should correctly count deleted vs active in pagination',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with large dataset including deleted records
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 4,
            name: 'records',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
          },
        ],
      })
      await createAuthenticatedUser()

      // Insert 30 active records and 20 deleted records
      const activeInserts = Array.from(
        { length: 30 },
        (_, i) => `(${i + 1}, 'Active ${i + 1}', NULL)`
      ).join(',')
      const deletedInserts = Array.from(
        { length: 20 },
        (_, i) => `(${i + 31}, 'Deleted ${i + 1}', NOW())`
      ).join(',')

      await executeQuery(`INSERT INTO records (id, name, deleted_at) VALUES ${activeInserts}`)
      await executeQuery(`INSERT INTO records (id, name, deleted_at) VALUES ${deletedInserts}`)

      // WHEN: User requests records without includeDeleted (default behavior)
      const defaultResponse = await request.get('/api/tables/1/records', {
        params: {
          limit: '10',
        },
      })

      // THEN: Pagination reflects only active records
      expect(defaultResponse.status()).toBe(200)
      const defaultData = await defaultResponse.json()
      expect(defaultData.records).toHaveLength(10)
      expect(defaultData.pagination.total).toBe(30) // Only active records counted

      // WHEN: User requests records with includeDeleted=true
      const includedResponse = await request.get('/api/tables/1/records', {
        params: {
          limit: '10',
          includeDeleted: 'true',
        },
      })

      // THEN: Pagination reflects all records
      expect(includedResponse.status()).toBe(200)
      const includedData = await includedResponse.json()
      expect(includedData.records).toHaveLength(10)
      expect(includedData.pagination.total).toBe(50) // All records counted
    }
  )

  // ============================================================================
  // @regression test (exactly one) - OPTIMIZED integration
  // ============================================================================

  test(
    'API-TABLES-RECORDS-INCLUDE-DELETED-REGRESSION: user can complete include-deleted workflow',
    { tag: '@regression' },
    async ({
      request,
      startServerWithSchema,
      executeQuery,
      createAuthenticatedUser,
      createAuthenticatedAdmin,
      createAuthenticatedMember,
      createAuthenticatedViewer,
    }) => {
      await test.step('Setup: Start server with table and mixed records', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: { emailAndPassword: true },
          tables: [
            {
              id: 1,
              name: 'documents',
              fields: [
                { id: 1, name: 'title', type: 'single-line-text', required: true },
                { id: 2, name: 'content', type: 'long-text' },
                { id: 3, name: 'deleted_at', type: 'deleted-at', indexed: true },
              ],
            },
          ],
        })

        // Insert 30 active records and 20 deleted records for comprehensive testing
        const activeInserts = Array.from(
          { length: 30 },
          (_, i) => `(${i + 1}, 'Active Doc ${i + 1}', 'Content ${i + 1}', NULL)`
        ).join(',')
        const deletedInserts = Array.from(
          { length: 20 },
          (_, i) => `(${i + 31}, 'Deleted Doc ${i + 1}', 'Content ${i + 31}', NOW())`
        ).join(',')

        await executeQuery(
          `INSERT INTO documents (id, title, content, deleted_at) VALUES ${activeInserts}`
        )
        await executeQuery(
          `INSERT INTO documents (id, title, content, deleted_at) VALUES ${deletedInserts}`
        )
      })

      await test.step('Authenticate as user for basic operations', async () => {
        await createAuthenticatedUser()
      })

      await test.step('API-TABLES-RECORDS-INCLUDE-DELETED-001: Excludes deleted records by default', async () => {
        // WHEN: User requests records without includeDeleted parameter
        const response = await request.get('/api/tables/1/records', {})

        // THEN: Returns 200 with only active records
        expect(response.status()).toBe(200)

        const data = await response.json()
        // THEN: Only 30 active records returned
        expect(data.records).toHaveLength(10) // First page of 10
        expect(data.pagination.total).toBe(30)

        // THEN: No soft-deleted records in response
        const ids = data.records.map((r: { id: number }) => r.id)
        ids.forEach((id: number) => {
          expect(id).toBeLessThanOrEqual(30) // Only active IDs (1-30)
        })
      })

      await test.step('API-TABLES-RECORDS-INCLUDE-DELETED-002: Includes deleted with includeDeleted=true', async () => {
        // WHEN: User requests records with includeDeleted=true
        const response = await request.get('/api/tables/1/records', {
          params: {
            includeDeleted: 'true',
          },
        })

        // THEN: Returns 200 with all records (including deleted)
        expect(response.status()).toBe(200)

        const data = await response.json()
        // THEN: All 50 records counted in total
        expect(data.records).toHaveLength(10) // First page of 10
        expect(data.pagination.total).toBe(50) // All records counted

        // THEN: Deleted records have deleted_at populated
        const allRecordsResponse = await request.get('/api/tables/1/records', {
          params: {
            includeDeleted: 'true',
            limit: '50',
          },
        })
        const allData = await allRecordsResponse.json()
        const deletedRecords = allData.records.filter((r: { fields: { deleted_at: any } }) =>
          Boolean(r.fields.deleted_at)
        )
        expect(deletedRecords.length).toBe(20)
      })

      await test.step('API-TABLES-RECORDS-INCLUDE-DELETED-003: Allows member to use includeDeleted', async () => {
        // WHEN: Member requests records with includeDeleted=true
        const response = await request.get('/api/tables/1/records', {
          params: {
            includeDeleted: 'true',
          },
        })

        // THEN: Returns 200 with all records (member can use includeDeleted)
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.pagination.total).toBe(50)

        // THEN: Both active and deleted records are accessible
        const sampleResponse = await request.get('/api/tables/1/records', {
          params: {
            includeDeleted: 'true',
            limit: '5',
          },
        })
        const sampleData = await sampleResponse.json()
        expect(sampleData.records.length).toBeGreaterThan(0)
      })

      await test.step('API-TABLES-RECORDS-INCLUDE-DELETED-004: Correctly counts deleted vs active in pagination', async () => {
        // WHEN: User requests records without includeDeleted (default behavior)
        const defaultResponse = await request.get('/api/tables/1/records', {
          params: {
            limit: '10',
          },
        })

        // THEN: Pagination reflects only active records
        expect(defaultResponse.status()).toBe(200)
        const defaultData = await defaultResponse.json()
        expect(defaultData.records).toHaveLength(10)
        expect(defaultData.pagination.total).toBe(30) // Only active records counted

        // WHEN: User requests records with includeDeleted=true
        const includedResponse = await request.get('/api/tables/1/records', {
          params: {
            limit: '10',
            includeDeleted: 'true',
          },
        })

        // THEN: Pagination reflects all records
        expect(includedResponse.status()).toBe(200)
        const includedData = await includedResponse.json()
        expect(includedData.records).toHaveLength(10)
        expect(includedData.pagination.total).toBe(50) // All records counted
      })
    }
  )
})
