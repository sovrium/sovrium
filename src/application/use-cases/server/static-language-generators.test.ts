/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Effect, Exit } from 'effect'
import {
  generateMultiLanguageFiles,
  generateSingleLanguageFiles,
} from './static-language-generators'
import type { App } from '@/domain/models/app'

// Helper to create a minimal valid app for testing

const createTestApp = (overrides: Record<string, unknown> = {}): App =>
  ({
    name: 'test-app',
    version: '1.0.0',
    theme: {},
    pages: [
      { name: 'Home', path: '/', sections: [] },
      { name: 'About', path: '/about', sections: [] },
    ],
    ...overrides,
  }) as App

// Mock server instance
const createMockServerInstance = (app: App) => ({
  app,
  stop: Effect.succeed(undefined),
})

// Mock service factories - use any to bypass strict type checking

const createMockServerFactory = (): any => ({
  create: (config: { app: App }) => Effect.succeed(createMockServerInstance(config.app)),
})

const createMockPageRenderer = (): any => ({
  renderHome: () => '<html>Home</html>',
  renderPage: () => '<html>Page</html>',
  renderNotFound: () => '<html>404</html>',
  renderError: () => '<html>Error</html>',
})

const createMockStaticSiteGenerator = (
  files: readonly string[] = ['index.html', 'about.html']
): any => ({
  generate: () => Effect.succeed({ files }),
})

describe('generateSingleLanguageFiles', () => {
  describe('When generating files for a single-language app', () => {
    test('Then returns generated file list', async () => {
      const app = createTestApp()
      const expectedFiles = ['index.html', 'about.html']

      const result = await Effect.runPromiseExit(
        generateSingleLanguageFiles(
          app,
          '/output',
          createMockServerFactory(),
          createMockPageRenderer(),
          createMockStaticSiteGenerator(expectedFiles)
        )
      )

      expect(Exit.isSuccess(result)).toBe(true)
      if (Exit.isSuccess(result)) {
        expect(result.value).toEqual(expectedFiles)
      }
    })

    test('Then filters out underscore-prefixed pages', async () => {
      const app = createTestApp({
        pages: [
          { name: 'Home', path: '/', sections: [] },
          { name: 'About', path: '/about', sections: [] },
          { name: 'Admin', path: '/_admin', sections: [] },
        ],
      })

      // Track which pagePaths are passed to SSG
      let capturedPagePaths: string[] = []
      const mockSSG = {
        generate: (_app: App, options: { pagePaths: string[] }) => {
          capturedPagePaths = options.pagePaths
          return Effect.succeed({ files: ['index.html', 'about.html'] })
        },
      }

      await Effect.runPromise(
        generateSingleLanguageFiles(
          app,
          '/output',
          createMockServerFactory(),
          createMockPageRenderer(),
          mockSSG as any
        )
      )

      expect(capturedPagePaths).toEqual(['/', '/about'])
      expect(capturedPagePaths).not.toContain('/_admin')
    })

    test('Then handles empty pages array', async () => {
      const app = createTestApp({ pages: [] })

      const result = await Effect.runPromiseExit(
        generateSingleLanguageFiles(
          app,
          '/output',
          createMockServerFactory(),
          createMockPageRenderer(),
          createMockStaticSiteGenerator([])
        )
      )

      expect(Exit.isSuccess(result)).toBe(true)
      if (Exit.isSuccess(result)) {
        expect(result.value).toEqual([])
      }
    })
  })
})

describe('generateMultiLanguageFiles', () => {
  describe('When generating files for a multi-language app', () => {
    test('Then generates files for each language', async () => {
      const app = createTestApp({
        languages: {
          default: 'en',
          supported: [
            { code: 'en', label: 'English' },
            { code: 'fr', label: 'French' },
          ],
        },
      })

      // Track SSG calls per language
      const ssgCalls: string[] = []
      const mockSSG = {
        generate: (_app: App, options: { outputDir: string }) => {
          ssgCalls.push(options.outputDir)
          return Effect.succeed({ files: ['index.html'] })
        },
      }

      const result = await Effect.runPromiseExit(
        generateMultiLanguageFiles(
          app,
          '/output',
          (appParam, _lang) => appParam, // Identity transform
          createMockServerFactory(),
          createMockPageRenderer(),
          mockSSG as any
        )
      )

      expect(Exit.isSuccess(result)).toBe(true)
      // Should have called SSG for each language + root
      expect(ssgCalls).toContain('/output/en')
      expect(ssgCalls).toContain('/output/fr')
      expect(ssgCalls).toContain('/output')
    })

    test('Then prefixes files with language code', async () => {
      const app = createTestApp({
        languages: {
          default: 'en',
          supported: [{ code: 'en', label: 'English' }],
        },
      })

      const mockSSG = {
        generate: () => Effect.succeed({ files: ['index.html', 'about.html'] }),
      }

      const result = await Effect.runPromiseExit(
        generateMultiLanguageFiles(
          app,
          '/output',
          (appParam, _lang) => appParam,
          createMockServerFactory(),
          createMockPageRenderer(),
          mockSSG as any
        )
      )

      expect(Exit.isSuccess(result)).toBe(true)
      if (Exit.isSuccess(result)) {
        expect(result.value).toContain('en/index.html')
        expect(result.value).toContain('en/about.html')
      }
    })

    test('Then includes root index.html in output', async () => {
      const app = createTestApp({
        languages: {
          default: 'en',
          supported: [{ code: 'en', label: 'English' }],
        },
      })

      const mockSSG = {
        generate: (_app: App, options: { outputDir: string }) => {
          // Return different files for root vs language dirs
          if (options.outputDir === '/output') {
            return Effect.succeed({ files: ['index.html'] })
          }
          return Effect.succeed({ files: ['index.html', 'about.html'] })
        },
      }

      const result = await Effect.runPromiseExit(
        generateMultiLanguageFiles(
          app,
          '/output',
          (appParam, _lang) => appParam,
          createMockServerFactory(),
          createMockPageRenderer(),
          mockSSG as any
        )
      )

      expect(Exit.isSuccess(result)).toBe(true)
      if (Exit.isSuccess(result)) {
        // Root index.html should be included (without prefix)
        expect(result.value).toContain('index.html')
      }
    })

    test('Then calls replaceAppTokens for each language', async () => {
      const app = createTestApp({
        languages: {
          default: 'en',
          supported: [
            { code: 'en', label: 'English' },
            { code: 'fr', label: 'French' },
          ],
        },
      })

      const tokenReplacements: string[] = []
      const replaceAppTokens = (appParam: App, lang: string): App => {
        tokenReplacements.push(lang)
        return appParam
      }

      await Effect.runPromise(
        generateMultiLanguageFiles(
          app,
          '/output',
          replaceAppTokens,
          createMockServerFactory(),
          createMockPageRenderer(),
          createMockStaticSiteGenerator()
        )
      )

      // Should replace tokens for en, fr, and default (en again for root)
      expect(tokenReplacements).toContain('en')
      expect(tokenReplacements).toContain('fr')
      expect(tokenReplacements.filter((l) => l === 'en').length).toBe(2) // Once for lang, once for default root
    })

    test('Then filters underscore-prefixed pages in each language', async () => {
      const app = createTestApp({
        languages: {
          default: 'en',
          supported: [{ code: 'en', label: 'English' }],
        },
        pages: [
          { name: 'Home', path: '/', sections: [] },
          { name: 'About', path: '/about', sections: [] },
          { name: 'Internal', path: '/_internal', sections: [] },
        ],
      })

      let capturedPagePaths: string[] = []
      const mockSSG = {
        generate: (_app: App, options: { pagePaths: string[] }) => {
          if (options.pagePaths.length > 1) {
            capturedPagePaths = options.pagePaths
          }
          return Effect.succeed({ files: ['index.html', 'about.html'] })
        },
      }

      await Effect.runPromise(
        generateMultiLanguageFiles(
          app,
          '/output',
          (appParam, _lang) => appParam,
          createMockServerFactory(),
          createMockPageRenderer(),
          mockSSG as any
        )
      )

      expect(capturedPagePaths).toEqual(['/', '/about'])
      expect(capturedPagePaths).not.toContain('/_internal')
    })
  })
})
