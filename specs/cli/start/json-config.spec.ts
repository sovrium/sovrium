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
 * E2E Tests for CLI Start Command with JSON Configuration
 *
 * Source: src/cli.ts
 * Domain: cli
 * Spec Count: 6
 *
 * JSON Config Behavior:
 * - Starts server from valid JSON configuration file
 * - Handles invalid JSON syntax errors
 * - Validates schema against AppEncoded type
 * - Reports file not found errors
 * - Supports .json file extension
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (5 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 */

test.describe('CLI Start Command - JSON Configuration', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test(
    'CLI-START-JSON-001: should start server with valid JSON config file',
    { tag: '@spec' },
    async ({ startCliServerWithConfig, page }) => {
      // GIVEN: Valid JSON configuration file with minimal app schema
      // WHEN: Starting server with JSON config via CLI (handled by fixture)
      const server = await startCliServerWithConfig({
        format: 'json',
        config: {
          name: 'test-app-from-json',
          description: 'App loaded from JSON config file',
        },
      })

      // THEN: Server starts successfully and serves the app
      await page.goto(server.url)
      await expect(page.getByTestId('app-name-heading')).toHaveText('test-app-from-json')
      await expect(page.getByTestId('app-description')).toHaveText(
        'App loaded from JSON config file'
      )
    }
  )

  test(
    'CLI-START-JSON-002: should handle invalid JSON syntax with clear error message',
    { tag: '@spec' },
    async () => {
      // GIVEN: JSON file with syntax error (missing closing brace)
      const configPath = await createTempConfigFile(
        `{
  "name": "Test App",
  "description": "Missing closing brace"
`, // Intentionally invalid JSON
        'json'
      )

      try {
        // WHEN: Attempting to start server with invalid JSON
        const result = await captureCliOutput(configPath)

        // THEN: CLI displays error message about invalid JSON
        expect(result.output).toContain('Failed to parse JSON file')
        expect(result.output).toContain(configPath)
      } finally {
        await cleanupTempConfigFile(configPath)
      }
    }
  )

  test(
    'CLI-START-JSON-003: should validate JSON schema and report validation errors',
    { tag: '@spec' },
    async () => {
      // GIVEN: Valid JSON but invalid schema (missing required 'name' field)
      const configPath = await createTempConfigFile(
        JSON.stringify({
          description: 'App without name field',
          // name field intentionally omitted (required by AppEncoded schema)
        }),
        'json'
      )

      try {
        // WHEN: Attempting to start server with invalid schema
        const result = await captureCliOutput(configPath)

        // THEN: CLI displays schema validation error
        expect(result.output).toContain('name')
        expect(result.output.toLowerCase()).toMatch(/required|missing|expected/)
      } finally {
        await cleanupTempConfigFile(configPath)
      }
    }
  )

  test(
    'CLI-START-JSON-004: should report file not found error with helpful message',
    { tag: '@spec' },
    async () => {
      // GIVEN: Non-existent JSON config file path
      const nonExistentPath = '/tmp/sovrium-nonexistent-config-12345.json'

      // WHEN: Attempting to start server with non-existent file
      const result = await captureCliOutput(nonExistentPath)

      // THEN: CLI displays file not found error with path and usage hint
      expect(result.output).toContain('File not found')
      expect(result.output).toContain(nonExistentPath)
      expect(result.output).toContain('Usage')
      expect(result.output).toContain('sovrium start')
    }
  )

  test(
    'CLI-START-JSON-005: should support JSON config with all app schema features',
    { tag: '@spec' },
    async ({ startCliServerWithConfig, page }) => {
      // GIVEN: Comprehensive JSON config with theme, pages, and metadata
      // WHEN: Starting server with comprehensive JSON config (handled by fixture)
      const server = await startCliServerWithConfig({
        format: 'json',
        config: {
          name: 'full-featured-app',
          description: 'App with all schema features',
          version: '1.2.3',
          theme: {
            colors: {
              primary: '#3B82F6',
              secondary: '#10B981',
            },
            fonts: {
              sans: {
                family: 'Inter',
                fallback: 'system-ui, sans-serif',
              },
            },
          },
          pages: [
            {
              name: 'home',
              path: '/',
              meta: {
                lang: 'en',
                title: 'Home Page',
                description: 'Welcome to our app',
              },
              sections: [
                {
                  type: 'h1',
                  children: ['Welcome to full-featured-app'],
                },
              ],
            },
          ],
        },
      })

      // THEN: Server applies all configuration correctly
      // Note: Custom pages bypass default layout, so app-name-heading/version-badge are NOT rendered
      await page.goto(server.url)
      await expect(page.locator('h1')).toHaveText('Welcome to full-featured-app')

      // Verify theme colors applied (check CSS variables)
      const root = page.locator('html')
      const primaryColor = await root.evaluate((el) =>
        getComputedStyle(el).getPropertyValue('--color-primary')
      )
      expect(primaryColor.trim()).toBe('#3B82F6')
    }
  )

  test(
    'CLI-START-JSON-006: should support JSON config with environment variable overrides',
    { tag: '@spec' },
    async ({ startCliServerWithConfig, page }) => {
      // GIVEN: JSON config file AND environment variables (PORT, HOSTNAME)
      // WHEN: Starting server with specific port via environment variable (handled by fixture)
      const server = await startCliServerWithConfig({
        format: 'json',
        config: {
          name: 'env-override-test',
          description: 'Testing environment variable integration',
        },
        port: 0, // Let Bun auto-select port
        hostname: 'localhost',
      })

      // THEN: Server respects environment variables and starts successfully
      await page.goto(server.url)
      await expect(page.getByTestId('app-name-heading')).toHaveText('env-override-test')

      // Verify server is accessible on the specified host
      expect(server.url).toContain('localhost')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test(
    'CLI-START-JSON-REGRESSION: user can start server from JSON config and navigate app',
    { tag: '@regression' },
    async ({ startCliServerWithConfig, page }) => {
      await test.step('Start server with multi-page JSON config', async () => {
        await startCliServerWithConfig({
          format: 'json',
          config: {
            name: 'multi-page-json-app',
            description: 'Testing complete JSON workflow',
            version: '2.0.0-beta',
            pages: [
              {
                name: 'home',
                path: '/',
                meta: {
                  lang: 'en',
                  title: 'Home',
                  description: 'Home page',
                },
                sections: [
                  {
                    type: 'h1',
                    children: ['Home Page'],
                  },
                  {
                    type: 'p',
                    children: ['Welcome to the app'],
                  },
                ],
              },
              {
                name: 'about',
                path: '/about',
                meta: {
                  lang: 'en',
                  title: 'About',
                  description: 'About page',
                },
                sections: [
                  {
                    type: 'h1',
                    children: ['About Us'],
                  },
                ],
              },
            ],
          },
        })
      })

      await test.step('Verify home page renders correctly', async () => {
        // Note: Custom pages bypass default layout - header elements not rendered
        await page.goto('/')
        await expect(page.locator('h1')).toHaveText('Home Page')
        await expect(page.locator('p')).toHaveText('Welcome to the app')
      })

      await test.step('Navigate to about page', async () => {
        await page.goto('/about')
        await expect(page.locator('h1')).toHaveText('About Us')
      })
    }
  )
})
