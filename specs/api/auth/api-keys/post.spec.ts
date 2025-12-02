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
    'API-AUTH-API-KEYS-CREATE-001: should create API key with name and description',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Authenticated user with API keys plugin enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['email-and-password'],
          plugins: {
            apiKeys: true,
          },
        },
      })

      const user = await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      const session = await signIn({
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      // WHEN: User creates an API key
      const response = await page.request.post('/api/auth/api-keys', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
        data: {
          name: 'Production API Key',
          description: 'API key for production integration',
        },
      })

      // THEN: Returns 201 Created with API key details
      expect(response.status()).toBe(201)

      const data = await response.json()
      expect(data).toHaveProperty('id')
      expect(data).toHaveProperty('key') // The actual API key value (shown once)
      expect(data.name).toBe('Production API Key')
      expect(data.description).toBe('API key for production integration')
      expect(data).toHaveProperty('createdAt')
    }
  )

  test.fixme(
    'API-AUTH-API-KEYS-CREATE-002: should create API key with expiration date',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Authenticated user with API keys configured with expiration
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['email-and-password'],
          plugins: {
            apiKeys: {
              expirationDays: 90,
            },
          },
        },
      })

      const user = await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      const session = await signIn({
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      // WHEN: User creates an API key
      const response = await page.request.post('/api/auth/api-keys', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
        data: {
          name: 'Temporary Key',
        },
      })

      // THEN: Returns 201 Created with expiration date set
      expect(response.status()).toBe(201)

      const data = await response.json()
      expect(data).toHaveProperty('expiresAt')
      const expiresAt = new Date(data.expiresAt)
      const now = new Date()
      const daysDiff = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      expect(daysDiff).toBeGreaterThanOrEqual(89) // Account for timing
      expect(daysDiff).toBeLessThanOrEqual(90)
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
          methods: ['email-and-password'],
          plugins: {
            apiKeys: true,
          },
        },
      })

      // WHEN: Unauthenticated user attempts to create API key
      const response = await page.request.post('/api/auth/api-keys', {
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
    'API-AUTH-API-KEYS-CREATE-004: should return 400 when name is missing',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Authenticated user with API keys enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['email-and-password'],
          plugins: {
            apiKeys: true,
          },
        },
      })

      const user = await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      const session = await signIn({
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      // WHEN: User attempts to create API key without name
      const response = await page.request.post('/api/auth/api-keys', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
        data: {
          description: 'Missing name',
        },
      })

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-API-KEYS-CREATE-005: should enforce maximum keys per user limit',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Authenticated user with max 2 API keys allowed
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['email-and-password'],
          plugins: {
            apiKeys: {
              maxKeysPerUser: 2,
            },
          },
        },
      })

      const user = await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      const session = await signIn({
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      // Create first API key
      await page.request.post('/api/auth/api-keys', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
        data: {
          name: 'Key 1',
        },
      })

      // Create second API key
      await page.request.post('/api/auth/api-keys', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
        data: {
          name: 'Key 2',
        },
      })

      // WHEN: User attempts to create third API key (exceeding limit)
      const response = await page.request.post('/api/auth/api-keys', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
        data: {
          name: 'Key 3',
        },
      })

      // THEN: Returns 400 Bad Request indicating limit exceeded
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
      expect(data.message).toContain('limit')
    }
  )

  test.fixme(
    'API-AUTH-API-KEYS-CREATE-006: should return 400 when API keys plugin not enabled',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Authenticated user but API keys plugin disabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['email-and-password'],
          // No apiKeys plugin
        },
      })

      const user = await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      const session = await signIn({
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      // WHEN: User attempts to create API key
      const response = await page.request.post('/api/auth/api-keys', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
        data: {
          name: 'Test Key',
        },
      })

      // THEN: Returns 400 Bad Request or 404 Not Found
      expect([400, 404]).toContain(response.status())
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
          methods: ['email-and-password'],
          plugins: {
            apiKeys: {
              expirationDays: 90,
              maxKeysPerUser: 3,
            },
          },
        },
      })

      const user = await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      const session = await signIn({
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      // WHEN: User creates API key
      const createResponse = await page.request.post('/api/auth/api-keys', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
        data: {
          name: 'Production API Key',
          description: 'Key for production integration',
        },
      })

      // THEN: API key is created successfully
      expect(createResponse.status()).toBe(201)
      const createData = await createResponse.json()
      expect(createData).toHaveProperty('id')
      expect(createData).toHaveProperty('key')
      expect(createData.name).toBe('Production API Key')
      expect(createData).toHaveProperty('expiresAt')

      // WHEN: User attempts to create key without authentication
      const unauthResponse = await page.request.post('/api/auth/api-keys', {
        data: {
          name: 'Unauthorized Key',
        },
      })

      // THEN: Request fails
      expect(unauthResponse.status()).toBe(401)
    }
  )
})
