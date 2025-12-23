/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Revoke Admin Role
 *
 * Domain: api
 * Spec Count: 7
 */

test.describe('Revoke Admin Role', () => {
  test.fixme(
    'API-AUTH-ADMIN-REVOKE-001: should return 200 OK when revoking admin role',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, signUp, request }) => {
      // GIVEN: An admin and another user with admin role
      await startServerWithSchema({ name: 'test-app' })
      const admin = await createAuthenticatedUser({
        email: 'admin@example.com',
        password: 'Password123!',
      })

      const targetUser = await signUp({
        email: 'target@example.com',
        password: 'Password123!',
        name: 'Target User',
      })

      // First assign admin role to target user
      await request.post('/api/auth/admin/set-role', {
        data: { userId: targetUser.user.id, role: 'admin' },
      })

      // WHEN: Revoking admin role from target user
      const response = await request.post('/api/auth/admin/revoke-admin', {
        data: { userId: targetUser.user.id },
      })

      // THEN: Should return 200 OK
      expect(response.status()).toBe(200)
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-REVOKE-002: should remove admin permissions from user',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, signUp, request }) => {
      // GIVEN: A user with admin role
      await startServerWithSchema({ name: 'test-app' })
      const admin = await createAuthenticatedUser({
        email: 'admin@example.com',
        password: 'Password123!',
      })

      const targetUser = await signUp({
        email: 'target@example.com',
        password: 'Password123!',
        name: 'Target User',
      })

      await request.post('/api/auth/admin/set-role', {
        data: { userId: targetUser.user.id, role: 'admin' },
      })

      // WHEN: Revoking admin role
      await request.post('/api/auth/admin/revoke-admin', {
        data: { userId: targetUser.user.id },
      })

      // THEN: User should no longer have admin permissions
      const userResponse = await request.get('/api/auth/admin/get-user', {
        params: { userId: targetUser.user.id },
      })
      const userData = await userResponse.json()
      expect(userData.role).toBe('user')
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-REVOKE-003: should return 403 when non-admin tries to revoke',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, signIn, request }) => {
      // GIVEN: A regular user trying to revoke admin role
      await startServerWithSchema({ name: 'test-app' })
      const regularUser = await signUp({
        email: 'regular@example.com',
        password: 'Password123!',
        name: 'Regular User',
      })
      await signIn({ email: 'regular@example.com', password: 'Password123!' })

      const targetUser = await signUp({
        email: 'target@example.com',
        password: 'Password123!',
        name: 'Target User',
      })

      // WHEN: Non-admin tries to revoke admin role
      const response = await request.post('/api/auth/admin/revoke-admin', {
        data: { userId: targetUser.user.id },
      })

      // THEN: Should return 403 Forbidden
      expect(response.status()).toBe(403)
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-REVOKE-004: should return 404 when user not found',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: An admin user
      await startServerWithSchema({ name: 'test-app' })
      await createAuthenticatedUser({
        email: 'admin@example.com',
        password: 'Password123!',
      })

      // WHEN: Trying to revoke admin from non-existent user
      const response = await request.post('/api/auth/admin/revoke-admin', {
        data: { userId: 'non-existent-user-id' },
      })

      // THEN: Should return 404 Not Found
      expect(response.status()).toBe(404)
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-REVOKE-005: should prevent self-revocation',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: An admin user
      await startServerWithSchema({ name: 'test-app' })
      const admin = await createAuthenticatedUser({
        email: 'admin@example.com',
        password: 'Password123!',
      })

      // WHEN: Admin tries to revoke their own admin role
      const response = await request.post('/api/auth/admin/revoke-admin', {
        data: { userId: admin.user.id },
      })

      // THEN: Should return 400 Bad Request
      expect(response.status()).toBe(400)
      const error = await response.json()
      expect(error.message).toContain('self')
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-REVOKE-006: should return 401 when not authenticated',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, request }) => {
      // GIVEN: An unauthenticated request
      await startServerWithSchema({ name: 'test-app' })
      const targetUser = await signUp({
        email: 'target@example.com',
        password: 'Password123!',
        name: 'Target User',
      })

      // WHEN: Trying to revoke admin without authentication
      const response = await request.post('/api/auth/admin/revoke-admin', {
        data: { userId: targetUser.user.id },
      })

      // THEN: Should return 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-REVOKE-007: admin can revoke role and verify permissions removed',
    { tag: '@regression' },
    async ({ startServerWithSchema, createAuthenticatedUser, signUp, signIn, request }) => {
      // GIVEN: Admin assigns admin role to another user
      await startServerWithSchema({ name: 'test-app' })
      const admin = await createAuthenticatedUser({
        email: 'admin@example.com',
        password: 'Password123!',
      })

      const targetUser = await signUp({
        email: 'target@example.com',
        password: 'Password123!',
        name: 'Target User',
      })

      await request.post('/api/auth/admin/set-role', {
        data: { userId: targetUser.user.id, role: 'admin' },
      })

      // Verify target user has admin access
      await signIn({ email: 'target@example.com', password: 'Password123!' })
      const adminCheckBefore = await request.get('/api/auth/admin/list-users')
      expect(adminCheckBefore.status()).toBe(200)

      // WHEN: Original admin revokes the role
      await signIn({ email: 'admin@example.com', password: 'Password123!' })
      const revokeResponse = await request.post('/api/auth/admin/revoke-admin', {
        data: { userId: targetUser.user.id },
      })
      expect(revokeResponse.status()).toBe(200)

      // THEN: Target user should no longer have admin access
      await signIn({ email: 'target@example.com', password: 'Password123!' })
      const adminCheckAfter = await request.get('/api/auth/admin/list-users')
      expect(adminCheckAfter.status()).toBe(403)
    }
  )
})
