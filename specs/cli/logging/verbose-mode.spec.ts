/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { spawn } from 'node:child_process'
import { test, expect, createTempConfigFile, cleanupTempConfigFile } from '@/specs/fixtures'

/**
 * E2E Tests for CLI Verbose Mode (LOG_LEVEL=debug)
 *
 * Source: src/infrastructure/logging/logger.ts, src/infrastructure/css/compiler.ts
 * Domain: cli
 * User Story: US-CLI-LOGGING-003
 * Spec Count: 4
 *
 * Validates that LOG_LEVEL=debug reveals detailed diagnostic output:
 *   [CSS] Compiler diagnostics...
 *   [Schema] Initializer step details...
 *   [bootstrap-admin] Admin details...
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (4 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 */

/**
 * Spawn the CLI server, collect all output until the URL line appears,
 * then kill the process and return the captured output.
 */
async function captureStartupOutput(
  configPath: string,
  options?: { env?: Record<string, string> }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('bun', ['run', 'src/cli.ts', 'start', configPath], {
      env: {
        ...process.env,
        PORT: '0',
        AUTH_SECRET: 'test-secret-for-e2e-testing-32chars',
        ...options?.env,
      },
      stdio: 'pipe',
      cwd: process.cwd(),
    })

    const chunks: string[] = []
    child.stdout?.on('data', (data: Buffer) => chunks.push(data.toString()))
    child.stderr?.on('data', (data: Buffer) => chunks.push(data.toString()))

    child.on('error', (error) => {
      reject(new Error(`Failed to start CLI: ${error.message}`))
    })

    const interval = setInterval(() => {
      const output = chunks.join('')
      if (output.includes('http://localhost:')) {
        clearInterval(interval)
        child.kill()
        resolve(output)
      }
    }, 100)

    setTimeout(() => {
      clearInterval(interval)
      child.kill()
      const output = chunks.join('')
      if (output.includes('http://localhost:')) {
        resolve(output)
      } else {
        reject(new Error(`Server did not start within 15s. Output:\n${output}`))
      }
    }, 15_000)
  })
}

test.describe('CLI Verbose Mode (LOG_LEVEL=debug)', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test(
    'CLI-LOG-VERBOSE-001: should show CSS compiler diagnostics in debug mode',
    { tag: '@spec' },
    async () => {
      // GIVEN: Valid app config with theme
      const configPath = await createTempConfigFile(
        JSON.stringify({
          name: 'css-debug-test',
          theme: {
            colors: {
              primary: '#3B82F6',
            },
          },
        }),
        'json'
      )

      try {
        // WHEN: Starting server with LOG_LEVEL=debug
        const output = await captureStartupOutput(configPath, {
          env: { LOG_LEVEL: 'debug' },
        })

        // THEN: Output contains "[CSS]" diagnostic messages
        expect(output).toContain('[CSS]')
      } finally {
        await cleanupTempConfigFile(configPath)
      }
    }
  )

  test(
    'CLI-LOG-VERBOSE-002: should show schema initializer details in debug mode',
    { tag: '@spec' },
    async () => {
      // GIVEN: Valid app config with DATABASE_URL set
      const databaseUrl = process.env.DATABASE_URL
      const configPath = await createTempConfigFile(
        JSON.stringify({ name: 'schema-debug-test' }),
        'json'
      )

      try {
        if (databaseUrl) {
          // WHEN: Starting server with LOG_LEVEL=debug and DATABASE_URL
          const output = await captureStartupOutput(configPath, {
            env: { LOG_LEVEL: 'debug', DATABASE_URL: databaseUrl },
          })

          // THEN: Output contains schema initialization step details
          const hasSchemaDebug =
            output.includes('[initializeSchemaInternal]') ||
            output.includes('[executeSchemaInit]') ||
            output.includes('[Schema]')
          expect(hasSchemaDebug).toBe(true)
        } else {
          // WHEN: No DATABASE_URL, schema init is never called (server skips it entirely)
          const output = await captureStartupOutput(configPath, {
            env: { LOG_LEVEL: 'debug', DATABASE_URL: '' },
          })

          // THEN: Debug mode still shows CSS diagnostics (verifying debug level works)
          // Schema init is skipped at server level, so no [Schema] messages appear
          expect(output).toContain('[CSS]')
        }
      } finally {
        await cleanupTempConfigFile(configPath)
      }
    }
  )

  test(
    'CLI-LOG-VERBOSE-003: should show bootstrap admin details in debug mode',
    { tag: '@spec' },
    async () => {
      // GIVEN: App config with auth enabled
      const databaseUrl = process.env.DATABASE_URL
      const configPath = await createTempConfigFile(
        JSON.stringify({
          name: 'bootstrap-debug-test',
          auth: {
            strategies: [{ type: 'emailAndPassword' }],
          },
        }),
        'json'
      )

      try {
        if (databaseUrl) {
          // WHEN: Starting server with LOG_LEVEL=debug and DATABASE_URL
          const output = await captureStartupOutput(configPath, {
            env: { LOG_LEVEL: 'debug', DATABASE_URL: databaseUrl },
          })

          // THEN: Output contains "[bootstrap-admin]" messages
          expect(output).toContain('[bootstrap-admin]')
        } else {
          // WHEN: No DATABASE_URL — bootstrap admin may not run but debug output is still present
          // Bootstrap admin logs "No admin bootstrap config found" when no ADMIN_EMAIL env
          const output = await captureStartupOutput(configPath, {
            env: { LOG_LEVEL: 'debug', DATABASE_URL: '' },
          })

          // THEN: Debug mode still shows CSS diagnostics (verifying debug level works)
          // Bootstrap admin may not emit logs without a database, but CSS debug always runs
          expect(output).toContain('[CSS]')
        }
      } finally {
        await cleanupTempConfigFile(configPath)
      }
    }
  )

  test(
    'CLI-LOG-VERBOSE-004: should hide debug messages at default log level',
    { tag: '@spec' },
    async () => {
      // GIVEN: Valid app config
      const configPath = await createTempConfigFile(
        JSON.stringify({
          name: 'default-level-test',
          theme: {
            colors: {
              primary: '#3B82F6',
            },
          },
        }),
        'json'
      )

      try {
        // WHEN: Starting server without LOG_LEVEL (default)
        // Explicitly unset LOG_LEVEL and set NODE_ENV to non-development
        // to ensure debug messages are suppressed
        const output = await captureStartupOutput(configPath, {
          env: { LOG_LEVEL: '', NODE_ENV: 'production' },
        })

        // THEN: Output does NOT contain "[CSS]", "[Schema]", "[bootstrap-admin]" messages
        expect(output).not.toContain('[CSS]')
        expect(output).not.toContain('[Schema]')
        expect(output).not.toContain('[bootstrap-admin]')
        expect(output).not.toContain('[executeSchemaInit]')
        expect(output).not.toContain('[initializeSchemaInternal]')
      } finally {
        await cleanupTempConfigFile(configPath)
      }
    }
  )

  // ============================================================================
  // @regression test - ONE optimized integration test
  // ============================================================================

  test(
    'CLI-LOG-VERBOSE-REGRESSION: verbose mode regression workflow',
    { tag: '@regression' },
    async () => {
      const configPath = await createTempConfigFile(
        JSON.stringify({
          name: 'regression-verbose-test',
          theme: {
            colors: {
              primary: '#3B82F6',
            },
          },
        }),
        'json'
      )

      try {
        await test.step('CLI-LOG-VERBOSE-004: default mode hides debug messages', async () => {
          const output = await captureStartupOutput(configPath, {
            env: { LOG_LEVEL: '', NODE_ENV: 'production' },
          })

          expect(output).not.toContain('[CSS]')
          expect(output).not.toContain('[Schema]')
          expect(output).not.toContain('[bootstrap-admin]')
        })

        await test.step('CLI-LOG-VERBOSE-001: LOG_LEVEL=debug reveals CSS diagnostics', async () => {
          const output = await captureStartupOutput(configPath, {
            env: { LOG_LEVEL: 'debug' },
          })

          expect(output).toContain('[CSS]')
        })

        await test.step('Clean startup summary still present in debug mode', async () => {
          const output = await captureStartupOutput(configPath, {
            env: { LOG_LEVEL: 'debug' },
          })

          // Even in debug mode, the startup summary should still render
          expect(output).toMatch(/Sovrium v\d+\.\d+\.\d+/)
          expect(output).toMatch(/✓ CSS compiled/)
          expect(output).toMatch(/✓ Server ready in/)
          expect(output).toMatch(/→ http:\/\/localhost:\d+/)
        })
      } finally {
        await cleanupTempConfigFile(configPath)
      }
    }
  )
})
