/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Organization Allowed Email Domains
 *
 * Domain: api
 * Spec Count: 6
 */

test.describe('Organization Allowed Email Domains', () => {
  test.fixme(
    'API-AUTH-ORG-OPT-DOMAIN-001: should allow invitation to configured email domain',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: Organization with allowed email domains configured
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
      })
      const owner = await createAuthenticatedUser({
        email: 'owner@example.com',
        password: 'Password123!',
        createOrganization: true,
      })

      await request.patch('/api/auth/organization/update-settings', {
        data: {
          organizationId: owner.organizationId!,
          allowedDomains: ['example.com', 'company.org'],
        },
      })

      // WHEN: Owner invites user with allowed domain
      const response = await request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: owner.organizationId!,
          email: 'newuser@example.com',
          role: 'member',
        },
      })

      // THEN: Invitation should succeed
      expect(response.status()).toBe(200)
    }
  )

  test.fixme(
    'API-AUTH-ORG-OPT-DOMAIN-002: should return 400 when inviting disallowed domain',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: Organization with restricted email domains
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
      })
      const owner = await createAuthenticatedUser({
        email: 'owner@example.com',
        password: 'Password123!',
        createOrganization: true,
      })

      await request.patch('/api/auth/organization/update-settings', {
        data: {
          organizationId: owner.organizationId!,
          allowedDomains: ['example.com'],
        },
      })

      // WHEN: Owner tries to invite user from disallowed domain
      const response = await request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: owner.organizationId!,
          email: 'outsider@unauthorized.com',
          role: 'member',
        },
      })

      // THEN: Should return 400 Bad Request
      expect(response.status()).toBe(400)
      const error = await response.json()
      expect(error.message).toContain('domain')
    }
  )

  test.fixme(
    'API-AUTH-ORG-OPT-DOMAIN-003: should support wildcard domain matching',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: Organization with wildcard domain configuration
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
      })
      const owner = await createAuthenticatedUser({
        email: 'owner@company.com',
        password: 'Password123!',
        createOrganization: true,
      })

      await request.patch('/api/auth/organization/update-settings', {
        data: {
          organizationId: owner.organizationId!,
          allowedDomains: ['*.company.com'],
        },
      })

      // WHEN: Owner invites users from subdomain
      const response1 = await request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: owner.organizationId!,
          email: 'user@engineering.company.com',
          role: 'member',
        },
      })

      const response2 = await request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: owner.organizationId!,
          email: 'user@sales.company.com',
          role: 'member',
        },
      })

      // THEN: Both invitations should succeed
      expect(response1.status()).toBe(200)
      expect(response2.status()).toBe(200)
    }
  )

  test.fixme(
    'API-AUTH-ORG-OPT-DOMAIN-004: should support multiple allowed domains',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: Organization with multiple allowed domains
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
      })
      const owner = await createAuthenticatedUser({
        email: 'owner@company1.com',
        password: 'Password123!',
        createOrganization: true,
      })

      await request.patch('/api/auth/organization/update-settings', {
        data: {
          organizationId: owner.organizationId!,
          allowedDomains: ['company1.com', 'company2.com', 'partner.org'],
        },
      })

      // WHEN: Owner invites users from different allowed domains
      const response1 = await request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: owner.organizationId!,
          email: 'user1@company1.com',
          role: 'member',
        },
      })

      const response2 = await request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: owner.organizationId!,
          email: 'user2@company2.com',
          role: 'member',
        },
      })

      const response3 = await request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: owner.organizationId!,
          email: 'user3@partner.org',
          role: 'member',
        },
      })

      // THEN: All invitations should succeed
      expect(response1.status()).toBe(200)
      expect(response2.status()).toBe(200)
      expect(response3.status()).toBe(200)
    }
  )

  test.fixme(
    'API-AUTH-ORG-OPT-DOMAIN-005: should validate domain format on configuration',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: Authenticated organization owner
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
      })
      const owner = await createAuthenticatedUser({
        email: 'owner@example.com',
        password: 'Password123!',
        createOrganization: true,
      })

      // WHEN: Owner tries to configure invalid domain formats
      const response = await request.patch('/api/auth/organization/update-settings', {
        data: {
          organizationId: owner.organizationId!,
          allowedDomains: ['invalid domain', '@example.com', 'http://example.com'],
        },
      })

      // THEN: Should return 400 Bad Request
      expect(response.status()).toBe(400)
      const error = await response.json()
      expect(error.message).toContain('format')
    }
  )

  test.fixme(
    'API-AUTH-ORG-OPT-DOMAIN-006: should allow all domains when list is empty',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: Organization with no domain restrictions
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
      })
      const owner = await createAuthenticatedUser({
        email: 'owner@example.com',
        password: 'Password123!',
        createOrganization: true,
      })

      // Ensure allowedDomains is empty or null
      await request.patch('/api/auth/organization/update-settings', {
        data: {
          organizationId: owner.organizationId!,
          allowedDomains: [],
        },
      })

      // WHEN: Owner invites users from any domain
      const response1 = await request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: owner.organizationId!,
          email: 'user@anydomain1.com',
          role: 'member',
        },
      })

      const response2 = await request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: owner.organizationId!,
          email: 'user@anydomain2.org',
          role: 'member',
        },
      })

      // THEN: All invitations should succeed
      expect(response1.status()).toBe(200)
      expect(response2.status()).toBe(200)
    }
  )

  test.fixme(
    'API-AUTH-ORG-OPT-DOMAIN-007: system can enforce domain restrictions across invitations',
    { tag: '@regression' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: Organization with specific domain restrictions
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
      })
      const owner = await createAuthenticatedUser({
        email: 'owner@company.com',
        password: 'Password123!',
        createOrganization: true,
      })

      await request.patch('/api/auth/organization/update-settings', {
        data: {
          organizationId: owner.organizationId!,
          allowedDomains: ['company.com', '*.subsidiary.com'],
        },
      })

      // WHEN/THEN: Invite users from allowed domains
      const allowedInvite1 = await request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: owner.organizationId!,
          email: 'user1@company.com',
          role: 'member',
        },
      })
      expect(allowedInvite1.status()).toBe(200)

      const allowedInvite2 = await request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: owner.organizationId!,
          email: 'user2@engineering.subsidiary.com',
          role: 'member',
        },
      })
      expect(allowedInvite2.status()).toBe(200)

      const allowedInvite3 = await request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: owner.organizationId!,
          email: 'user3@hr.subsidiary.com',
          role: 'admin',
        },
      })
      expect(allowedInvite3.status()).toBe(200)

      // WHEN/THEN: Reject users from disallowed domains
      const disallowedInvite1 = await request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: owner.organizationId!,
          email: 'outsider@competitor.com',
          role: 'member',
        },
      })
      expect(disallowedInvite1.status()).toBe(400)

      const disallowedInvite2 = await request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: owner.organizationId!,
          email: 'external@partner.org',
          role: 'member',
        },
      })
      expect(disallowedInvite2.status()).toBe(400)

      // THEN: Verify domain restrictions are enforced consistently
      const invitations = await request
        .get('/api/auth/organization/list-invitations', {
          params: { organizationId: owner.organizationId! },
        })
        .then((r) => r.json())

      expect(invitations.length).toBe(3)
      const invitedEmails = invitations.map((inv: any) => inv.email)
      expect(invitedEmails).toContain('user1@company.com')
      expect(invitedEmails).toContain('user2@engineering.subsidiary.com')
      expect(invitedEmails).toContain('user3@hr.subsidiary.com')
      expect(invitedEmails).not.toContain('outsider@competitor.com')
      expect(invitedEmails).not.toContain('external@partner.org')
    }
  )
})
