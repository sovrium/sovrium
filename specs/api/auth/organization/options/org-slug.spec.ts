/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Organization Slug Handling
 *
 * Domain: api
 * Spec Count: 3
 */

test.describe('Organization Slug Handling', () => {
  test.fixme(
    'API-AUTH-ORG-OPT-SLUG-001: should auto-generate slug from organization name',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: User creates organization with name
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

      await request.patch('/api/auth/organization/update', {
        data: {
          organizationId: owner.organizationId!,
          name: 'Acme Corporation',
        },
      })

      // WHEN: Fetch organization details
      const response = await request.get('/api/auth/organization/get-details', {
        params: { organizationId: owner.organizationId! },
      })

      // THEN: Slug should be auto-generated from name
      expect(response.status()).toBe(200)
      const org = await response.json()
      expect(org.slug).toBeDefined()
      expect(org.slug).toBe('acme-corporation')
    }
  )

  test.fixme(
    'API-AUTH-ORG-OPT-SLUG-002: should return 400 when slug conflicts with existing',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: Organization with existing slug
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
      })
      const owner1 = await createAuthenticatedUser({
        email: 'owner1@example.com',
        password: 'Password123!',
        createOrganization: true,
      })

      await request.patch('/api/auth/organization/update', {
        data: {
          organizationId: owner1.organizationId,
          slug: 'acme-corp',
        },
      })

      const owner2 = await createAuthenticatedUser({
        email: 'owner2@example.com',
        password: 'Password123!',
        createOrganization: true,
      })

      // WHEN: Try to use same slug for different organization
      const response = await request.patch('/api/auth/organization/update', {
        data: {
          organizationId: owner2.organizationId,
          slug: 'acme-corp',
        },
      })

      // THEN: Should return 400 Bad Request
      expect(response.status()).toBe(400)
      const error = await response.json()
      expect(error.message).toContain('slug')
    }
  )

  test.fixme(
    'API-AUTH-ORG-OPT-SLUG-003: should validate slug format (alphanumeric-dash)',
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

      // WHEN: Try to set invalid slug formats
      const invalidSlugs = [
        'invalid slug', // Contains space
        'invalid_slug', // Contains underscore
        'Invalid-Slug', // Contains uppercase
        'invalid@slug', // Contains special char
        'invalid.slug', // Contains dot
      ]

      for (const invalidSlug of invalidSlugs) {
        const response = await request.patch('/api/auth/organization/update', {
          data: {
            organizationId: owner.organizationId!,
            slug: invalidSlug,
          },
        })

        // THEN: Should return 400 for invalid format
        expect(response.status()).toBe(400)
        const error = await response.json()
        expect(error.message).toContain('slug')
      }

      // WHEN: Set valid slug
      const validResponse = await request.patch('/api/auth/organization/update', {
        data: {
          organizationId: owner.organizationId!,
          slug: 'valid-slug-123',
        },
      })

      // THEN: Valid slug should succeed
      expect(validResponse.status()).toBe(200)
    }
  )

  test.fixme(
    'API-AUTH-ORG-OPT-SLUG-REGRESSION: system can manage slug uniqueness across organizations',
    { tag: '@regression' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      let org1: Awaited<ReturnType<typeof createAuthenticatedUser>>
      let org2: Awaited<ReturnType<typeof createAuthenticatedUser>>

      await test.step('Setup: Start server with comprehensive configuration', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            organization: true,
          },
        })

        org1 = await createAuthenticatedUser({
          email: 'org1@example.com',
          password: 'Password123!',
          createOrganization: true,
        })

        org2 = await createAuthenticatedUser({
          email: 'org2@example.com',
          password: 'Password123!',
          createOrganization: true,
        })
      })

      await test.step('API-AUTH-ORG-OPT-SLUG-001: Auto-generates slug from organization name', async () => {
        // WHEN: Update organization with name
        await request.patch('/api/auth/organization/update', {
          data: {
            organizationId: org1.organizationId!,
            name: 'Acme Corporation',
          },
        })

        // WHEN: Fetch organization details
        const response = await request.get('/api/auth/organization/get-details', {
          params: { organizationId: org1.organizationId! },
        })

        // THEN: Slug should be auto-generated from name
        expect(response.status()).toBe(200)
        const org = await response.json()
        expect(org.slug).toBeDefined()
        expect(org.slug).toBe('acme-corporation')
      })

      await test.step('API-AUTH-ORG-OPT-SLUG-002: Returns 400 when slug conflicts with existing', async () => {
        // Set up org2 with explicit slug
        await request.patch('/api/auth/organization/update', {
          data: {
            organizationId: org2.organizationId!,
            slug: 'company-two',
          },
        })

        // WHEN: Try to use same slug for different organization
        const response = await request.patch('/api/auth/organization/update', {
          data: {
            organizationId: org2.organizationId!,
            slug: 'acme-corporation', // Same as org1
          },
        })

        // THEN: Should return 400 Bad Request
        expect(response.status()).toBe(400)
        const error = await response.json()
        expect(error.message).toContain('slug')
      })

      await test.step('API-AUTH-ORG-OPT-SLUG-003: Validates slug format (alphanumeric-dash)', async () => {
        // WHEN: Try to set invalid slug formats
        const invalidSlugs = [
          'invalid slug', // Contains space
          'invalid_slug', // Contains underscore
          'Invalid-Slug', // Contains uppercase
        ]

        for (const invalidSlug of invalidSlugs) {
          const response = await request.patch('/api/auth/organization/update', {
            data: {
              organizationId: org2.organizationId!,
              slug: invalidSlug,
            },
          })

          // THEN: Should return 400 for invalid format
          expect(response.status()).toBe(400)
          const error = await response.json()
          expect(error.message).toContain('slug')
        }

        // WHEN: Set valid slug
        const validResponse = await request.patch('/api/auth/organization/update', {
          data: {
            organizationId: org2.organizationId!,
            slug: 'valid-slug-123',
          },
        })

        // THEN: Valid slug should succeed
        expect(validResponse.status()).toBe(200)
      })

      await test.step('Verifies auto-generation creates unique slugs for duplicate names', async () => {
        // WHEN: Create org3 with same name as org1
        const org3 = await createAuthenticatedUser({
          email: 'org3@example.com',
          password: 'Password123!',
          createOrganization: true,
        })

        await request.patch('/api/auth/organization/update', {
          data: {
            organizationId: org3.organizationId!,
            name: 'Acme Corporation', // Same name as org1
          },
        })

        const org3Details = await request
          .get('/api/auth/organization/get-details', {
            params: { organizationId: org3.organizationId! },
          })
          .then((r) => r.json())

        // THEN: Should generate unique slug (e.g., acme-corporation-1 or similar)
        expect(org3Details.slug).not.toBe('acme-corporation')
        expect(org3Details.slug).toContain('acme')

        // THEN: Verify all slugs are unique
        const allOrgs = await request.get('/api/auth/organization/list').then((r) => r.json())

        const slugs = allOrgs.map((o: any) => o.slug)
        const uniqueSlugs = new Set(slugs)
        expect(slugs.length).toBe(uniqueSlugs.size)
      })
    }
  )
})
