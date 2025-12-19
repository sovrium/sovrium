/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { start } from '@/index'
import { test, expect } from '@/specs/fixtures'
import type { AppEncoded } from '@/domain/models/app'

/**
 * E2E Tests for Programmatic API - start() Function
 *
 * Source: src/index.ts (start function)
 * Domain: package
 * Spec Count: 7
 *
 * Programmatic API Behavior:
 * - Starts server from JavaScript/TypeScript configuration object
 * - Returns Promise-based server interface (url, stop)
 * - Handles custom port and hostname options
 * - Validates schema using Effect Schema
 * - Provides graceful shutdown capability
 * - Different from CLI (no file loading, direct object input)
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (6 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 */

test.describe('Programmatic API - start()', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test.fixme(
    'PACKAGE-START-001: should start server with minimal config object',
    { tag: '@spec' },
    async ({ page }) => {
      // GIVEN: Minimal app configuration object (no file, direct TypeScript)
      const app: AppEncoded = {
        name: 'Programmatic Test App',
        description: 'Testing TypeScript API',
      }

      // WHEN: Starting server programmatically
      const server = await start(app, { port: 0 }) // Auto-select port

      try {
        // THEN: Server returns interface with url and stop method
        expect(server.url).toMatch(/^http:\/\/localhost:\d+$/)
        expect(typeof server.stop).toBe('function')

        // THEN: Server serves the application
        await page.goto(server.url)
        await expect(page.getByTestId('app-name-heading')).toHaveText('Programmatic Test App')
        await expect(page.getByTestId('app-description')).toHaveText('Testing TypeScript API')
      } finally {
        // Cleanup: Stop server
        await server.stop()
      }
    }
  )

  test.fixme(
    'PACKAGE-START-002: should support custom port option',
    { tag: '@spec' },
    async ({ page }) => {
      // GIVEN: App config with custom port via options object
      const app: AppEncoded = {
        name: 'Custom Port App',
        description: 'Testing custom port',
      }

      // WHEN: Starting server with custom port (auto-select via port 0)
      const server = await start(app, { port: 0 })

      try {
        // THEN: Server starts on specified port
        const portMatch = server.url.match(/:(\d+)$/)
        expect(portMatch).toBeTruthy()
        const port = parseInt(portMatch![1]!, 10)
        expect(port).toBeGreaterThan(0)
        expect(port).toBeLessThanOrEqual(65_535)

        // THEN: Server is accessible on the port
        await page.goto(server.url)
        await expect(page.getByTestId('app-name-heading')).toHaveText('Custom Port App')
      } finally {
        await server.stop()
      }
    }
  )

  test.fixme(
    'PACKAGE-START-003: should support custom hostname option',
    { tag: '@spec' },
    async ({ page }) => {
      // GIVEN: App config with custom hostname
      const app: AppEncoded = {
        name: 'Custom Host App',
        description: 'Testing custom hostname',
      }

      // WHEN: Starting server with localhost hostname
      const server = await start(app, { port: 0, hostname: 'localhost' })

      try {
        // THEN: Server URL contains specified hostname
        expect(server.url).toContain('localhost')

        // THEN: Server is accessible on the hostname
        await page.goto(server.url)
        await expect(page.getByTestId('app-name-heading')).toHaveText('Custom Host App')
      } finally {
        await server.stop()
      }
    }
  )

  test.fixme(
    'PACKAGE-START-004: should validate schema and reject invalid config',
    { tag: '@spec' },
    async () => {
      // GIVEN: Invalid app config (missing required 'name' field)
      const invalidApp = {
        description: 'App without name',
        // name field intentionally omitted
      } as unknown as AppEncoded

      // WHEN: Attempting to start server with invalid config
      // THEN: Promise rejects with validation error
      await expect(start(invalidApp)).rejects.toThrow()
    }
  )

  test.fixme(
    'PACKAGE-START-005: should provide working stop() method for graceful shutdown',
    { tag: '@spec' },
    async ({ page }) => {
      // GIVEN: Running server
      const app: AppEncoded = {
        name: 'Shutdown Test App',
        description: 'Testing graceful shutdown',
      }

      const server = await start(app, { port: 0 })

      // Verify server is running
      await page.goto(server.url)
      await expect(page.getByTestId('app-name-heading')).toHaveText('Shutdown Test App')

      // WHEN: Calling stop() method
      await server.stop()

      // THEN: Server is no longer accessible
      await expect(page.goto(server.url)).rejects.toThrow()
    }
  )

  test.fixme(
    'PACKAGE-START-006: should support comprehensive app configuration',
    { tag: '@spec' },
    async ({ page }) => {
      // GIVEN: Comprehensive app config with theme, pages, metadata
      const app: AppEncoded = {
        name: 'Full Featured Programmatic App',
        description: 'Complete configuration test',
        version: '2.5.0',
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
              description: 'Welcome to programmatic API',
            },
            sections: [
              {
                type: 'h1',
                children: ['Welcome to Full Featured App'],
              },
              {
                type: 'p',
                children: ['This app was configured programmatically'],
              },
            ],
          },
        ],
      }

      // WHEN: Starting server with comprehensive config
      const server = await start(app, { port: 0 })

      try {
        // THEN: Server applies all configuration correctly
        await page.goto(server.url)
        await expect(page.getByTestId('app-name-heading')).toHaveText(
          'Full Featured Programmatic App'
        )
        await expect(page.getByTestId('app-version-badge')).toHaveText('2.5.0')
        await expect(page.locator('h1')).toHaveText('Welcome to Full Featured App')
        await expect(page.locator('p')).toHaveText('This app was configured programmatically')

        // Verify theme colors applied
        const root = page.locator('html')
        const primaryColor = await root.evaluate((el) =>
          getComputedStyle(el).getPropertyValue('--color-primary')
        )
        expect(primaryColor.trim()).toBe('#3B82F6')
      } finally {
        await server.stop()
      }
    }
  )

  test.fixme(
    'PACKAGE-START-007: should start server with default options when none provided',
    { tag: '@spec' },
    async ({ page }) => {
      // GIVEN: App config with NO options object
      const app: AppEncoded = {
        name: 'Default Options App',
        description: 'Testing default port and hostname',
      }

      // WHEN: Starting server without options (using defaults)
      const server = await start(app) // No options parameter

      try {
        // THEN: Server starts with default configuration
        expect(server.url).toMatch(/^http:\/\/localhost:\d+$/)

        // THEN: Server is accessible
        await page.goto(server.url)
        await expect(page.getByTestId('app-name-heading')).toHaveText('Default Options App')
      } finally {
        await server.stop()
      }
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test.fixme(
    'PACKAGE-START-008: developer can embed Sovrium server in TypeScript application',
    { tag: '@regression' },
    async ({ page }) => {
      let server1: Awaited<ReturnType<typeof start>> | undefined
      let server2: Awaited<ReturnType<typeof start>> | undefined

      await test.step('Start first server with minimal config', async () => {
        const app: AppEncoded = {
          name: 'Embedded App 1',
          description: 'First embedded server',
          pages: [
            {
              name: 'home',
              path: '/',
              meta: { lang: 'en', title: 'Home', description: 'Home page' },
              sections: [
                { type: 'h1', children: ['First Server'] },
                { type: 'p', children: ['This is the first embedded server'] },
              ],
            },
          ],
        }

        server1 = await start(app, { port: 0 })
        expect(server1.url).toMatch(/^http:\/\/localhost:\d+$/)
      })

      await test.step('Verify first server is accessible', async () => {
        await page.goto(server1!.url)
        await expect(page.getByTestId('app-name-heading')).toHaveText('Embedded App 1')
        await expect(page.locator('h1')).toHaveText('First Server')
      })

      await test.step('Start second server concurrently', async () => {
        const app: AppEncoded = {
          name: 'Embedded App 2',
          description: 'Second embedded server',
          version: '1.0.0',
          theme: {
            colors: {
              primary: '#10B981',
            },
          },
          pages: [
            {
              name: 'home',
              path: '/',
              meta: { lang: 'en', title: 'Home', description: 'Home page' },
              sections: [
                { type: 'h1', children: ['Second Server'] },
                { type: 'p', children: ['This is the second embedded server'] },
              ],
            },
          ],
        }

        server2 = await start(app, { port: 0 })
        expect(server2.url).toMatch(/^http:\/\/localhost:\d+$/)
        expect(server2.url).not.toBe(server1!.url) // Different ports
      })

      await test.step('Verify second server is accessible', async () => {
        await page.goto(server2!.url)
        await expect(page.getByTestId('app-name-heading')).toHaveText('Embedded App 2')
        await expect(page.getByTestId('app-version-badge')).toHaveText('1.0.0')
        await expect(page.locator('h1')).toHaveText('Second Server')
      })

      await test.step('Verify first server still running', async () => {
        await page.goto(server1!.url)
        await expect(page.locator('h1')).toHaveText('First Server')
      })

      await test.step('Stop both servers gracefully', async () => {
        await server1!.stop()
        await server2!.stop()

        // Verify both servers are stopped
        await expect(page.goto(server1!.url)).rejects.toThrow()
        await expect(page.goto(server2!.url)).rejects.toThrow()
      })
    }
  )
})
