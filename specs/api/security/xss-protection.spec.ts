/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for XSS (Cross-Site Scripting) Protection
 *
 * Domain: api/security
 * Spec Count: 8
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (8 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 *
 * Tests XSS prevention across attack vectors:
 * - Stored XSS (malicious script stored in database, executed on render)
 * - Reflected XSS (malicious script in URL/query params, reflected in response)
 * - Content-Type enforcement (ensure JSON responses, not HTML)
 * - Script tag injection in user-generated content
 * - Event handler injection (onclick, onerror, etc.)
 * - JavaScript URL injection (javascript:alert())
 * - HTML entity encoding in API responses
 *
 * XSS Protection Responsibility:
 * - API Layer: Returns JSON responses (not HTML), preventing script execution.
 *   Uses Content-Type: application/json and X-Content-Type-Options: nosniff.
 * - URL Field Type: Validates for http/https protocols, rejecting javascript: URLs.
 * - Frontend (React): MUST sanitize user content when rendering as HTML using
 *   libraries like DOMPurify. React's JSX escapes values by default, but
 *   dangerouslySetInnerHTML requires explicit sanitization.
 */

test.describe('XSS Protection - Cross-Site Scripting Prevention', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test.fixme(
    'API-SECURITY-XSS-001: should safely store and return script tag content',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Application with user-generated content field
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'posts',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'content', type: 'long-text' },
            ],
          },
        ],
      })

      await signUp({ email: 'user@example.com', password: 'TestPassword123!', name: 'Test User' })
      await signIn({ email: 'user@example.com', password: 'TestPassword123!' })

      // WHEN: Storing content with script tags
      const xssPayloads = [
        '<script>alert("XSS")</script>', // Basic script tag
      ]

      for (const payload of xssPayloads) {
        const createResponse = await request.post('/api/tables/1/records', {
          data: { title: 'Test Post', content: payload },
          headers: { 'Content-Type': 'application/json' },
        })

        expect([200, 201]).toContain(createResponse.status())

        const created = await createResponse.json()

        // THEN: Content should be stored literally (for JSON API)
        // The frontend is responsible for sanitizing when rendering HTML
        // But API should return proper JSON with Content-Type
        expect(created.content).toBeDefined()

        // Verify Content-Type is JSON (not text/html which would execute)
        const getResponse = await request.get(`/api/tables/1/records/${created.id}`)
        expect(getResponse.headers()['content-type']).toContain('application/json')
      }
    }
  )

  test.fixme(
    'API-SECURITY-XSS-002: should safely store and return event handler injections',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Application with user content fields
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'profiles',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'bio', type: 'long-text' },
              { id: 3, name: 'website', type: 'url' },
            ],
          },
        ],
      })

      await signUp({ email: 'user@example.com', password: 'TestPassword123!', name: 'Test User' })
      await signIn({ email: 'user@example.com', password: 'TestPassword123!' })

      // WHEN: Storing content with event handlers
      const eventHandlerPayloads = [
        '<img src=x onerror="alert(\'XSS\')">', // Event handler injection
      ]

      for (const payload of eventHandlerPayloads) {
        const response = await request.post('/api/tables/1/records', {
          data: { bio: payload, website: 'https://example.com' },
          headers: { 'Content-Type': 'application/json' },
        })

        expect([200, 201, 400]).toContain(response.status())

        if (response.status() === 200 || response.status() === 201) {
          const data = await response.json()
          // Content stored literally in JSON (not sanitized by API)
          // Frontend must sanitize when rendering as HTML
          expect(data.bio).toBeDefined()
        }
      }
    }
  )

  test(
    'API-SECURITY-XSS-003: should reject or sanitize javascript: URLs',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Application with URL fields
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'links',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'url', type: 'url' },
            ],
          },
        ],
      })

      await signUp({ email: 'user@example.com', password: 'TestPassword123!', name: 'Test User' })
      await signIn({ email: 'user@example.com', password: 'TestPassword123!' })

      // WHEN: Attempting to store javascript: URLs
      const jsUrlPayloads = [
        'javascript:alert("XSS")', // JavaScript URL
      ]

      for (const payload of jsUrlPayloads) {
        const response = await request.post('/api/tables/1/records', {
          data: { title: 'Malicious Link', url: payload },
          headers: { 'Content-Type': 'application/json' },
        })

        // THEN: Should reject invalid URL format or sanitize
        // URL field type should validate for http/https
        if (response.status() === 400) {
          // Good: Validation rejected javascript: URL
          const error = await response.json()
          expect(error).toHaveProperty('error')
        } else if (response.status() === 200 || response.status() === 201) {
          // If accepted, verify it's not stored as executable
          const data = await response.json()
          const storedUrl = data.url?.toLowerCase() ?? ''
          // Should not contain executable javascript:
          expect(storedUrl.startsWith('javascript:')).toBe(false)
        }
      }
    }
  )

  test(
    'API-SECURITY-XSS-004: should return Content-Type application/json for API responses',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Application with various endpoints
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'items',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'data', type: 'single-line-text' },
            ],
          },
        ],
      })

      await signUp({ email: 'user@example.com', password: 'TestPassword123!', name: 'Test User' })
      await signIn({ email: 'user@example.com', password: 'TestPassword123!' })

      // Create test data with HTML content
      await request.post('/api/tables/1/records', {
        data: { data: '<script>alert("XSS")</script>' },
      })

      // WHEN: Fetching API responses
      const endpoints = ['/api/health', '/api/tables', '/api/tables/1/records']

      for (const endpoint of endpoints) {
        const response = await request.get(endpoint)

        // THEN: Content-Type should be application/json
        const contentType = response.headers()['content-type']
        expect(contentType).toBeDefined()
        expect(contentType).toContain('application/json')

        // Should NOT be text/html (which would execute scripts)
        expect(contentType).not.toContain('text/html')
      }
    }
  )

  test.fixme(
    'API-SECURITY-XSS-005: should not reflect query parameters in error responses',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application running
      await startServerWithSchema({
        name: 'test-app',
      })

      // WHEN: Sending requests with XSS payloads in query parameters
      const xssQueries = [
        '/api/nonexistent?param=<script>alert("XSS")</script>',
        '/api/tables/999?callback=<script>alert("XSS")</script>',
        '/api/search?q=<img src=x onerror=alert("XSS")>',
      ]

      for (const query of xssQueries) {
        const response = await request.get(query)

        // THEN: Error response should not reflect the XSS payload
        const body = await response.text()

        // Should not contain unescaped script tags
        expect(body).not.toContain('<script>')
        expect(body).not.toContain('onerror=')
        expect(body).not.toContain('onclick=')

        // Content-Type should still be JSON
        const contentType = response.headers()['content-type']
        if (contentType) {
          expect(contentType).toContain('application/json')
        }
      }
    }
  )

  // Note: X-Content-Type-Options header is tested comprehensively in secure-headers.spec.ts
  // This test focuses on Content-Type application/json for XSS prevention

  test.fixme(
    'API-SECURITY-XSS-006: should handle nested XSS payloads in JSON',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Application with complex data structures
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'complex_data',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'metadata', type: 'json' },
            ],
          },
        ],
      })

      await signUp({ email: 'user@example.com', password: 'TestPassword123!', name: 'Test User' })
      await signIn({ email: 'user@example.com', password: 'TestPassword123!' })

      // WHEN: Storing nested XSS payloads in JSON fields
      const nestedPayload = {
        user: {
          name: '<script>alert("XSS")</script>',
          bio: '<img src=x onerror=alert("XSS")>',
        },
        tags: ['<script>evil()</script>', 'normal', '<svg onload=alert(1)>'],
        content: {
          html: '<div onclick="alert(\'XSS\')">Click me</div>',
        },
      }

      const response = await request.post('/api/tables/1/records', {
        data: { metadata: nestedPayload },
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 201]).toContain(response.status())

      const created = await response.json()

      // THEN: Data should be stored as JSON (not HTML-escaped in storage)
      // Frontend must sanitize when rendering
      const getResponse = await request.get(`/api/tables/1/records/${created.id}`)
      expect(getResponse.status()).toBe(200)

      // Content-Type must be JSON to prevent execution
      expect(getResponse.headers()['content-type']).toContain('application/json')

      // Verify the nested structure is preserved
      const retrieved = await getResponse.json()
      expect(retrieved.metadata).toBeDefined()
    }
  )

  test(
    'API-SECURITY-XSS-007: should prevent XSS in user profile name field during sign-up',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application with user registration
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      // WHEN: Attempting to register with XSS payloads in name field
      const xssNamePayloads = [
        '<script>alert("XSS")</script>', // Basic script tag
        '<img src=x onerror="alert(\'XSS\')">', // Event handler
        'javascript:alert("XSS")', // JavaScript URL
      ]

      for (const payload of xssNamePayloads) {
        const response = await request.post('/api/auth/sign-up/email', {
          data: {
            email: `test${Math.random()}@example.com`,
            password: 'TestPassword123!',
            name: payload,
          },
          headers: { 'Content-Type': 'application/json' },
        })

        // THEN: Should either accept (store as text) or reject (validate name format)
        if (response.status() === 200 || response.status() === 201) {
          // If accepted, verify it's stored safely as JSON
          const data = await response.json()
          expect(data.user).toBeDefined()

          // Get user profile to verify storage
          const sessionResponse = await request.get('/api/auth/get-session')
          expect(sessionResponse.headers()['content-type']).toContain('application/json')

          // User data should be JSON-encoded (not HTML-rendered by API)
          const session = await sessionResponse.json()
          if (session.user) {
            expect(session.user.name).toBeDefined()
          }
        } else if (response.status() === 400) {
          // Validation rejected malicious input (preferred approach)
          const error = await response.json()
          expect(error).toHaveProperty('error')
        }

        // THEN: Response must always be JSON (prevent HTML rendering)
        expect(response.headers()['content-type']).toContain('application/json')
      }
    }
  )

  test.fixme(
    'API-SECURITY-XSS-008: should prevent XSS in update-user endpoint',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'TestPassword123!',
        name: 'Original Name',
      })
      await signIn({ email: 'user@example.com', password: 'TestPassword123!' })

      // WHEN: Attempting to update user profile with XSS payloads
      const xssUpdatePayloads = [
        { name: '<script>alert("XSS")</script>' },
        { name: '<img src=x onerror="alert(\'XSS\')">' },
        { email: 'test@example.com<script>alert("XSS")</script>' },
        { image: 'javascript:alert("XSS")' },
        { image: 'data:text/html,<script>alert("XSS")</script>' },
      ]

      for (const payload of xssUpdatePayloads) {
        const response = await request.patch('/api/auth/update-user', {
          data: payload,
          headers: { 'Content-Type': 'application/json' },
        })

        // THEN: Should handle XSS payloads safely
        if (response.status() === 200) {
          // If update succeeds, verify data is JSON-safe
          const data = await response.json()
          expect(data.user).toBeDefined()

          // Verify Content-Type is JSON
          expect(response.headers()['content-type']).toContain('application/json')
        } else if (response.status() === 400) {
          // Validation rejected malicious input (preferred)
          const error = await response.json()
          expect(error).toHaveProperty('error')
        } else {
          // Other error codes are acceptable (403, 401, etc.)
          expect([200, 400, 401, 403]).toContain(response.status())
        }

        // THEN: All responses must be JSON (prevent HTML rendering)
        expect(response.headers()['content-type']).toContain('application/json')
      }
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test.fixme(
    'API-SECURITY-XSS-REGRESSION: XSS protection is enforced across all content types',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Application with comprehensive schema for all XSS test scenarios
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'posts',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'content', type: 'long-text' },
            ],
          },
          {
            id: 2,
            name: 'profiles',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'bio', type: 'long-text' },
              { id: 3, name: 'website', type: 'url' },
            ],
          },
          {
            id: 3,
            name: 'links',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'url', type: 'url' },
            ],
          },
          {
            id: 4,
            name: 'items',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'data', type: 'single-line-text' },
            ],
          },
          {
            id: 5,
            name: 'complex_data',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'metadata', type: 'json' },
            ],
          },
        ],
      })

      await test.step('API-SECURITY-XSS-001: Safely store and return script tag content', async () => {
        // Create user for this step
        await signUp({
          email: 'user001@example.com',
          password: 'TestPassword123!',
          name: 'Test User 001',
        })
        await signIn({ email: 'user001@example.com', password: 'TestPassword123!' })

        // WHEN: Storing content with script tags
        const xssPayloads = ['<script>alert("XSS")</script>']

        for (const payload of xssPayloads) {
          const createResponse = await request.post('/api/tables/1/records', {
            data: { title: 'Test Post', content: payload },
            headers: { 'Content-Type': 'application/json' },
          })

          expect([200, 201]).toContain(createResponse.status())

          const created = await createResponse.json()

          // THEN: Content should be stored literally (for JSON API)
          expect(created.content).toBeDefined()

          // Verify Content-Type is JSON (not text/html which would execute)
          const getResponse = await request.get(`/api/tables/1/records/${created.id}`)
          expect(getResponse.headers()['content-type']).toContain('application/json')
        }
      })

      await test.step('API-SECURITY-XSS-002: Safely store and return event handler injections', async () => {
        // WHEN: Storing content with event handlers
        const eventHandlerPayloads = ['<img src=x onerror="alert(\'XSS\')">']

        for (const payload of eventHandlerPayloads) {
          const response = await request.post('/api/tables/2/records', {
            data: { bio: payload, website: 'https://example.com' },
            headers: { 'Content-Type': 'application/json' },
          })

          expect([200, 201, 400]).toContain(response.status())

          if (response.status() === 200 || response.status() === 201) {
            const data = await response.json()
            // Content stored literally in JSON (not sanitized by API)
            expect(data.bio).toBeDefined()
          }
        }
      })

      await test.step('API-SECURITY-XSS-003: Reject or sanitize javascript: URLs', async () => {
        // WHEN: Attempting to store javascript: URLs
        const jsUrlPayloads = ['javascript:alert("XSS")']

        for (const payload of jsUrlPayloads) {
          const response = await request.post('/api/tables/3/records', {
            data: { title: 'Malicious Link', url: payload },
            headers: { 'Content-Type': 'application/json' },
          })

          // THEN: Should reject invalid URL format or sanitize
          if (response.status() === 400) {
            const error = await response.json()
            expect(error).toHaveProperty('error')
          } else if (response.status() === 200 || response.status() === 201) {
            const data = await response.json()
            const storedUrl = data.url?.toLowerCase() ?? ''
            expect(storedUrl.startsWith('javascript:')).toBe(false)
          }
        }
      })

      await test.step('API-SECURITY-XSS-004: Return Content-Type application/json for API responses', async () => {
        // Create test data with HTML content
        await request.post('/api/tables/4/records', {
          data: { data: '<script>alert("XSS")</script>' },
        })

        // WHEN: Fetching API responses
        const endpoints = ['/api/health', '/api/tables', '/api/tables/4/records']

        for (const endpoint of endpoints) {
          const response = await request.get(endpoint)

          // THEN: Content-Type should be application/json
          const contentType = response.headers()['content-type']
          expect(contentType).toBeDefined()
          expect(contentType).toContain('application/json')
          expect(contentType).not.toContain('text/html')
        }
      })

      await test.step('API-SECURITY-XSS-005: Not reflect query parameters in error responses', async () => {
        // WHEN: Sending requests with XSS payloads in query parameters
        const xssQueries = [
          '/api/nonexistent?param=<script>alert("XSS")</script>',
          '/api/tables/999?callback=<script>alert("XSS")</script>',
          '/api/search?q=<img src=x onerror=alert("XSS")>',
        ]

        for (const query of xssQueries) {
          const response = await request.get(query)

          // THEN: Error response should not reflect the XSS payload
          const body = await response.text()
          expect(body).not.toContain('<script>')
          expect(body).not.toContain('onerror=')
          expect(body).not.toContain('onclick=')

          const contentType = response.headers()['content-type']
          if (contentType) {
            expect(contentType).toContain('application/json')
          }
        }
      })

      await test.step('API-SECURITY-XSS-006: Handle nested XSS payloads in JSON', async () => {
        // WHEN: Storing nested XSS payloads in JSON fields
        const nestedPayload = {
          user: {
            name: '<script>alert("XSS")</script>',
            bio: '<img src=x onerror=alert("XSS")>',
          },
          tags: ['<script>evil()</script>', 'normal', '<svg onload=alert(1)>'],
          content: {
            html: '<div onclick="alert(\'XSS\')">Click me</div>',
          },
        }

        const response = await request.post('/api/tables/5/records', {
          data: { metadata: nestedPayload },
          headers: { 'Content-Type': 'application/json' },
        })

        expect([200, 201]).toContain(response.status())

        const created = await response.json()

        // THEN: Data should be stored as JSON
        const getResponse = await request.get(`/api/tables/5/records/${created.id}`)
        expect(getResponse.status()).toBe(200)
        expect(getResponse.headers()['content-type']).toContain('application/json')

        const retrieved = await getResponse.json()
        expect(retrieved.metadata).toBeDefined()
      })

      await test.step('API-SECURITY-XSS-007: Prevent XSS in user profile name field during sign-up', async () => {
        // WHEN: Attempting to register with XSS payloads in name field
        const xssNamePayloads = [
          '<script>alert("XSS")</script>',
          '<img src=x onerror="alert(\'XSS\')">',
          'javascript:alert("XSS")',
        ]

        for (const payload of xssNamePayloads) {
          const response = await request.post('/api/auth/sign-up/email', {
            data: {
              email: `test${Math.random()}@example.com`,
              password: 'TestPassword123!',
              name: payload,
            },
            headers: { 'Content-Type': 'application/json' },
          })

          // THEN: Should either accept (store as text) or reject
          if (response.status() === 200 || response.status() === 201) {
            const data = await response.json()
            expect(data.user).toBeDefined()

            const sessionResponse = await request.get('/api/auth/get-session')
            expect(sessionResponse.headers()['content-type']).toContain('application/json')

            const session = await sessionResponse.json()
            if (session.user) {
              expect(session.user.name).toBeDefined()
            }
          } else if (response.status() === 400) {
            const error = await response.json()
            expect(error).toHaveProperty('error')
          }

          // THEN: Response must always be JSON
          expect(response.headers()['content-type']).toContain('application/json')
        }
      })

      await test.step('API-SECURITY-XSS-008: Prevent XSS in update-user endpoint', async () => {
        // Sign in as a known user for update test
        await signIn({ email: 'user001@example.com', password: 'TestPassword123!' })

        // WHEN: Attempting to update user profile with XSS payloads
        const xssUpdatePayloads = [
          { name: '<script>alert("XSS")</script>' },
          { name: '<img src=x onerror="alert(\'XSS\')">' },
          { email: 'test@example.com<script>alert("XSS")</script>' },
          { image: 'javascript:alert("XSS")' },
          { image: 'data:text/html,<script>alert("XSS")</script>' },
        ]

        for (const payload of xssUpdatePayloads) {
          const response = await request.patch('/api/auth/update-user', {
            data: payload,
            headers: { 'Content-Type': 'application/json' },
          })

          // THEN: Should handle XSS payloads safely
          if (response.status() === 200) {
            const data = await response.json()
            expect(data.user).toBeDefined()
            expect(response.headers()['content-type']).toContain('application/json')
          } else if (response.status() === 400) {
            const error = await response.json()
            expect(error).toHaveProperty('error')
          } else {
            expect([200, 400, 401, 403]).toContain(response.status())
          }

          // THEN: All responses must be JSON
          expect(response.headers()['content-type']).toContain('application/json')
        }
      })
    }
  )
})
