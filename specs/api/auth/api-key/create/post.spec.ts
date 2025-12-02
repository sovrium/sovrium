/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Create API Key
 *
 * Source: src/domain/models/app/auth/plugins/api-keys.ts
 * Domain: api
 * Spec Count: 7
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (6 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Create API Key', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-AUTH-API-KEYS-CREATE-001: should create API key with name',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Authenticated user with API keys plugin enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            apiKeys: true,
          },
        },
      })

      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      await signIn({
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      // WHEN: User creates an API key via Better Auth endpoint
      const response = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Production API Key',
        },
      })

      // THEN: Returns 200 OK with API key details including the actual key value
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('id')
      expect(data).toHaveProperty('key') // The actual API key value (shown only once)
      expect(data.name).toBe('Production API Key')
      expect(data).toHaveProperty('createdAt')
    }
  )

  test.fixme(
    'API-AUTH-API-KEYS-CREATE-002: should create API key with custom expiresIn',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Authenticated user with API keys plugin enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            apiKeys: true,
          },
        },
      })

      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      await signIn({
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      // WHEN: User creates an API key with custom expiration (7 days = 604800 seconds)
      const response = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Temporary Key',
          expiresIn: 604_800, // 7 days in seconds
        },
      })

      // THEN: Returns 200 OK with expiration date set approximately 7 days from now
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('expiresAt')
      const expiresAt = new Date(data.expiresAt)
      const now = new Date()
      const daysDiff = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      expect(daysDiff).toBeGreaterThanOrEqual(6) // Account for timing
      expect(daysDiff).toBeLessThanOrEqual(7)
    }
  )

  test.fixme(
    'API-AUTH-API-KEYS-CREATE-003: should return 401 when not authenticated',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application with API keys enabled but no authentication
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            apiKeys: true,
          },
        },
      })

      // WHEN: Unauthenticated user attempts to create API key
      const response = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Unauthorized Key',
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-API-KEYS-CREATE-004: should create API key without name (name is optional)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Authenticated user with API keys enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            apiKeys: true,
          },
        },
      })

      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      await signIn({
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      // WHEN: User creates API key without name (name is optional in Better Auth)
      const response = await page.request.post('/api/auth/api-key/create', {
        data: {},
      })

      // THEN: Returns 200 OK with API key created successfully (name can be optional)
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('id')
      expect(data).toHaveProperty('key')
    }
  )

  test.fixme(
    'API-AUTH-API-KEYS-CREATE-005: should create API key with metadata',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Authenticated user with API keys plugin enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            apiKeys: true,
          },
        },
      })

      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      await signIn({
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      // WHEN: User creates API key with custom metadata
      const response = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Production Key',
          metadata: {
            environment: 'production',
            service: 'webhook-handler',
          },
        },
      })

      // THEN: Returns 200 OK with metadata stored
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('metadata')
      expect(data.metadata).toEqual({
        environment: 'production',
        service: 'webhook-handler',
      })
    }
  )

  test.fixme(
    'API-AUTH-API-KEYS-CREATE-006: should return 404 when API keys plugin not enabled',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Authenticated user but API keys plugin disabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          // No apiKeys plugin
        },
      })

      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      await signIn({
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      // WHEN: User attempts to create API key when plugin is disabled
      const response = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Test Key',
        },
      })

      // THEN: Returns 404 Not Found (endpoint doesn't exist)
      expect(response.status()).toBe(404)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-API-KEYS-CREATE-007: user can complete full API key creation workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Application with API keys enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            apiKeys: true,
          },
        },
      })

      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      await signIn({
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      // WHEN: User creates API key with various options
      const createResponse = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Production API Key',
          expiresIn: 7_776_000, // 90 days in seconds
          metadata: {
            environment: 'production',
          },
        },
      })

      // THEN: API key is created successfully with all properties
      expect(createResponse.status()).toBe(200)
      const createData = await createResponse.json()
      expect(createData).toHaveProperty('id')
      expect(createData).toHaveProperty('key')
      expect(createData.name).toBe('Production API Key')
      expect(createData).toHaveProperty('expiresAt')
      expect(createData.metadata).toEqual({ environment: 'production' })

      // WHEN: Unauthenticated user attempts to create key
      const unauthResponse = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Unauthorized Key',
        },
      })

      // THEN: Request fails with 401
      expect(unauthResponse.status()).toBe(401)
    }
  )
})
