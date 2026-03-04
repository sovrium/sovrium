/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  test,
  expect,
  createTempConfigFile,
  cleanupTempConfigFile,
  captureRuntimeOutput,
} from '@/specs/fixtures'

/**
 * E2E Tests for CLI Structured Error Logging
 *
 * Source: src/infrastructure/server/server.ts, src/infrastructure/server/route-setup/page-routes.ts
 * Domain: cli
 * User Story: US-CLI-LOGGING-006
 * Spec Count: 4
 *
 * Validates that server errors are logged with structured format including
 * request context (method, path) and use logError for consistent formatting.
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (3 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 */

test.describe('CLI Structured Error Logging', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test(
    'CLI-LOG-ERROR-001: server 500 errors include method and path in log',
    { tag: '@spec' },
    async () => {
      // GIVEN: Server running (test error route available in non-production)
      const configPath = await createTempConfigFile(
        JSON.stringify({ name: 'error-context-test' }),
        'json'
      )

      try {
        // WHEN: Triggering a server error via /test/error
        const { runtimeOutput } = await captureRuntimeOutput(configPath, async (url) => {
          await fetch(`${url}/test/error`)
        })

        // THEN: Error log includes method and path
        expect(runtimeOutput).toContain('[SERVER] GET /test/error')
      } finally {
        await cleanupTempConfigFile(configPath)
      }
    }
  )

  test(
    'CLI-LOG-ERROR-002: page rendering errors use logError format',
    { tag: '@spec' },
    async () => {
      // GIVEN: Server running
      const configPath = await createTempConfigFile(
        JSON.stringify({ name: 'error-format-test' }),
        'json'
      )

      try {
        // WHEN: Triggering a server error
        const { runtimeOutput } = await captureRuntimeOutput(configPath, async (url) => {
          await fetch(`${url}/test/error`)
        })

        // THEN: Error log uses logError format with [ERROR] prefix and timestamp
        expect(runtimeOutput).toMatch(/\[ERROR\]/)
      } finally {
        await cleanupTempConfigFile(configPath)
      }
    }
  )

  test.fixme(
    'CLI-LOG-ERROR-003: auth errors do not leak passwords or tokens',
    { tag: '@spec' },
    async () => {
      // GIVEN: Server running with auth configured
      const configPath = await createTempConfigFile(
        JSON.stringify({
          name: 'error-sanitize-test',
          auth: {
            strategies: ['emailPassword'],
          },
        }),
        'json'
      )

      try {
        // WHEN: Sending a bad auth request with a password
        const { runtimeOutput } = await captureRuntimeOutput(configPath, async (url) => {
          await fetch(`${url}/api/auth/sign-in/email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: 'test@example.com',
              password: 'super-secret-password-123',
            }),
          })
        })

        // THEN: Password is not present in any log output
        expect(runtimeOutput).not.toContain('super-secret-password-123')
      } finally {
        await cleanupTempConfigFile(configPath)
      }
    }
  )

  // ============================================================================
  // @regression test - ONE optimized integration test
  // ============================================================================

  test(
    'CLI-LOG-ERROR-REGRESSION: error logging regression workflow',
    { tag: '@regression' },
    async () => {
      const configPath = await createTempConfigFile(
        JSON.stringify({ name: 'error-logging-regression' }),
        'json'
      )

      try {
        const { runtimeOutput } = await captureRuntimeOutput(configPath, async (url) => {
          // Trigger a 500 error via the test error route
          await fetch(`${url}/test/error`)
        })

        await test.step('CLI-LOG-ERROR-001: error includes method and path', async () => {
          expect(runtimeOutput).toContain('[SERVER] GET /test/error')
        })

        await test.step('CLI-LOG-ERROR-002: uses logError format with [ERROR] prefix', async () => {
          expect(runtimeOutput).toMatch(/\[ERROR\]/)
        })
      } finally {
        await cleanupTempConfigFile(configPath)
      }
    }
  )
})
