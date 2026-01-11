/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { readFile, readdir, stat, mkdir, writeFile, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Static Site Generation - Asset Management
 *
 * Source: src/infrastructure/static-generation/assets.ts
 * Domain: cli/build
 * Spec Count: 4
 *
 * Asset Management Behavior:
 * - Copies files from public/ directory to output
 * - Handles images, fonts, and other static assets
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (4 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Static Site Generation - Asset Management', () => {
  test(
    'CLI-BUILD-ASSETS-001: should copy files from public/ directory',
    { tag: '@spec' },
    async ({ generateStaticSite }) => {
      // GIVEN: app with public directory containing assets
      const tempPublicDir = await mkdtemp(join(tmpdir(), 'sovrium-public-'))

      // Create test files in public directory
      await mkdir(join(tempPublicDir, 'images'), { recursive: true })
      await mkdir(join(tempPublicDir, 'fonts'), { recursive: true })
      await writeFile(join(tempPublicDir, 'favicon.ico'), Buffer.from('fake-ico'))
      await writeFile(join(tempPublicDir, 'robots.txt'), 'User-agent: *\nAllow: /')
      await writeFile(join(tempPublicDir, 'images/logo.png'), Buffer.from('fake-png'))
      await writeFile(join(tempPublicDir, 'fonts/inter.woff2'), Buffer.from('fake-font'))

      const outputDir = await generateStaticSite(
        {
          name: 'test-app',
          pages: [
            {
              name: 'home',
              path: '/',
              meta: { lang: 'en', title: 'Home', description: 'Home' },
              sections: [],
            },
          ],
        },
        {
          publicDir: tempPublicDir,
        }
      )

      // WHEN: examining copied assets
      const files = await readdir(outputDir, { recursive: true })

      // THEN: should copy all files from public directory
      expect(files).toContain('favicon.ico')
      expect(files).toContain('robots.txt')
      expect(files).toContain('images/logo.png')
      expect(files).toContain('fonts/inter.woff2')

      // Verify file contents were copied
      const favicon = await readFile(join(outputDir, 'favicon.ico'))
      // THEN: assertion
      expect(favicon.toString()).toBe('fake-ico')

      const robots = await readFile(join(outputDir, 'robots.txt'), 'utf-8')
      // THEN: assertion
      expect(robots).toBe('User-agent: *\nAllow: /')

      const logo = await readFile(join(outputDir, 'images/logo.png'))
      // THEN: assertion
      expect(logo.toString()).toBe('fake-png')

      const font = await readFile(join(outputDir, 'fonts/inter.woff2'))
      // THEN: assertion
      expect(font.toString()).toBe('fake-font')
    }
  )

  test(
    'CLI-BUILD-ASSETS-002: should preserve directory structure',
    { tag: '@spec' },
    async ({ generateStaticSite }) => {
      // GIVEN: public directory with complex structure
      const tempPublicDir = await mkdtemp(join(tmpdir(), 'sovrium-public-'))

      // Create complex directory structure
      await mkdir(join(tempPublicDir, 'assets/images/icons'), { recursive: true })
      await mkdir(join(tempPublicDir, 'assets/images/photos'), { recursive: true })
      await mkdir(join(tempPublicDir, 'assets/fonts/woff'), { recursive: true })
      await mkdir(join(tempPublicDir, 'assets/fonts/woff2'), { recursive: true })
      await mkdir(join(tempPublicDir, 'documents/pdf'), { recursive: true })

      await writeFile(join(tempPublicDir, 'assets/images/icons/arrow.svg'), '<svg></svg>')
      await writeFile(join(tempPublicDir, 'assets/images/photos/hero.jpg'), 'fake-jpg')
      await writeFile(join(tempPublicDir, 'assets/fonts/woff/inter.woff'), 'fake-woff')
      await writeFile(join(tempPublicDir, 'assets/fonts/woff2/inter.woff2'), 'fake-woff2')
      await writeFile(join(tempPublicDir, 'documents/pdf/guide.pdf'), 'fake-pdf')

      const outputDir = await generateStaticSite(
        {
          name: 'test-app',
          pages: [
            {
              name: 'home',
              path: '/',
              meta: { lang: 'en', title: 'Home', description: 'Home' },
              sections: [],
            },
          ],
        },
        {
          publicDir: tempPublicDir,
        }
      )

      // WHEN: examining directory structure
      const files = await readdir(outputDir, { recursive: true, withFileTypes: true })
      const structure = new Map<string, 'file' | 'directory'>()

      for (const file of files) {
        const relativePath = file.parentPath
          ? join(file.parentPath.replace(outputDir, ''), file.name)
          : file.name
        structure.set(relativePath.replace(/^\//, ''), file.isDirectory() ? 'directory' : 'file')
      }

      // THEN: should preserve directory structure
      expect(structure.get('assets')).toBe('directory')
      expect(structure.get('assets/images')).toBe('directory')
      expect(structure.get('assets/images/icons')).toBe('directory')
      expect(structure.get('assets/images/photos')).toBe('directory')
      expect(structure.get('assets/fonts')).toBe('directory')
      expect(structure.get('assets/fonts/woff')).toBe('directory')
      expect(structure.get('assets/fonts/woff2')).toBe('directory')
      expect(structure.get('documents')).toBe('directory')
      expect(structure.get('documents/pdf')).toBe('directory')

      // Verify files are in correct locations
      // THEN: assertion
      expect(structure.get('assets/images/icons/arrow.svg')).toBe('file')
      expect(structure.get('assets/images/photos/hero.jpg')).toBe('file')
      expect(structure.get('assets/fonts/woff/inter.woff')).toBe('file')
      expect(structure.get('assets/fonts/woff2/inter.woff2')).toBe('file')
      expect(structure.get('documents/pdf/guide.pdf')).toBe('file')
    }
  )

  test(
    'CLI-BUILD-ASSETS-003: should handle binary files correctly',
    { tag: '@spec' },
    async ({ generateStaticSite }) => {
      // GIVEN: public directory with binary files
      const tempPublicDir = await mkdtemp(join(tmpdir(), 'sovrium-public-'))

      await mkdir(join(tempPublicDir, 'media'), { recursive: true })

      // Create various binary file types
      const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) // PNG header
      const jpgHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0]) // JPEG header
      const gifHeader = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]) // GIF89a header
      const woffHeader = Buffer.from([0x77, 0x4f, 0x46, 0x46]) // WOFF header
      const mp4Header = Buffer.from([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]) // MP4 header

      await writeFile(join(tempPublicDir, 'media/image.png'), pngHeader)
      await writeFile(join(tempPublicDir, 'media/photo.jpg'), jpgHeader)
      await writeFile(join(tempPublicDir, 'media/animation.gif'), gifHeader)
      await writeFile(join(tempPublicDir, 'media/font.woff'), woffHeader)
      await writeFile(join(tempPublicDir, 'media/video.mp4'), mp4Header)

      const outputDir = await generateStaticSite(
        {
          name: 'test-app',
          pages: [
            {
              name: 'home',
              path: '/',
              meta: { lang: 'en', title: 'Home', description: 'Home' },
              sections: [],
            },
          ],
        },
        {
          publicDir: tempPublicDir,
        }
      )

      // WHEN: reading binary files
      const png = await readFile(join(outputDir, 'media/image.png'))
      const jpg = await readFile(join(outputDir, 'media/photo.jpg'))
      const gif = await readFile(join(outputDir, 'media/animation.gif'))
      const woff = await readFile(join(outputDir, 'media/font.woff'))
      const mp4 = await readFile(join(outputDir, 'media/video.mp4'))

      // THEN: should preserve binary content exactly
      expect(Buffer.compare(png, pngHeader)).toBe(0)
      expect(Buffer.compare(jpg, jpgHeader)).toBe(0)
      expect(Buffer.compare(gif, gifHeader)).toBe(0)
      expect(Buffer.compare(woff, woffHeader)).toBe(0)
      expect(Buffer.compare(mp4, mp4Header)).toBe(0)

      // Verify file sizes are preserved
      const pngStat = await stat(join(outputDir, 'media/image.png'))
      // THEN: assertion
      expect(pngStat.size).toBe(pngHeader.length)
    }
  )

  test(
    'CLI-BUILD-ASSETS-004: should update asset references in HTML and CSS',
    { tag: '@spec' },
    async ({ generateStaticSite }) => {
      // GIVEN: app with asset references in HTML and public assets
      const tempPublicDir = await mkdtemp(join(tmpdir(), 'sovrium-public-'))

      await mkdir(join(tempPublicDir, 'images'), { recursive: true })
      await mkdir(join(tempPublicDir, 'fonts'), { recursive: true })
      await writeFile(join(tempPublicDir, 'images/logo.svg'), '<svg>logo</svg>')
      await writeFile(join(tempPublicDir, 'images/hero-bg.jpg'), 'fake-jpg')
      await writeFile(join(tempPublicDir, 'fonts/inter.woff2'), 'fake-font')
      await writeFile(join(tempPublicDir, 'favicon.ico'), 'fake-ico')

      const outputDir = await generateStaticSite(
        {
          name: 'test-app',
          theme: {
            fonts: {
              custom: {
                family: 'Inter',
                url: '/fonts/inter.woff2',
              },
            },
          },
          pages: [
            {
              name: 'home',
              path: '/',
              meta: {
                lang: 'en',
                title: 'Home',
                description: 'Home page',
                favicon: './favicon.ico',
              },
              sections: [
                {
                  type: 'div',
                  props: {
                    className: 'hero',
                    style: { backgroundImage: "url('/images/hero-bg.jpg')" },
                  },
                  children: [
                    {
                      type: 'image',
                      props: {
                        src: '/images/logo.svg',
                        alt: 'Logo',
                      },
                    },
                  ],
                },
              ],
            },
            {
              name: 'nested',
              path: '/products/detail',
              meta: {
                lang: 'en',
                title: 'Product',
                description: 'Product detail',
              },
              sections: [
                {
                  type: 'image',
                  props: {
                    src: '/images/logo.svg',
                    alt: 'Logo',
                  },
                },
              ],
            },
          ],
        },
        {
          publicDir: tempPublicDir,
        }
      )

      // WHEN: reading generated HTML files
      const homeHtml = await readFile(join(outputDir, 'index.html'), 'utf-8')
      const nestedHtml = await readFile(join(outputDir, 'products/detail.html'), 'utf-8')

      // THEN: should update asset references correctly
      // Home page (at root) should have correct paths
      expect(homeHtml).toContain('href="./favicon.ico"')
      expect(homeHtml).toContain('src="/images/logo.svg"')
      expect(homeHtml).toContain('background-image: url(&#x27;/images/hero-bg.jpg&#x27;)')
      expect(homeHtml).toContain('href="/assets/output.css"')

      // Nested page should have absolute paths
      // THEN: assertion
      expect(nestedHtml).toContain('src="/images/logo.svg"')
      expect(nestedHtml).toContain('href="/assets/output.css"')

      // Verify assets were actually copied
      const files = await readdir(outputDir, { recursive: true })
      // THEN: assertion
      expect(files).toContain('images/logo.svg')
      expect(files).toContain('images/hero-bg.jpg')
      expect(files).toContain('fonts/inter.woff2')
      expect(files).toContain('favicon.ico')
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying asset management components work together
  // Generated from 4 @spec tests - covers: file copying, directory structure,
  // binary files, and asset references
  // ============================================================================

  test(
    'CLI-BUILD-ASSETS-REGRESSION: user can complete full asset management workflow',
    { tag: '@regression' },
    async ({ generateStaticSite }) => {
      // Shared state across steps
      let outputDir: string

      await test.step('Setup: Creates comprehensive asset structure for all tests', async () => {
        const tempPublicDir = await mkdtemp(join(tmpdir(), 'sovrium-public-'))

        // Create directory structure (for CLI-BUILD-ASSETS-001, 002)
        await mkdir(join(tempPublicDir, 'images/icons'), { recursive: true })
        await mkdir(join(tempPublicDir, 'images/photos'), { recursive: true })
        await mkdir(join(tempPublicDir, 'fonts/woff2'), { recursive: true })
        await mkdir(join(tempPublicDir, 'documents/pdf'), { recursive: true })
        await mkdir(join(tempPublicDir, 'media'), { recursive: true })

        // Create text-based assets (for CLI-BUILD-ASSETS-001)
        await writeFile(join(tempPublicDir, 'favicon.ico'), Buffer.from('fake-ico'))
        await writeFile(join(tempPublicDir, 'robots.txt'), 'User-agent: *\nAllow: /')
        await writeFile(join(tempPublicDir, 'images/logo.svg'), '<svg>logo</svg>')
        await writeFile(join(tempPublicDir, 'images/icons/arrow.svg'), '<svg></svg>')
        await writeFile(join(tempPublicDir, 'images/photos/hero.jpg'), 'fake-jpg')
        await writeFile(join(tempPublicDir, 'images/hero-bg.jpg'), 'fake-jpg-bg')
        await writeFile(join(tempPublicDir, 'fonts/woff2/inter.woff2'), Buffer.from('fake-font'))
        await writeFile(join(tempPublicDir, 'documents/pdf/guide.pdf'), 'fake-pdf')

        // Create binary assets with proper headers (for CLI-BUILD-ASSETS-003)
        const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
        const jpgHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0])
        const gifHeader = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
        await writeFile(join(tempPublicDir, 'media/image.png'), pngHeader)
        await writeFile(join(tempPublicDir, 'media/photo.jpg'), jpgHeader)
        await writeFile(join(tempPublicDir, 'media/animation.gif'), gifHeader)

        // Generate static site with comprehensive configuration (for CLI-BUILD-ASSETS-004)
        outputDir = await generateStaticSite(
          {
            name: 'test-app',
            theme: {
              fonts: {
                custom: {
                  family: 'Inter',
                  url: '/fonts/woff2/inter.woff2',
                },
              },
            },
            pages: [
              {
                name: 'home',
                path: '/',
                meta: {
                  lang: 'en',
                  title: 'Home',
                  description: 'Home page',
                  favicon: './favicon.ico',
                },
                sections: [
                  {
                    type: 'div',
                    props: {
                      className: 'hero',
                      style: { backgroundImage: "url('/images/hero-bg.jpg')" },
                    },
                    children: [
                      {
                        type: 'image',
                        props: {
                          src: '/images/logo.svg',
                          alt: 'Logo',
                        },
                      },
                    ],
                  },
                ],
              },
              {
                name: 'nested',
                path: '/products/detail',
                meta: {
                  lang: 'en',
                  title: 'Product',
                  description: 'Product detail',
                },
                sections: [
                  {
                    type: 'image',
                    props: {
                      src: '/images/logo.svg',
                      alt: 'Logo',
                    },
                  },
                ],
              },
            ],
          },
          {
            publicDir: tempPublicDir,
          }
        )
      })

      await test.step('CLI-BUILD-ASSETS-001: Copies files from public/ directory', async () => {
        const files = await readdir(outputDir, { recursive: true })

        // Verify essential files are copied
        expect(files).toContain('favicon.ico')
        expect(files).toContain('robots.txt')
        expect(files).toContain('images/logo.svg')

        // Verify file contents were copied correctly
        const favicon = await readFile(join(outputDir, 'favicon.ico'))
        expect(favicon.toString()).toBe('fake-ico')

        const robots = await readFile(join(outputDir, 'robots.txt'), 'utf-8')
        expect(robots).toBe('User-agent: *\nAllow: /')
      })

      await test.step('CLI-BUILD-ASSETS-002: Preserves directory structure', async () => {
        const files = await readdir(outputDir, { recursive: true, withFileTypes: true })
        const structure = new Map<string, 'file' | 'directory'>()

        for (const file of files) {
          const relativePath = file.parentPath
            ? join(file.parentPath.replace(outputDir, ''), file.name)
            : file.name
          structure.set(relativePath.replace(/^\//, ''), file.isDirectory() ? 'directory' : 'file')
        }

        // Verify directory structure is preserved
        expect(structure.get('images')).toBe('directory')
        expect(structure.get('images/icons')).toBe('directory')
        expect(structure.get('images/photos')).toBe('directory')
        expect(structure.get('fonts')).toBe('directory')
        expect(structure.get('documents')).toBe('directory')

        // Verify files are in correct locations
        expect(structure.get('images/icons/arrow.svg')).toBe('file')
        expect(structure.get('images/photos/hero.jpg')).toBe('file')
      })

      await test.step('CLI-BUILD-ASSETS-003: Handles binary files correctly', async () => {
        // Read binary files from output
        const png = await readFile(join(outputDir, 'media/image.png'))
        const jpg = await readFile(join(outputDir, 'media/photo.jpg'))
        const gif = await readFile(join(outputDir, 'media/animation.gif'))

        // Verify PNG header preserved
        const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
        expect(Buffer.compare(png, pngHeader)).toBe(0)

        // Verify JPG header preserved
        const jpgHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0])
        expect(Buffer.compare(jpg, jpgHeader)).toBe(0)

        // Verify GIF header preserved
        const gifHeader = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
        expect(Buffer.compare(gif, gifHeader)).toBe(0)

        // Verify file size is preserved
        const pngStat = await stat(join(outputDir, 'media/image.png'))
        expect(pngStat.size).toBe(pngHeader.length)
      })

      await test.step('CLI-BUILD-ASSETS-004: Updates asset references in HTML and CSS', async () => {
        // Read generated HTML files
        const homeHtml = await readFile(join(outputDir, 'index.html'), 'utf-8')
        const nestedHtml = await readFile(join(outputDir, 'products/detail.html'), 'utf-8')

        // Verify home page asset references
        expect(homeHtml).toContain('href="./favicon.ico"')
        expect(homeHtml).toContain('src="/images/logo.svg"')
        expect(homeHtml).toContain('href="/assets/output.css"')

        // Verify nested page has absolute paths
        expect(nestedHtml).toContain('src="/images/logo.svg"')
        expect(nestedHtml).toContain('href="/assets/output.css"')

        // Verify assets were copied
        const files = await readdir(outputDir, { recursive: true })
        expect(files).toContain('images/logo.svg')
        expect(files).toContain('images/hero-bg.jpg')
        expect(files).toContain('favicon.ico')
      })
    }
  )
})
