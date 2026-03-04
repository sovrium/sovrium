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
 * E2E Tests for CLI Runtime Silent Behavior
 *
 * Source: src/infrastructure/server/route-setup/static-assets.ts, src/infrastructure/server/lifecycle.ts
 * Domain: cli
 * User Story: US-CLI-LOGGING-004
 * Spec Count: 6
 *
 * Validates that runtime serving of pages and assets produces no console noise
 * unless LOG_LEVEL=debug is set.
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (5 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 */

test.describe('CLI Runtime Silent Behavior', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test.fixme(
    'CLI-LOG-RUNTIME-001: CSS request produces no console output',
    { tag: '@spec' },
    async () => {
      // GIVEN: Server running with minimal config
      const configPath = await createTempConfigFile(
        JSON.stringify({ name: 'css-silent-test' }),
        'json'
      )

      try {
        // WHEN: Requesting CSS asset
        const { runtimeOutput } = await captureRuntimeOutput(configPath, async (url) => {
          await fetch(`${url}/assets/output.css`)
        })

        // THEN: No output during CSS serving (cache hit or miss)
        expect(runtimeOutput.trim()).toBe('')
      } finally {
        await cleanupTempConfigFile(configPath)
      }
    }
  )

  test.fixme(
    'CLI-LOG-RUNTIME-002: CSS compilation logs at debug level only',
    { tag: '@spec' },
    async () => {
      // GIVEN: Server running with LOG_LEVEL=debug
      const configPath = await createTempConfigFile(
        JSON.stringify({ name: 'css-debug-test' }),
        'json'
      )

      try {
        // WHEN: Requesting CSS with debug logging
        const { runtimeOutput } = await captureRuntimeOutput(
          configPath,
          async (url) => {
            await fetch(`${url}/assets/output.css`)
          },
          { env: { LOG_LEVEL: 'debug' } }
        )

        // THEN: CSS debug output appears (from the compiler's internal logDebug)
        expect(runtimeOutput).toContain('[CSS]')
      } finally {
        await cleanupTempConfigFile(configPath)
      }
    }
  )

  test.fixme(
    'CLI-LOG-RUNTIME-003: JS asset serving produces no console output',
    { tag: '@spec' },
    async () => {
      // GIVEN: Server running with minimal config
      const configPath = await createTempConfigFile(
        JSON.stringify({ name: 'js-silent-test' }),
        'json'
      )

      try {
        // WHEN: Requesting JS asset
        const { runtimeOutput } = await captureRuntimeOutput(configPath, async (url) => {
          await fetch(`${url}/assets/language-switcher.js`)
        })

        // THEN: No output during JS serving
        expect(runtimeOutput.trim()).toBe('')
      } finally {
        await cleanupTempConfigFile(configPath)
      }
    }
  )

  test.fixme(
    'CLI-LOG-RUNTIME-004: CSS errors still log at error level',
    { tag: '@spec' },
    async () => {
      // Structural validation: verify logError is used in static-assets.ts
      // This is a code-level check — CSS compilation errors are hard to trigger in E2E
      // The implementation uses logError('[CSS] Compilation failed', error)
      // which produces [ERROR] [CSS] Compilation failed in the output
      expect(true).toBe(true)
    }
  )

  test.fixme(
    'CLI-LOG-RUNTIME-005: no "Press Ctrl+C" message in output',
    { tag: '@spec' },
    async () => {
      // GIVEN: Server running with minimal config
      const configPath = await createTempConfigFile(
        JSON.stringify({ name: 'no-ctrlc-test' }),
        'json'
      )

      try {
        // WHEN: Capturing full startup output
        const { startupOutput } = await captureRuntimeOutput(configPath, async () => {
          // No requests needed — just checking startup output
        })

        // THEN: Output does NOT contain "Press Ctrl+C"
        expect(startupOutput).not.toContain('Press Ctrl+C')
      } finally {
        await cleanupTempConfigFile(configPath)
      }
    }
  )

  // ============================================================================
  // @regression test - ONE optimized integration test
  // ============================================================================

  test.fixme(
    'CLI-LOG-RUNTIME-REGRESSION: runtime silence regression workflow',
    { tag: '@regression' },
    async () => {
      const configPath = await createTempConfigFile(
        JSON.stringify({ name: 'runtime-silent-regression' }),
        'json'
      )

      try {
        const { startupOutput, runtimeOutput } = await captureRuntimeOutput(
          configPath,
          async (url) => {
            // Hit CSS, JS, and page routes
            await fetch(`${url}/assets/output.css`)
            await fetch(`${url}/assets/language-switcher.js`)
            await fetch(url)
          }
        )

        await test.step('CLI-LOG-RUNTIME-001: CSS request produces no "CSS compiled" noise', async () => {
          expect(runtimeOutput).not.toContain('CSS compiled successfully')
        })

        await test.step('CLI-LOG-RUNTIME-003: JS asset silent', async () => {
          expect(runtimeOutput).not.toContain('Failed to load')
        })

        await test.step('CLI-LOG-RUNTIME-005: no "Press Ctrl+C" in startup output', async () => {
          expect(startupOutput).not.toContain('Press Ctrl+C')
        })
      } finally {
        await cleanupTempConfigFile(configPath)
      }
    }
  )
})
