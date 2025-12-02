/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable drizzle/enforce-delete-with-where */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Delete organization
 *
 * Source: specs/api/paths/auth/organization/delete-organization/delete.json
 * Domain: api
 * Spec Count: 6
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (6 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Validation Approach:
 * - API response assertions (status codes, response schemas)
 * - Database state validation via API (no direct executeQuery for auth data)
 * - Authentication/authorization checks via auth fixtures
 */

test.describe('Delete organization', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-AUTH-ORG-DELETE-ORGANIZATION-001: should return 200 OK and permanently delete organization',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated organization owner
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
          plugins: { organization: true },
        },
      })

      await signUp({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
        name: 'Owner User',
      })
      await signIn({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
      })

      // Create organization
      const createResponse = await page.request.post('/api/auth/organization/create', {
        data: { name: 'Test Org', slug: 'test-org' },
      })
      const org = await createResponse.json()

      // WHEN: Owner deletes the organization
      const response = await page.request.delete('/api/auth/organization/delete', {
        data: {
          organizationId: org.id,
        },
      })

      // THEN: Returns 200 OK and permanently deletes organization
      expect(response.status()).toBe(200)

      // Verify organization no longer exists
      const listResponse = await page.request.get('/api/auth/organization/list')
      const orgs = await listResponse.json()
      const deletedOrg = orgs.find((o: { id: string }) => o.id === org.id)
      expect(deletedOrg).toBeUndefined()
    }
  )

  test.fixme(
    'API-AUTH-ORG-DELETE-ORGANIZATION-002: should return 400 Bad Request with validation error',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
          plugins: { organization: true },
        },
      })

      await signUp({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
        name: 'Owner User',
      })
      await signIn({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
      })

      // WHEN: Owner submits request without organizationId
      const response = await page.request.delete('/api/auth/organization/delete', {
        data: {},
      })

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-DELETE-ORGANIZATION-003: should return 401 Unauthorized',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server (no authenticated user)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
          plugins: { organization: true },
        },
      })

      // WHEN: Unauthenticated user attempts to delete organization
      const response = await page.request.delete('/api/auth/organization/delete', {
        data: {
          organizationId: '1',
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-AUTH-ORG-DELETE-ORGANIZATION-004: should return 403 Forbidden',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated organization member (non-owner)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
          plugins: { organization: true },
        },
      })

      // Owner creates organization
      await signUp({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
        name: 'Owner User',
      })
      await signIn({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
      })

      const createResponse = await page.request.post('/api/auth/organization/create', {
        data: { name: 'Test Org', slug: 'test-org' },
      })
      const org = await createResponse.json()

      // Create member and invite them
      await signUp({
        email: 'member@example.com',
        password: 'MemberPass123!',
        name: 'Member User',
      })

      await page.request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: org.id,
          email: 'member@example.com',
          role: 'member',
        },
      })

      // Sign in as member
      await signIn({
        email: 'member@example.com',
        password: 'MemberPass123!',
      })

      // WHEN: Member attempts to delete organization
      const response = await page.request.delete('/api/auth/organization/delete', {
        data: {
          organizationId: org.id,
        },
      })

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-DELETE-ORGANIZATION-005: should return 404 Not Found',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
          plugins: { organization: true },
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'UserPass123!',
        name: 'Test User',
      })
      await signIn({
        email: 'user@example.com',
        password: 'UserPass123!',
      })

      // WHEN: User attempts to delete non-existent organization
      const response = await page.request.delete('/api/auth/organization/delete', {
        data: {
          organizationId: 'nonexistent-id',
        },
      })

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-DELETE-ORGANIZATION-006: should return 404 Not Found (not 403 to prevent organization enumeration)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Two organizations with different owners
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
          plugins: { organization: true },
        },
      })

      // Owner 1 creates organization
      await signUp({
        email: 'owner1@example.com',
        password: 'Owner1Pass123!',
        name: 'Owner 1',
      })
      await signIn({
        email: 'owner1@example.com',
        password: 'Owner1Pass123!',
      })

      await page.request.post('/api/auth/organization/create', {
        data: { name: 'Org A', slug: 'org-a' },
      })

      // Owner 2 creates organization
      await signUp({
        email: 'owner2@example.com',
        password: 'Owner2Pass123!',
        name: 'Owner 2',
      })
      await signIn({
        email: 'owner2@example.com',
        password: 'Owner2Pass123!',
      })

      const createResponse = await page.request.post('/api/auth/organization/create', {
        data: { name: 'Org B', slug: 'org-b' },
      })
      const orgB = await createResponse.json()

      // Sign back in as Owner 1
      await signIn({
        email: 'owner1@example.com',
        password: 'Owner1Pass123!',
      })

      // WHEN: Owner 1 attempts to delete Organization B
      const response = await page.request.delete('/api/auth/organization/delete', {
        data: {
          organizationId: orgB.id,
        },
      })

      // THEN: Returns 404 Not Found (not 403 to prevent organization enumeration)
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-ORG-DELETE-ORGANIZATION-007: user can complete full deleteOrganization workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: A running server with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
          plugins: { organization: true },
        },
      })

      // Test 1: Delete organization without auth fails
      const noAuthResponse = await page.request.delete('/api/auth/organization/delete', {
        data: { organizationId: '1' },
      })
      expect(noAuthResponse.status()).toBe(401)

      // Create and authenticate user
      await signUp({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
        name: 'Owner User',
      })
      await signIn({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
      })

      // Create organization
      const createResponse = await page.request.post('/api/auth/organization/create', {
        data: { name: 'Test Org', slug: 'test-org' },
      })
      const org = await createResponse.json()

      // Test 2: Delete organization succeeds for owner
      const deleteResponse = await page.request.delete('/api/auth/organization/delete', {
        data: { organizationId: org.id },
      })
      expect(deleteResponse.status()).toBe(200)

      // Test 3: Verify organization is deleted
      const listResponse = await page.request.get('/api/auth/organization/list')
      const orgs = await listResponse.json()
      expect(orgs.length).toBe(0)
    }
  )
})
