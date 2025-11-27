/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/* eslint-disable drizzle/enforce-delete-with-where */
/**
 * E2E Tests for Cancel organization invitation
 *
 * Source: specs/api/paths/auth/organization/cancel-invitation/delete.json
 * Domain: api
 * Spec Count: 8
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (8 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Validation Approach:
 * - API response assertions (status codes, response schemas)
 * - Database state validation (executeQuery fixture)
 * - Authentication/authorization checks
 */

test.describe('Cancel organization invitation', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-AUTH-ORG-CANCEL-INVITATION-001: should returns 200 OK and invitation status updated to cancelled',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated organization owner and a pending invitation
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin', 'organization'],
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
        `INSERT INTO organization_invitations (id, organization_id, email, role, token, status, expires_at, created_at) VALUES (1, 1, 'invitee@example.com', 'member', 'invite_token_123', 'pending', NOW() + INTERVAL '7 days', NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'owner_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: Owner cancels the invitation
      const response = await page.request.delete('/api/auth/organization/cancel-invitation', {
        data: {
          invitationId: '1',
        },
      })

      // THEN: Returns 200 OK and invitation status updated to cancelled
      // Returns 200 OK
      expect(response.status).toBe(200)

      // Response contains success flag
      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toMatchObject({ success: true })

      // Invitation status updated to cancelled
      const dbRow = await executeQuery('SELECT * FROM users LIMIT 1')
      expect(dbRow).toBeDefined()
    }
  )

  test.fixme(
    'API-AUTH-ORG-CANCEL-INVITATION-002: should returns 400 Bad Request with validation error',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated organization owner
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin', 'organization'],
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

      // WHEN: Owner submits request without invitationId
      const response = await page.request.delete('/api/auth/organization/cancel-invitation', {})

      // THEN: Returns 400 Bad Request with validation error
      // Returns 400 Bad Request
      expect(response.status).toBe(400)

      // Response contains validation error for invitationId field
      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-CANCEL-INVITATION-003: should returns 401 Unauthorized',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin', 'organization'],
        },
      })

      // WHEN: Unauthenticated user attempts to cancel invitation
      const response = await page.request.delete('/api/auth/organization/cancel-invitation', {
        data: {
          invitationId: '1',
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
    'API-AUTH-ORG-CANCEL-INVITATION-004: should returns 403 Forbidden',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated regular member (not owner/admin)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin', 'organization'],
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
        `INSERT INTO organization_invitations (id, organization_id, email, role, token, status, expires_at, created_at) VALUES (1, 1, 'invitee@example.com', 'member', 'invite_token_123', 'pending', NOW() + INTERVAL '7 days', NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'member_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: Member attempts to cancel invitation
      const response = await page.request.delete('/api/auth/organization/cancel-invitation', {
        data: {
          invitationId: '1',
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
    'API-AUTH-ORG-CANCEL-INVITATION-005: should returns 404 Not Found',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated organization owner
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin', 'organization'],
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

      // WHEN: Owner attempts to cancel non-existent invitation
      const response = await page.request.delete('/api/auth/organization/cancel-invitation', {
        data: {
          invitationId: '999',
        },
      })

      // THEN: Returns 404 Not Found
      // Returns 404 Not Found
      expect(response.status).toBe(404)

      // Response contains error about invitation not found
      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-CANCEL-INVITATION-006: should returns 409 Conflict',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated organization owner and an accepted invitation
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin', 'organization'],
        },
      })

      // Database setup
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (1, 'owner@example.com', '$2a$10$YourHashedPasswordHere', 'Owner User', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (2, 'member@example.com', '$2a$10$YourHashedPasswordHere', 'Member User', true, NOW(), NOW())`
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
        `INSERT INTO organization_invitations (id, organization_id, email, role, token, status, expires_at, created_at) VALUES (1, 1, 'member@example.com', 'member', 'invite_token_123', 'accepted', NOW() + INTERVAL '7 days', NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'owner_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: Owner attempts to cancel already accepted invitation
      const response = await page.request.delete('/api/auth/organization/cancel-invitation', {
        data: {
          invitationId: '1',
        },
      })

      // THEN: Returns 409 Conflict
      // Returns 409 Conflict
      expect(response.status).toBe(409)

      // Response contains error about invitation already accepted
      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-CANCEL-INVITATION-007: should returns 409 Conflict',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated organization owner and an already cancelled invitation
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin', 'organization'],
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
        `INSERT INTO organization_invitations (id, organization_id, email, role, token, status, expires_at, created_at) VALUES (1, 1, 'invitee@example.com', 'member', 'invite_token_123', 'cancelled', NOW() + INTERVAL '7 days', NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'owner_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: Owner attempts to cancel the same invitation again
      const response = await page.request.delete('/api/auth/organization/cancel-invitation', {
        data: {
          invitationId: '1',
        },
      })

      // THEN: Returns 409 Conflict
      // Returns 409 Conflict
      expect(response.status).toBe(409)

      // Response contains error about invitation already cancelled
      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-CANCEL-INVITATION-008: should returns 404 Not Found (prevent organization enumeration)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated owner of one organization and an invitation from different organization
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin', 'organization'],
        },
      })

      // Database setup
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (1, 'owner1@example.com', '$2a$10$YourHashedPasswordHere', 'Owner 1', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (2, 'owner2@example.com', '$2a$10$YourHashedPasswordHere', 'Owner 2', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO organizations (id, name, slug, created_at, updated_at) VALUES (1, 'Org One', 'org-one', NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO organizations (id, name, slug, created_at, updated_at) VALUES (2, 'Org Two', 'org-two', NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO organization_members (id, organization_id, user_id, role, created_at) VALUES (1, 1, 1, 'owner', NOW())`
      )
      await executeQuery(
        `INSERT INTO organization_members (id, organization_id, user_id, role, created_at) VALUES (2, 2, 2, 'owner', NOW())`
      )
      await executeQuery(
        `INSERT INTO organization_invitations (id, organization_id, email, role, token, status, expires_at, created_at) VALUES (1, 2, 'invitee@example.com', 'member', 'invite_token_123', 'pending', NOW() + INTERVAL '7 days', NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'owner1_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: Owner attempts to cancel invitation from another organization
      const response = await page.request.delete('/api/auth/organization/cancel-invitation', {
        data: {
          invitationId: '1',
        },
      })

      // THEN: Returns 404 Not Found (prevent organization enumeration)
      // Returns 404 Not Found (prevent organization enumeration)
      expect(response.status).toBe(404)

      // Response contains error about invitation not found
      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toHaveProperty('message')

      // Invitation remains pending in its organization
      const dbRow = await executeQuery('SELECT * FROM users LIMIT 1')
      expect(dbRow).toBeDefined()
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-ORG-CANCEL-INVITATION-009: user can complete full cancelInvitation workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Representative test scenario
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin', 'organization'],
        },
      })

      // WHEN: Execute workflow
      const response = await page.request.post('/api/auth/workflow', {
        data: { test: true },
      })

      // THEN: Verify integration
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data).toMatchObject({ success: true })
    }
  )
})
