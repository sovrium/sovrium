/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Authorization Enforcement - Access Control Vulnerabilities
 *
 * Domain: api/auth
 * Spec Count: 7
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (7 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 *
 * Tests authorization bypass vulnerabilities that could allow:
 * - Horizontal privilege escalation (accessing other users' data)
 * - IDOR (Insecure Direct Object Reference) attacks
 * - Organization/tenant isolation bypass
 * - Role-based access control bypass
 *
 * These tests ensure that authorization checks are enforced at all API endpoints
 * and that users cannot access resources beyond their permission level.
 *
 * See also:
 * - admin-enforcement.spec.ts (vertical privilege escalation, admin-only endpoints)
 * - session-enforcement.spec.ts (session isolation, revocation)
 */

test.describe('Authorization Bypass - Access Control Vulnerabilities', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test.fixme(
    'API-AUTH-ENFORCE-AUTHZ-001: should prevent horizontal privilege escalation on user records',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Two authenticated users with their own data
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'notes',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'content', type: 'long-text' },
              { id: 3, name: 'user_id', type: 'integer', required: true },
            ],
          },
        ],
      })

      // Create user A and their note
      const userA = await createAuthenticatedUser({
        email: 'userA@example.com',
        name: 'User A',
      })

      // Create note for user A
      const noteResponse = await request.post('/api/tables/1/records', {
        data: { content: 'Private note for User A', user_id: userA.user.id },
      })
      const noteA = await noteResponse.json()

      // Create user B
      await createAuthenticatedUser({
        email: 'userB@example.com',
        name: 'User B',
      })

      // WHEN: User B attempts to access User A's note
      const response = await request.get(`/api/tables/1/records/${noteA.id}`)

      // THEN: Should return 403 Forbidden or 404 Not Found (not revealing existence)
      expect([403, 404]).toContain(response.status())

      // If 403, should not leak data
      if (response.status() === 403) {
        const data = await response.json()
        expect(data).not.toHaveProperty('content')
        expect(JSON.stringify(data)).not.toContain('Private note')
      }
    }
  )

  test.fixme(
    'API-AUTH-ENFORCE-AUTHZ-002: should prevent IDOR attacks via predictable IDs',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Application with sequential record IDs
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'documents',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'owner_id', type: 'integer', required: true },
            ],
          },
        ],
      })

      const userA = await createAuthenticatedUser({
        email: 'userA@example.com',
        name: 'User A',
      })

      // Create documents for user A
      await request.post('/api/tables/1/records', {
        data: { title: 'Document 1', owner_id: userA.user.id },
      })
      const doc2Response = await request.post('/api/tables/1/records', {
        data: { title: 'Document 2', owner_id: userA.user.id },
      })
      const doc2 = await doc2Response.json()

      // Create user B
      await createAuthenticatedUser({
        email: 'userB@example.com',
        name: 'User B',
      })

      // WHEN: User B attempts to access documents by guessing sequential IDs
      const attackResponses = await Promise.all([
        request.get(`/api/tables/1/records/${doc2.id - 1}`), // Try previous ID
        request.get(`/api/tables/1/records/${doc2.id}`), // Try known ID
        request.get(`/api/tables/1/records/${doc2.id + 1}`), // Try next ID
      ])

      // THEN: All should be denied (403 or 404)
      for (const response of attackResponses) {
        expect([403, 404]).toContain(response.status())
      }
    }
  )

  test.fixme(
    'API-AUTH-ENFORCE-AUTHZ-003: should enforce organization isolation',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Two organizations with separate data
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { organization: true },
        },
        tables: [],
      })

      // Create user in Org A
      await createAuthenticatedUser({
        email: 'userA@example.com',
        name: 'User A',
      })

      // Create organization A
      const orgAResponse = await page.request.post('/api/auth/organization/create', {
        data: { name: 'Organization A', slug: 'org-a' },
      })
      const orgA = await orgAResponse.json()

      // Switch to a different user in Org B
      await createAuthenticatedUser({
        email: 'userB@example.com',
        name: 'User B',
      })

      // Create organization B
      await page.request.post('/api/auth/organization/create', {
        data: { name: 'Organization B', slug: 'org-b' },
      })

      // WHEN: User B attempts to access Org A's data
      const response = await page.request.get(`/api/auth/organization/${orgA.id}`)

      // THEN: Should be denied
      expect([403, 404]).toContain(response.status())
    }
  )

  test.fixme(
    'API-AUTH-ENFORCE-AUTHZ-004: should prevent role manipulation attacks',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: A regular user attempting to escalate their own role
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { admin: true },
        },
        tables: [],
      })

      const regularUser = await createAuthenticatedUser({
        email: 'regular@example.com',
        name: 'Regular User',
      })

      // WHEN: User attempts to modify their own role via API
      const response = await request.patch(`/api/auth/user/update`, {
        data: {
          userId: regularUser.user.id,
          role: 'admin',
        },
      })

      // THEN: Role change should be denied or ignored
      expect([400, 403]).toContain(response.status())

      // Verify user is still not admin
      const sessionResponse = await request.get('/api/auth/get-session')
      const session = await sessionResponse.json()
      expect(session.user?.role).not.toBe('admin')
    }
  )

  test.fixme(
    'API-AUTH-ENFORCE-AUTHZ-005: should prevent parameter tampering in bulk operations',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Application with bulk delete endpoint
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'owner_id', type: 'integer', required: true },
            ],
          },
        ],
      })

      const userA = await createAuthenticatedUser({
        email: 'userA@example.com',
        name: 'User A',
      })

      // Create task for user A
      const taskResponse = await request.post('/api/tables/1/records', {
        data: { title: 'User A Task', owner_id: userA.user.id },
      })
      const taskA = await taskResponse.json()

      // Create user B
      await createAuthenticatedUser({
        email: 'userB@example.com',
        name: 'User B',
      })

      // WHEN: User B attempts to delete User A's task via bulk delete
      const response = await request.delete('/api/tables/1/records', {
        data: { ids: [taskA.id] },
      })

      // THEN: Should deny deletion of other user's records
      expect([400, 403, 404]).toContain(response.status())

      // Verify task still exists (using user A's session)
      await createAuthenticatedUser({
        email: 'userA@example.com',
        name: 'User A',
      })
      const verifyResponse = await request.get(`/api/tables/1/records/${taskA.id}`)
      expect(verifyResponse.status()).toBe(200)
    }
  )

  test.fixme(
    'API-AUTH-ENFORCE-AUTHZ-006: should prevent access via modified JWT claims',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Application with JWT-based authentication
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { admin: true },
        },
        tables: [],
      })

      await createAuthenticatedUser({
        email: 'user@example.com',
        name: 'Test User',
      })

      // WHEN: Attempting to access admin endpoint with tampered Authorization header
      const response = await request.get('/api/auth/admin/list-users', {
        headers: {
          // Attempt to use a forged/modified token
          Authorization:
            'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjM0NSIsInJvbGUiOiJhZG1pbiJ9.fake',
        },
      })

      // THEN: Should reject tampered token
      expect([400, 401, 403]).toContain(response.status())
    }
  )

  test.fixme(
    'API-AUTH-ENFORCE-AUTHZ-007: should return 404 instead of 403 to prevent enumeration',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: User attempting to probe for resources they don't own
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'secrets',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'value', type: 'single-line-text' },
              { id: 3, name: 'owner_id', type: 'integer', required: true },
            ],
          },
        ],
      })

      const userA = await createAuthenticatedUser({
        email: 'userA@example.com',
        name: 'User A',
      })

      // Create secret for user A
      const secretResponse = await request.post('/api/tables/1/records', {
        data: { value: 'super-secret', owner_id: userA.user.id },
      })
      const secretA = await secretResponse.json()

      // Switch to user B
      await createAuthenticatedUser({
        email: 'userB@example.com',
        name: 'User B',
      })

      // WHEN: User B probes for existing and non-existing resources
      const existingResponse = await request.get(`/api/tables/1/records/${secretA.id}`)
      const nonExistingResponse = await request.get(`/api/tables/1/records/99999`)

      // THEN: Both should return 404 (not 403 for existing, which reveals existence)
      // This prevents attackers from enumerating valid IDs
      expect(existingResponse.status()).toBe(404)
      expect(nonExistingResponse.status()).toBe(404)

      // Error messages should be identical to prevent timing attacks
      const existingData = await existingResponse.json()
      const nonExistingData = await nonExistingResponse.json()
      expect(existingData.error).toBe(nonExistingData.error)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test.fixme(
    'API-AUTH-ENFORCE-AUTHZ-008: authorization controls prevent privilege escalation and data leakage',
    { tag: '@regression' },
    async ({
      page,
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createAuthenticatedAdmin,
    }) => {
      let userAId: string
      let privateNoteId: number

      await test.step('Setup: Start server with auth and tables', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            plugins: { admin: true, organization: true },
          },
          tables: [
            {
              id: 1,
              name: 'notes',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'content', type: 'long-text' },
                { id: 3, name: 'owner_id', type: 'integer', required: true },
              ],
            },
          ],
        })
      })

      await test.step('Setup: Create admin and regular users', async () => {
        await createAuthenticatedAdmin()

        const userA = await createAuthenticatedUser({
          email: 'userA@example.com',
          name: 'User A',
        })
        userAId = userA.user.id

        // Create private note for User A
        const noteResponse = await request.post('/api/tables/1/records', {
          data: { content: 'Private content', owner_id: userAId },
        })
        const note = await noteResponse.json()
        privateNoteId = note.id
      })

      await test.step('Verify: Regular user cannot access admin endpoints', async () => {
        await createAuthenticatedUser({
          email: 'userB@example.com',
          name: 'User B',
        })

        const adminResponse = await page.request.get('/api/auth/admin/list-users')
        expect([400, 403]).toContain(adminResponse.status())
      })

      await test.step('Verify: User cannot access other user data', async () => {
        const noteResponse = await request.get(`/api/tables/1/records/${privateNoteId}`)
        expect([403, 404]).toContain(noteResponse.status())
      })

      await test.step('Verify: User cannot modify other user data', async () => {
        const updateResponse = await request.patch(`/api/tables/1/records/${privateNoteId}`, {
          data: { content: 'Hacked content' },
        })
        expect([403, 404]).toContain(updateResponse.status())
      })

      await test.step('Verify: User cannot delete other user data', async () => {
        const deleteResponse = await request.delete(`/api/tables/1/records/${privateNoteId}`)
        expect([403, 404]).toContain(deleteResponse.status())
      })

      await test.step('Verify: Admin can access admin endpoints', async () => {
        await createAuthenticatedAdmin()
        const adminResponse = await page.request.get('/api/auth/admin/list-users')
        expect(adminResponse.status()).toBe(200)
      })

      await test.step('Verify: Error responses are consistent (no enumeration)', async () => {
        await createAuthenticatedUser({
          email: 'prober@example.com',
          name: 'Prober',
        })

        const responses = await Promise.all([
          request.get(`/api/tables/1/records/${privateNoteId}`), // Exists, not owned
          request.get(`/api/tables/1/records/999999`), // Doesn't exist
        ])

        // Both should return same status and similar error structure
        expect(responses[0].status()).toBe(responses[1].status())
      })
    }
  )
})
