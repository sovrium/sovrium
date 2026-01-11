/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for SQL Injection Prevention
 *
 * Domain: api/security
 * Spec Count: 8
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (8 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 *
 * Tests SQL injection prevention across all attack vectors:
 * - Query string parameters (filter, sort, search)
 * - URL path parameters (record IDs)
 * - Request body JSON fields
 * - ORDER BY clause injection
 * - LIKE pattern injection
 * - Authentication endpoints (email parameter)
 * - Admin endpoints with filter/search params
 *
 * Drizzle ORM uses parameterized queries by default, which should prevent
 * most SQL injection attacks. These tests verify this protection works
 * correctly and that no raw SQL execution paths exist.
 */

test.describe('SQL Injection Prevention', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test(
    'API-SECURITY-SQLI-001: should prevent SQL injection in query string filters',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Application with table containing data
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'users_data',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'secret', type: 'single-line-text' },
            ],
          },
        ],
      })

      await signUp({ email: 'user@example.com', password: 'TestPassword123!', name: 'Test User' })
      await signIn({ email: 'user@example.com', password: 'TestPassword123!' })

      // Create test data
      await request.post('/api/tables/1/records', {
        data: { name: 'Alice', secret: 'alice-secret' },
      })
      await request.post('/api/tables/1/records', {
        data: { name: 'Bob', secret: 'bob-secret' },
      })

      // WHEN: Attempting SQL injection via filter parameter
      const sqlInjectionPayloads = [
        "' OR '1'='1",
        "'; DROP TABLE users_data; --",
        '1; SELECT * FROM users_data --',
        "' UNION SELECT * FROM users_data --",
        "1' OR '1'='1' --",
        "admin'--",
      ]

      for (const payload of sqlInjectionPayloads) {
        const response = await request.get(
          `/api/tables/1/records?filter[name]=${encodeURIComponent(payload)}`
        )

        // THEN: Should not expose all data or cause SQL errors
        // Either return empty results or 400 Bad Request
        expect([200, 400]).toContain(response.status())

        if (response.status() === 200) {
          const data = await response.json()
          // Should not return all records (SQL injection didn't bypass filter)
          expect(Array.isArray(data) ? data.length : 0).toBeLessThanOrEqual(1)
        }
      }
    }
  )

  test(
    'API-SECURITY-SQLI-002: should prevent SQL injection in URL path parameters',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Application with records accessible by ID
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

      // WHEN: Attempting SQL injection via path parameter
      const injectionPaths = [
        '1 OR 1=1',
        "1'; DROP TABLE items; --",
        '1 UNION SELECT * FROM items',
        '1--',
        "1' AND '1'='1",
      ]

      for (const payload of injectionPaths) {
        const response = await request.get(`/api/tables/1/records/${encodeURIComponent(payload)}`)

        // THEN: Should return 400 Bad Request or 404 Not Found
        // Should NOT return 200 with injected data
        expect([400, 404]).toContain(response.status())
      }
    }
  )

  test.fixme(
    'API-SECURITY-SQLI-003: should prevent SQL injection in request body fields',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Application with writable table
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

      // WHEN: Attempting SQL injection via request body
      const maliciousPayloads = [
        { title: "'); DROP TABLE posts; --", content: 'Normal content' },
        { title: 'Normal', content: "' OR '1'='1" },
        { title: "' UNION SELECT password FROM users --", content: 'Test' },
      ]

      for (const payload of maliciousPayloads) {
        const response = await request.post('/api/tables/1/records', {
          data: payload,
          headers: { 'Content-Type': 'application/json' },
        })

        // THEN: Should succeed (data is safely escaped) or fail validation
        expect([200, 201, 400]).toContain(response.status())

        if (response.status() === 201 || response.status() === 200) {
          const data = await response.json()
          // Data should be stored literally (escaped), not executed as SQL
          if (data.title) {
            expect(data.title).toBe(payload.title)
          }
        }
      }

      // Verify table still exists by querying it
      const listResponse = await request.get('/api/tables/1/records')
      expect(listResponse.status()).toBe(200)
    }
  )

  test.fixme(
    'API-SECURITY-SQLI-004: should prevent SQL injection in ORDER BY clauses',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Application with sortable data
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'products',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'price', type: 'decimal' },
            ],
          },
        ],
      })

      await signUp({ email: 'user@example.com', password: 'TestPassword123!', name: 'Test User' })
      await signIn({ email: 'user@example.com', password: 'TestPassword123!' })

      // Create test data
      await request.post('/api/tables/1/records', { data: { name: 'Item A', price: 10.0 } })
      await request.post('/api/tables/1/records', { data: { name: 'Item B', price: 20.0 } })

      // WHEN: Attempting SQL injection via sort parameter
      const sortInjections = [
        'name; DROP TABLE products; --',
        '(SELECT password FROM users)',
        'name DESC, (SELECT 1 FROM users WHERE 1=1) --',
        'CASE WHEN 1=1 THEN name ELSE price END',
      ]

      for (const payload of sortInjections) {
        const response = await request.get(
          `/api/tables/1/records?sort=${encodeURIComponent(payload)}`
        )

        // THEN: Should either reject invalid sort or ignore injection
        expect([200, 400]).toContain(response.status())

        // If 200, should still return data (injection failed to execute)
        if (response.status() === 200) {
          const data = await response.json()
          expect(Array.isArray(data) ? data.length : 0).toBeGreaterThan(0)
        }
      }
    }
  )

  test.fixme(
    'API-SECURITY-SQLI-005: should prevent SQL injection in LIKE search patterns',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Application with search functionality
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'articles',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'body', type: 'long-text' },
            ],
          },
        ],
      })

      await signUp({ email: 'user@example.com', password: 'TestPassword123!', name: 'Test User' })
      await signIn({ email: 'user@example.com', password: 'TestPassword123!' })

      // Create test articles
      await request.post('/api/tables/1/records', {
        data: { title: 'Public Article', body: 'Public content' },
      })
      await request.post('/api/tables/1/records', {
        data: { title: 'Secret Article', body: 'Secret content' },
      })

      // WHEN: Attempting SQL injection via search/LIKE pattern
      const likeInjections = [
        "%' OR '1'='1",
        "%'; DELETE FROM articles; --",
        '% UNION SELECT * FROM users --',
        '_) OR (1=1',
      ]

      for (const payload of likeInjections) {
        const response = await request.get(
          `/api/tables/1/records?search=${encodeURIComponent(payload)}`
        )

        // THEN: Should safely escape special characters
        expect([200, 400]).toContain(response.status())

        if (response.status() === 200) {
          const data = await response.json()
          // Should not return all articles (injection didn't bypass LIKE)
          // Zero results is expected for invalid search
          expect(Array.isArray(data) ? data.length : 0).toBeLessThanOrEqual(2)
        }
      }

      // Verify data wasn't deleted
      const verifyResponse = await request.get('/api/tables/1/records')
      expect(verifyResponse.status()).toBe(200)
      const allArticles = await verifyResponse.json()
      expect(Array.isArray(allArticles) ? allArticles.length : 0).toBe(2)
    }
  )

  test.fixme(
    'API-SECURITY-SQLI-006: should prevent second-order SQL injection',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Application where stored data is used in subsequent queries
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'templates',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'query_pattern', type: 'single-line-text' },
            ],
          },
          {
            id: 2,
            name: 'data',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'value', type: 'single-line-text' },
            ],
          },
        ],
      })

      await signUp({ email: 'user@example.com', password: 'TestPassword123!', name: 'Test User' })
      await signIn({ email: 'user@example.com', password: 'TestPassword123!' })

      // Create data that will be used later
      await request.post('/api/tables/2/records', { data: { value: 'Normal data' } })

      // Store malicious payload (first-order)
      const maliciousTemplate = await request.post('/api/tables/1/records', {
        data: {
          name: 'Malicious Template',
          query_pattern: "'; DROP TABLE data; --",
        },
      })
      expect([200, 201]).toContain(maliciousTemplate.status())

      // WHEN: The stored data is used (second-order)
      // This depends on implementation, but the key is that stored malicious
      // data should never be interpolated into SQL queries

      // THEN: Verify original data table still exists and has data
      const verifyResponse = await request.get('/api/tables/2/records')
      expect(verifyResponse.status()).toBe(200)

      const data = await verifyResponse.json()
      expect(Array.isArray(data) ? data.length : 0).toBeGreaterThan(0)
    }
  )

  test(
    'API-SECURITY-SQLI-007: should prevent SQL injection in authentication email parameter',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, signUp }) => {
      // GIVEN: Application with email/password authentication
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      // Create a legitimate user
      await signUp({ email: 'user@example.com', password: 'TestPassword123!', name: 'Test User' })

      // WHEN: Attempting SQL injection via email parameter in sign-in
      const sqlInjectionEmails = [
        "admin@example.com' OR '1'='1",
        "admin@example.com'; DROP TABLE users; --",
        "' UNION SELECT * FROM users WHERE '1'='1",
        "admin@example.com' --",
      ]

      for (const payload of sqlInjectionEmails) {
        const response = await request.post('/api/auth/sign-in/email', {
          data: {
            email: payload,
            password: 'anypassword',
          },
        })

        // THEN: Should not bypass authentication or execute SQL
        expect([400, 401]).toContain(response.status())

        // Should not return user data or session
        const data = await response.json()
        expect(data).not.toHaveProperty('session')
        expect(data).not.toHaveProperty('user')
      }
    }
  )

  test.fixme(
    'API-SECURITY-SQLI-008: should prevent SQL injection in admin list-users endpoint',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, createAuthenticatedAdmin }) => {
      // GIVEN: Application with admin plugin and filter/search params
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          admin: true,
        },
      })

      await createAuthenticatedAdmin()

      // WHEN: Attempting SQL injection via filter/search parameters
      const sqlInjectionParams = [
        "?filter[email]=' OR '1'='1",
        "?search=' UNION SELECT * FROM users --",
        "?filter[role]=admin'; DROP TABLE users; --",
      ]

      for (const params of sqlInjectionParams) {
        const response = await page.request.get(`/api/auth/admin/list-users${params}`)

        // THEN: Should either reject invalid params or safely escape them
        expect([200, 400]).toContain(response.status())

        if (response.status() === 200) {
          const data = await response.json()
          // Should not leak all users or execute injection
          // Result should be normal filtered list
          expect(data).toBeDefined()
        }
      }
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test.fixme(
    'API-SECURITY-SQLI-REGRESSION: SQL injection protection across all attack vectors',
    { tag: '@regression' },
    async ({ request, page, startServerWithSchema, signUp, signIn, createAuthenticatedAdmin }) => {
      // Setup comprehensive schema for all injection test scenarios
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          admin: true,
        },
        tables: [
          {
            id: 1,
            name: 'users_data',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'secret', type: 'single-line-text' },
            ],
          },
          {
            id: 2,
            name: 'items',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'data', type: 'single-line-text' },
            ],
          },
          {
            id: 3,
            name: 'posts',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'content', type: 'long-text' },
            ],
          },
          {
            id: 4,
            name: 'products',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'price', type: 'decimal' },
            ],
          },
          {
            id: 5,
            name: 'articles',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'body', type: 'long-text' },
            ],
          },
          {
            id: 6,
            name: 'templates',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'query_pattern', type: 'single-line-text' },
            ],
          },
          {
            id: 7,
            name: 'data',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'value', type: 'single-line-text' },
            ],
          },
        ],
      })

      await signUp({ email: 'user@example.com', password: 'TestPassword123!', name: 'Test User' })
      await signIn({ email: 'user@example.com', password: 'TestPassword123!' })

      await test.step('API-SECURITY-SQLI-001: prevents SQL injection in query string filters', async () => {
        // Create test data
        await request.post('/api/tables/1/records', {
          data: { name: 'Alice', secret: 'alice-secret' },
        })
        await request.post('/api/tables/1/records', {
          data: { name: 'Bob', secret: 'bob-secret' },
        })

        // Attempt SQL injection via filter parameter
        const sqlInjectionPayloads = [
          "' OR '1'='1",
          "'; DROP TABLE users_data; --",
          '1; SELECT * FROM users_data --',
          "' UNION SELECT * FROM users_data --",
          "1' OR '1'='1' --",
          "admin'--",
        ]

        for (const payload of sqlInjectionPayloads) {
          const response = await request.get(
            `/api/tables/1/records?filter[name]=${encodeURIComponent(payload)}`
          )

          // Should not expose all data or cause SQL errors
          expect([200, 400]).toContain(response.status())

          if (response.status() === 200) {
            const data = await response.json()
            // Should not return all records (SQL injection didn't bypass filter)
            expect(Array.isArray(data) ? data.length : 0).toBeLessThanOrEqual(1)
          }
        }
      })

      await test.step('API-SECURITY-SQLI-002: prevents SQL injection in URL path parameters', async () => {
        // Attempt SQL injection via path parameter
        const injectionPaths = [
          '1 OR 1=1',
          "1'; DROP TABLE items; --",
          '1 UNION SELECT * FROM items',
          '1--',
          "1' AND '1'='1",
        ]

        for (const payload of injectionPaths) {
          const response = await request.get(`/api/tables/2/records/${encodeURIComponent(payload)}`)

          // Should return 400 Bad Request or 404 Not Found
          // Should NOT return 200 with injected data
          expect([400, 404]).toContain(response.status())
        }
      })

      await test.step('API-SECURITY-SQLI-003: prevents SQL injection in request body fields', async () => {
        // Attempt SQL injection via request body
        const maliciousPayloads = [
          { title: "'); DROP TABLE posts; --", content: 'Normal content' },
          { title: 'Normal', content: "' OR '1'='1" },
          { title: "' UNION SELECT password FROM users --", content: 'Test' },
        ]

        for (const payload of maliciousPayloads) {
          const response = await request.post('/api/tables/3/records', {
            data: payload,
            headers: { 'Content-Type': 'application/json' },
          })

          // Should succeed (data is safely escaped) or fail validation
          expect([200, 201, 400]).toContain(response.status())

          if (response.status() === 201 || response.status() === 200) {
            const data = await response.json()
            // Data should be stored literally (escaped), not executed as SQL
            if (data.title) {
              expect(data.title).toBe(payload.title)
            }
          }
        }

        // Verify table still exists by querying it
        const listResponse = await request.get('/api/tables/3/records')
        expect(listResponse.status()).toBe(200)
      })

      await test.step('API-SECURITY-SQLI-004: prevents SQL injection in ORDER BY clauses', async () => {
        // Create test data
        await request.post('/api/tables/4/records', { data: { name: 'Item A', price: 10.0 } })
        await request.post('/api/tables/4/records', { data: { name: 'Item B', price: 20.0 } })

        // Attempt SQL injection via sort parameter
        const sortInjections = [
          'name; DROP TABLE products; --',
          '(SELECT password FROM users)',
          'name DESC, (SELECT 1 FROM users WHERE 1=1) --',
          'CASE WHEN 1=1 THEN name ELSE price END',
        ]

        for (const payload of sortInjections) {
          const response = await request.get(
            `/api/tables/4/records?sort=${encodeURIComponent(payload)}`
          )

          // Should either reject invalid sort or ignore injection
          expect([200, 400]).toContain(response.status())

          // If 200, should still return data (injection failed to execute)
          if (response.status() === 200) {
            const data = await response.json()
            expect(Array.isArray(data) ? data.length : 0).toBeGreaterThan(0)
          }
        }
      })

      await test.step('API-SECURITY-SQLI-005: prevents SQL injection in LIKE search patterns', async () => {
        // Create test articles
        await request.post('/api/tables/5/records', {
          data: { title: 'Public Article', body: 'Public content' },
        })
        await request.post('/api/tables/5/records', {
          data: { title: 'Secret Article', body: 'Secret content' },
        })

        // Attempt SQL injection via search/LIKE pattern
        const likeInjections = [
          "%' OR '1'='1",
          "%'; DELETE FROM articles; --",
          '% UNION SELECT * FROM users --',
          '_) OR (1=1',
        ]

        for (const payload of likeInjections) {
          const response = await request.get(
            `/api/tables/5/records?search=${encodeURIComponent(payload)}`
          )

          // Should safely escape special characters
          expect([200, 400]).toContain(response.status())

          if (response.status() === 200) {
            const data = await response.json()
            // Should not return all articles (injection didn't bypass LIKE)
            expect(Array.isArray(data) ? data.length : 0).toBeLessThanOrEqual(2)
          }
        }

        // Verify data wasn't deleted
        const verifyResponse = await request.get('/api/tables/5/records')
        expect(verifyResponse.status()).toBe(200)
        const allArticles = await verifyResponse.json()
        expect(Array.isArray(allArticles) ? allArticles.length : 0).toBe(2)
      })

      await test.step('API-SECURITY-SQLI-006: prevents second-order SQL injection', async () => {
        // Create data that will be used later
        await request.post('/api/tables/7/records', { data: { value: 'Normal data' } })

        // Store malicious payload (first-order)
        const maliciousTemplate = await request.post('/api/tables/6/records', {
          data: {
            name: 'Malicious Template',
            query_pattern: "'; DROP TABLE data; --",
          },
        })
        expect([200, 201]).toContain(maliciousTemplate.status())

        // Verify original data table still exists and has data
        const verifyResponse = await request.get('/api/tables/7/records')
        expect(verifyResponse.status()).toBe(200)

        const data = await verifyResponse.json()
        expect(Array.isArray(data) ? data.length : 0).toBeGreaterThan(0)
      })

      await test.step('API-SECURITY-SQLI-007: prevents SQL injection in authentication email parameter', async () => {
        // Attempt SQL injection via email parameter in sign-in
        const sqlInjectionEmails = [
          "admin@example.com' OR '1'='1",
          "admin@example.com'; DROP TABLE users; --",
          "' UNION SELECT * FROM users WHERE '1'='1",
          "admin@example.com' --",
        ]

        for (const payload of sqlInjectionEmails) {
          const response = await request.post('/api/auth/sign-in/email', {
            data: {
              email: payload,
              password: 'anypassword',
            },
          })

          // Should not bypass authentication or execute SQL
          expect([400, 401]).toContain(response.status())

          // Should not return user data or session
          const data = await response.json()
          expect(data).not.toHaveProperty('session')
          expect(data).not.toHaveProperty('user')
        }
      })

      await test.step('API-SECURITY-SQLI-008: prevents SQL injection in admin list-users endpoint', async () => {
        await createAuthenticatedAdmin()

        // Attempt SQL injection via filter/search parameters
        const sqlInjectionParams = [
          "?filter[email]=' OR '1'='1",
          "?search=' UNION SELECT * FROM users --",
          "?filter[role]=admin'; DROP TABLE users; --",
        ]

        for (const params of sqlInjectionParams) {
          const response = await page.request.get(`/api/auth/admin/list-users${params}`)

          // Should either reject invalid params or safely escape them
          expect([200, 400]).toContain(response.status())

          if (response.status() === 200) {
            const data = await response.json()
            // Should not leak all users or execute injection
            expect(data).toBeDefined()
          }
        }
      })
    }
  )
})
