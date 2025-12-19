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

  test.fixme(
    'CLI-START-YAML-001: should start server with valid YAML config file',
    { tag: '@spec' },
    async ({ startCliServerWithConfig, page }) => {
      // GIVEN: Valid YAML configuration file with minimal app schema
      // WHEN: Starting server with YAML config via CLI (handled by fixture)
      const server = await startCliServerWithConfig({
        format: 'yaml',
        config: `
name: Test App from YAML
description: App loaded from YAML config file
`,
      })

      // THEN: Server starts successfully and serves the app
      await page.goto(server.url)
      await expect(page.getByTestId('app-name-heading')).toHaveText('Test App from YAML')
      await expect(page.getByTestId('app-description')).toHaveText(
        'App loaded from YAML config file'
      )
    }
  )

  test.fixme(
    'CLI-START-YAML-002: should support .yml file extension',
    { tag: '@spec' },
    async ({ startCliServerWithConfig, page }) => {
      // GIVEN: Valid YAML configuration with .yml extension
      // WHEN: Starting server with .yml config via CLI (handled by fixture)
      const server = await startCliServerWithConfig({
        format: 'yml',
        config: `
name: Test YML Extension
description: Testing .yml file support
`,
      })

      // THEN: Server starts successfully with .yml file
      await page.goto(server.url)
      await expect(page.getByTestId('app-name-heading')).toHaveText('Test YML Extension')
    }
  )

  test.fixme(
    'CLI-START-YAML-003: should handle invalid YAML syntax with clear error message',
    { tag: '@spec' },
    async () => {
      // GIVEN: YAML file with syntax error (invalid indentation)
      const invalidYaml = `
name: Test App
description:
  This is invalid YAML
    with broken indentation
  that should fail parsing
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

  test.fixme(
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

  test.fixme(
    'CLI-START-YAML-005: should support YAML-specific features (comments, multi-line strings)',
    { tag: '@spec' },
    async ({ startCliServerWithConfig, page }) => {
      // GIVEN: YAML config with comments and multi-line strings
      // WHEN: Starting server with YAML-specific features (handled by fixture)
      const server = await startCliServerWithConfig({
        format: 'yaml',
        config: `
# Application configuration
name: YAML Features Test

# Multi-line description using pipe operator
description: |
  This is a multi-line description
  that preserves line breaks
  and demonstrates YAML features

version: 1.0.0

# Theme configuration
theme:
  colors:
    primary: "#3B82F6"  # Blue
    secondary: "#10B981"  # Green
`,
      })

      // THEN: Server parses YAML correctly, preserving multi-line strings
      await page.goto(server.url)
      await expect(page.getByTestId('app-name-heading')).toHaveText('YAML Features Test')

      // Verify multi-line description is preserved
      const description = await page.getByTestId('app-description').textContent()
      expect(description).toContain('This is a multi-line description')
      expect(description).toContain('that preserves line breaks')
      expect(description).toContain('and demonstrates YAML features')
    }
  )

  test.fixme(
    'CLI-START-YAML-006: should support comprehensive YAML config with all app schema features',
    { tag: '@spec' },
    async ({ startCliServerWithConfig, page }) => {
      // GIVEN: Comprehensive YAML config with theme, pages, and metadata
      // WHEN: Starting server with comprehensive YAML config (handled by fixture)
      const server = await startCliServerWithConfig({
        format: 'yaml',
        config: `
name: Full Featured YAML App
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
          - Welcome to Full Featured YAML App
      - type: p
        children:
          - This app was configured using YAML
`,
      })

      // THEN: Server applies all configuration correctly
      await page.goto(server.url)
      await expect(page.getByTestId('app-name-heading')).toHaveText('Full Featured YAML App')
      await expect(page.getByTestId('app-version-badge')).toHaveText('2.1.0')
      await expect(page.locator('h1')).toHaveText('Welcome to Full Featured YAML App')
      await expect(page.locator('p')).toHaveText('This app was configured using YAML')

      // Verify theme colors applied
      const root = page.locator('html')
      const primaryColor = await root.evaluate((el) =>
        getComputedStyle(el).getPropertyValue('--color-primary')
      )
      expect(primaryColor.trim()).toBe('#3B82F6')
    }
  )

  test.fixme(
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
  // ============================================================================

  test.fixme(
    'CLI-START-YAML-008: user can start server from YAML config and navigate app',
    { tag: '@regression' },
    async ({ startCliServerWithConfig, page }) => {
      await test.step('Start server with multi-page YAML config', async () => {
        await startCliServerWithConfig({
          format: 'yaml',
          config: `
# Multi-page YAML application configuration
name: Multi-Page YAML App
description: Testing complete YAML workflow
version: 3.0.0-rc.1

# Page definitions
pages:
  # Home page
  - name: home
    path: /
    meta:
      lang: en
      title: Home
      description: Home page
    sections:
      - type: h1
        children:
          - Home Page
      - type: p
        children:
          - Welcome to the YAML-configured app

  # About page
  - name: about
    path: /about
    meta:
      lang: en
      title: About
      description: About page
    sections:
      - type: h1
        children:
          - About Us
      - type: p
        children:
          - This application demonstrates YAML configuration
`,
        })
      })

      await test.step('Verify home page renders correctly', async () => {
        await page.goto('/')
        await expect(page.getByTestId('app-name-heading')).toHaveText('Multi-Page YAML App')
        await expect(page.getByTestId('app-version-badge')).toHaveText('3.0.0-rc.1')
        await expect(page.locator('h1')).toHaveText('Home Page')
        await expect(page.locator('p')).toHaveText('Welcome to the YAML-configured app')
      })

      await test.step('Navigate to about page', async () => {
        await page.goto('/about')
        await expect(page.locator('h1')).toHaveText('About Us')
        await expect(page.locator('p')).toHaveText(
          'This application demonstrates YAML configuration'
        )
      })
    }
  )
})
