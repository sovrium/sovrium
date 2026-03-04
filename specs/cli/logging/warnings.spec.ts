/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { spawn } from 'node:child_process'
import { test, expect, createTempConfigFile, cleanupTempConfigFile } from '@/specs/fixtures'

/**
 * E2E Tests for CLI Warning Display
 *
 * Source: src/infrastructure/server/server.ts, src/infrastructure/email/email-config.ts
 * Domain: cli
 * User Story: US-CLI-LOGGING-002
 * Spec Count: 3
 *
 * Validates that warnings are displayed cleanly in startup output:
 *   ⚠ SMTP not configured (using Mailpit at 127.0.0.1:1025)
 *   ⚠ DATABASE_URL not set (skipping database)
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (3 tests) - Exhaustive coverage
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

test.describe('CLI Warning Display', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test(
    'CLI-LOG-WARNINGS-001: should show SMTP warning with ⚠ prefix when not configured',
    { tag: '@spec' },
    async () => {
      // GIVEN: App config with auth enabled but no SMTP_HOST
      // SMTP warning only appears when app.auth is configured
      const configPath = await createTempConfigFile(
        JSON.stringify({
          name: 'smtp-warning-test',
          auth: {
            strategies: [{ type: 'emailAndPassword' }],
          },
        }),
        'json'
      )

      try {
        // WHEN: Starting server via CLI without SMTP_HOST env var
        const output = await captureStartupOutput(configPath, {
          env: { SMTP_HOST: '' },
        })

        // THEN: Output contains "⚠ SMTP not configured" with Mailpit fallback info
        expect(output).toContain('SMTP not configured (using Mailpit at 127.0.0.1:1025)')
        expect(output).toContain('\u26A0')
      } finally {
        await cleanupTempConfigFile(configPath)
      }
    }
  )

  test(
    'CLI-LOG-WARNINGS-002: should show DATABASE_URL warning when not set',
    { tag: '@spec' },
    async () => {
      // GIVEN: App config without DATABASE_URL environment variable
      const configPath = await createTempConfigFile(
        JSON.stringify({ name: 'db-warning-test' }),
        'json'
      )

      try {
        // WHEN: Starting server via CLI without DATABASE_URL
        // Explicitly unset DATABASE_URL to ensure warning appears
        const output = await captureStartupOutput(configPath, {
          env: { DATABASE_URL: '' },
        })

        // THEN: Output contains "⚠ DATABASE_URL not set (skipping database)"
        expect(output).toContain('DATABASE_URL not set (skipping database)')
        expect(output).toContain('\u26A0')
      } finally {
        await cleanupTempConfigFile(configPath)
      }
    }
  )

  test(
    'CLI-LOG-WARNINGS-003: should display warnings before success phases',
    { tag: '@spec' },
    async () => {
      // GIVEN: App config that triggers both warnings and success phases
      // Auth enabled (triggers SMTP warning) + no DATABASE_URL (triggers DB warning)
      const configPath = await createTempConfigFile(
        JSON.stringify({
          name: 'warning-order-test',
          auth: {
            strategies: [{ type: 'emailAndPassword' }],
          },
        }),
        'json'
      )

      try {
        // WHEN: Starting server via CLI
        const output = await captureStartupOutput(configPath, {
          env: { DATABASE_URL: '', SMTP_HOST: '' },
        })

        // THEN: All ⚠ lines appear before all ✓ lines in output
        // Find positions of warning and success markers
        const warningLines: number[] = []
        const successLines: number[] = []
        const lines = output.split('\n')

        lines.forEach((line, index) => {
          if (line.includes('\u26A0')) {
            warningLines.push(index)
          }
          if (line.includes('\u2713')) {
            successLines.push(index)
          }
        })

        // There should be at least one warning and one success
        expect(warningLines.length).toBeGreaterThan(0)
        expect(successLines.length).toBeGreaterThan(0)

        // All warnings should come before all successes
        const lastWarningLine = Math.max(...warningLines)
        const firstSuccessLine = Math.min(...successLines)
        expect(lastWarningLine).toBeLessThan(firstSuccessLine)
      } finally {
        await cleanupTempConfigFile(configPath)
      }
    }
  )

  // ============================================================================
  // @regression test - ONE optimized integration test
  // ============================================================================

  test(
    'CLI-LOG-WARNINGS-REGRESSION: warning display regression workflow',
    { tag: '@regression' },
    async () => {
      // GIVEN: App config with auth (triggers SMTP warning) and no DATABASE_URL
      const configPath = await createTempConfigFile(
        JSON.stringify({
          name: 'regression-warnings-test',
          auth: {
            strategies: [{ type: 'emailAndPassword' }],
          },
        }),
        'json'
      )

      try {
        const output = await captureStartupOutput(configPath, {
          env: { DATABASE_URL: '', SMTP_HOST: '' },
        })

        await test.step('CLI-LOG-WARNINGS-001: SMTP warning with ⚠ prefix and Mailpit info', async () => {
          expect(output).toContain('SMTP not configured (using Mailpit at 127.0.0.1:1025)')
        })

        await test.step('CLI-LOG-WARNINGS-002: DATABASE_URL warning present', async () => {
          expect(output).toContain('DATABASE_URL not set (skipping database)')
        })

        await test.step('CLI-LOG-WARNINGS-003: warnings appear before success phases', async () => {
          const lines = output.split('\n')
          const warningIndices: number[] = []
          const successIndices: number[] = []

          lines.forEach((line, index) => {
            if (line.includes('\u26A0')) warningIndices.push(index)
            if (line.includes('\u2713')) successIndices.push(index)
          })

          expect(warningIndices.length).toBeGreaterThan(0)
          expect(successIndices.length).toBeGreaterThan(0)
          expect(Math.max(...warningIndices)).toBeLessThan(Math.min(...successIndices))
        })

        await test.step('No duplicate warnings in output', async () => {
          const smtpMatches = output.match(/SMTP not configured/g)
          const dbMatches = output.match(/DATABASE_URL not set/g)
          expect(smtpMatches?.length).toBe(1)
          expect(dbMatches?.length).toBe(1)
        })

        await test.step('Structured order: header → warnings → successes → URL', async () => {
          const lines = output.split('\n')
          let headerIdx = -1
          let firstWarningIdx = -1
          let firstSuccessIdx = -1
          let urlIdx = -1

          lines.forEach((line, index) => {
            if (line.match(/Sovrium v\d/) && headerIdx === -1) headerIdx = index
            if (line.includes('\u26A0') && firstWarningIdx === -1) firstWarningIdx = index
            if (line.includes('\u2713') && firstSuccessIdx === -1) firstSuccessIdx = index
            if (line.includes('\u2192 http://localhost:') && urlIdx === -1) urlIdx = index
          })

          expect(headerIdx).toBeGreaterThanOrEqual(0)
          expect(firstWarningIdx).toBeGreaterThan(headerIdx)
          expect(firstSuccessIdx).toBeGreaterThan(firstWarningIdx)
          expect(urlIdx).toBeGreaterThan(firstSuccessIdx)
        })
      } finally {
        await cleanupTempConfigFile(configPath)
      }
    }
  )
})
