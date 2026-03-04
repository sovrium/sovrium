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
 * E2E Tests for CLI Request Access Log
 *
 * Source: src/infrastructure/server/middleware/request-logger.ts
 * Domain: cli
 * User Story: US-CLI-LOGGING-005
 * Spec Count: 5
 *
 * Validates that LOG_LEVEL=debug produces request access logs for page routes
 * but not for static asset routes, and that default log level is silent.
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (4 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 */

test.describe('CLI Request Access Log', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test(
    'CLI-LOG-ACCESS-001: LOG_LEVEL=debug shows request log with method, path, status, duration',
    { tag: '@spec' },
    async () => {
      // GIVEN: Server running with LOG_LEVEL=debug
      const configPath = await createTempConfigFile(
        JSON.stringify({ name: 'access-log-test' }),
        'json'
      )

      try {
        // WHEN: Making a page request
        const { runtimeOutput } = await captureRuntimeOutput(
          configPath,
          async (url) => {
            await fetch(url)
          },
          { env: { LOG_LEVEL: 'debug' } }
        )

        // THEN: Access log contains method, path, status
        expect(runtimeOutput).toContain('<-- GET /')
      } finally {
        await cleanupTempConfigFile(configPath)
      }
    }
  )

  test(
    'CLI-LOG-ACCESS-002: static asset paths excluded from access log',
    { tag: '@spec' },
    async () => {
      // GIVEN: Server running with LOG_LEVEL=debug
      const configPath = await createTempConfigFile(
        JSON.stringify({ name: 'access-exclude-test' }),
        'json'
      )

      try {
        // WHEN: Requesting only static assets
        const { runtimeOutput } = await captureRuntimeOutput(
          configPath,
          async (url) => {
            await fetch(`${url}/assets/output.css`)
          },
          { env: { LOG_LEVEL: 'debug' } }
        )

        // THEN: No access log for /assets/ paths
        expect(runtimeOutput).not.toContain('<-- GET /assets')
      } finally {
        await cleanupTempConfigFile(configPath)
      }
    }
  )

  test(
    'CLI-LOG-ACCESS-003: default log level produces no access log',
    { tag: '@spec' },
    async () => {
      // GIVEN: Server running with default log level (no LOG_LEVEL set)
      const configPath = await createTempConfigFile(
        JSON.stringify({ name: 'access-default-test' }),
        'json'
      )

      try {
        // WHEN: Making a page request
        const { runtimeOutput } = await captureRuntimeOutput(configPath, async (url) => {
          await fetch(url)
        })

        // THEN: No access log output at default level
        expect(runtimeOutput).not.toContain('<--')
      } finally {
        await cleanupTempConfigFile(configPath)
      }
    }
  )

  test(
    'CLI-LOG-ACCESS-004: access log format includes duration',
    { tag: '@spec' },
    async () => {
      // GIVEN: Server running with LOG_LEVEL=debug
      const configPath = await createTempConfigFile(
        JSON.stringify({ name: 'access-format-test' }),
        'json'
      )

      try {
        // WHEN: Making a page request
        const { runtimeOutput } = await captureRuntimeOutput(
          configPath,
          async (url) => {
            await fetch(url)
          },
          { env: { LOG_LEVEL: 'debug' } }
        )

        // THEN: Access log matches format: <-- METHOD /path STATUS TIMEms
        expect(runtimeOutput).toMatch(/<-- GET \/ \d{3} \d+ms/)
      } finally {
        await cleanupTempConfigFile(configPath)
      }
    }
  )

  // ============================================================================
  // @regression test - ONE optimized integration test
  // ============================================================================

  test(
    'CLI-LOG-ACCESS-REGRESSION: access log regression workflow',
    { tag: '@regression' },
    async () => {
      const configPath = await createTempConfigFile(
        JSON.stringify({ name: 'access-log-regression' }),
        'json'
      )

      try {
        // Test with LOG_LEVEL=debug
        const { runtimeOutput: debugOutput } = await captureRuntimeOutput(
          configPath,
          async (url) => {
            await fetch(url)
            await fetch(`${url}/assets/output.css`)
          },
          { env: { LOG_LEVEL: 'debug' } }
        )

        await test.step('CLI-LOG-ACCESS-001: page request logged', async () => {
          expect(debugOutput).toContain('<-- GET /')
        })

        await test.step('CLI-LOG-ACCESS-002: assets excluded from log', async () => {
          expect(debugOutput).not.toContain('<-- GET /assets')
        })

        await test.step('CLI-LOG-ACCESS-004: format includes duration', async () => {
          expect(debugOutput).toMatch(/<-- GET \/ \d{3} \d+ms/)
        })

        // Test with default log level (separate server instance)
        const configPath2 = await createTempConfigFile(
          JSON.stringify({ name: 'access-log-regression-silent' }),
          'json'
        )

        try {
          const { runtimeOutput: defaultOutput } = await captureRuntimeOutput(
            configPath2,
            async (url) => {
              await fetch(url)
            }
          )

          await test.step('CLI-LOG-ACCESS-003: default level is silent', async () => {
            expect(defaultOutput).not.toContain('<--')
          })
        } finally {
          await cleanupTempConfigFile(configPath2)
        }
      } finally {
        await cleanupTempConfigFile(configPath)
      }
    }
  )
})
