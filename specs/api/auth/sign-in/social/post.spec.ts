/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Sign in with OAuth (Social Login)
 *
 * Source: src/domain/models/app/auth/oauth/providers.ts
 * Domain: api
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (4 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Supported Providers: google, github, microsoft, slack, gitlab
 */

test.describe('Sign in with OAuth (Social Login)', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-AUTH-SIGN-IN-SOCIAL-001: should return redirect URL for Google OAuth',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application with Google OAuth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
          oauth: {
            providers: ['google'],
          },
        },
      })

      // WHEN: User initiates Google OAuth sign-in
      const response = await page.request.post('/api/auth/sign-in/social', {
        data: {
          provider: 'google',
          callbackUrl: '/dashboard',
        },
      })

      // THEN: Returns 200 OK with redirect URL to Google OAuth consent page
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('url')
      expect(data.url).toContain('accounts.google.com')
    }
  )

  test.fixme(
    'API-AUTH-SIGN-IN-SOCIAL-002: should return redirect URL for GitHub OAuth',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application with GitHub OAuth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
          oauth: {
            providers: ['github'],
          },
        },
      })

      // WHEN: User initiates GitHub OAuth sign-in
      const response = await page.request.post('/api/auth/sign-in/social', {
        data: {
          provider: 'github',
          callbackUrl: '/dashboard',
        },
      })

      // THEN: Returns 200 OK with redirect URL to GitHub OAuth authorization page
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('url')
      expect(data.url).toContain('github.com')
    }
  )

  test.fixme(
    'API-AUTH-SIGN-IN-SOCIAL-003: should return 400 for unsupported provider',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application with Google OAuth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
          oauth: {
            providers: ['google'],
          },
        },
      })

      // WHEN: User attempts OAuth sign-in with unsupported provider
      const response = await page.request.post('/api/auth/sign-in/social', {
        data: {
          provider: 'facebook', // Not in supported list
          callbackUrl: '/dashboard',
        },
      })

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-SIGN-IN-SOCIAL-004: should return 400 when OAuth not configured',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application with OAuth disabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
          // No oauth configuration
        },
      })

      // WHEN: User attempts OAuth sign-in
      const response = await page.request.post('/api/auth/sign-in/social', {
        data: {
          provider: 'google',
          callbackUrl: '/dashboard',
        },
      })

      // THEN: Returns 400 Bad Request indicating OAuth is not enabled
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-SIGN-IN-SOCIAL-005: user can complete full OAuth sign-in workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application with multiple OAuth providers enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
          oauth: {
            providers: ['google', 'github', 'microsoft'],
          },
        },
      })

      // WHEN: User initiates Google OAuth sign-in
      const googleResponse = await page.request.post('/api/auth/sign-in/social', {
        data: {
          provider: 'google',
          callbackUrl: '/dashboard',
        },
      })

      // THEN: Google OAuth redirect succeeds
      expect(googleResponse.status()).toBe(200)
      const googleData = await googleResponse.json()
      expect(googleData).toHaveProperty('url')
      expect(googleData.url).toContain('accounts.google.com')

      // WHEN: User initiates GitHub OAuth sign-in
      const githubResponse = await page.request.post('/api/auth/sign-in/social', {
        data: {
          provider: 'github',
          callbackUrl: '/dashboard',
        },
      })

      // THEN: GitHub OAuth redirect succeeds
      expect(githubResponse.status()).toBe(200)
      const githubData = await githubResponse.json()
      expect(githubData).toHaveProperty('url')
      expect(githubData.url).toContain('github.com')

      // WHEN: User attempts sign-in with non-enabled provider
      const failedResponse = await page.request.post('/api/auth/sign-in/social', {
        data: {
          provider: 'slack', // Not enabled in config
          callbackUrl: '/dashboard',
        },
      })

      // THEN: Request fails
      expect(failedResponse.status()).toBe(400)
    }
  )
})
