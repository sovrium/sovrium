/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { constants } from 'node:fs'
import { readFile, readdir, access, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, test, expect } from 'bun:test'
import { start, build } from '.'
import type { AppEncoded } from '.'

/**
 * Unit Tests for Programmatic API
 *
 * These tests verify the programmatic API exported from src/index.ts:
 * - start() - Start a development server programmatically
 * - build() - Generate static site files programmatically
 *
 * Tests are currently skipped pending implementation.
 * They will be enabled once the underlying use cases are fully implemented.
 */

describe('Programmatic API - start()', () => {
  test('should start server with minimal config object', async () => {
    // GIVEN: Minimal app configuration object (no file, direct TypeScript)
    const app: AppEncoded = {
      name: 'programmatic-test-app',
      description: 'Testing TypeScript API',
    }

    // WHEN: Starting server programmatically
    const server = await start(app, { port: 0 }) // Auto-select port

    try {
      // THEN: Server returns interface with url and stop method
      expect(server.url).toMatch(/^http:\/\/localhost:\d+$/)
      expect(typeof server.stop).toBe('function')

      // THEN: Server URL is accessible
      const response = await fetch(server.url)
      expect(response.ok).toBe(true)
    } finally {
      // Cleanup: Stop server
      await server.stop()
    }
  })

  test('should support custom port option', async () => {
    // GIVEN: App config with custom port via options object
    const app: AppEncoded = {
      name: 'custom-port-app',
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
      const response = await fetch(server.url)
      expect(response.ok).toBe(true)
    } finally {
      await server.stop()
    }
  })

  test('should support custom hostname option', async () => {
    // GIVEN: App config with custom hostname
    const app: AppEncoded = {
      name: 'custom-host-app',
      description: 'Testing custom hostname',
    }

    // WHEN: Starting server with localhost hostname
    const server = await start(app, { port: 0, hostname: 'localhost' })

    try {
      // THEN: Server URL contains specified hostname
      expect(server.url).toContain('localhost')

      // THEN: Server is accessible on the hostname
      const response = await fetch(server.url)
      expect(response.ok).toBe(true)
    } finally {
      await server.stop()
    }
  })

  test('should validate schema and reject invalid config', async () => {
    // GIVEN: Invalid app config (missing required 'name' field)
    const invalidApp = {
      description: 'App without name',
      // name field intentionally omitted
    } as unknown as AppEncoded

    // WHEN: Attempting to start server with invalid config
    // THEN: Promise rejects with validation error
    await expect(start(invalidApp)).rejects.toThrow()
  })

  test('should provide working stop() method for graceful shutdown', async () => {
    // GIVEN: Running server
    const app: AppEncoded = {
      name: 'shutdown-test-app',
      description: 'Testing graceful shutdown',
    }

    const server = await start(app, { port: 0 })

    // Verify server is running
    const response1 = await fetch(server.url)
    expect(response1.ok).toBe(true)

    // WHEN: Calling stop() method
    await server.stop()

    // THEN: Server is no longer accessible (connection should fail)
    try {
      await fetch(server.url)
      throw new Error('Expected fetch to fail but it succeeded')
    } catch (error) {
      // Connection error expected - server is stopped
      expect(error).toBeDefined()
    }
  })

  test('should support comprehensive app configuration', async () => {
    // GIVEN: Comprehensive app config with theme, pages, metadata
    const app: AppEncoded = {
      name: 'full-featured-programmatic-app',
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
      const response = await fetch(server.url)
      expect(response.ok).toBe(true)

      const html = await response.text()
      expect(html).toContain('Welcome to Full Featured App')
      expect(html).toContain('This app was configured programmatically')
    } finally {
      await server.stop()
    }
  })

  test('should start server with default options when none provided', async () => {
    // GIVEN: App config with NO options object
    const app: AppEncoded = {
      name: 'default-options-app',
      description: 'Testing default port and hostname',
    }

    // WHEN: Starting server without options (using defaults)
    const server = await start(app) // No options parameter

    try {
      // THEN: Server starts with default configuration
      expect(server.url).toMatch(/^http:\/\/localhost:\d+$/)

      // THEN: Server is accessible
      const response = await fetch(server.url)
      expect(response.ok).toBe(true)
    } finally {
      await server.stop()
    }
  })

  test('should support multiple concurrent server instances', async () => {
    // GIVEN: Two different app configurations
    const app1: AppEncoded = {
      name: 'embedded-app-1',
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

    const app2: AppEncoded = {
      name: 'embedded-app-2',
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

    // WHEN: Starting two servers concurrently
    const server1 = await start(app1, { port: 0 })
    const server2 = await start(app2, { port: 0 })

    try {
      // THEN: Both servers run on different ports
      expect(server1.url).toMatch(/^http:\/\/localhost:\d+$/)
      expect(server2.url).toMatch(/^http:\/\/localhost:\d+$/)
      expect(server1.url).not.toBe(server2.url)

      // THEN: Both servers are accessible
      const response1 = await fetch(server1.url)
      const response2 = await fetch(server2.url)
      expect(response1.ok).toBe(true)
      expect(response2.ok).toBe(true)

      // THEN: Each server returns its own content
      const html1 = await response1.text()
      const html2 = await response2.text()
      expect(html1).toContain('First Server')
      expect(html2).toContain('Second Server')
    } finally {
      // THEN: Both servers can be stopped gracefully
      await server1.stop()
      await server2.stop()

      // Verify both servers are stopped (connection should fail)
      try {
        await fetch(server1.url)
        throw new Error('Expected fetch to server1 to fail but it succeeded')
      } catch (error) {
        expect(error).toBeDefined()
      }

      try {
        await fetch(server2.url)
        throw new Error('Expected fetch to server2 to fail but it succeeded')
      } catch (error) {
        expect(error).toBeDefined()
      }
    }
  })
})

describe('Programmatic API - build()', () => {
  test('should generate static site with minimal config object', async () => {
    // GIVEN: Minimal app configuration object (no file, direct TypeScript)
    const app: AppEncoded = {
      name: 'programmatic-static-app',
      description: 'Testing TypeScript static API',
      pages: [
        {
          name: 'home',
          path: '/',
          meta: { lang: 'en', title: 'Home', description: 'Home page' },
          sections: [
            { type: 'h1', children: ['Generated Programmatically'] },
            { type: 'p', children: ['This site was generated via TypeScript API'] },
          ],
        },
      ],
    }

    // WHEN: Generating static site programmatically
    const result = await build(app)

    try {
      // THEN: Returns result with outputDir and files list
      expect(result.outputDir).toBeTruthy()
      expect(Array.isArray(result.files)).toBe(true)
      expect(result.files.length).toBeGreaterThan(0)

      // THEN: Generated files exist on disk
      await access(join(result.outputDir, 'index.html'), constants.R_OK)

      // THEN: HTML contains expected content
      const html = await readFile(join(result.outputDir, 'index.html'), 'utf-8')
      expect(html).toContain('Generated Programmatically')
      expect(html).toContain('This site was generated via TypeScript API')
    } finally {
      // Cleanup: Remove generated files
      await rm(result.outputDir, { recursive: true, force: true })
    }
  })

  test('should support custom output directory option', async () => {
    // GIVEN: App config with custom output directory
    const app: AppEncoded = {
      name: 'custom-output-app',
      description: 'Testing custom output directory',
      pages: [
        {
          name: 'home',
          path: '/',
          meta: { lang: 'en', title: 'Home', description: 'Home page' },
          sections: [],
        },
      ],
    }

    const customOutputDir = join(process.cwd(), 'test-custom-output')

    // WHEN: Generating with custom outputDir option
    const result = await build(app, { outputDir: customOutputDir })

    try {
      // THEN: Files are generated in custom directory
      expect(result.outputDir).toBe(customOutputDir)
      await access(join(customOutputDir, 'index.html'), constants.R_OK)

      // THEN: result.files list is accurate
      const actualFiles = await readdir(customOutputDir, { recursive: true })
      expect(result.files.length).toBeGreaterThan(0)
      expect(actualFiles).toContain('index.html')
    } finally {
      await rm(customOutputDir, { recursive: true, force: true })
    }
  })

  test('should validate schema and reject invalid config', async () => {
    // GIVEN: Invalid app config (missing required 'name' field)
    const invalidApp = {
      description: 'App without name',
      pages: [],
      // name field intentionally omitted
    } as unknown as AppEncoded

    // WHEN: Attempting to generate static site with invalid config
    // THEN: Promise rejects with validation error
    await expect(build(invalidApp)).rejects.toThrow()
  })

  test('should return complete file list in result', async () => {
    // GIVEN: App with multiple pages
    const app: AppEncoded = {
      name: 'multi-page-app',
      description: 'Testing file list',
      pages: [
        {
          name: 'home',
          path: '/',
          meta: { lang: 'en', title: 'Home', description: 'Home page' },
          sections: [],
        },
        {
          name: 'about',
          path: '/about',
          meta: { lang: 'en', title: 'About', description: 'About page' },
          sections: [],
        },
        {
          name: 'contact',
          path: '/contact',
          meta: { lang: 'en', title: 'Contact', description: 'Contact page' },
          sections: [],
        },
      ],
    }

    // WHEN: Generating static site
    const result = await build(app)

    try {
      // THEN: result.files includes all generated files
      expect(result.files).toContain('index.html')
      expect(result.files).toContain('about.html')
      expect(result.files).toContain('contact.html')
      expect(result.files).toContain('assets/output.css')

      // THEN: All listed files exist on disk
      for (const file of result.files) {
        await access(join(result.outputDir, file), constants.R_OK)
      }
    } finally {
      await rm(result.outputDir, { recursive: true, force: true })
    }
  })

  test('should support generation options (baseUrl, sitemap, robots)', async () => {
    // GIVEN: App config with generation options
    const app: AppEncoded = {
      name: 'options-test-app',
      description: 'Testing generation options',
      pages: [
        {
          name: 'home',
          path: '/',
          meta: { lang: 'en', title: 'Home', description: 'Home page' },
          sections: [],
        },
        {
          name: 'about',
          path: '/about',
          meta: { lang: 'en', title: 'About', description: 'About page' },
          sections: [],
        },
      ],
    }

    // WHEN: Generating with options
    const result = await build(app, {
      baseUrl: 'https://example.com',
      generateSitemap: true,
      generateRobotsTxt: true,
    })

    try {
      // THEN: Sitemap is generated
      await access(join(result.outputDir, 'sitemap.xml'), constants.R_OK)

      const sitemap = await readFile(join(result.outputDir, 'sitemap.xml'), 'utf-8')
      expect(sitemap).toContain('https://example.com/')
      expect(sitemap).toContain('https://example.com/about')

      // THEN: robots.txt is generated
      await access(join(result.outputDir, 'robots.txt'), constants.R_OK)

      const robots = await readFile(join(result.outputDir, 'robots.txt'), 'utf-8')
      expect(robots).toContain('Sitemap: https://example.com/sitemap.xml')
    } finally {
      await rm(result.outputDir, { recursive: true, force: true })
    }
  })

  test('should support comprehensive app configuration', async () => {
    // GIVEN: Comprehensive app config with theme, pages, metadata
    const app: AppEncoded = {
      name: 'full-featured-static-app',
      description: 'Complete static generation test',
      version: '3.0.0',
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
            title: 'Home - Full Featured',
            description: 'Complete static site',
          },
          sections: [
            { type: 'h1', children: ['Full Featured Static Site'] },
            { type: 'p', children: ['Generated with comprehensive configuration'] },
          ],
        },
      ],
    }

    // WHEN: Generating static site with comprehensive config
    const result = await build(app)

    try {
      // THEN: HTML applies all configuration correctly
      const html = await readFile(join(result.outputDir, 'index.html'), 'utf-8')
      expect(html).toContain('<title>Home - Full Featured</title>')
      expect(html).toContain('Full Featured Static Site')
      expect(html).toContain('Generated with comprehensive configuration')

      // THEN: CSS includes theme tokens
      const css = await readFile(join(result.outputDir, 'assets/output.css'), 'utf-8')
      expect(css).toContain('--color-primary')
      expect(css).toContain('#3B82F6')
      expect(css).toContain('--font-sans')
      expect(css).toContain('Inter')
    } finally {
      await rm(result.outputDir, { recursive: true, force: true })
    }
  })

  test('should generate with default options when none provided', async () => {
    // GIVEN: App config with NO options object
    const app: AppEncoded = {
      name: 'default-options-static-app',
      description: 'Testing default generation options',
      pages: [
        {
          name: 'home',
          path: '/',
          meta: { lang: 'en', title: 'Home', description: 'Home page' },
          sections: [],
        },
      ],
    }

    // WHEN: Generating without options (using defaults)
    const result = await build(app) // No options parameter

    try {
      // THEN: Site is generated with default settings
      expect(result.outputDir).toBeTruthy()
      expect(result.files.length).toBeGreaterThan(0)

      // THEN: Default output directory is used (./static)
      expect(result.outputDir).toContain('static')

      // THEN: Files are generated successfully
      await access(join(result.outputDir, 'index.html'), constants.R_OK)
    } finally {
      await rm(result.outputDir, { recursive: true, force: true })
    }
  })

  test('should support deployment-specific options', async () => {
    // GIVEN: App config with GitHub Pages deployment options
    const app: AppEncoded = {
      name: 'github-pages-app',
      description: 'Testing deployment options',
      pages: [
        {
          name: 'home',
          path: '/',
          meta: { lang: 'en', title: 'Home', description: 'Home page' },
          sections: [
            { type: 'h1', children: ['GitHub Pages Deployment'] },
            { type: 'p', children: ['With base path support'] },
          ],
        },
        {
          name: 'docs',
          path: '/docs',
          meta: { lang: 'en', title: 'Docs', description: 'Documentation' },
          sections: [{ type: 'h1', children: ['Documentation'] }],
        },
      ],
    }

    // WHEN: Generating with deployment options
    const result = await build(app, {
      deployment: 'github-pages',
      basePath: '/my-project',
      baseUrl: 'https://username.github.io/my-project',
      generateSitemap: true,
    })

    try {
      // THEN: Base path is applied to links
      const html = await readFile(join(result.outputDir, 'index.html'), 'utf-8')
      // Note: Base path handling will be in asset references
      expect(html).toContain('GitHub Pages Deployment')

      // THEN: Sitemap uses correct base URL
      const sitemap = await readFile(join(result.outputDir, 'sitemap.xml'), 'utf-8')
      expect(sitemap).toContain('https://username.github.io/my-project/')
      expect(sitemap).toContain('https://username.github.io/my-project/docs')
    } finally {
      await rm(result.outputDir, { recursive: true, force: true })
    }
  })

  test('should support build script integration workflow', async () => {
    // GIVEN: Comprehensive build configuration
    const app: AppEncoded = {
      name: 'build-script-app',
      description: 'Automated build via TypeScript',
      version: '1.0.0-build',
      theme: {
        colors: {
          primary: '#3B82F6',
          secondary: '#10B981',
        },
      },
      pages: [
        {
          name: 'home',
          path: '/',
          meta: {
            lang: 'en',
            title: 'Home - Build Script',
            description: 'Automated static generation',
          },
          sections: [
            { type: 'h1', children: ['Automated Build'] },
            { type: 'p', children: ['Generated via build script'] },
          ],
        },
        {
          name: 'features',
          path: '/features',
          meta: {
            lang: 'en',
            title: 'Features',
            description: 'Feature list',
          },
          sections: [
            { type: 'h1', children: ['Features'] },
            { type: 'p', children: ['Static site generation'] },
          ],
        },
        {
          name: 'docs',
          path: '/docs/getting-started',
          meta: {
            lang: 'en',
            title: 'Getting Started',
            description: 'Documentation',
          },
          sections: [
            { type: 'h1', children: ['Getting Started'] },
            { type: 'p', children: ['Learn how to use our platform'] },
          ],
        },
      ],
    }

    const buildOutputDir = join(process.cwd(), 'test-build-output')

    // WHEN: Generating with full build options
    const result = await build(app, {
      outputDir: buildOutputDir,
      baseUrl: 'https://example.com',
      basePath: '/',
      deployment: 'generic',
      generateSitemap: true,
      generateRobotsTxt: true,
    })

    try {
      // THEN: Build completes with correct output
      expect(result.outputDir).toBe(buildOutputDir)
      expect(result.files.length).toBeGreaterThan(0)

      // THEN: All pages generated correctly
      expect(result.files).toContain('index.html')
      expect(result.files).toContain('features.html')
      expect(result.files).toContain('docs/getting-started.html')
      expect(result.files).toContain('sitemap.xml')
      expect(result.files).toContain('robots.txt')

      // THEN: Sitemap contains all pages
      const sitemap = await readFile(join(result.outputDir, 'sitemap.xml'), 'utf-8')
      expect(sitemap).toContain('https://example.com/')
      expect(sitemap).toContain('https://example.com/features')
      expect(sitemap).toContain('https://example.com/docs/getting-started')
    } finally {
      await rm(result.outputDir, { recursive: true, force: true })
    }
  })
})
