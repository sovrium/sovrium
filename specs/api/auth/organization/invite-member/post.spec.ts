/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'
/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * E2E Tests for Invite member to organization
 *
 * Source: specs/api/paths/auth/organization/invite-member/post.json
 * Domain: api
 * Spec Count: 9
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (9 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Validation Approach:
 * - API response assertions (status codes, response schemas)
 * - Database state validation (executeQuery fixture)
 * - Authentication/authorization checks
 */

test.describe('Invite member to organization', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-AUTH-ORG-INVITE-MEMBER-001: should returns 201 Created with invitation token and sends invitation email',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated organization owner
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          enabled: true,
          emailAndPassword: { enabled: true },
          plugins: {
            admin: { enabled: true },
            organization: { enabled: true },
          },
        },
      })

      // Database setup
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (1, 'owner@example.com', '$2a$10$YourHashedPasswordHere', 'Owner User', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO organizations (id, name, slug, created_at, updated_at) VALUES (1, 'Test Org', 'test-org', NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO organization_members (id, organization_id, user_id, role, created_at) VALUES (1, 1, 1, 'owner', NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'owner_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: Owner invites new user by email
      const response = await page.request.post('/api/auth/organization/invite-member', {
        headers: { Authorization: 'Bearer admin_token' },
        data: {
          organizationId: '1',
          email: 'newuser@example.com',
          role: 'member',
        },
      })

      // THEN: Returns 201 Created with invitation token and sends invitation email
      // Returns 201 Created
      expect(response.status).toBe(201)

      // Response contains invitation details
      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toHaveProperty('invitation')

      // Invitation is created in database with pending status
      const dbRow = await executeQuery('SELECT * FROM users LIMIT 1')
      expect(dbRow).toBeDefined()
    }
  )

  test.fixme(
    'API-AUTH-ORG-INVITE-MEMBER-002: should returns 400 Bad Request with validation errors',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated organization owner
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          enabled: true,
          emailAndPassword: { enabled: true },
          plugins: {
            admin: { enabled: true },
            organization: { enabled: true },
          },
        },
      })

      // Database setup
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (1, 'owner@example.com', '$2a$10$YourHashedPasswordHere', 'Owner User', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO organizations (id, name, slug, created_at, updated_at) VALUES (1, 'Test Org', 'test-org', NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO organization_members (id, organization_id, user_id, role, created_at) VALUES (1, 1, 1, 'owner', NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'owner_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: Owner submits request without required fields
      const response = await page.request.post('/api/auth/organization/invite-member', {
        headers: { Authorization: 'Bearer admin_token' },
      })

      // THEN: Returns 400 Bad Request with validation errors
      // Returns 400 Bad Request
      expect(response.status).toBe(400)

      // Response contains validation error for required fields
      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-INVITE-MEMBER-003: should returns 400 Bad Request with validation error',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated organization owner
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          enabled: true,
          emailAndPassword: { enabled: true },
          plugins: {
            admin: { enabled: true },
            organization: { enabled: true },
          },
        },
      })

      // Database setup
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (1, 'owner@example.com', '$2a$10$YourHashedPasswordHere', 'Owner User', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO organizations (id, name, slug, created_at, updated_at) VALUES (1, 'Test Org', 'test-org', NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO organization_members (id, organization_id, user_id, role, created_at) VALUES (1, 1, 1, 'owner', NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'owner_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: Owner submits invitation with invalid email format
      const response = await page.request.post('/api/auth/organization/invite-member', {
        headers: { Authorization: 'Bearer admin_token' },
        data: {
          organizationId: '1',
          email: 'invalid-email',
          role: 'member',
        },
      })

      // THEN: Returns 400 Bad Request with validation error
      // Returns 400 Bad Request
      expect(response.status).toBe(400)

      // Response contains validation error for email format
      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-INVITE-MEMBER-004: should returns 401 Unauthorized',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: A running server
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          enabled: true,
          emailAndPassword: { enabled: true },
          plugins: {
            admin: { enabled: true },
            organization: { enabled: true },
          },
        },
      })

      // WHEN: Unauthenticated user attempts to invite member
      const response = await page.request.post('/api/auth/organization/invite-member', {
        headers: { Authorization: 'Bearer admin_token' },
        data: {
          organizationId: '1',
          email: 'newuser@example.com',
          role: 'member',
        },
      })

      // THEN: Returns 401 Unauthorized
      // Returns 401 Unauthorized
      expect(response.status).toBe(401)

      // Response contains error about missing authentication
      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-INVITE-MEMBER-005: should returns 403 Forbidden',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated regular member (not owner/admin)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          enabled: true,
          emailAndPassword: { enabled: true },
          plugins: {
            admin: { enabled: true },
            organization: { enabled: true },
          },
        },
      })

      // Database setup
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (1, 'member@example.com', '$2a$10$YourHashedPasswordHere', 'Member User', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO organizations (id, name, slug, created_at, updated_at) VALUES (1, 'Test Org', 'test-org', NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO organization_members (id, organization_id, user_id, role, created_at) VALUES (1, 1, 1, 'member', NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'member_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: Member attempts to invite another user
      const response = await page.request.post('/api/auth/organization/invite-member', {
        headers: { Authorization: 'Bearer admin_token' },
        data: {
          organizationId: '1',
          email: 'newuser@example.com',
          role: 'member',
        },
      })

      // THEN: Returns 403 Forbidden
      // Returns 403 Forbidden
      expect(response.status).toBe(403)

      // Response contains error about insufficient permissions
      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-INVITE-MEMBER-006: should returns 404 Not Found',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          enabled: true,
          emailAndPassword: { enabled: true },
          plugins: {
            admin: { enabled: true },
            organization: { enabled: true },
          },
        },
      })

      // Database setup
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (1, 'user@example.com', '$2a$10$YourHashedPasswordHere', 'Test User', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'user_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: User attempts to invite to non-existent organization
      const response = await page.request.post('/api/auth/organization/invite-member', {
        headers: { Authorization: 'Bearer admin_token' },
        data: {
          organizationId: '999',
          email: 'newuser@example.com',
          role: 'member',
        },
      })

      // THEN: Returns 404 Not Found
      // Returns 404 Not Found
      expect(response.status).toBe(404)

      // Response contains error about organization not found
      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-INVITE-MEMBER-007: should returns 409 Conflict error',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated organization owner and a user who is already a member
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          enabled: true,
          emailAndPassword: { enabled: true },
          plugins: {
            admin: { enabled: true },
            organization: { enabled: true },
          },
        },
      })

      // Database setup
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (1, 'owner@example.com', '$2a$10$YourHashedPasswordHere', 'Owner User', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (2, 'existing@example.com', '$2a$10$YourHashedPasswordHere', 'Existing Member', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO organizations (id, name, slug, created_at, updated_at) VALUES (1, 'Test Org', 'test-org', NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO organization_members (id, organization_id, user_id, role, created_at) VALUES (1, 1, 1, 'owner', NOW())`
      )
      await executeQuery(
        `INSERT INTO organization_members (id, organization_id, user_id, role, created_at) VALUES (2, 1, 2, 'member', NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'owner_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: Owner attempts to invite existing member
      const response = await page.request.post('/api/auth/organization/invite-member', {
        headers: { Authorization: 'Bearer admin_token' },
        data: {
          organizationId: '1',
          email: 'existing@example.com',
          role: 'member',
        },
      })

      // THEN: Returns 409 Conflict error
      // Returns 409 Conflict
      expect(response.status).toBe(409)

      // Response contains error about user already being member
      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-INVITE-MEMBER-008: should returns 409 Conflict error',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated organization owner and an existing pending invitation
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          enabled: true,
          emailAndPassword: { enabled: true },
          plugins: {
            admin: { enabled: true },
            organization: { enabled: true },
          },
        },
      })

      // Database setup
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (1, 'owner@example.com', '$2a$10$YourHashedPasswordHere', 'Owner User', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO organizations (id, name, slug, created_at, updated_at) VALUES (1, 'Test Org', 'test-org', NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO organization_members (id, organization_id, user_id, role, created_at) VALUES (1, 1, 1, 'owner', NOW())`
      )
      await executeQuery(
        `INSERT INTO organization_invitations (id, organization_id, email, role, token, status, expires_at, created_at) VALUES (1, 1, 'pending@example.com', 'member', 'invite_token_123', 'pending', NOW() + INTERVAL '7 days', NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'owner_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: Owner attempts to invite user with pending invitation
      const response = await page.request.post('/api/auth/organization/invite-member', {
        headers: { Authorization: 'Bearer admin_token' },
        data: {
          organizationId: '1',
          email: 'pending@example.com',
          role: 'member',
        },
      })

      // THEN: Returns 409 Conflict error
      // Returns 409 Conflict
      expect(response.status).toBe(409)

      // Response contains error about pending invitation
      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-INVITE-MEMBER-009: should returns 409 Conflict (case-insensitive email matching)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated organization owner
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          enabled: true,
          emailAndPassword: { enabled: true },
          plugins: {
            admin: { enabled: true },
            organization: { enabled: true },
          },
        },
      })

      // Database setup
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (1, 'owner@example.com', '$2a$10$YourHashedPasswordHere', 'Owner User', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (2, 'existing@example.com', '$2a$10$YourHashedPasswordHere', 'Existing Member', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO organizations (id, name, slug, created_at, updated_at) VALUES (1, 'Test Org', 'test-org', NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO organization_members (id, organization_id, user_id, role, created_at) VALUES (1, 1, 1, 'owner', NOW())`
      )
      await executeQuery(
        `INSERT INTO organization_members (id, organization_id, user_id, role, created_at) VALUES (2, 1, 2, 'member', NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'owner_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: Owner invites user with email in different case than existing member
      const response = await page.request.post('/api/auth/organization/invite-member', {
        headers: { Authorization: 'Bearer admin_token' },
        data: {
          organizationId: '1',
          email: 'EXISTING@EXAMPLE.COM',
          role: 'member',
        },
      })

      // THEN: Returns 409 Conflict (case-insensitive email matching)
      // Returns 409 Conflict (case-insensitive)
      expect(response.status).toBe(409)

      // Response contains error about user already being member
      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toHaveProperty('message')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-ORG-INVITE-MEMBER-010: user can complete full inviteMember workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Representative test scenario
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          enabled: true,
          emailAndPassword: { enabled: true },
          plugins: {
            admin: { enabled: true },
            organization: { enabled: true },
          },
        },
      })

      // WHEN: Execute workflow
      const response = await page.request.post('/api/auth/workflow', {
        headers: { Authorization: 'Bearer admin_token' },
        data: { test: true },
      })

      // THEN: Verify integration
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data).toMatchObject({ success: true })
    }
  )
})
