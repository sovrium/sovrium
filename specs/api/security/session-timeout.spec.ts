/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Session Timeout - Idle and Maximum Session Lifetime
 *
 * Domain: api/security
 * Spec Count: 4
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (4 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 *
 * Tests session timeout mechanisms that enforce:
 * - Idle timeout: Logout after 30 minutes of inactivity
 * - Maximum session lifetime: Logout after 12 hours regardless of activity
 * - Timeout renewal: Activity resets idle timeout
 * - Data preservation: Warning before idle timeout expires
 *
 * Session timeout is critical for security:
 * 1. Idle Timeout: Prevents unauthorized access to unattended sessions
 * 2. Maximum Lifetime: Limits exposure window for compromised sessions
 * 3. Activity Tracking: Ensures legitimate users stay logged in
 * 4. Data Loss Prevention: Warns users before timing out
 *
 * Better Auth provides session timeout configuration via session options.
 *
 * Error Response Structure:
 * - Session errors: `{ error: string }` - Generic API error format
 * - Better Auth errors: `{ message: string }` - Authentication-specific format
 * - See docs/architecture/testing-strategy/status-code-guidelines.md for details
 */

test.describe('Session Timeout - Idle and Maximum Session Lifetime', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test.fixme(
    'API-SECURITY-TIMEOUT-001: should logout after 30 minutes of inactivity',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Application with 30-minute idle timeout
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          session: {
            idleTimeout: 30 * 60, // 30 minutes in seconds
          },
        },
      })

      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'SecurePass123!',
      })

      await signIn({
        email: 'test@example.com',
        password: 'SecurePass123!',
      })

      // Verify user is authenticated
      await page.goto('/')
      await expect(page.getByText('Test User')).toBeVisible()

      // WHEN: 30 minutes pass without activity
      // Simulate time passage (use page.clock or wait)
      await page.clock.fastForward(31 * 60 * 1000) // 31 minutes

      // Attempt to access protected resource
      await page.goto('/dashboard')

      // THEN: User should be logged out due to idle timeout
      // Should redirect to login page
      await expect(page).toHaveURL(/\/login/)
      await expect(page.getByText('Session expired')).toBeVisible()
    }
  )

  test.fixme(
    'API-SECURITY-TIMEOUT-002: should logout after 12 hours maximum session length',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Application with 12-hour maximum session lifetime
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          session: {
            maxAge: 12 * 60 * 60, // 12 hours in seconds
          },
        },
      })

      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'SecurePass123!',
      })

      await signIn({
        email: 'test@example.com',
        password: 'SecurePass123!',
      })

      // Verify user is authenticated
      await page.goto('/')
      await expect(page.getByText('Test User')).toBeVisible()

      // WHEN: 12 hours pass with periodic activity (to avoid idle timeout)
      // Simulate activity every 20 minutes for 12 hours
      for (let hour = 0; hour < 12; hour++) {
        await page.clock.fastForward(20 * 60 * 1000) // 20 minutes
        await page.goto('/dashboard') // Activity to reset idle timeout
        await page.clock.fastForward(20 * 60 * 1000) // 20 minutes
        await page.goto('/') // Activity
        await page.clock.fastForward(20 * 60 * 1000) // 20 minutes
        await page.goto('/profile') // Activity
      }

      // Now exceed 12 hours
      await page.clock.fastForward(5 * 60 * 1000) // 5 more minutes

      // Attempt to access protected resource
      await page.goto('/dashboard')

      // THEN: User should be logged out due to maximum session lifetime
      await expect(page).toHaveURL(/\/login/)
      await expect(page.getByText(/Session expired|Maximum session time/i)).toBeVisible()
    }
  )

  test.fixme(
    'API-SECURITY-TIMEOUT-003: should renew timeout on user activity',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Application with 30-minute idle timeout
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          session: {
            idleTimeout: 30 * 60, // 30 minutes
          },
        },
      })

      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'SecurePass123!',
      })

      await signIn({
        email: 'test@example.com',
        password: 'SecurePass123!',
      })

      // WHEN: User performs activity every 20 minutes
      for (let i = 0; i < 5; i++) {
        // 100 minutes total
        // Wait 20 minutes
        await page.clock.fastForward(20 * 60 * 1000)

        // Perform activity (navigate)
        await page.goto('/dashboard')

        // Verify still authenticated
        await expect(page.getByText('Test User')).toBeVisible()
      }

      // THEN: User should remain logged in (timeout renewed by activity)
      // Total elapsed: 100 minutes, but no 30-minute idle period occurred
      await page.goto('/profile')
      await expect(page).toHaveURL(/\/profile/)
      await expect(page.getByText('Test User')).toBeVisible()
    }
  )

  test.fixme(
    'API-SECURITY-TIMEOUT-004: should preserve data on idle timeout warning',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Application with idle timeout and warning
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          session: {
            idleTimeout: 30 * 60, // 30 minutes
            warningBeforeTimeout: 5 * 60, // 5 minutes warning
          },
        },
      })

      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'SecurePass123!',
      })

      await signIn({
        email: 'test@example.com',
        password: 'SecurePass123!',
      })

      // User fills out form
      await page.goto('/create-post')
      await page.getByLabel('Title').fill('Important Draft Post')
      await page.getByLabel('Content').fill('This content should not be lost')

      // WHEN: 25 minutes pass (warning should appear)
      await page.clock.fastForward(25 * 60 * 1000)

      // THEN: Warning dialog should appear
      await expect(page.getByText(/Your session will expire in 5 minutes/i)).toBeVisible()

      // THEN: Form data should still be present
      await expect(page.getByLabel('Title')).toHaveValue('Important Draft Post')
      await expect(page.getByLabel('Content')).toHaveValue('This content should not be lost')

      // WHEN: User clicks "Stay logged in"
      await page.getByRole('button', { name: /Stay logged in|Continue session/i }).click()

      // THEN: Warning should disappear and session renewed
      await expect(page.getByText(/Your session will expire/i)).toBeHidden()

      // THEN: Form data should remain
      await expect(page.getByLabel('Title')).toHaveValue('Important Draft Post')
      await expect(page.getByLabel('Content')).toHaveValue('This content should not be lost')

      // THEN: User should remain logged in
      await page.clock.fastForward(10 * 60 * 1000) // 10 more minutes
      await expect(page.getByText('Test User')).toBeVisible()
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test.fixme(
    'API-SECURITY-TIMEOUT-005: session timeout workflow protects against unattended access',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      await test.step('Setup: Start server with session timeout', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            session: {
              idleTimeout: 30 * 60, // 30 minutes
              maxAge: 12 * 60 * 60, // 12 hours
              warningBeforeTimeout: 5 * 60, // 5 minutes warning
            },
          },
        })

        await signUp({
          name: 'Regression User',
          email: 'regression@example.com',
          password: 'TestPass123!',
        })

        await signIn({
          email: 'regression@example.com',
          password: 'TestPass123!',
        })
      })

      await test.step('Verify: Activity renews idle timeout', async () => {
        // Perform activity every 20 minutes
        for (let i = 0; i < 3; i++) {
          await page.clock.fastForward(20 * 60 * 1000)
          await page.goto('/dashboard')
          await expect(page.getByText('Regression User')).toBeVisible()
        }
      })

      await test.step('Verify: Idle timeout logs out after inactivity', async () => {
        // Wait 31 minutes without activity
        await page.clock.fastForward(31 * 60 * 1000)

        await page.goto('/dashboard')

        // Should be logged out
        await expect(page).toHaveURL(/\/login/)
        await expect(page.getByText(/Session expired/i)).toBeVisible()
      })

      await test.step('Verify: Maximum session lifetime enforced', async () => {
        // Sign in again
        await signIn({
          email: 'regression@example.com',
          password: 'TestPass123!',
        })

        // Simulate 12 hours with periodic activity
        for (let hour = 0; hour < 13; hour++) {
          await page.clock.fastForward(60 * 60 * 1000) // 1 hour
          if (hour < 12) {
            await page.goto('/dashboard') // Activity
          }
        }

        // Attempt access after 13 hours
        await page.goto('/profile')

        // Should be logged out
        await expect(page).toHaveURL(/\/login/)
      })

      await test.step('Verify: Timeout warning preserves data', async () => {
        // Sign in again
        await signIn({
          email: 'regression@example.com',
          password: 'TestPass123!',
        })

        // Fill form
        await page.goto('/create-post')
        await page.getByLabel('Title').fill('Test Post')

        // Wait for warning (25 minutes)
        await page.clock.fastForward(25 * 60 * 1000)

        // Warning appears
        await expect(page.getByText(/session will expire/i)).toBeVisible()

        // Data preserved
        await expect(page.getByLabel('Title')).toHaveValue('Test Post')

        // Renew session
        await page.getByRole('button', { name: /Stay logged in/i }).click()

        // Data still preserved
        await expect(page.getByLabel('Title')).toHaveValue('Test Post')
      })
    }
  )
})
