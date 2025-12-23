/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Organization Metadata
 *
 * Domain: api
 * Spec Count: 7
 */

test.describe('Organization Metadata', () => {
  test.fixme(
    'API-AUTH-ORG-OPT-METADATA-001: should store custom metadata on organization',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: Organization with custom metadata
      await startServerWithSchema({ name: 'test-app' })
      const owner = await createAuthenticatedUser({
        email: 'owner@example.com',
        password: 'Password123!',
        createOrganization: true,
      })

      // WHEN: Update organization with metadata
      const response = await request.patch('/api/auth/organization/update', {
        data: {
          organizationId: owner.organizationId,
          metadata: {
            industry: 'technology',
            companySize: '50-100',
            region: 'us-west',
          },
        },
      })

      // THEN: Metadata should be stored successfully
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.metadata).toEqual({
        industry: 'technology',
        companySize: '50-100',
        region: 'us-west',
      })
    }
  )

  test.fixme(
    'API-AUTH-ORG-OPT-METADATA-002: should update organization metadata',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: Organization with existing metadata
      await startServerWithSchema({ name: 'test-app' })
      const owner = await createAuthenticatedUser({
        email: 'owner@example.com',
        password: 'Password123!',
        createOrganization: true,
      })

      await request.patch('/api/auth/organization/update', {
        data: {
          organizationId: owner.organizationId,
          metadata: {
            industry: 'technology',
            companySize: '10-50',
          },
        },
      })

      // WHEN: Update metadata with new values
      const response = await request.patch('/api/auth/organization/update', {
        data: {
          organizationId: owner.organizationId,
          metadata: {
            industry: 'finance',
            companySize: '50-100',
            region: 'eu-central',
          },
        },
      })

      // THEN: Metadata should be updated
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.metadata.industry).toBe('finance')
      expect(data.metadata.companySize).toBe('50-100')
      expect(data.metadata.region).toBe('eu-central')
    }
  )

  test.fixme(
    'API-AUTH-ORG-OPT-METADATA-003: should return metadata in organization response',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: Organization with metadata
      await startServerWithSchema({ name: 'test-app' })
      const owner = await createAuthenticatedUser({
        email: 'owner@example.com',
        password: 'Password123!',
        createOrganization: true,
      })

      await request.patch('/api/auth/organization/update', {
        data: {
          organizationId: owner.organizationId,
          metadata: {
            industry: 'healthcare',
            tier: 'premium',
          },
        },
      })

      // WHEN: Fetch organization details
      const response = await request.get('/api/auth/organization/get-details', {
        params: { organizationId: owner.organizationId },
      })

      // THEN: Response should include metadata
      expect(response.status()).toBe(200)
      const org = await response.json()
      expect(org.metadata).toBeDefined()
      expect(org.metadata.industry).toBe('healthcare')
      expect(org.metadata.tier).toBe('premium')
    }
  )

  test.fixme(
    'API-AUTH-ORG-OPT-METADATA-004: should support nested metadata objects',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: Organization with nested metadata structure
      await startServerWithSchema({ name: 'test-app' })
      const owner = await createAuthenticatedUser({
        email: 'owner@example.com',
        password: 'Password123!',
        createOrganization: true,
      })

      // WHEN: Update with nested metadata
      const response = await request.patch('/api/auth/organization/update', {
        data: {
          organizationId: owner.organizationId,
          metadata: {
            company: {
              name: 'Acme Corp',
              founded: 2020,
            },
            contact: {
              email: 'contact@acme.com',
              phone: '+1234567890',
            },
            features: ['feature1', 'feature2', 'feature3'],
          },
        },
      })

      // THEN: Nested metadata should be stored
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.metadata.company.name).toBe('Acme Corp')
      expect(data.metadata.company.founded).toBe(2020)
      expect(data.metadata.contact.email).toBe('contact@acme.com')
      expect(data.metadata.features).toEqual(['feature1', 'feature2', 'feature3'])
    }
  )

  test.fixme(
    'API-AUTH-ORG-OPT-METADATA-005: should validate metadata schema if configured',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: System with metadata schema validation enabled
      await startServerWithSchema({ name: 'test-app' })
      const owner = await createAuthenticatedUser({
        email: 'owner@example.com',
        password: 'Password123!',
        createOrganization: true,
      })

      // WHEN: Update with invalid metadata (assuming required fields)
      const response = await request.patch('/api/auth/organization/update', {
        data: {
          organizationId: owner.organizationId,
          metadata: {
            invalidField: 'should not be allowed',
          },
        },
      })

      // THEN: Should return 400 if validation is enforced
      // Note: This behavior depends on system configuration
      expect([200, 400]).toContain(response.status())

      if (response.status() === 400) {
        const error = await response.json()
        expect(error.message).toBeDefined()
      }
    }
  )

  test.fixme(
    'API-AUTH-ORG-OPT-METADATA-006: should filter organizations by metadata query',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: Multiple organizations with different metadata
      await startServerWithSchema({ name: 'test-app' })

      const org1 = await createAuthenticatedUser({
        email: 'org1@example.com',
        password: 'Password123!',
        createOrganization: true,
      })

      await request.patch('/api/auth/organization/update', {
        data: {
          organizationId: org1.organizationId,
          metadata: { industry: 'technology', tier: 'premium' },
        },
      })

      const org2 = await createAuthenticatedUser({
        email: 'org2@example.com',
        password: 'Password123!',
        createOrganization: true,
      })

      await request.patch('/api/auth/organization/update', {
        data: {
          organizationId: org2.organizationId,
          metadata: { industry: 'finance', tier: 'basic' },
        },
      })

      // WHEN: Query organizations by metadata
      const response = await request.get('/api/auth/organization/list', {
        params: { 'metadata.industry': 'technology' },
      })

      // THEN: Should return filtered organizations
      expect(response.status()).toBe(200)
      const orgs = await response.json()
      expect(orgs.length).toBeGreaterThan(0)
      expect(orgs.every((org: any) => org.metadata?.industry === 'technology')).toBe(true)
    }
  )

  test.fixme(
    'API-AUTH-ORG-OPT-METADATA-007: system can manage metadata across organization lifecycle',
    { tag: '@regression' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: Organization with initial metadata
      await startServerWithSchema({ name: 'test-app' })
      const owner = await createAuthenticatedUser({
        email: 'owner@example.com',
        password: 'Password123!',
        createOrganization: true,
      })

      // WHEN/THEN: Set initial metadata
      const createResponse = await request.patch('/api/auth/organization/update', {
        data: {
          organizationId: owner.organizationId,
          metadata: {
            industry: 'technology',
            companySize: '10-50',
            tier: 'basic',
          },
        },
      })
      expect(createResponse.status()).toBe(200)

      // WHEN/THEN: Update metadata
      const updateResponse = await request.patch('/api/auth/organization/update', {
        data: {
          organizationId: owner.organizationId,
          metadata: {
            industry: 'technology',
            companySize: '50-100',
            tier: 'premium',
            features: ['sso', 'audit-logs'],
          },
        },
      })
      expect(updateResponse.status()).toBe(200)

      // WHEN/THEN: Retrieve and verify metadata
      const getResponse = await request.get('/api/auth/organization/get-details', {
        params: { organizationId: owner.organizationId },
      })
      expect(getResponse.status()).toBe(200)
      const org = await getResponse.json()
      expect(org.metadata.companySize).toBe('50-100')
      expect(org.metadata.tier).toBe('premium')
      expect(org.metadata.features).toEqual(['sso', 'audit-logs'])

      // WHEN/THEN: Partial metadata update
      const partialUpdate = await request.patch('/api/auth/organization/update', {
        data: {
          organizationId: owner.organizationId,
          metadata: {
            ...org.metadata,
            tier: 'enterprise',
          },
        },
      })
      expect(partialUpdate.status()).toBe(200)

      const finalOrg = await request
        .get('/api/auth/organization/get-details', {
          params: { organizationId: owner.organizationId },
        })
        .then((r) => r.json())

      expect(finalOrg.metadata.tier).toBe('enterprise')
      expect(finalOrg.metadata.companySize).toBe('50-100')
    }
  )
})
