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
    async ({ page }) => {
      // GIVEN: Config file with .json extension containing valid JSON
      const jsonConfig = JSON.stringify(
        {
          name: 'JSON Format Test',
          description: 'Auto-detected as JSON',
        },
        null,
        2
      )
      const configPath = await createTempConfigFile(jsonConfig, 'json')

      try {
        // WHEN: Starting server with .json file (no explicit format flag)
        const result = await captureCliOutput(configPath, { waitForServer: true })

        // THEN: Server detects JSON format and starts successfully
        expect(result.output).toContain('Starting Sovrium server from CLI')
        expect(result.output).toContain('JSON Format Test')
        expect(result.output).toContain('Homepage: http://localhost:')

        // Verify server is accessible
        const match = result.output.match(/Homepage: http:\/\/localhost:(\d+)/)
        if (match) {
          const port = match[1]
          await page.goto(`http://localhost:${port}`)
          await expect(page.getByTestId('app-name-heading')).toHaveText('JSON Format Test')
        }

        // Cleanup
        result.process.kill('SIGKILL')
      } finally {
        await cleanupTempConfigFile(configPath)
      }
    }
  )

  test.fixme(
    'CLI-START-FORMAT-002: should auto-detect YAML format from .yaml extension',
    { tag: '@spec' },
    async ({ page }) => {
      // GIVEN: Config file with .yaml extension containing valid YAML
      const yamlConfig = `
name: YAML Format Test
description: Auto-detected as YAML from .yaml extension
`
      const configPath = await createTempConfigFile(yamlConfig, 'yaml')

      try {
        // WHEN: Starting server with .yaml file (no explicit format flag)
        const result = await captureCliOutput(configPath, { waitForServer: true })

        // THEN: Server detects YAML format and starts successfully
        expect(result.output).toContain('Starting Sovrium server from CLI')
        expect(result.output).toContain('YAML Format Test')
        expect(result.output).toContain('Homepage: http://localhost:')

        // Verify server is accessible
        const match = result.output.match(/Homepage: http:\/\/localhost:(\d+)/)
        if (match) {
          const port = match[1]
          await page.goto(`http://localhost:${port}`)
          await expect(page.getByTestId('app-name-heading')).toHaveText('YAML Format Test')
        }

        // Cleanup
        result.process.kill('SIGKILL')
      } finally {
        await cleanupTempConfigFile(configPath)
      }
    }
  )

  test.fixme(
    'CLI-START-FORMAT-003: should auto-detect YAML format from .yml extension',
    { tag: '@spec' },
    async ({ page }) => {
      // GIVEN: Config file with .yml extension containing valid YAML
      const yamlConfig = `
name: YML Format Test
description: Auto-detected as YAML from .yml extension
`
      const configPath = await createTempConfigFile(yamlConfig, 'yml')

      try {
        // WHEN: Starting server with .yml file (no explicit format flag)
        const result = await captureCliOutput(configPath, { waitForServer: true })

        // THEN: Server detects YAML format from .yml and starts successfully
        expect(result.output).toContain('Starting Sovrium server from CLI')
        expect(result.output).toContain('YML Format Test')
        expect(result.output).toContain('Homepage: http://localhost:')

        // Verify server is accessible
        const match = result.output.match(/Homepage: http:\/\/localhost:(\d+)/)
        if (match) {
          const port = match[1]
          await page.goto(`http://localhost:${port}`)
          await expect(page.getByTestId('app-name-heading')).toHaveText('YML Format Test')
        }

        // Cleanup
        result.process.kill('SIGKILL')
      } finally {
        await cleanupTempConfigFile(configPath)
      }
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
    async () => {
      // GIVEN: Config files with mixed case extensions (.JSON, .Yaml, .YML)
      const testCases = [
        {
          ext: 'JSON',
          content: JSON.stringify({ name: 'Uppercase JSON', description: 'Test' }),
        },
        {
          ext: 'Yaml',
          content: 'name: Mixed Case YAML\ndescription: Test\n',
        },
        {
          ext: 'YML',
          content: 'name: Uppercase YML\ndescription: Test\n',
        },
      ]

      for (const testCase of testCases) {
        const configPath = await createTempConfigFile(testCase.content, testCase.ext)

        try {
          // WHEN: Starting server with mixed case extension
          const result = await captureCliOutput(configPath, { waitForServer: true })

          // THEN: Server detects format case-insensitively and starts successfully
          expect(result.output).toContain('Starting Sovrium server from CLI')
          expect(result.output).toContain('Homepage: http://localhost:')

          // Cleanup
          result.process.kill('SIGKILL')
        } finally {
          await cleanupTempConfigFile(configPath)
        }
      }
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test.fixme(
    'CLI-START-FORMAT-006: user can start server with different config formats seamlessly',
    { tag: '@regression' },
    async ({ page }) => {
      const testConfigs: Array<{ format: string; ext: string; content: string; appName: string }> =
        []
      const processes: Array<{ kill: (signal: NodeJS.Signals) => boolean }> = []

      await test.step('Setup: Create config files in multiple formats', async () => {
        testConfigs.push(
          {
            format: 'JSON',
            ext: 'json',
            content: JSON.stringify({
              name: 'Multi-Format JSON App',
              description: 'JSON config test',
              version: '1.0.0',
            }),
            appName: 'Multi-Format JSON App',
          },
          {
            format: 'YAML',
            ext: 'yaml',
            content: `
name: Multi-Format YAML App
description: YAML config test
version: 2.0.0
`,
            appName: 'Multi-Format YAML App',
          },
          {
            format: 'YML',
            ext: 'yml',
            content: `
name: Multi-Format YML App
description: YML config test
version: 3.0.0
`,
            appName: 'Multi-Format YML App',
          }
        )
      })

      for (const config of testConfigs) {
        await test.step(`Test ${config.format} format detection and startup`, async () => {
          const configPath = await createTempConfigFile(config.content, config.ext)

          try {
            const result = await captureCliOutput(configPath, { waitForServer: true })
            processes.push(result.process)

            // Verify server started
            expect(result.output).toContain('Starting Sovrium server from CLI')
            expect(result.output).toContain(config.appName)

            // Extract port and verify app
            const match = result.output.match(/Homepage: http:\/\/localhost:(\d+)/)
            if (match) {
              const port = match[1]
              await page.goto(`http://localhost:${port}`)
              await expect(page.getByTestId('app-name-heading')).toHaveText(config.appName)
            }
          } finally {
            await cleanupTempConfigFile(configPath)
          }
        })
      }

      await test.step('Cleanup: Stop all servers', async () => {
        for (const process of processes) {
          process.kill('SIGKILL')
        }
      })
    }
  )
})
