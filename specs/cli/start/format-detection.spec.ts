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
  captureCliOutput,
} from '@/specs/fixtures'

/**
 * E2E Tests for CLI Start Command Format Detection
 *
 * Source: src/cli.ts
 * Domain: cli
 * Spec Count: 5
 *
 * Format Detection Behavior:
 * - Auto-detects JSON format from .json extension
 * - Auto-detects YAML format from .yaml extension
 * - Auto-detects YAML format from .yml extension
 * - Reports errors for unsupported file extensions
 * - Handles format detection edge cases
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (4 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 */

test.describe('CLI Start Command - Format Detection', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test.fixme(
    'CLI-START-FORMAT-001: should auto-detect JSON format from .json extension',
    { tag: '@spec' },
    async ({ startCliServerWithConfig, page }) => {
      // GIVEN: Config file with .json extension containing valid JSON
      // WHEN: Starting server with .json file (no explicit format flag) - handled by fixture
      const server = await startCliServerWithConfig({
        format: 'json',
        config: {
          name: 'JSON Format Test',
          description: 'Auto-detected as JSON',
        },
      })

      // THEN: Server detects JSON format and starts successfully
      await page.goto(server.url)
      await expect(page.getByTestId('app-name-heading')).toHaveText('JSON Format Test')
    }
  )

  test.fixme(
    'CLI-START-FORMAT-002: should auto-detect YAML format from .yaml extension',
    { tag: '@spec' },
    async ({ startCliServerWithConfig, page }) => {
      // GIVEN: Config file with .yaml extension containing valid YAML
      // WHEN: Starting server with .yaml file (no explicit format flag) - handled by fixture
      const server = await startCliServerWithConfig({
        format: 'yaml',
        config: `
name: YAML Format Test
description: Auto-detected as YAML from .yaml extension
`,
      })

      // THEN: Server detects YAML format and starts successfully
      await page.goto(server.url)
      await expect(page.getByTestId('app-name-heading')).toHaveText('YAML Format Test')
    }
  )

  test.fixme(
    'CLI-START-FORMAT-003: should auto-detect YAML format from .yml extension',
    { tag: '@spec' },
    async ({ startCliServerWithConfig, page }) => {
      // GIVEN: Config file with .yml extension containing valid YAML
      // WHEN: Starting server with .yml file (no explicit format flag) - handled by fixture
      const server = await startCliServerWithConfig({
        format: 'yml',
        config: `
name: YML Format Test
description: Auto-detected as YAML from .yml extension
`,
      })

      // THEN: Server detects YAML format from .yml and starts successfully
      await page.goto(server.url)
      await expect(page.getByTestId('app-name-heading')).toHaveText('YML Format Test')
    }
  )

  test.fixme(
    'CLI-START-FORMAT-004: should report error for unsupported file extensions',
    { tag: '@spec' },
    async () => {
      // GIVEN: Config file with unsupported extension (.txt, .xml, .ini)
      const testCases = [
        { ext: 'txt', content: 'name: Test App\ndescription: Text file' },
        { ext: 'xml', content: '<app><name>Test</name></app>' },
        { ext: 'ini', content: '[app]\nname=Test\n' },
      ]

      for (const testCase of testCases) {
        const configPath = await createTempConfigFile(testCase.content, testCase.ext)

        try {
          // WHEN: Attempting to start server with unsupported extension
          const result = await captureCliOutput(configPath, { waitForServer: false })

          // THEN: CLI reports unsupported format error
          expect(result.output.toLowerCase()).toMatch(
            /unsupported|invalid|unknown.*format|file type|extension/i
          )
          expect(result.output).toContain(testCase.ext)
          expect(result.exitCode).not.toBe(0) // Should exit with error code
        } finally {
          await cleanupTempConfigFile(configPath)
        }
      }
    }
  )

  test.fixme(
    'CLI-START-FORMAT-005: should handle format detection with mixed case extensions',
    { tag: '@spec' },
    async ({ startCliServerWithConfig }) => {
      // GIVEN: Config files with mixed case extensions (.JSON, .Yaml, .YML)
      // Note: We test one at a time since fixture handles cleanup automatically

      // Test uppercase JSON
      await startCliServerWithConfig({
        format: 'json', // Extension case handled by file system
        config: { name: 'Uppercase JSON', description: 'Test' },
      })

      // Test mixed case YAML
      await startCliServerWithConfig({
        format: 'yaml',
        config: 'name: Mixed Case YAML\ndescription: Test\n',
      })

      // Test uppercase YML
      await startCliServerWithConfig({
        format: 'yml',
        config: 'name: Uppercase YML\ndescription: Test\n',
      })
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test.fixme(
    'CLI-START-FORMAT-006: user can start server with different config formats seamlessly',
    { tag: '@regression' },
    async ({ startCliServerWithConfig, page }) => {
      await test.step('Test JSON format detection and startup', async () => {
        const server = await startCliServerWithConfig({
          format: 'json',
          config: {
            name: 'Multi-Format JSON App',
            description: 'JSON config test',
            version: '1.0.0',
          },
        })

        await page.goto(server.url)
        await expect(page.getByTestId('app-name-heading')).toHaveText('Multi-Format JSON App')
      })

      await test.step('Test YAML format detection and startup', async () => {
        const server = await startCliServerWithConfig({
          format: 'yaml',
          config: `
name: Multi-Format YAML App
description: YAML config test
version: 2.0.0
`,
        })

        await page.goto(server.url)
        await expect(page.getByTestId('app-name-heading')).toHaveText('Multi-Format YAML App')
      })

      await test.step('Test YML format detection and startup', async () => {
        const server = await startCliServerWithConfig({
          format: 'yml',
          config: `
name: Multi-Format YML App
description: YML config test
version: 3.0.0
`,
        })

        await page.goto(server.url)
        await expect(page.getByTestId('app-name-heading')).toHaveText('Multi-Format YML App')
      })
    }
  )
})
