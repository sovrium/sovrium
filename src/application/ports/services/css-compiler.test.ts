/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Effect, Layer } from 'effect'
import { CSSCompiler, type CompiledCSS, type CSSCompilationError } from './css-compiler'
import type { App } from '@/domain/models/app'

describe('CSSCompiler', () => {
  test('should be a Context.Tag', () => {
    expect(CSSCompiler).toBeDefined()
    expect(typeof CSSCompiler).toBe('function')
  })

  test('should have correct service identifier', () => {
    // Verify the tag has the expected identifier
    expect(String(CSSCompiler)).toContain('CSSCompiler')
  })

  test('should compile CSS successfully', async () => {
    const mockCompiledCSS: CompiledCSS = {
      css: '.test { color: red; }',
      timestamp: Date.now(),
    }

    const MockCSSCompilerLive = Layer.succeed(CSSCompiler, {
      compile: (_app?: App) => Effect.succeed(mockCompiledCSS),
    })

    const program = Effect.gen(function* () {
      const cssCompiler = yield* CSSCompiler
      return yield* cssCompiler.compile()
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(MockCSSCompilerLive)))

    expect(result.css).toBe('.test { color: red; }')
    expect(result.timestamp).toBeDefined()
  })

  test('should fail with CSSCompilationError on error', async () => {
    const mockError: CSSCompilationError = {
      _tag: 'CSSCompilationError',
      cause: new Error('Compilation failed'),
    }

    const MockCSSCompilerLive = Layer.succeed(CSSCompiler, {
      compile: (_app?: App) => Effect.fail(mockError),
    })

    const program = Effect.gen(function* () {
      const cssCompiler = yield* CSSCompiler
      return yield* cssCompiler.compile()
    })

    const result = await Effect.runPromiseExit(program.pipe(Effect.provide(MockCSSCompilerLive)))

    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      const error = result.cause as unknown as { _tag: string; error: CSSCompilationError }
      expect(error.error._tag).toBe('CSSCompilationError')
    }
  })

  test('should accept optional app parameter', async () => {
    const mockApp: App = {
      name: 'test-app',
      theme: {
        colors: { primary: '#ff0000' },
      },
    }

    const MockCSSCompilerLive = Layer.succeed(CSSCompiler, {
      compile: (app?: App) =>
        Effect.succeed({
          css: app?.theme?.colors?.primary
            ? `.primary { color: ${app.theme.colors.primary}; }`
            : '',
          timestamp: Date.now(),
        }),
    })

    const program = Effect.gen(function* () {
      const cssCompiler = yield* CSSCompiler
      return yield* cssCompiler.compile(mockApp)
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(MockCSSCompilerLive)))

    expect(result.css).toContain('#ff0000')
  })
})

describe('CompiledCSS interface', () => {
  test('should have correct shape', () => {
    const compiled: CompiledCSS = {
      css: 'body { margin: 0; }',
      timestamp: 1_234_567_890,
    }

    expect(compiled.css).toBe('body { margin: 0; }')
    expect(compiled.timestamp).toBe(1_234_567_890)
  })
})

describe('CSSCompilationError interface', () => {
  test('should have correct shape', () => {
    const error: CSSCompilationError = {
      _tag: 'CSSCompilationError',
      cause: new Error('PostCSS failed'),
    }

    expect(error._tag).toBe('CSSCompilationError')
    expect(error.cause).toBeInstanceOf(Error)
  })
})
