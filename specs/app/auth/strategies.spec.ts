/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Auth Strategy Configuration
 *
 * Source: src/domain/models/app/auth/strategies.ts
 * Domain: app
 * Spec Count: 8
 *
 * User Story: US-AUTH-STRATEGIES-001 (Configure Authentication Strategies)
 * Schema: AuthStrategiesSchema - NonEmptyArray of discriminated union strategies
 *
 * Tests validate that:
 * - strategies accepts an array of typed strategy objects
 * - Supported types: emailAndPassword, magicLink, oauth
 * - Each type has its own configuration options
 * - At least one strategy is required
 * - Duplicate strategy types are rejected
 * - Unknown strategy types are rejected
 * - Strategy-specific options are validated per type
 * - emailAndPassword defaults: minPasswordLength=8, autoSignIn=true
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (8 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Auth Strategy Configuration', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test(
    'APP-AUTH-STRATEGIES-001: should accept array of strategy objects with type field',
    { tag: '@spec' },
    async ({ startServerWithSchema, page }) => {
      // GIVEN: Application configured with a single emailAndPassword strategy
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
        },
      })

      // WHEN: User navigates to the application
      await page.goto('/')

      // THEN: Application starts successfully (no schema validation error)
      await expect(page.locator('body')).toBeVisible()
    }
  )

  test(
    'APP-AUTH-STRATEGIES-002: should support emailAndPassword, magicLink, and oauth strategy types',
    { tag: '@spec' },
    async ({ startServerWithSchema, page }) => {
      // GIVEN: Application configured with all three supported strategy types
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [
            { type: 'emailAndPassword' },
            { type: 'magicLink' },
            { type: 'oauth', providers: ['google', 'github'] },
          ],
        },
      })

      // WHEN: User navigates to the application
      await page.goto('/')

      // THEN: Application starts successfully with all three strategies enabled
      await expect(page.locator('body')).toBeVisible()
    }
  )

  test(
    'APP-AUTH-STRATEGIES-003: should accept strategy-specific configuration options per type',
    { tag: '@spec' },
    async ({ startServerWithSchema, page }) => {
      // GIVEN: Application with strategies using type-specific options:
      //   - emailAndPassword with minPasswordLength=12, maxPasswordLength=64, requireEmailVerification=true
      //   - magicLink with expirationMinutes=30
      //   - oauth with providers=['google', 'github', 'microsoft']
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [
            {
              type: 'emailAndPassword',
              minPasswordLength: 12,
              maxPasswordLength: 64,
              requireEmailVerification: true,
            },
            {
              type: 'magicLink',
              expirationMinutes: 30,
            },
            {
              type: 'oauth',
              providers: ['google', 'github', 'microsoft'],
            },
          ],
        },
      })

      // WHEN: User navigates to the application
      await page.goto('/')

      // THEN: Application starts successfully with all strategy-specific options applied
      await expect(page.locator('body')).toBeVisible()
    }
  )

  test(
    'APP-AUTH-STRATEGIES-004: should reject configuration when no strategies are defined',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Application with auth configured but empty strategies array
      // WHEN: Server attempts to start with empty strategies
      // THEN: Schema validation rejects the configuration (NonEmptyArray requires at least one)
      await expect(async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            // @ts-expect-error - Intentionally testing empty strategies array (NonEmptyArray rejects)
            strategies: [],
          },
        })
      }).rejects.toThrow()
    }
  )

  test(
    'APP-AUTH-STRATEGIES-005: should reject configuration with duplicate strategy types',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Application with two emailAndPassword strategies (duplicate type)
      // WHEN: Server attempts to start with duplicate strategy types
      // THEN: Schema validation rejects with "Duplicate strategy types" error
      await expect(async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            strategies: [
              { type: 'emailAndPassword' },
              { type: 'emailAndPassword', minPasswordLength: 12 },
            ],
          },
        })
      }).rejects.toThrow()
    }
  )

  test(
    'APP-AUTH-STRATEGIES-006: should reject configuration with unknown strategy type',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Application with an unsupported strategy type 'sms'
      // WHEN: Server attempts to start with unknown strategy type
      // THEN: Schema validation rejects the unknown type (Union discriminator fails)
      await expect(async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            // @ts-expect-error - Intentionally testing invalid strategy type
            strategies: [{ type: 'sms' }],
          },
        })
      }).rejects.toThrow()
    }
  )

  test(
    'APP-AUTH-STRATEGIES-007: should validate strategy-specific required options',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: OAuth strategy without required 'providers' field
      // WHEN: Server attempts to start with invalid oauth configuration
      // THEN: Schema validation rejects because 'providers' is required for oauth type
      await expect(async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            // @ts-expect-error - Intentionally omitting required 'providers' field
            strategies: [{ type: 'oauth' }],
          },
        })
      }).rejects.toThrow()
    }
  )

  test(
    'APP-AUTH-STRATEGIES-008: should apply emailAndPassword defaults when options are omitted',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: Application with minimal emailAndPassword strategy (no explicit options)
      // Defaults should be: minPasswordLength=8, autoSignIn=true
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
        },
      })

      // WHEN: User signs up with a password meeting default minimum length (8 chars)
      await signUp({
        email: 'alice@example.com',
        password: 'Pass1234',
        name: 'Alice Johnson',
      })

      // THEN: Sign-up succeeds with 8-character password (default minPasswordLength=8)
      await page.goto('/')
      await expect(page.locator('body')).toBeVisible()

      // WHEN: User signs up with a password below default minimum length (7 chars)
      // THEN: Sign-up is rejected because password is too short
      await expect(async () => {
        await signUp({
          email: 'bob@example.com',
          password: 'Short1!',
          name: 'Bob Smith',
        })
      }).rejects.toThrow()
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying all strategy configuration behaviors together
  // Generated from 8 @spec tests - see individual @spec tests for exhaustive criteria
  // ============================================================================

  test(
    'APP-AUTH-STRATEGIES-REGRESSION: developer can configure authentication strategies correctly',
    { tag: '@regression' },
    async ({ startServerWithSchema, signUp, page }) => {
      await test.step('APP-AUTH-STRATEGIES-001: accepts array of strategy objects with type field', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            strategies: [{ type: 'emailAndPassword' }],
          },
        })
        await page.goto('/')
        await expect(page.locator('body')).toBeVisible()
      })

      await test.step('APP-AUTH-STRATEGIES-002: supports all three strategy types simultaneously', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            strategies: [
              { type: 'emailAndPassword' },
              { type: 'magicLink' },
              { type: 'oauth', providers: ['google', 'github'] },
            ],
          },
        })
        await page.goto('/')
        await expect(page.locator('body')).toBeVisible()
      })

      await test.step('APP-AUTH-STRATEGIES-003: accepts strategy-specific configuration options', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            strategies: [
              {
                type: 'emailAndPassword',
                minPasswordLength: 12,
                maxPasswordLength: 64,
                requireEmailVerification: true,
              },
              { type: 'magicLink', expirationMinutes: 30 },
              { type: 'oauth', providers: ['google', 'github', 'microsoft'] },
            ],
          },
        })
        await page.goto('/')
        await expect(page.locator('body')).toBeVisible()
      })

      await test.step('APP-AUTH-STRATEGIES-004: rejects empty strategies array', async () => {
        await expect(async () => {
          await startServerWithSchema({
            name: 'test-app',
            // @ts-expect-error - Intentionally testing empty strategies array (NonEmptyArray rejects)
            auth: { strategies: [] },
          })
        }).rejects.toThrow()
      })

      await test.step('APP-AUTH-STRATEGIES-005: rejects duplicate strategy types', async () => {
        await expect(async () => {
          await startServerWithSchema({
            name: 'test-app',
            auth: {
              strategies: [
                { type: 'emailAndPassword' },
                { type: 'emailAndPassword', minPasswordLength: 12 },
              ],
            },
          })
        }).rejects.toThrow()
      })

      await test.step('APP-AUTH-STRATEGIES-006: rejects unknown strategy type', async () => {
        await expect(async () => {
          await startServerWithSchema({
            name: 'test-app',
            auth: {
              // @ts-expect-error - Intentionally testing invalid strategy type
              strategies: [{ type: 'sms' }],
            },
          })
        }).rejects.toThrow()
      })

      await test.step('APP-AUTH-STRATEGIES-007: validates required options per strategy type', async () => {
        await expect(async () => {
          await startServerWithSchema({
            name: 'test-app',
            auth: {
              // @ts-expect-error - Intentionally omitting required 'providers' field
              strategies: [{ type: 'oauth' }],
            },
          })
        }).rejects.toThrow()
      })

      await test.step('APP-AUTH-STRATEGIES-008: applies emailAndPassword defaults', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            strategies: [{ type: 'emailAndPassword' }],
          },
        })
        // Default minPasswordLength=8: 8-char password should succeed
        await signUp({
          email: 'alice@example.com',
          password: 'Pass1234',
          name: 'Alice Johnson',
        })
        await page.goto('/')
        await expect(page.locator('body')).toBeVisible()
      })
    }
  )
})
