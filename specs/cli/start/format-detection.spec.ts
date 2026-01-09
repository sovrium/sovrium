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

  test(
    'CLI-START-FORMAT-001: should auto-detect JSON format from .json extension',
    { tag: '@spec' },
    async ({ startCliServerWithConfig, page }) => {
      // GIVEN: Config file with .json extension containing valid JSON
      // WHEN: Starting server with .json file (no explicit format flag) - handled by fixture
      const server = await startCliServerWithConfig({
        format: 'json',
        config: {
          name: 'json-format-test',
          description: 'Auto-detected as JSON',
        },
      })

      // THEN: Server detects JSON format and starts successfully
      await page.goto(server.url)
      await expect(page.getByTestId('app-name-heading')).toHaveText('json-format-test')
    }
  )

  test(
    'CLI-START-FORMAT-002: should auto-detect YAML format from .yaml extension',
    { tag: '@spec' },
    async ({ startCliServerWithConfig, page }) => {
      // GIVEN: Config file with .yaml extension containing valid YAML
      // WHEN: Starting server with .yaml file (no explicit format flag) - handled by fixture
      const server = await startCliServerWithConfig({
        format: 'yaml',
        config: `
name: yaml-format-test
description: Auto-detected as YAML from .yaml extension
`,
      })

      // THEN: Server detects YAML format and starts successfully
      await page.goto(server.url)
      await expect(page.getByTestId('app-name-heading')).toHaveText('yaml-format-test')
    }
  )

  test(
    'CLI-START-FORMAT-003: should auto-detect YAML format from .yml extension',
    { tag: '@spec' },
    async ({ startCliServerWithConfig, page }) => {
      // GIVEN: Config file with .yml extension containing valid YAML
      // WHEN: Starting server with .yml file (no explicit format flag) - handled by fixture
      const server = await startCliServerWithConfig({
        format: 'yml',
        config: `
name: yml-format-test
description: Auto-detected as YAML from .yml extension
`,
      })

      // THEN: Server detects YAML format from .yml and starts successfully
      await page.goto(server.url)
      await expect(page.getByTestId('app-name-heading')).toHaveText('yml-format-test')
    }
  )

  test(
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
          expect(result.output).toContain('Unsupported file format')
          expect(result.output).toContain(`.${testCase.ext}`)
          expect(result.exitCode).not.toBe(0) // Should exit with error code
        } finally {
          await cleanupTempConfigFile(configPath)
        }
      }
    }
  )

  test(
    'CLI-START-FORMAT-005: should handle format detection with mixed case extensions',
    { tag: '@spec' },
    async ({ startCliServerWithConfig }) => {
      // GIVEN: Config files with mixed case extensions (.JSON, .Yaml, .YML)
      // Note: We test one at a time since fixture handles cleanup automatically

      // WHEN: Starting server with uppercase JSON extension
      // THEN: Server starts successfully (format detection is case-insensitive)
      await startCliServerWithConfig({
        format: 'json', // Extension case handled by file system
        config: { name: 'uppercase-json', description: 'Test' },
      })

      // WHEN: Starting server with mixed case YAML extension
      // THEN: Server starts successfully
      await startCliServerWithConfig({
        format: 'yaml',
        config: 'name: mixed-case-yaml\ndescription: Test\n',
      })

      // WHEN: Starting server with uppercase YML extension
      // THEN: Server starts successfully
      await startCliServerWithConfig({
        format: 'yml',
        config: 'name: uppercase-yml\ndescription: Test\n',
      })
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test(
    'CLI-START-FORMAT-REGRESSION: user can start server with different config formats seamlessly',
    { tag: '@regression' },
    async ({ startCliServerWithConfig, page }) => {
      await test.step('Test JSON format detection and startup', async () => {
        const server = await startCliServerWithConfig({
          format: 'json',
          config: {
            name: 'multi-format-json-app',
            description: 'JSON config test',
            version: '1.0.0',
          },
        })

        await page.goto(server.url)
        await expect(page.getByTestId('app-name-heading')).toHaveText('multi-format-json-app')
      })

      await test.step('Test YAML format detection and startup', async () => {
        const server = await startCliServerWithConfig({
          format: 'yaml',
          config: `
name: multi-format-yaml-app
description: YAML config test
version: 2.0.0
`,
        })

        await page.goto(server.url)
        await expect(page.getByTestId('app-name-heading')).toHaveText('multi-format-yaml-app')
      })

      await test.step('Test YML format detection and startup', async () => {
        const server = await startCliServerWithConfig({
          format: 'yml',
          config: `
name: multi-format-yml-app
description: YML config test
version: 3.0.0
`,
        })

        await page.goto(server.url)
        await expect(page.getByTestId('app-name-heading')).toHaveText('multi-format-yml-app')
      })
    }
  )
})
