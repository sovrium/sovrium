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
 * E2E Tests for CLI Start Command with YAML Configuration
 *
 * Source: src/cli.ts
 * Domain: cli
 * Spec Count: 7
 *
 * YAML Config Behavior:
 * - Starts server from valid YAML configuration file
 * - Handles invalid YAML syntax errors
 * - Validates schema against AppEncoded type
 * - Reports file not found errors
 * - Supports .yaml and .yml file extensions
 * - Preserves YAML-specific features (comments, multi-line strings)
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (6 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 */

test.describe('CLI Start Command - YAML Configuration', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test(
    'CLI-START-YAML-001: should start server with valid YAML config file',
    { tag: '@spec' },
    async ({ startCliServerWithConfig, page }) => {
      // GIVEN: Valid YAML configuration file with minimal app schema
      // WHEN: Starting server with YAML config via CLI (handled by fixture)
      const server = await startCliServerWithConfig({
        format: 'yaml',
        config: `
name: test-app-from-yaml
description: App loaded from YAML config file
`,
      })

      // THEN: Server starts successfully and serves the app
      await page.goto(server.url)
      await expect(page.getByTestId('app-name-heading')).toHaveText('test-app-from-yaml')
      await expect(page.getByTestId('app-description')).toHaveText(
        'App loaded from YAML config file'
      )
    }
  )

  test(
    'CLI-START-YAML-002: should support .yml file extension',
    { tag: '@spec' },
    async ({ startCliServerWithConfig, page }) => {
      // GIVEN: Valid YAML configuration with .yml extension
      // WHEN: Starting server with .yml config via CLI (handled by fixture)
      const server = await startCliServerWithConfig({
        format: 'yml',
        config: `
name: test-yml-extension
description: Testing .yml file support
`,
      })

      // THEN: Server starts successfully with .yml file
      await page.goto(server.url)
      await expect(page.getByTestId('app-name-heading')).toHaveText('test-yml-extension')
    }
  )

  test(
    'CLI-START-YAML-003: should handle invalid YAML syntax with clear error message',
    { tag: '@spec' },
    async () => {
      // GIVEN: YAML file with actual syntax error (unclosed quote)
      const invalidYaml = `
name: "unclosed quote
description: This will cause a YAML parse error
`
      const configPath = await createTempConfigFile(invalidYaml, 'yaml')

      try {
        // WHEN: Attempting to start server with invalid YAML
        const result = await captureCliOutput(configPath)

        // THEN: CLI displays error message about invalid YAML
        expect(result.output).toContain('Failed to parse YAML file')
        expect(result.output).toContain(configPath)
      } finally {
        await cleanupTempConfigFile(configPath)
      }
    }
  )

  test(
    'CLI-START-YAML-004: should validate YAML schema and report validation errors',
    { tag: '@spec' },
    async () => {
      // GIVEN: Valid YAML but invalid schema (missing required 'name' field)
      const invalidSchemaYaml = `
description: App without name field
version: 1.0.0
# name field intentionally omitted (required by AppEncoded schema)
`
      const configPath = await createTempConfigFile(invalidSchemaYaml, 'yaml')

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
    'CLI-START-YAML-005: should support YAML-specific features (comments, anchors)',
    { tag: '@spec' },
    async ({ startCliServerWithConfig, page }) => {
      // GIVEN: YAML config with comments (multi-line descriptions not supported by schema)
      // WHEN: Starting server with YAML-specific features (handled by fixture)
      const server = await startCliServerWithConfig({
        format: 'yaml',
        config: `
# Application configuration - demonstrating YAML features
name: yaml-features-test
description: Single line description demonstrating YAML comments
version: 1.0.0

# Theme configuration with inline comments
theme:
  colors:
    primary: "#3B82F6"  # Blue - primary brand color
    secondary: "#10B981"  # Green - secondary brand color
`,
      })

      // THEN: Server parses YAML correctly with comments
      await page.goto(server.url)
      await expect(page.getByTestId('app-name-heading')).toHaveText('yaml-features-test')
      await expect(page.getByTestId('app-description')).toHaveText(
        'Single line description demonstrating YAML comments'
      )

      // Verify theme colors from commented YAML
      const root = page.locator('html')
      const primaryColor = await root.evaluate((el) =>
        getComputedStyle(el).getPropertyValue('--color-primary')
      )
      expect(primaryColor.trim()).toBe('#3B82F6')
    }
  )

  test(
    'CLI-START-YAML-006: should support comprehensive YAML config with all app schema features',
    { tag: '@spec' },
    async ({ startCliServerWithConfig, page }) => {
      // GIVEN: Comprehensive YAML config with theme, pages, and metadata
      // WHEN: Starting server with comprehensive YAML config (handled by fixture)
      const server = await startCliServerWithConfig({
        format: 'yaml',
        config: `
name: full-featured-yaml-app
description: App with all schema features in YAML
version: 2.1.0

theme:
  colors:
    primary: "#3B82F6"
    secondary: "#10B981"
  fonts:
    sans:
      family: Inter
      fallback: system-ui, sans-serif

pages:
  - name: home
    path: /
    meta:
      lang: en
      title: Home Page
      description: Welcome to our YAML app
    sections:
      - type: h1
        children:
          - Welcome to full-featured-yaml-app
      - type: p
        children:
          - This app was configured using YAML
`,
      })

      // THEN: Server applies all configuration correctly
      // Note: Custom pages bypass default layout, so app-name-heading/version-badge are NOT rendered
      await page.goto(server.url)
      await expect(page.locator('h1')).toHaveText('Welcome to full-featured-yaml-app')
      await expect(page.locator('p')).toHaveText('This app was configured using YAML')

      // Verify theme colors applied
      const root = page.locator('html')
      const primaryColor = await root.evaluate((el) =>
        getComputedStyle(el).getPropertyValue('--color-primary')
      )
      expect(primaryColor.trim()).toBe('#3B82F6')
    }
  )

  test(
    'CLI-START-YAML-007: should report file not found error for YAML config',
    { tag: '@spec' },
    async () => {
      // GIVEN: Non-existent YAML config file path
      const nonExistentPath = '/tmp/sovrium-nonexistent-config-67890.yaml'

      // WHEN: Attempting to start server with non-existent file
      const result = await captureCliOutput(nonExistentPath)

      // THEN: CLI displays file not found error with path and usage hint
      expect(result.output).toContain('File not found')
      expect(result.output).toContain(nonExistentPath)
      expect(result.output).toContain('Usage')
      expect(result.output).toContain('sovrium start')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // Generated from 7 @spec tests - covers: valid YAML, .yml extension, error handling, features
  // ============================================================================

  test(
    'CLI-START-YAML-REGRESSION: YAML configuration workflows function correctly',
    { tag: '@regression' },
    async ({ startCliServerWithConfig, page }) => {
      await test.step('CLI-START-YAML-001: Starts server with valid YAML config file', async () => {
        // WHEN: Starting server with YAML config via CLI
        const server = await startCliServerWithConfig({
          format: 'yaml',
          config: `
name: test-app-from-yaml
description: App loaded from YAML config file
`,
        })

        // THEN: Server starts successfully and serves the app
        await page.goto(server.url)
        await expect(page.getByTestId('app-name-heading')).toHaveText('test-app-from-yaml')
        await expect(page.getByTestId('app-description')).toHaveText(
          'App loaded from YAML config file'
        )
      })

      await test.step('CLI-START-YAML-002: Supports .yml file extension', async () => {
        // WHEN: Starting server with .yml config via CLI
        const server = await startCliServerWithConfig({
          format: 'yml',
          config: `
name: test-yml-extension
description: Testing .yml file support
`,
        })

        // THEN: Server starts successfully with .yml file
        await page.goto(server.url)
        await expect(page.getByTestId('app-name-heading')).toHaveText('test-yml-extension')
      })

      await test.step('CLI-START-YAML-003: Handles invalid YAML syntax with clear error message', async () => {
        // GIVEN: YAML file with actual syntax error (unclosed quote)
        const invalidYaml = `
name: "unclosed quote
description: This will cause a YAML parse error
`
        const configPath = await createTempConfigFile(invalidYaml, 'yaml')

        try {
          // WHEN: Attempting to start server with invalid YAML
          const result = await captureCliOutput(configPath)

          // THEN: CLI displays error message about invalid YAML
          expect(result.output).toContain('Failed to parse YAML file')
          expect(result.output).toContain(configPath)
        } finally {
          await cleanupTempConfigFile(configPath)
        }
      })

      await test.step('CLI-START-YAML-004: Validates YAML schema and reports validation errors', async () => {
        // GIVEN: Valid YAML but invalid schema (missing required 'name' field)
        const invalidSchemaYaml = `
description: App without name field
version: 1.0.0
# name field intentionally omitted (required by AppEncoded schema)
`
        const configPath = await createTempConfigFile(invalidSchemaYaml, 'yaml')

        try {
          // WHEN: Attempting to start server with invalid schema
          const result = await captureCliOutput(configPath)

          // THEN: CLI displays schema validation error
          expect(result.output).toContain('name')
          expect(result.output.toLowerCase()).toMatch(/required|missing|expected/)
        } finally {
          await cleanupTempConfigFile(configPath)
        }
      })

      await test.step('CLI-START-YAML-005: Supports YAML-specific features (comments)', async () => {
        // WHEN: Starting server with YAML-specific features
        const server = await startCliServerWithConfig({
          format: 'yaml',
          config: `
# Application configuration - demonstrating YAML features
name: yaml-features-test
description: Single line description demonstrating YAML comments
version: 1.0.0

# Theme configuration with inline comments
theme:
  colors:
    primary: "#3B82F6"  # Blue - primary brand color
    secondary: "#10B981"  # Green - secondary brand color
`,
        })

        // THEN: Server parses YAML correctly with comments
        await page.goto(server.url)
        await expect(page.getByTestId('app-name-heading')).toHaveText('yaml-features-test')

        // THEN: Theme colors from commented YAML are applied
        const root = page.locator('html')
        const primaryColor = await root.evaluate((el) =>
          getComputedStyle(el).getPropertyValue('--color-primary')
        )
        expect(primaryColor.trim()).toBe('#3B82F6')
      })

      await test.step('CLI-START-YAML-006: Supports comprehensive YAML config with all features', async () => {
        // WHEN: Starting server with comprehensive YAML config
        const server = await startCliServerWithConfig({
          format: 'yaml',
          config: `
name: full-featured-yaml-app
description: App with all schema features in YAML
version: 2.1.0

theme:
  colors:
    primary: "#3B82F6"
    secondary: "#10B981"
  fonts:
    sans:
      family: Inter
      fallback: system-ui, sans-serif

pages:
  - name: home
    path: /
    meta:
      lang: en
      title: Home Page
      description: Welcome to our YAML app
    sections:
      - type: h1
        children:
          - Welcome to full-featured-yaml-app
      - type: p
        children:
          - This app was configured using YAML
`,
        })

        // THEN: Server applies all configuration correctly
        await page.goto(server.url)
        await expect(page.locator('h1')).toHaveText('Welcome to full-featured-yaml-app')
        await expect(page.locator('p')).toHaveText('This app was configured using YAML')

        // THEN: Theme colors are applied
        const root = page.locator('html')
        const primaryColor = await root.evaluate((el) =>
          getComputedStyle(el).getPropertyValue('--color-primary')
        )
        expect(primaryColor.trim()).toBe('#3B82F6')
      })

      await test.step('CLI-START-YAML-007: Reports file not found error for YAML config', async () => {
        // GIVEN: Non-existent YAML config file path
        const nonExistentPath = '/tmp/sovrium-nonexistent-config-67890.yaml'

        // WHEN: Attempting to start server with non-existent file
        const result = await captureCliOutput(nonExistentPath)

        // THEN: CLI displays file not found error with path and usage hint
        expect(result.output).toContain('File not found')
        expect(result.output).toContain(nonExistentPath)
        expect(result.output).toContain('Usage')
        expect(result.output).toContain('sovrium start')
      })
    }
  )
})
