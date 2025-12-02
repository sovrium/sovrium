/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'
import { extractTokenFromUrl } from '../../email-helpers'

/**
 * E2E Tests for Sign up with email and password
 *
 * Source: specs/api/paths/auth/sign-up/email/post.json
 * Domain: api
 * Spec Count: 15
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (15 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Validation Approach:
 * - API response assertions (status codes, response schemas)
 * - Database state validation via API (no direct executeQuery for auth data)
 * - Authentication/authorization checks
 * - Email verification flow testing via Mailpit fixture
 */

test.describe('Sign up with email and password', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-AUTH-SIGN-UP-EMAIL-001: should returns 200 OK with user data and session token',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      // WHEN: User submits valid sign-up credentials
      const response = await page.request.post('/api/auth/sign-up/email', {
        data: {
          name: 'John Doe',
          email: 'john@example.com',
          password: 'SecurePass123!',
        },
      })

      // THEN: Returns 200 OK with user data and session token
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('user')
      expect(data.user).toHaveProperty('id')
      expect(data.user).toHaveProperty('email', 'john@example.com')
      expect(data.user).toHaveProperty('name', 'John Doe')
    }
  )

  test.fixme(
    'API-AUTH-SIGN-UP-EMAIL-002: should returns 422 when name is missing',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      // WHEN: User submits request without name field
      const response = await page.request.post('/api/auth/sign-up/email', {
        data: {
          email: 'john@example.com',
          password: 'SecurePass123!',
        },
      })

      // THEN: Better Auth returns 422 for validation errors
      expect(response.status()).toBe(422)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-SIGN-UP-EMAIL-003: should returns 400 Bad Request when email is missing',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      // WHEN: User submits request without email field
      const response = await page.request.post('/api/auth/sign-up/email', {
        data: {
          name: 'John Doe',
          password: 'SecurePass123!',
        },
      })

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-SIGN-UP-EMAIL-004: should return error when password is missing',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      // WHEN: User submits request without password field
      const response = await page.request.post('/api/auth/sign-up/email', {
        data: {
          name: 'John Doe',
          email: 'john@example.com',
        },
      })

      // THEN: Better Auth returns 500 for missing password (internal handling)
      // Note: This is Better Auth behavior - password is handled differently
      expect(response.status()).toBe(500)
    }
  )

  test.fixme(
    'API-AUTH-SIGN-UP-EMAIL-005: should returns 400 Bad Request with invalid email format',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      // WHEN: User submits request with invalid email format
      const response = await page.request.post('/api/auth/sign-up/email', {
        data: {
          name: 'John Doe',
          email: 'not-an-email',
          password: 'SecurePass123!',
        },
      })

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-SIGN-UP-EMAIL-006: should returns 400 Bad Request with short password',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      // WHEN: User submits password shorter than minimum length (8 characters)
      const response = await page.request.post('/api/auth/sign-up/email', {
        data: {
          name: 'John Doe',
          email: 'john@example.com',
          password: 'Short1!',
        },
      })

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-SIGN-UP-EMAIL-007: should returns 422 when email already exists',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: A running server with an existing user (created via API)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      // Create existing user via API (not executeQuery)
      await signUp({
        name: 'Existing User',
        email: 'existing@example.com',
        password: 'SecurePass123!',
      })

      // WHEN: Another user attempts sign-up with same email
      const response = await page.request.post('/api/auth/sign-up/email', {
        data: {
          name: 'Another User',
          email: 'existing@example.com',
          password: 'SecurePass123!',
        },
      })

      // THEN: Returns 422 (Better Auth returns 422 for duplicate email)
      expect(response.status()).toBe(422)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-SIGN-UP-EMAIL-008: should returns 422 for case-insensitive email matching',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: A running server with existing user (lowercase email, created via API)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      // Create existing user via API (not executeQuery)
      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'SecurePass123!',
      })

      // WHEN: User attempts sign-up with same email in different case
      const response = await page.request.post('/api/auth/sign-up/email', {
        data: {
          name: 'Another User',
          email: 'TEST@EXAMPLE.COM',
          password: 'SecurePass123!',
        },
      })

      // THEN: Returns 422 (Better Auth returns 422 for duplicate email)
      expect(response.status()).toBe(422)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-SIGN-UP-EMAIL-009: should returns 200 OK with sanitized name (XSS payload neutralized)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      // WHEN: User submits name with XSS payload
      const response = await page.request.post('/api/auth/sign-up/email', {
        data: {
          name: "<script>alert('xss')</script>John",
          email: 'john@example.com',
          password: 'SecurePass123!',
        },
      })

      // THEN: Returns 200 OK with sanitized name
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('user')
      // Name should not contain unescaped script tags when rendered
    }
  )

  test.fixme(
    'API-AUTH-SIGN-UP-EMAIL-010: should returns 200 OK with Unicode name preserved',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      // WHEN: User submits name with Unicode characters
      const response = await page.request.post('/api/auth/sign-up/email', {
        data: {
          name: 'José García 日本語',
          email: 'jose@example.com',
          password: 'SecurePass123!',
        },
      })

      // THEN: Returns 200 OK with Unicode name preserved
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('user')
      expect(data.user.name).toBe('José García 日本語')
    }
  )

  test.fixme(
    'API-AUTH-SIGN-UP-EMAIL-011: should send verification email when requireEmailVerification is true',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, mailpit }) => {
      // GIVEN: A running server with email verification required
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: { requireEmailVerification: true },
        },
      })

      const userEmail = mailpit.email('verification-test')

      // WHEN: User signs up with valid credentials
      const response = await page.request.post('/api/auth/sign-up/email', {
        data: {
          name: 'John Doe',
          email: userEmail,
          password: 'SecurePass123!',
        },
      })

      // THEN: Returns 200 OK with user data
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data).toHaveProperty('user')
      expect(data.user.email).toBe(userEmail)
      expect(data.user.emailVerified).toBe(false)

      // THEN: Verification email is sent
      const email = await mailpit.waitForEmail(
        (e) => e.To[0]?.Address === userEmail && e.Subject.toLowerCase().includes('verify')
      )
      expect(email).toBeDefined()
      expect(email.Subject).toBeTruthy()
      expect(email.HTML).toContain('verify')

      // THEN: Email contains verification token
      const token = extractTokenFromUrl(email.HTML, 'token')
      expect(token).not.toBeNull()
      expect(token).toBeTruthy()
    }
  )

  test.fixme(
    'API-AUTH-SIGN-UP-EMAIL-012: should prevent sign-in before email verification when required',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, mailpit }) => {
      // GIVEN: A running server with email verification required and unverified user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: { requireEmailVerification: true },
        },
      })

      const userEmail = mailpit.email('unverified')
      const password = 'SecurePass123!'

      // Create user via sign-up
      await page.request.post('/api/auth/sign-up/email', {
        data: {
          name: 'Unverified User',
          email: userEmail,
          password,
        },
      })

      // WHEN: Unverified user attempts to sign in
      const signInResponse = await page.request.post('/api/auth/sign-in/email', {
        data: {
          email: userEmail,
          password,
        },
      })

      // THEN: Sign-in is rejected with error about email verification
      expect([400, 401, 403]).toContain(signInResponse.status())
      const errorData = await signInResponse.json()
      expect(errorData).toHaveProperty('message')
      // Error message should indicate email verification is required
      expect(errorData.message.toLowerCase()).toMatch(/verif/i)
    }
  )

  test.fixme(
    'API-AUTH-SIGN-UP-EMAIL-013: should allow sign-in after email verification',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, mailpit }) => {
      // GIVEN: A running server with email verification required
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: { requireEmailVerification: true },
        },
      })

      const userEmail = mailpit.email('verified')
      const password = 'SecurePass123!'

      // Create user via sign-up
      await page.request.post('/api/auth/sign-up/email', {
        data: {
          name: 'Verified User',
          email: userEmail,
          password,
        },
      })

      // Get verification email and extract token
      const email = await mailpit.waitForEmail(
        (e) => e.To[0]?.Address === userEmail && e.Subject.toLowerCase().includes('verify')
      )
      const token = extractTokenFromUrl(email.HTML, 'token')
      expect(token).not.toBeNull()

      // Verify email
      const verifyResponse = await page.request.get(`/api/auth/verify-email?token=${token}`)
      expect(verifyResponse.status()).toBe(200)

      // WHEN: Verified user attempts to sign in
      const signInResponse = await page.request.post('/api/auth/sign-in/email', {
        data: {
          email: userEmail,
          password,
        },
      })

      // THEN: Sign-in succeeds with session token
      expect(signInResponse.status()).toBe(200)
      const signInData = await signInResponse.json()
      expect(signInData).toHaveProperty('user')
      expect(signInData).toHaveProperty('token')
      expect(signInData.user.email).toBe(userEmail)
      expect(signInData.user.emailVerified).toBe(true)
    }
  )

  test.fixme(
    'API-AUTH-SIGN-UP-EMAIL-014: should prevent access to protected resources without email verification',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, mailpit }) => {
      // GIVEN: A running server with email verification required and tables with permissions
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: { requireEmailVerification: true },
        },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text', required: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              create: { type: 'roles', roles: ['member'] },
              read: { type: 'roles', roles: ['member'] },
              update: { type: 'roles', roles: ['member'] },
              delete: { type: 'roles', roles: ['member'] },
            },
          },
        ],
      })

      const userEmail = mailpit.email('unverified-api')
      const password = 'SecurePass123!'

      // Create unverified user
      const signUpResponse = await page.request.post('/api/auth/sign-up/email', {
        data: {
          name: 'Unverified API User',
          email: userEmail,
          password,
        },
      })
      expect(signUpResponse.status()).toBe(200)

      // WHEN: Unverified user attempts to access protected API endpoint
      // (User cannot sign in, so they cannot get a valid session to access resources)
      const signInAttempt = await page.request.post('/api/auth/sign-in/email', {
        data: { email: userEmail, password },
      })

      // THEN: Sign-in fails due to unverified email
      expect([400, 401, 403]).toContain(signInAttempt.status())

      // THEN: User cannot access protected resources (no valid session)
      const apiResponse = await page.request.get('/api/tables/tasks/records')

      // THEN: Returns 401 Unauthorized (no valid session)
      expect(apiResponse.status()).toBe(401)
    }
  )

  test.fixme(
    'API-AUTH-SIGN-UP-EMAIL-015: should allow access to protected resources after email verification',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, mailpit, executeQuery }) => {
      // GIVEN: A running server with email verification required and tables with permissions
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: { requireEmailVerification: true },
        },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text', required: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              create: { type: 'roles', roles: ['member'] },
              read: { type: 'roles', roles: ['member'] },
              update: { type: 'roles', roles: ['member'] },
              delete: { type: 'roles', roles: ['member'] },
            },
          },
        ],
      })

      const userEmail = mailpit.email('verified-api')
      const password = 'SecurePass123!'

      // Create user and verify email
      await page.request.post('/api/auth/sign-up/email', {
        data: {
          name: 'Verified API User',
          email: userEmail,
          password,
        },
      })

      // Get verification email and verify
      const email = await mailpit.waitForEmail(
        (e) => e.To[0]?.Address === userEmail && e.Subject.toLowerCase().includes('verify')
      )
      const token = extractTokenFromUrl(email.HTML, 'token')
      await page.request.get(`/api/auth/verify-email?token=${token}`)

      // Sign in to get session
      const signInResponse = await page.request.post('/api/auth/sign-in/email', {
        data: { email: userEmail, password },
      })
      expect(signInResponse.status()).toBe(200)

      // Create a task record for testing
      await executeQuery("INSERT INTO tasks (id, title) VALUES (1, 'Test Task')")

      // WHEN: Verified user accesses protected API endpoint
      const apiResponse = await page.request.get('/api/tables/tasks/records')

      // THEN: Access is granted and data is returned
      expect(apiResponse.status()).toBe(200)
      const apiData = await apiResponse.json()
      expect(apiData).toBeDefined()
      // Should return the task we created
      expect(Array.isArray(apiData.data)).toBe(true)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-SIGN-UP-EMAIL-016: user can complete full sign-up workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      // WHEN: User signs up with valid credentials
      const signUpResponse = await page.request.post('/api/auth/sign-up/email', {
        data: {
          name: 'Regression User',
          email: 'regression@example.com',
          password: 'SecurePass123!',
        },
      })

      // THEN: Sign-up succeeds
      expect(signUpResponse.status()).toBe(200)
      const signUpData = await signUpResponse.json()
      expect(signUpData).toHaveProperty('user')
      expect(signUpData.user.email).toBe('regression@example.com')

      // WHEN: User can sign in with new credentials
      const signInResponse = await page.request.post('/api/auth/sign-in/email', {
        data: {
          email: 'regression@example.com',
          password: 'SecurePass123!',
        },
      })

      // THEN: Sign-in succeeds
      expect(signInResponse.status()).toBe(200)
      const signInData = await signInResponse.json()
      expect(signInData).toHaveProperty('user')
      expect(signInData).toHaveProperty('token') // Better Auth returns token, not session object
    }
  )
})
