/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { spawn } from 'node:child_process'
import { test, expect, createTempConfigFile, cleanupTempConfigFile } from '@/specs/fixtures'

/**
 * E2E Tests for CLI Startup Output Format
 *
 * Source: src/infrastructure/server/server.ts, src/infrastructure/logging/logger.ts
 * Domain: cli
 * User Story: US-CLI-LOGGING-001
 * Spec Count: 7
 *
 * Validates that the startup output follows clean structured format:
 *   Sovrium v{version}
 *   ✓ CSS compiled (XX KB)
 *   ✓ Server ready in XXms
 *   → http://localhost:XXXX
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (7 tests) - Exhaustive coverage
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
      env: { ...process.env, PORT: '0', ...options?.env },
      stdio: 'pipe',
      cwd: process.cwd(),
    })

    const chunks: string[] = []
    child.stdout?.on('data', (data: Buffer) => chunks.push(data.toString()))
    child.stderr?.on('data', (data: Buffer) => chunks.push(data.toString()))

    child.on('error', (error) => {
      reject(new Error(`Failed to start CLI: ${error.message}`))
    })

    // Poll for server URL (indicates startup complete)
    const interval = setInterval(() => {
      const output = chunks.join('')
      if (output.includes('http://localhost:')) {
        clearInterval(interval)
        child.kill()
        resolve(output)
      }
    }, 100)

    // Timeout safety
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

test.describe('CLI Startup Output Format', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test(
    'CLI-LOG-OUTPUT-001: should display Sovrium version header on startup',
    { tag: '@spec' },
    async () => {
      // GIVEN: Valid minimal app config
      const configPath = await createTempConfigFile(
        JSON.stringify({ name: 'version-header-test' }),
        'json'
      )

      try {
        // WHEN: Starting server via CLI
        const output = await captureStartupOutput(configPath)

        // THEN: Output contains "Sovrium v{version}" header
        expect(output).toMatch(/Sovrium v\d+\.\d+\.\d+/)
      } finally {
        await cleanupTempConfigFile(configPath)
      }
    }
  )

  test(
    'CLI-LOG-OUTPUT-002: should show only completed phases, not internal steps',
    { tag: '@spec' },
    async () => {
      // GIVEN: Valid app config
      const configPath = await createTempConfigFile(
        JSON.stringify({ name: 'no-debug-test' }),
        'json'
      )

      try {
        // WHEN: Starting server (default log level)
        const output = await captureStartupOutput(configPath)

        // THEN: No "[Schema]", "[CSS]", "[Migrations]" debug messages in output
        expect(output).not.toContain('[Schema]')
        expect(output).not.toContain('[CSS]')
        expect(output).not.toContain('[Migrations]')
        expect(output).not.toContain('[bootstrap-admin]')
        expect(output).not.toContain('[executeSchemaInit]')
      } finally {
        await cleanupTempConfigFile(configPath)
      }
    }
  )

  test(
    'CLI-LOG-OUTPUT-003: should display human-readable startup time',
    { tag: '@spec' },
    async () => {
      // GIVEN: Valid minimal app config
      const configPath = await createTempConfigFile(JSON.stringify({ name: 'timing-test' }), 'json')

      try {
        // WHEN: Starting server via CLI
        const output = await captureStartupOutput(configPath)

        // THEN: Output contains "Server ready in" with ms or s format
        expect(output).toMatch(/Server ready in \d+(\.\d+)?(ms|s)/)
      } finally {
        await cleanupTempConfigFile(configPath)
      }
    }
  )

  test(
    'CLI-LOG-OUTPUT-004: should show server URL with arrow prefix',
    { tag: '@spec' },
    async () => {
      // GIVEN: Valid minimal app config
      const configPath = await createTempConfigFile(
        JSON.stringify({ name: 'url-format-test' }),
        'json'
      )

      try {
        // WHEN: Starting server via CLI
        const output = await captureStartupOutput(configPath)

        // THEN: Output contains "→ http://localhost:{port}"
        expect(output).toMatch(/→ http:\/\/localhost:\d+/)
      } finally {
        await cleanupTempConfigFile(configPath)
      }
    }
  )

  test('CLI-LOG-OUTPUT-005: should show CSS size in KB', { tag: '@spec' }, async () => {
    // GIVEN: Valid app config with theme
    const configPath = await createTempConfigFile(
      JSON.stringify({
        name: 'css-size-test',
        theme: {
          colors: {
            primary: '#3B82F6',
            secondary: '#10B981',
          },
        },
      }),
      'json'
    )

    try {
      // WHEN: Starting server via CLI
      const output = await captureStartupOutput(configPath)

      // THEN: Output contains "CSS compiled ({N} KB)"
      expect(output).toMatch(/CSS compiled \(\d+ KB\)/)
    } finally {
      await cleanupTempConfigFile(configPath)
    }
  })

  test(
    'CLI-LOG-OUTPUT-006: should show minimal phases for app without DB or auth',
    { tag: '@spec' },
    async () => {
      // GIVEN: Minimal app config (no database, no auth)
      const configPath = await createTempConfigFile(
        JSON.stringify({ name: 'minimal-phases-test' }),
        'json'
      )

      try {
        // WHEN: Starting server via CLI
        const output = await captureStartupOutput(configPath)

        // THEN: Output shows CSS and Server phases (with ✓ prefix)
        expect(output).toMatch(/✓ CSS compiled/)
        expect(output).toMatch(/✓ Server ready in/)

        // THEN: No database connected phase (no DATABASE_URL)
        expect(output).not.toContain('Database connected')
      } finally {
        await cleanupTempConfigFile(configPath)
      }
    }
  )

  test(
    'CLI-LOG-OUTPUT-007: should show database phase when DATABASE_URL is set',
    { tag: '@spec' },
    async () => {
      // GIVEN: App config with DATABASE_URL set
      const databaseUrl = process.env.DATABASE_URL
      const configPath = await createTempConfigFile(
        JSON.stringify({ name: 'db-phase-test' }),
        'json'
      )

      try {
        if (databaseUrl) {
          // WHEN: Starting server via CLI with DATABASE_URL available
          const output = await captureStartupOutput(configPath, {
            env: { DATABASE_URL: databaseUrl },
          })

          // THEN: Output includes "Database connected" success phase
          expect(output).toMatch(/✓ Database connected/)
          // And no DATABASE_URL warning
          expect(output).not.toContain('DATABASE_URL not set')
        } else {
          // WHEN: No DATABASE_URL available, verify the warning path works correctly
          const output = await captureStartupOutput(configPath, {
            env: { DATABASE_URL: '' },
          })

          // THEN: Output shows the DATABASE_URL warning (skip phase)
          expect(output).toContain('DATABASE_URL not set (skipping database)')
          // And no "Database connected" success phase
          expect(output).not.toContain('Database connected')
        }
      } finally {
        await cleanupTempConfigFile(configPath)
      }
    }
  )

  // ============================================================================
  // @regression test - ONE optimized integration test
  // ============================================================================

  test(
    'CLI-LOG-OUTPUT-REGRESSION: startup output regression workflow',
    { tag: '@regression' },
    async () => {
      const configPath = await createTempConfigFile(
        JSON.stringify({
          name: 'regression-output-test',
          theme: {
            colors: {
              primary: '#3B82F6',
            },
          },
        }),
        'json'
      )

      try {
        const output = await captureStartupOutput(configPath)

        await test.step('CLI-LOG-OUTPUT-001: version header present', async () => {
          expect(output).toMatch(/Sovrium v\d+\.\d+\.\d+/)
        })

        await test.step('CLI-LOG-OUTPUT-002: no debug-level noise in default output', async () => {
          expect(output).not.toContain('[Schema]')
          expect(output).not.toContain('[CSS]')
          expect(output).not.toContain('[bootstrap-admin]')
        })

        await test.step('CLI-LOG-OUTPUT-003: human-readable startup time', async () => {
          expect(output).toMatch(/Server ready in \d+(\.\d+)?(ms|s)/)
        })

        await test.step('CLI-LOG-OUTPUT-004: URL with → prefix', async () => {
          expect(output).toMatch(/→ http:\/\/localhost:\d+/)
        })

        await test.step('CLI-LOG-OUTPUT-005: CSS size in KB', async () => {
          expect(output).toMatch(/CSS compiled \(\d+ KB\)/)
        })

        await test.step('CLI-LOG-OUTPUT-006: phase lines use ✓ prefix', async () => {
          expect(output).toMatch(/✓ CSS compiled/)
          expect(output).toMatch(/✓ Server ready in/)
        })
      } finally {
        await cleanupTempConfigFile(configPath)
      }
    }
  )
})
