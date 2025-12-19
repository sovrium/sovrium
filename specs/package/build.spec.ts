/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { constants } from 'node:fs'
import { readFile, readdir, access, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { build } from '@/index'
import { test, expect } from '@/specs/fixtures'
import type { AppEncoded } from '@/domain/models/app'

/**
 * E2E Tests for Programmatic API - build() Function
 *
 * Source: src/index.ts (build function)
 * Domain: package
 * Spec Count: 8
 *
 * Programmatic API Behavior:
 * - Builds static site from JavaScript/TypeScript configuration object
 * - Returns Promise with result (outputDir, files list)
 * - Supports custom output directory and build options
 * - Validates schema using Effect Schema
 * - Different from CLI (no file loading, direct object input)
 * - Suitable for build scripts and automation
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (7 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 */

test.describe('Programmatic API - build()', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test.fixme(
    'PACKAGE-BUILD-001: should generate static site with minimal config object',
    { tag: '@spec' },
    async () => {
      // GIVEN: Minimal app configuration object (no file, direct TypeScript)
      const app: AppEncoded = {
        name: 'Programmatic Static App',
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
        await expect(
          access(join(result.outputDir, 'index.html'), constants.R_OK)
        ).resolves.toBeUndefined()

        // THEN: HTML contains expected content
        const html = await readFile(join(result.outputDir, 'index.html'), 'utf-8')
        expect(html).toContain('Generated Programmatically')
        expect(html).toContain('This site was generated via TypeScript API')
      } finally {
        // Cleanup: Remove generated files
        await rm(result.outputDir, { recursive: true, force: true })
      }
    }
  )

  test.fixme(
    'PACKAGE-BUILD-002: should support custom output directory option',
    { tag: '@spec' },
    async () => {
      // GIVEN: App config with custom output directory
      const app: AppEncoded = {
        name: 'Custom Output App',
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
        await expect(
          access(join(customOutputDir, 'index.html'), constants.R_OK)
        ).resolves.toBeUndefined()

        // THEN: result.files list is accurate
        const actualFiles = await readdir(customOutputDir, { recursive: true })
        expect(result.files.length).toBeGreaterThan(0)
        expect(actualFiles).toContain('index.html')
      } finally {
        await rm(customOutputDir, { recursive: true, force: true })
      }
    }
  )

  test.fixme(
    'PACKAGE-BUILD-003: should validate schema and reject invalid config',
    { tag: '@spec' },
    async () => {
      // GIVEN: Invalid app config (missing required 'name' field)
      const invalidApp = {
        description: 'App without name',
        pages: [],
        // name field intentionally omitted
      } as unknown as AppEncoded

      // WHEN: Attempting to generate static site with invalid config
      // THEN: Promise rejects with validation error
      await expect(build(invalidApp)).rejects.toThrow()
    }
  )

  test.fixme(
    'PACKAGE-BUILD-004: should return complete file list in result',
    { tag: '@spec' },
    async () => {
      // GIVEN: App with multiple pages
      const app: AppEncoded = {
        name: 'Multi Page App',
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
          await expect(
            access(join(result.outputDir, file), constants.R_OK)
          ).resolves.toBeUndefined()
        }
      } finally {
        await rm(result.outputDir, { recursive: true, force: true })
      }
    }
  )

  test.fixme(
    'PACKAGE-BUILD-005: should support generation options (baseUrl, sitemap, robots)',
    { tag: '@spec' },
    async () => {
      // GIVEN: App config with generation options
      const app: AppEncoded = {
        name: 'Options Test App',
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
        await expect(
          access(join(result.outputDir, 'sitemap.xml'), constants.R_OK)
        ).resolves.toBeUndefined()

        const sitemap = await readFile(join(result.outputDir, 'sitemap.xml'), 'utf-8')
        expect(sitemap).toContain('https://example.com/')
        expect(sitemap).toContain('https://example.com/about')

        // THEN: robots.txt is generated
        await expect(
          access(join(result.outputDir, 'robots.txt'), constants.R_OK)
        ).resolves.toBeUndefined()

        const robots = await readFile(join(result.outputDir, 'robots.txt'), 'utf-8')
        expect(robots).toContain('Sitemap: https://example.com/sitemap.xml')
      } finally {
        await rm(result.outputDir, { recursive: true, force: true })
      }
    }
  )

  test.fixme(
    'PACKAGE-BUILD-006: should support comprehensive app configuration',
    { tag: '@spec' },
    async ({ page }) => {
      // GIVEN: Comprehensive app config with theme, pages, metadata
      const app: AppEncoded = {
        name: 'Full Featured Static App',
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

        // THEN: Visual verification in browser
        await page.goto(`file://${join(result.outputDir, 'index.html')}`)
        await expect(page.locator('h1')).toHaveText('Full Featured Static Site')

        const root = page.locator('html')
        const primaryColor = await root.evaluate((el) =>
          getComputedStyle(el).getPropertyValue('--color-primary')
        )
        expect(primaryColor.trim()).toBe('#3B82F6')
      } finally {
        await rm(result.outputDir, { recursive: true, force: true })
      }
    }
  )

  test.fixme(
    'PACKAGE-BUILD-007: should generate with default options when none provided',
    { tag: '@spec' },
    async () => {
      // GIVEN: App config with NO options object
      const app: AppEncoded = {
        name: 'Default Options Static App',
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
        await expect(
          access(join(result.outputDir, 'index.html'), constants.R_OK)
        ).resolves.toBeUndefined()
      } finally {
        await rm(result.outputDir, { recursive: true, force: true })
      }
    }
  )

  test.fixme(
    'PACKAGE-BUILD-008: should support deployment-specific options',
    { tag: '@spec' },
    async () => {
      // GIVEN: App config with GitHub Pages deployment options
      const app: AppEncoded = {
        name: 'GitHub Pages App',
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
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test.fixme(
    'PACKAGE-BUILD-009: developer can integrate static generation in build scripts',
    { tag: '@regression' },
    async ({ page }) => {
      let result: Awaited<ReturnType<typeof build>> | undefined

      await test.step('Generate static site with build script configuration', async () => {
        const app: AppEncoded = {
          name: 'Build Script App',
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

        result = await build(app, {
          outputDir: buildOutputDir,
          baseUrl: 'https://example.com',
          basePath: '/',
          deployment: 'generic',
          generateSitemap: true,
          generateRobotsTxt: true,
          generateManifest: true,
        })

        expect(result.outputDir).toBe(buildOutputDir)
        expect(result.files.length).toBeGreaterThan(0)
      })

      await test.step('Verify all pages generated correctly', async () => {
        expect(result!.files).toContain('index.html')
        expect(result!.files).toContain('features.html')
        expect(result!.files).toContain('docs/getting-started.html')
        expect(result!.files).toContain('sitemap.xml')
        expect(result!.files).toContain('robots.txt')
        expect(result!.files).toContain('manifest.json')
      })

      await test.step('Verify home page renders correctly', async () => {
        await page.goto(`file://${join(result!.outputDir, 'index.html')}`)
        await expect(page.locator('h1')).toHaveText('Automated Build')
        await expect(page.locator('p')).toHaveText('Generated via build script')

        const root = page.locator('html')
        const primaryColor = await root.evaluate((el) =>
          getComputedStyle(el).getPropertyValue('--color-primary')
        )
        expect(primaryColor.trim()).toBe('#3B82F6')
      })

      await test.step('Verify features page', async () => {
        await page.goto(`file://${join(result!.outputDir, 'features.html')}`)
        await expect(page.locator('h1')).toHaveText('Features')
      })

      await test.step('Verify nested documentation page', async () => {
        await page.goto(`file://${join(result!.outputDir, 'docs/getting-started.html')}`)
        await expect(page.locator('h1')).toHaveText('Getting Started')
      })

      await test.step('Verify sitemap contains all pages', async () => {
        const sitemap = await readFile(join(result!.outputDir, 'sitemap.xml'), 'utf-8')
        expect(sitemap).toContain('https://example.com/')
        expect(sitemap).toContain('https://example.com/features')
        expect(sitemap).toContain('https://example.com/docs/getting-started')
      })

      await test.step('Verify manifest.json generated', async () => {
        const manifest = await readFile(join(result!.outputDir, 'manifest.json'), 'utf-8')
        const manifestData = JSON.parse(manifest)
        expect(manifestData.name).toBe('Build Script App')
        expect(manifestData.short_name).toBe('Build Script App')
      })

      await test.step('Cleanup build output', async () => {
        await rm(result!.outputDir, { recursive: true, force: true })
      })
    }
  )
})
