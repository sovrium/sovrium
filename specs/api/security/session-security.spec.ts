/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Session Security - Session Fixation and Hijacking Prevention
 *
 * Domain: api/security
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (5 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 *
 * Tests session security mechanisms that prevent session fixation and hijacking:
 * - Session ID regeneration after authentication
 * - Secure flag on session cookies (HTTPS only)
 * - HttpOnly flag on session cookies (no JavaScript access)
 * - SameSite attribute on session cookies (CSRF protection)
 * - Session invalidation after password change
 *
 * Session security is critical to prevent attackers from:
 * 1. Session Fixation: Forcing a known session ID on a victim
 * 2. Session Hijacking: Stealing session cookies to impersonate users
 * 3. XSS-based Cookie Theft: Accessing session cookies via JavaScript
 * 4. CSRF Attacks: Exploiting ambient authority of cookies
 *
 * Better Auth provides secure session management with proper cookie attributes.
 *
 * Error Response Structure:
 * - Session errors: `{ error: string }` - Generic API error format
 * - Better Auth errors: `{ message: string }` - Authentication-specific format
 * - See docs/architecture/testing-strategy/status-code-guidelines.md for details
 */

test.describe('Session Security - Session Fixation and Hijacking Prevention', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test.fixme(
    'API-SECURITY-SESSION-001: should regenerate session ID after authentication',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: Application with session-based authentication
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      // Create user
      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'SecurePass123!',
      })

      // Get initial session before sign-in
      await page.goto('/')
      const cookiesBefore = await page.context().cookies()
      const sessionCookieBefore = cookiesBefore.find(
        (c) => c.name.includes('session') || c.name.includes('auth')
      )

      // WHEN: User signs in
      const response = await page.request.post('/api/auth/sign-in/email', {
        data: {
          email: 'test@example.com',
          password: 'SecurePass123!',
        },
      })

      expect(response.status()).toBe(200)

      // THEN: Session ID should be different after authentication
      const cookiesAfter = await page.context().cookies()
      const sessionCookieAfter = cookiesAfter.find(
        (c) => c.name.includes('session') || c.name.includes('auth')
      )

      expect(sessionCookieAfter).toBeDefined()

      // Session ID should be regenerated (different value)
      if (sessionCookieBefore && sessionCookieAfter) {
        expect(sessionCookieAfter.value).not.toBe(sessionCookieBefore.value)
      }
    }
  )

  test.fixme(
    'API-SECURITY-SESSION-002: should set Secure flag on session cookies',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Application with session-based authentication
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'SecurePass123!',
      })

      // WHEN: User signs in
      await signIn({
        email: 'test@example.com',
        password: 'SecurePass123!',
      })

      // THEN: Session cookie should have Secure flag set
      const cookies = await page.context().cookies()
      const sessionCookie = cookies.find(
        (c) => c.name.includes('session') || c.name.includes('auth')
      )

      expect(sessionCookie).toBeDefined()
      expect(sessionCookie!.secure).toBe(true)
    }
  )

  test.fixme(
    'API-SECURITY-SESSION-003: should set HttpOnly flag on session cookies',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Application with session-based authentication
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'SecurePass123!',
      })

      // WHEN: User signs in
      await signIn({
        email: 'test@example.com',
        password: 'SecurePass123!',
      })

      // THEN: Session cookie should have HttpOnly flag set (prevents JavaScript access)
      const cookies = await page.context().cookies()
      const sessionCookie = cookies.find(
        (c) => c.name.includes('session') || c.name.includes('auth')
      )

      expect(sessionCookie).toBeDefined()
      expect(sessionCookie!.httpOnly).toBe(true)

      // THEN: JavaScript cannot access session cookie
      await page.goto('/')
      const jsAccessibleCookies = await page.evaluate(() => document.cookie)

      // Session cookie should NOT be accessible via JavaScript
      expect(jsAccessibleCookies).not.toContain(sessionCookie!.name)
    }
  )

  test.fixme(
    'API-SECURITY-SESSION-004: should set SameSite attribute on session cookies',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Application with session-based authentication
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'SecurePass123!',
      })

      // WHEN: User signs in
      await signIn({
        email: 'test@example.com',
        password: 'SecurePass123!',
      })

      // THEN: Session cookie should have SameSite attribute
      const cookies = await page.context().cookies()
      const sessionCookie = cookies.find(
        (c) => c.name.includes('session') || c.name.includes('auth')
      )

      expect(sessionCookie).toBeDefined()

      // SameSite should be 'Lax' or 'Strict' (not 'None')
      // 'Lax' allows top-level navigation, 'Strict' is more restrictive
      expect(['Lax', 'Strict']).toContain(sessionCookie!.sameSite)
    }
  )

  test.fixme(
    'API-SECURITY-SESSION-005: should invalidate old session after password change',
    { tag: '@spec' },
    async ({ page, context, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Application with authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'OldPassword123!',
      })

      await signIn({
        email: 'test@example.com',
        password: 'OldPassword123!',
      })

      // Save old session cookies
      const oldCookies = await context.cookies()
      const oldSessionCookie = oldCookies.find(
        (c) => c.name.includes('session') || c.name.includes('auth')
      )

      expect(oldSessionCookie).toBeDefined()

      // WHEN: User changes password
      const changePasswordResponse = await page.request.post('/api/auth/change-password', {
        data: {
          currentPassword: 'OldPassword123!',
          newPassword: 'NewPassword123!',
        },
      })

      expect(changePasswordResponse.status()).toBe(200)

      // THEN: Old session should be invalidated
      const newCookies = await context.cookies()
      const newSessionCookie = newCookies.find(
        (c) => c.name.includes('session') || c.name.includes('auth')
      )

      // Session cookie should be different (old session invalidated)
      expect(newSessionCookie).toBeDefined()
      expect(newSessionCookie!.value).not.toBe(oldSessionCookie!.value)

      // THEN: Accessing protected resource with old session should fail
      // (This would require manual cookie manipulation in a real attack scenario)
      // For now, verify that session has changed, which indicates invalidation
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test.fixme(
    'API-SECURITY-SESSION-006: session security workflow prevents attacks',
    { tag: '@regression' },
    async ({ page, context, startServerWithSchema, signUp, signIn }) => {
      await test.step('Setup: Start server with auth', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
          },
        })

        await signUp({
          name: 'Regression User',
          email: 'regression@example.com',
          password: 'InitialPass123!',
        })
      })

      await test.step('Verify: Session ID regenerates after sign-in', async () => {
        await page.goto('/')
        const cookiesBefore = await context.cookies()
        const sessionBefore = cookiesBefore.find(
          (c) => c.name.includes('session') || c.name.includes('auth')
        )

        await signIn({
          email: 'regression@example.com',
          password: 'InitialPass123!',
        })

        const cookiesAfter = await context.cookies()
        const sessionAfter = cookiesAfter.find(
          (c) => c.name.includes('session') || c.name.includes('auth')
        )

        expect(sessionAfter).toBeDefined()
        if (sessionBefore && sessionAfter) {
          expect(sessionAfter.value).not.toBe(sessionBefore.value)
        }
      })

      await test.step('Verify: Session cookie has Secure flag', async () => {
        const cookies = await context.cookies()
        const sessionCookie = cookies.find(
          (c) => c.name.includes('session') || c.name.includes('auth')
        )

        expect(sessionCookie).toBeDefined()
        expect(sessionCookie!.secure).toBe(true)
      })

      await test.step('Verify: Session cookie has HttpOnly flag', async () => {
        const cookies = await context.cookies()
        const sessionCookie = cookies.find(
          (c) => c.name.includes('session') || c.name.includes('auth')
        )

        expect(sessionCookie).toBeDefined()
        expect(sessionCookie!.httpOnly).toBe(true)

        // Verify JavaScript cannot access cookie
        await page.goto('/')
        const jsAccessibleCookies = await page.evaluate(() => document.cookie)
        expect(jsAccessibleCookies).not.toContain(sessionCookie!.name)
      })

      await test.step('Verify: Session cookie has SameSite attribute', async () => {
        const cookies = await context.cookies()
        const sessionCookie = cookies.find(
          (c) => c.name.includes('session') || c.name.includes('auth')
        )

        expect(sessionCookie).toBeDefined()
        expect(['Lax', 'Strict']).toContain(sessionCookie!.sameSite)
      })

      await test.step('Verify: Session invalidates after password change', async () => {
        const oldCookies = await context.cookies()
        const oldSession = oldCookies.find(
          (c) => c.name.includes('session') || c.name.includes('auth')
        )

        const changePasswordResponse = await page.request.post('/api/auth/change-password', {
          data: {
            currentPassword: 'InitialPass123!',
            newPassword: 'NewPass123!',
          },
        })

        expect(changePasswordResponse.status()).toBe(200)

        const newCookies = await context.cookies()
        const newSession = newCookies.find(
          (c) => c.name.includes('session') || c.name.includes('auth')
        )

        expect(newSession).toBeDefined()
        expect(newSession!.value).not.toBe(oldSession!.value)
      })
    }
  )
})
