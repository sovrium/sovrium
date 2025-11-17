/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { CSSCompilationError } from './css-compilation-error'

describe('CSSCompilationError', () => {
  describe('Error construction', () => {
    test('creates error with string cause', () => {
      // Given
      const cause = 'Invalid CSS syntax'

      // When
      const error = new CSSCompilationError(cause)

      // Then
      expect(error).toBeInstanceOf(CSSCompilationError)
      expect(error._tag).toBe('CSSCompilationError')
      expect(error.cause).toBe(cause)
    })

    test('creates error with Error cause', () => {
      // Given
      const cause = new Error('PostCSS compilation failed')

      // When
      const error = new CSSCompilationError(cause)

      // Then
      expect(error).toBeInstanceOf(CSSCompilationError)
      expect(error._tag).toBe('CSSCompilationError')
      expect(error.cause).toBe(cause)
    })

    test('creates error with object cause', () => {
      // Given
      const cause = {
        file: 'styles.css',
        line: 42,
        column: 15,
        message: 'Unexpected token',
      }

      // When
      const error = new CSSCompilationError(cause)

      // Then
      expect(error).toBeInstanceOf(CSSCompilationError)
      expect(error._tag).toBe('CSSCompilationError')
      expect(error.cause).toEqual(cause)
    })

    test('creates error with null cause', () => {
      // Given
      const cause = null

      // When
      const error = new CSSCompilationError(cause)

      // Then
      expect(error).toBeInstanceOf(CSSCompilationError)
      expect(error._tag).toBe('CSSCompilationError')
      expect(error.cause).toBe(null)
    })

    test('creates error with undefined cause', () => {
      // Given
      const cause = undefined

      // When
      const error = new CSSCompilationError(cause)

      // Then
      expect(error).toBeInstanceOf(CSSCompilationError)
      expect(error._tag).toBe('CSSCompilationError')
      expect(error.cause).toBe(undefined)
    })
  })

  describe('Error tag', () => {
    test('has correct _tag property', () => {
      // When
      const error = new CSSCompilationError('test')

      // Then
      expect(error._tag).toBe('CSSCompilationError')
      // Note: TypeScript readonly is compile-time only, not runtime enforced
      // The _tag property should not be modified in practice
    })

    test('tag is consistent across instances', () => {
      // When
      const error1 = new CSSCompilationError('cause1')
      const error2 = new CSSCompilationError('cause2')

      // Then
      expect(error1._tag).toBe('CSSCompilationError')
      expect(error2._tag).toBe('CSSCompilationError')
      expect(error1._tag).toBe(error2._tag)
    })

    test('tag differs from other error types', () => {
      // When
      const cssError = new CSSCompilationError('css failed')
      const regularError = new Error('regular error')

      // Then
      expect(cssError._tag).toBe('CSSCompilationError')
      expect((regularError as any)._tag).toBeUndefined()
    })
  })

  describe('CSS-specific error scenarios', () => {
    test('handles syntax error', () => {
      // Given
      const cause = {
        type: 'SYNTAX_ERROR',
        file: 'app.css',
        line: 10,
        column: 5,
        message: 'Expected ";" but found "{"',
        code: '.button { color: red { }',
      }

      // When
      const error = new CSSCompilationError(cause)

      // Then
      expect((error.cause as any).type).toBe('SYNTAX_ERROR')
      expect((error.cause as any).file).toBe('app.css')
      expect((error.cause as any).line).toBe(10)
      expect((error.cause as any).column).toBe(5)
    })

    test('handles PostCSS plugin error', () => {
      // Given
      const cause = {
        type: 'POSTCSS_PLUGIN_ERROR',
        plugin: 'postcss-nested',
        message: 'Cannot process nested rule',
        input: '.parent { &.child { } }',
      }

      // When
      const error = new CSSCompilationError(cause)

      // Then
      expect((error.cause as any).type).toBe('POSTCSS_PLUGIN_ERROR')
      expect((error.cause as any).plugin).toBe('postcss-nested')
    })

    test('handles Tailwind CSS compilation error', () => {
      // Given
      const cause = {
        type: 'TAILWIND_ERROR',
        class: 'text-invalid-500',
        message: 'Invalid color value',
        suggestion: 'Did you mean text-indigo-500?',
      }

      // When
      const error = new CSSCompilationError(cause)

      // Then
      expect((error.cause as any).type).toBe('TAILWIND_ERROR')
      expect((error.cause as any).class).toBe('text-invalid-500')
      expect((error.cause as any).suggestion).toBe('Did you mean text-indigo-500?')
    })

    test('handles CSS import error', () => {
      // Given
      const cause = {
        type: 'IMPORT_ERROR',
        file: 'styles.css',
        importPath: './missing.css',
        message: 'Cannot resolve import',
        resolvedPaths: ['/src/missing.css', '/node_modules/missing.css'],
      }

      // When
      const error = new CSSCompilationError(cause)

      // Then
      expect((error.cause as any).type).toBe('IMPORT_ERROR')
      expect((error.cause as any).importPath).toBe('./missing.css')
      expect((error.cause as any).resolvedPaths).toHaveLength(2)
    })

    test('handles CSS variable error', () => {
      // Given
      const cause = {
        type: 'CSS_VARIABLE_ERROR',
        variable: '--undefined-color',
        usage: 'color: var(--undefined-color)',
        availableVariables: ['--primary-color', '--secondary-color'],
      }

      // When
      const error = new CSSCompilationError(cause)

      // Then
      expect((error.cause as any).type).toBe('CSS_VARIABLE_ERROR')
      expect((error.cause as any).variable).toBe('--undefined-color')
      expect((error.cause as any).availableVariables).toContain('--primary-color')
    })
  })

  describe('Error cause preservation', () => {
    test('preserves complex CSS error objects', () => {
      // Given
      const complexCause = {
        message: 'CSS compilation failed',
        errors: [
          { file: 'main.css', line: 1, message: 'Syntax error' },
          { file: 'theme.css', line: 5, message: 'Invalid value' },
        ],
        warnings: [
          { message: 'Deprecated property used' },
          { message: 'Browser compatibility issue' },
        ],
        stats: {
          filesProcessed: 10,
          timeTaken: 1500,
          outputSize: 25_600,
        },
      }

      // When
      const error = new CSSCompilationError(complexCause)

      // Then
      expect(error.cause).toEqual(complexCause)
      expect((error.cause as any).errors).toHaveLength(2)
      expect((error.cause as any).warnings).toHaveLength(2)
      expect((error.cause as any).stats.filesProcessed).toBe(10)
    })

    test('preserves Error stack traces', () => {
      // Given
      const originalError = new Error('CSS parsing failed')
      const stackTrace = originalError.stack

      // When
      const error = new CSSCompilationError(originalError)

      // Then
      expect((error.cause as Error).stack).toBe(stackTrace)
      expect((error.cause as Error).message).toBe('CSS parsing failed')
    })

    test('handles circular references in error details', () => {
      // Given
      const circularObj: any = { type: 'CSS_ERROR' }
      circularObj.self = circularObj

      // When
      const error = new CSSCompilationError(circularObj)

      // Then
      expect(error.cause).toBe(circularObj)
      expect((error.cause as any).self).toBe(circularObj)
    })
  })

  describe('Type guards and instanceof', () => {
    test('works with instanceof checks', () => {
      // When
      const error = new CSSCompilationError('test')
      const regularError = new Error('regular')

      // Then
      expect(error instanceof CSSCompilationError).toBe(true)
      expect(regularError instanceof CSSCompilationError).toBe(false)
    })

    test('can be used in Effect error handling', () => {
      // Given
      const error = new CSSCompilationError('test')

      // When
      const isCSSCompilationError = (e: unknown): e is CSSCompilationError =>
        e instanceof CSSCompilationError && e._tag === 'CSSCompilationError'

      // Then
      expect(isCSSCompilationError(error)).toBe(true)
      expect(isCSSCompilationError(new Error('test'))).toBe(false)
      expect(isCSSCompilationError({ _tag: 'CSSCompilationError' })).toBe(false)
    })
  })

  describe('Usage patterns', () => {
    test('can be thrown and caught', () => {
      // Given
      const errorCause = 'Invalid CSS syntax'

      // When/Then
      expect(() => {
        throw new CSSCompilationError(errorCause)
      }).toThrow()
      try {
        throw new CSSCompilationError(errorCause)
      } catch (e) {
        expect(e).toBeInstanceOf(CSSCompilationError)
        expect((e as CSSCompilationError)._tag).toBe('CSSCompilationError')
        expect((e as CSSCompilationError).cause).toBe(errorCause)
      }
    })

    test('can be created from caught exceptions', () => {
      // Given
      let capturedError: CSSCompilationError | undefined

      // When
      try {
        // Simulate CSS parsing failure
        throw new Error('Unexpected token in CSS')
      } catch (e) {
        capturedError = new CSSCompilationError(e)
      }

      // Then
      expect(capturedError).toBeDefined()
      expect(capturedError?._tag).toBe('CSSCompilationError')
      expect((capturedError?.cause as Error).message).toBe('Unexpected token in CSS')
    })

    test('can chain multiple CSS compilation errors', () => {
      // Given
      const parseError = new Error('Parse error at line 10')
      const compilationError = new CSSCompilationError(parseError)
      const buildError = new CSSCompilationError(compilationError)

      // When
      const unwrapCause = (error: CSSCompilationError): unknown => {
        let { cause } = error
        while (cause instanceof CSSCompilationError) {
          cause = cause.cause
        }
        return cause
      }

      // Then
      expect(buildError.cause).toBe(compilationError)
      expect((buildError.cause as CSSCompilationError).cause).toBe(parseError)
      expect(unwrapCause(buildError)).toBe(parseError)
    })

    test('can be used in CSS build pipeline', () => {
      // When/Then - valid CSS
      const validCSS = '.button { color: red; }'
      const processedValidCSS = validCSS.replace(/\s+/g, ' ').trim()
      expect(processedValidCSS).toBe('.button { color: red; }')

      // When/Then - invalid CSS
      const invalidCSS = '.button { color: invalid; }'
      try {
        if (invalidCSS.includes('invalid')) {
          throw new CSSCompilationError({
            type: 'COMPILATION_ERROR',
            input: invalidCSS,
            message: 'CSS contains invalid syntax',
            position: invalidCSS.indexOf('invalid'),
          })
        }
      } catch (e) {
        expect(e).toBeInstanceOf(CSSCompilationError)
        expect((e as CSSCompilationError).cause).toEqual({
          type: 'COMPILATION_ERROR',
          input: '.button { color: invalid; }',
          message: 'CSS contains invalid syntax',
          position: 17,
        })
      }
    })

    test('can accumulate multiple CSS errors', () => {
      // Given
      const errors: CSSCompilationError[] = []
      const cssFiles = [
        { name: 'main.css', content: 'invalid1' },
        { name: 'theme.css', content: 'valid' },
        { name: 'components.css', content: 'invalid2' },
      ]

      // When
      cssFiles.forEach((file) => {
        if (file.content.includes('invalid')) {
          errors.push(
            new CSSCompilationError({
              file: file.name,
              content: file.content,
            })
          )
        }
      })

      // Then
      expect(errors).toHaveLength(2)
      expect((errors[0]?.cause as any)?.file).toBe('main.css')
      expect((errors[1]?.cause as any)?.file).toBe('components.css')
    })
  })
})
