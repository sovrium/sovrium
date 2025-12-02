/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Effect, Layer } from 'effect'
import {
  StaticSiteGenerator,
  type SSGOptions,
  type SSGResult,
  type SSGGenerationError,
} from './static-site-generator'
import type { Hono } from 'hono'

describe('StaticSiteGenerator', () => {
  test('should be a Context.Tag', () => {
    expect(StaticSiteGenerator).toBeDefined()
    expect(typeof StaticSiteGenerator).toBe('function')
  })

  test('should have correct service identifier', () => {
    // Verify the tag has the expected identifier
    expect(String(StaticSiteGenerator)).toContain('StaticSiteGenerator')
  })

  test('should generate static files successfully', async () => {
    const mockResult: SSGResult = {
      outputDir: './static',
      files: ['index.html', 'about.html'],
    }

    const MockSSGLive = Layer.succeed(StaticSiteGenerator, {
      generate: (_app: Hono | Readonly<Hono>, _options: Readonly<SSGOptions>) =>
        Effect.succeed(mockResult),
    })

    const program = Effect.gen(function* () {
      const ssg = yield* StaticSiteGenerator
      return yield* ssg.generate({} as Hono, { outputDir: './static' })
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(MockSSGLive)))

    expect(result.outputDir).toBe('./static')
    expect(result.files).toEqual(['index.html', 'about.html'])
  })

  test('should fail with SSGGenerationError on error', async () => {
    const mockError: SSGGenerationError = {
      _tag: 'SSGGenerationError',
      message: 'Failed to generate static files',
      cause: new Error('File system error'),
    }

    const MockSSGLive = Layer.succeed(StaticSiteGenerator, {
      generate: (_app: Hono | Readonly<Hono>, _options: Readonly<SSGOptions>) =>
        Effect.fail(mockError),
    })

    const program = Effect.gen(function* () {
      const ssg = yield* StaticSiteGenerator
      return yield* ssg.generate({} as Hono, { outputDir: './static' })
    })

    const result = await Effect.runPromiseExit(program.pipe(Effect.provide(MockSSGLive)))

    expect(result._tag).toBe('Failure')
  })
})

describe('SSGOptions interface', () => {
  test('should have optional fields', () => {
    const options: SSGOptions = {}
    expect(options.outputDir).toBeUndefined()
    expect(options.baseUrl).toBeUndefined()
    expect(options.pagePaths).toBeUndefined()
  })

  test('should accept all configuration options', () => {
    const options: SSGOptions = {
      outputDir: './dist',
      baseUrl: 'https://example.com',
      basePath: '/app',
      deployment: 'github-pages',
      languages: ['en', 'fr'],
      defaultLanguage: 'en',
      generateSitemap: true,
      generateRobotsTxt: true,
      hydration: true,
      generateManifest: true,
      bundleOptimization: 'split',
      pagePaths: ['/', '/about'],
      publicDir: './public',
    }

    expect(options.outputDir).toBe('./dist')
    expect(options.deployment).toBe('github-pages')
    expect(options.languages).toEqual(['en', 'fr'])
    expect(options.bundleOptimization).toBe('split')
  })
})

describe('SSGResult interface', () => {
  test('should have correct shape', () => {
    const result: SSGResult = {
      outputDir: './static',
      files: ['index.html', 'styles.css', 'script.js'],
    }

    expect(result.outputDir).toBe('./static')
    expect(result.files).toHaveLength(3)
  })
})

describe('SSGGenerationError interface', () => {
  test('should have correct shape with message', () => {
    const error: SSGGenerationError = {
      _tag: 'SSGGenerationError',
      message: 'Generation failed',
    }

    expect(error._tag).toBe('SSGGenerationError')
    expect(error.message).toBe('Generation failed')
    expect(error.cause).toBeUndefined()
  })

  test('should have correct shape with cause', () => {
    const cause = new Error('IO error')
    const error: SSGGenerationError = {
      _tag: 'SSGGenerationError',
      message: 'Generation failed',
      cause,
    }

    expect(error.cause).toBe(cause)
  })
})
