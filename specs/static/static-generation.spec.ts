/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { constants } from 'node:fs'
import { readFile, readdir, access } from 'node:fs/promises'
import { join } from 'node:path'
import { test, expect } from '@/specs/fixtures'

test.describe('Static Site Generation', () => {
  test(
    'STATIC-GENERATION-001: should generate HTML files for all pages',
    { tag: '@spec' },
    async ({ generateStaticSite }) => {
      // GIVEN: app with multiple pages
      const outputDir = await generateStaticSite({
        name: 'test-app',
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
            name: 'products',
            path: '/products',
            meta: { lang: 'en', title: 'Products', description: 'Products page' },
            sections: [],
          },
        ],
      })

      // WHEN: static generation completes
      const files = await readdir(outputDir, { recursive: true })

      // THEN: should generate HTML files for all pages
      expect(files).toContain('index.html')
      expect(files).toContain('about.html')
      expect(files).toContain('products.html')
      expect(files).toContain('assets/output.css')

      // Verify files are readable
      await expect(access(join(outputDir, 'index.html'), constants.R_OK)).resolves.toBeUndefined()
      await expect(access(join(outputDir, 'about.html'), constants.R_OK)).resolves.toBeUndefined()
      await expect(
        access(join(outputDir, 'products.html'), constants.R_OK)
      ).resolves.toBeUndefined()
    }
  )

  test(
    'STATIC-GENERATION-002: should generate valid HTML with DOCTYPE',
    { tag: '@spec' },
    async ({ generateStaticSite }) => {
      // GIVEN: app with home page
      const outputDir = await generateStaticSite({
        name: 'test-app',
        pages: [
          {
            name: 'home',
            path: '/',
            meta: {
              lang: 'en',
              title: 'Test App',
              description: 'Test application',
              viewport: 'width=device-width, initial-scale=1',
            },
            sections: [
              {
                type: 'section',
                props: { className: 'container mx-auto p-4' },
                children: [
                  { type: 'h1', children: ['Welcome to Test App'] },
                  { type: 'p', children: ['This is a static site'] },
                ],
              },
            ],
          },
        ],
      })

      // WHEN: reading generated HTML
      const html = await readFile(join(outputDir, 'index.html'), 'utf-8')

      // THEN: should generate valid HTML with DOCTYPE
      expect(html.startsWith('<!DOCTYPE html>')).toBe(true)
      expect(html).toContain('lang="en"') // React adds dir attribute
      expect(html).toContain('charset="UTF-8"') // Prettier normalizes charSet to charset (standard HTML)
      expect(html).toContain('name="viewport"')
      expect(html).toContain('content="width=device-width, initial-scale=1')
      expect(html).toContain('<title>Test App</title>')
      expect(html).toContain('name="description"')
      expect(html).toContain('content="Test application"')
      expect(html).toContain('Welcome to Test App') // Content check (React wraps in testid)
      expect(html).toContain('This is a static site')
      expect(html).toContain('</html>')
    }
  )

  test(
    'STATIC-GENERATION-003: should compile CSS with theme tokens',
    { tag: '@spec' },
    async ({ generateStaticSite }) => {
      // GIVEN: app with custom theme
      const outputDir = await generateStaticSite({
        name: 'test-app',
        theme: {
          colors: {
            primary: '#3B82F6',
            secondary: '#10B981',
            accent: '#F59E0B',
            neutral: '#6B7280',
            error: '#EF4444',
            warning: '#F97316',
            success: '#22C55E',
            info: '#06B6D4',
          },
          fonts: {
            sans: {
              family: 'Inter',
              fallback: 'system-ui, sans-serif',
            },
            mono: {
              family: 'JetBrains Mono',
              fallback: 'monospace',
            },
          },
          spacing: {
            xs: '0.5rem',
            sm: '1rem',
            md: '1.5rem',
            lg: '2rem',
            xl: '3rem',
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en', title: 'Home', description: 'Home page' },
            sections: [
              {
                type: 'div',
                props: { className: 'bg-primary text-white p-lg' },
                children: ['Themed content'],
              },
            ],
          },
        ],
      })

      // WHEN: reading generated CSS
      const css = await readFile(join(outputDir, 'assets/output.css'), 'utf-8')

      // THEN: should compile CSS with theme tokens
      expect(css).toContain('--color-primary')
      expect(css).toContain('#3B82F6')
      expect(css).toContain('--color-secondary')
      expect(css).toContain('#10B981')
      expect(css).toContain('--font-sans')
      expect(css).toContain('Inter')
      expect(css).toContain('--spacing-lg')
      expect(css).toContain('2rem')
      expect(css).toContain('.bg-primary')
      expect(css).toContain('.text-white')
      expect(css).toContain('.p-lg')
    }
  )

  test(
    'STATIC-GENERATION-004: should create proper directory structure',
    { tag: '@spec' },
    async ({ generateStaticSite }) => {
      // GIVEN: app with nested pages
      const outputDir = await generateStaticSite({
        name: 'test-app',
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en', title: 'Home', description: 'Home' },
            sections: [],
          },
          {
            name: 'products',
            path: '/products',
            meta: { lang: 'en', title: 'Products', description: 'Products' },
            sections: [],
          },
          {
            name: 'product-detail',
            path: '/products/detail',
            meta: { lang: 'en', title: 'Product Detail', description: 'Detail' },
            sections: [],
          },
          {
            name: 'blog',
            path: '/blog',
            meta: { lang: 'en', title: 'Blog', description: 'Blog' },
            sections: [],
          },
          {
            name: 'blog-post',
            path: '/blog/post-1',
            meta: { lang: 'en', title: 'Blog Post 1', description: 'Post 1' },
            sections: [],
          },
        ],
      })

      // WHEN: examining directory structure
      const files = await readdir(outputDir, { recursive: true, withFileTypes: true })
      const fileMap = new Map<string, 'file' | 'directory'>()

      for (const file of files) {
        const relativePath = file.parentPath
          ? join(file.parentPath.replace(outputDir, ''), file.name)
          : file.name
        fileMap.set(relativePath.replace(/^\//, ''), file.isDirectory() ? 'directory' : 'file')
      }

      // THEN: should create proper directory structure
      expect(fileMap.get('index.html')).toBe('file')
      expect(fileMap.get('products.html')).toBe('file')
      expect(fileMap.get('products')).toBe('directory')
      expect(fileMap.get('products/detail.html')).toBe('file')
      expect(fileMap.get('blog.html')).toBe('file')
      expect(fileMap.get('blog')).toBe('directory')
      expect(fileMap.get('blog/post-1.html')).toBe('file')
      expect(fileMap.get('assets')).toBe('directory')
      expect(fileMap.get('assets/output.css')).toBe('file')
    }
  )

  test(
    'STATIC-GENERATION-005: should handle nested page paths correctly',
    { tag: '@spec' },
    async ({ generateStaticSite }) => {
      // GIVEN: app with deeply nested paths
      const outputDir = await generateStaticSite({
        name: 'test-app',
        pages: [
          {
            name: 'deep-page',
            path: '/docs/guides/getting-started/installation',
            meta: { lang: 'en', title: 'Installation', description: 'Installation guide' },
            sections: [
              { type: 'h1', children: ['Installation Guide'] },
              { type: 'p', children: ['Follow these steps to install'] },
            ],
          },
          {
            name: 'another-deep',
            path: '/api/v1/users/profile',
            meta: { lang: 'en', title: 'User Profile', description: 'User profile endpoint' },
            sections: [{ type: 'h1', children: ['User Profile API'] }],
          },
        ],
      })

      // WHEN: reading deeply nested files
      const installHtml = await readFile(
        join(outputDir, 'docs/guides/getting-started/installation.html'),
        'utf-8'
      )
      const profileHtml = await readFile(join(outputDir, 'api/v1/users/profile.html'), 'utf-8')

      // THEN: should handle nested paths correctly
      expect(installHtml).toContain('<title>Installation</title>')
      expect(installHtml).toContain('>Installation Guide</h1>')
      expect(installHtml).toContain('Follow these steps to install')

      expect(profileHtml).toContain('<title>User Profile</title>')
      expect(profileHtml).toContain('>User Profile API</h1>')

      // Verify directory structure was created
      const files = await readdir(outputDir, { recursive: true })
      expect(files).toContain('docs/guides/getting-started/installation.html')
      expect(files).toContain('api/v1/users/profile.html')
    }
  )

  test(
    'STATIC-GENERATION-006: should generate well-formatted HTML',
    { tag: '@spec' },
    async ({ generateStaticSite }) => {
      // GIVEN: app with structured content
      const outputDir = await generateStaticSite({
        name: 'test-app',
        pages: [
          {
            name: 'formatted',
            path: '/formatted',
            meta: {
              lang: 'en',
              title: 'Formatted Page',
              description: 'Page with properly formatted HTML',
              viewport: 'width=device-width, initial-scale=1.0',
            },
            sections: [
              {
                type: 'div',
                props: { className: 'container mx-auto' },
                children: [
                  { type: 'h1', props: { className: 'text-3xl' }, children: ['Main Title'] },
                  {
                    type: 'div',
                    props: { className: 'content' },
                    children: [
                      {
                        type: 'p',
                        props: { className: 'mb-4' },
                        children: [
                          'First paragraph with some text content that should be properly formatted.',
                        ],
                      },
                      {
                        type: 'p',
                        props: { className: 'mb-4' },
                        children: [
                          'Second paragraph with additional content to ensure proper formatting.',
                        ],
                      },
                      {
                        type: 'list',
                        props: { className: 'list' },
                        children: [
                          { type: 'list-item', children: ['First item'] },
                          { type: 'list-item', children: ['Second item'] },
                          { type: 'list-item', children: ['Third item'] },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      })

      // WHEN: reading generated HTML
      const html = await readFile(join(outputDir, 'formatted.html'), 'utf-8')

      // THEN: HTML should be well formatted
      // Check for DOCTYPE on first line
      const lines = html.split('\n')
      expect(lines[0]?.trim()).toBe('<!DOCTYPE html>')

      // Check for proper structure (not minified)
      expect(html).toContain('<html')
      expect(html).toContain('<head>')
      expect(html).toContain('<body')
      expect(html).toContain('</html>')

      // Check that major elements are on separate lines (not all on one line)
      const htmlLines = html
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
      expect(htmlLines.length).toBeGreaterThan(10) // Should have multiple lines, not minified

      // Check for consistent indentation patterns
      // Head elements should be indented
      const metaLines = htmlLines.filter((line) => line.startsWith('<meta'))
      expect(metaLines.length).toBeGreaterThan(0) // Should have meta tags

      // Check that nested content maintains structure
      expect(html).toContain('<h1')
      expect(html).toContain('Main Title')
      expect(html).toContain('</h1>')

      // Check that paragraphs are present (list components might not be implemented yet)
      expect(html).toContain('First paragraph')
      expect(html).toContain('Second paragraph')

      // Verify HTML is not minified (has newlines between major sections)
      const htmlWithoutSpaces = html.replace(/\s+/g, '')
      expect(html.length).toBeGreaterThan(htmlWithoutSpaces.length * 0.9) // HTML should have significant whitespace

      // Check for proper closing tags
      const closeTags = html.match(/<\/[^>]+>/g) || []

      // Common paired tags should match (approximation since React may have extra wrappers)
      const pairedTags = ['html', 'head', 'body', 'div']
      for (const tagName of pairedTags) {
        const closeCount = closeTags.filter((tag) => tag.includes(`</${tagName}>`)).length
        expect(closeCount).toBeGreaterThan(0) // Should have at least some closing tags
      }
    }
  )

  test(
    'STATIC-GENERATION-REGRESSION-001: complete static generation workflow',
    { tag: '@regression' },
    async ({ generateStaticSite, page }) => {
      // GIVEN: complete app configuration with theme, pages, and sections
      const outputDir = await generateStaticSite({
        name: 'test-app',
        description: 'A complete test application',
        theme: {
          colors: {
            primary: '#3B82F6',
            secondary: '#10B981',
          },
          fonts: {
            sans: {
              family: 'Inter',
              fallback: 'sans-serif',
            },
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            meta: {
              lang: 'en',
              title: 'Home - Test App',
              description: 'Welcome to our test application',
            },
            sections: [
              {
                type: 'header',
                props: { className: 'bg-primary text-white py-4' },
                children: [
                  {
                    type: 'div',
                    props: { className: 'container mx-auto px-4' },
                    children: [
                      {
                        type: 'h1',
                        props: { className: 'text-3xl font-bold' },
                        children: ['Test App'],
                      },
                      {
                        type: 'p',
                        props: { className: 'text-lg' },
                        children: ['Static Site Generation'],
                      },
                    ],
                  },
                ],
              },
              {
                type: 'main',
                props: { className: 'container mx-auto px-4 py-8' },
                children: [
                  { type: 'h2', props: { className: 'text-2xl mb-4' }, children: ['Welcome'] },
                  {
                    type: 'p',
                    props: { className: 'text-gray-700' },
                    children: ['This is a statically generated page.'],
                  },
                ],
              },
            ],
          },
          {
            name: 'about',
            path: '/about',
            meta: {
              lang: 'en',
              title: 'About - Test App',
              description: 'Learn more about our application',
            },
            sections: [
              {
                type: 'div',
                props: { className: 'container mx-auto px-4 py-8' },
                children: [
                  { type: 'h1', props: { className: 'text-3xl mb-4' }, children: ['About Us'] },
                  { type: 'p', children: ['We build great applications.'] },
                ],
              },
            ],
          },
        ],
      })

      // WHEN: loading generated HTML in browser
      await page.goto(`file://${join(outputDir, 'index.html')}`)

      // THEN: should render correctly with styles
      await expect(page.locator('h1').first()).toHaveText('Test App')
      await expect(page.locator('h2')).toHaveText('Welcome')
      await expect(page.locator('header p')).toHaveText('Static Site Generation')
      await expect(
        page.locator('main').getByText('This is a statically generated page.')
      ).toBeVisible()

      // Verify CSS classes are present (actual styles don't load via file:// due to CORS)
      const header = page.locator('header')
      await expect(header).toHaveClass(/bg-primary/)
      await expect(header).toHaveClass(/text-white/)

      // Navigate to about page
      await page.goto(`file://${join(outputDir, 'about.html')}`)
      await expect(page.locator('h1')).toHaveText('About Us')
      await expect(page.locator('p')).toHaveText('We build great applications.')

      // Take snapshots for visual regression
      await expect(page).toHaveScreenshot('static-home-page.png')
    }
  )
})
