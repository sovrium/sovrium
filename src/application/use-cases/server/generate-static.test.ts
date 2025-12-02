/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import type { GenerateStaticOptions, GenerateStaticResult } from './generate-static'

describe('GenerateStaticOptions interface', () => {
  test('should have all optional fields', () => {
    const options: GenerateStaticOptions = {}

    expect(options.outputDir).toBeUndefined()
    expect(options.baseUrl).toBeUndefined()
    expect(options.basePath).toBeUndefined()
    expect(options.deployment).toBeUndefined()
    expect(options.languages).toBeUndefined()
    expect(options.defaultLanguage).toBeUndefined()
    expect(options.generateSitemap).toBeUndefined()
    expect(options.generateRobotsTxt).toBeUndefined()
    expect(options.hydration).toBeUndefined()
    expect(options.generateManifest).toBeUndefined()
    expect(options.bundleOptimization).toBeUndefined()
    expect(options.publicDir).toBeUndefined()
  })

  test('should accept all configuration options', () => {
    const options: GenerateStaticOptions = {
      outputDir: './dist',
      baseUrl: 'https://example.com',
      basePath: '/my-app',
      deployment: 'github-pages',
      languages: ['en', 'fr', 'es'],
      defaultLanguage: 'en',
      generateSitemap: true,
      generateRobotsTxt: true,
      hydration: true,
      generateManifest: true,
      bundleOptimization: 'split',
      publicDir: './public',
    }

    expect(options.outputDir).toBe('./dist')
    expect(options.baseUrl).toBe('https://example.com')
    expect(options.basePath).toBe('/my-app')
    expect(options.deployment).toBe('github-pages')
    expect(options.languages).toEqual(['en', 'fr', 'es'])
    expect(options.defaultLanguage).toBe('en')
    expect(options.generateSitemap).toBe(true)
    expect(options.generateRobotsTxt).toBe(true)
    expect(options.hydration).toBe(true)
    expect(options.generateManifest).toBe(true)
    expect(options.bundleOptimization).toBe('split')
    expect(options.publicDir).toBe('./public')
  })

  test('should accept generic deployment type', () => {
    const options: GenerateStaticOptions = {
      deployment: 'generic',
    }

    expect(options.deployment).toBe('generic')
  })

  test('should accept none bundle optimization', () => {
    const options: GenerateStaticOptions = {
      bundleOptimization: 'none',
    }

    expect(options.bundleOptimization).toBe('none')
  })
})

describe('GenerateStaticResult interface', () => {
  test('should have correct shape', () => {
    const result: GenerateStaticResult = {
      outputDir: './static',
      files: ['index.html', 'about.html', 'assets/output.css', 'sitemap.xml', 'robots.txt'],
    }

    expect(result.outputDir).toBe('./static')
    expect(result.files).toHaveLength(5)
    expect(result.files).toContain('index.html')
    expect(result.files).toContain('sitemap.xml')
  })

  test('should support multi-language files', () => {
    const result: GenerateStaticResult = {
      outputDir: './static',
      files: [
        'en/index.html',
        'en/about.html',
        'fr/index.html',
        'fr/about.html',
        'index.html',
        'assets/output.css',
      ],
    }

    expect(result.files).toContain('en/index.html')
    expect(result.files).toContain('fr/index.html')
    expect(result.files).toHaveLength(6)
  })

  test('files should be readonly', () => {
    const result: GenerateStaticResult = {
      outputDir: './static',
      files: ['index.html'],
    }

    // Type-level test: files is readonly
    // This should compile without error
    expect(result.files[0]).toBe('index.html')
  })
})
