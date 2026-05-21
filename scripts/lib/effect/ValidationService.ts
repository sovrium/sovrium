/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import * as Array from 'effect/Array'
import * as Context from 'effect/Context'
import * as Data from 'effect/Data'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Schema from 'effect/Schema'

export class ValidationFailedError extends Data.TaggedError('ValidationFailedError')<{
  readonly errors: readonly ValidationIssue[]
  readonly file?: string
}> {}

export class SchemaValidationError extends Data.TaggedError('SchemaValidationError')<{
  readonly message: string
  readonly file: string
  readonly cause?: unknown
}> {}

export type ValidationSeverity = 'error' | 'warning' | 'info'

export interface ValidationIssue {
  readonly file: string
  readonly severity: ValidationSeverity
  readonly message: string
  readonly line?: number
  readonly column?: number
  readonly code?: string
}

export interface ValidationResult {
  readonly passed: boolean
  readonly errors: readonly ValidationIssue[]
  readonly warnings: readonly ValidationIssue[]
  readonly infos: readonly ValidationIssue[]
  readonly totalSchemas: number
  readonly totalSpecs: number
  readonly duration: number
}

export const emptyValidationResult: ValidationResult = {
  passed: true,
  errors: [],
  warnings: [],
  infos: [],
  totalSchemas: 0,
  totalSpecs: 0,
  duration: 0,
}

export interface ValidationService {
  readonly validateSchema: <A, I>(
    schema: Schema.Schema<A, I>,
    data: I,
    file: string
  ) => Effect.Effect<A, SchemaValidationError>

  readonly validateAll: <A, E>(
    items: readonly A[],
    validator: (item: A, index: number) => Effect.Effect<ValidationIssue[], E>
  ) => Effect.Effect<ValidationResult>

  readonly createIssue: (issue: {
    file: string
    severity: ValidationSeverity
    message: string
    line?: number
    column?: number
    code?: string
  }) => ValidationIssue

  readonly combineResults: (results: readonly ValidationResult[]) => ValidationResult

  readonly formatResult: (result: ValidationResult, title?: string) => string

  readonly assertPassed: (result: ValidationResult) => Effect.Effect<void, ValidationFailedError>
}

export const ValidationService = Context.GenericTag<ValidationService>('ValidationService')

export const ValidationServiceLive = Layer.succeed(
  ValidationService,
  ValidationService.of({
    validateSchema: <A, I>(schema: Schema.Schema<A, I>, data: I, file: string) =>
      Schema.decodeUnknown(schema)(data).pipe(
        Effect.mapError(
          (parseError) =>
            new SchemaValidationError({
              message: `Schema validation failed: ${parseError.message}`,
              file,
              cause: parseError,
            })
        )
      ),

    validateAll: <A, E>(
      items: readonly A[],
      validator: (item: A, index: number) => Effect.Effect<ValidationIssue[], E>
    ) =>
      Effect.gen(function* () {
        const startTime = Date.now()

        const issuesArrays = yield* Effect.all(
          items.map((item, index) =>
            validator(item, index).pipe(
              Effect.catchAll((error) => {
                const issue: ValidationIssue = {
                  file: 'unknown',
                  severity: 'error',
                  message: String(error),
                }
                return Effect.succeed([issue])
              })
            )
          ),
          { concurrency: 'unbounded' }
        )

        const allIssues = issuesArrays.flat()

        const errors = allIssues.filter((i) => i.severity === 'error')
        const warnings = allIssues.filter((i) => i.severity === 'warning')
        const infos = allIssues.filter((i) => i.severity === 'info')

        const duration = Date.now() - startTime

        return {
          passed: errors.length === 0,
          errors,
          warnings,
          infos,
          totalSchemas: items.length,
          totalSpecs: 0,
          duration,
        }
      }),

    createIssue: (issue) => ({
      file: issue.file,
      severity: issue.severity,
      message: issue.message,
      line: issue.line,
      column: issue.column,
      code: issue.code,
    }),

    combineResults: (results) => {
      const totalDuration = Array.reduce(results, 0, (acc, r) => acc + r.duration)
      const totalSchemas = Array.reduce(results, 0, (acc, r) => acc + r.totalSchemas)
      const totalSpecs = Array.reduce(results, 0, (acc, r) => acc + r.totalSpecs)

      const allErrors = results.flatMap((r) => r.errors)
      const allWarnings = results.flatMap((r) => r.warnings)
      const allInfos = results.flatMap((r) => r.infos)

      return {
        passed: results.every((r) => r.passed),
        errors: allErrors,
        warnings: allWarnings,
        infos: allInfos,
        totalSchemas,
        totalSpecs,
        duration: totalDuration,
      }
    },

    formatResult: (result, title = 'Validation Results') => {
      const lines: string[] = []
      const separator = '='.repeat(80)

      lines.push('')
      lines.push(separator)
      lines.push(title)
      lines.push(separator)
      lines.push('')

      lines.push(`📊 Total Schemas: ${result.totalSchemas}`)
      lines.push(`📋 Total Specs: ${result.totalSpecs}`)
      lines.push(`❌ Errors: ${result.errors.length}`)
      lines.push(`⚠️  Warnings: ${result.warnings.length}`)
      lines.push(`ℹ️  Info: ${result.infos.length}`)
      lines.push(`⏱️  Duration: ${result.duration}ms`)
      lines.push('')

      if (result.errors.length > 0) {
        lines.push('❌ ERRORS:\n')
        result.errors.forEach((error) => {
          lines.push(`  ${error.file}${error.line ? `:${error.line}` : ''}`)
          lines.push(`    → ${error.message}`)
          if (error.code) {
            lines.push(`    Code: ${error.code}`)
          }
          lines.push('')
        })
      }

      if (result.warnings.length > 0) {
        lines.push('⚠️  WARNINGS:\n')
        result.warnings.forEach((warning) => {
          lines.push(`  ${warning.file}${warning.line ? `:${warning.line}` : ''}`)
          lines.push(`    → ${warning.message}`)
          if (warning.code) {
            lines.push(`    Code: ${warning.code}`)
          }
          lines.push('')
        })
      }

      if (result.infos.length > 0) {
        lines.push('ℹ️  INFO:\n')
        result.infos.forEach((info) => {
          lines.push(`  ${info.file}${info.line ? `:${info.line}` : ''}`)
          lines.push(`    → ${info.message}`)
          lines.push('')
        })
      }

      if (result.errors.length === 0 && result.warnings.length === 0 && result.infos.length === 0) {
        lines.push('✅ All validations passed!\n')
      }

      lines.push(separator)
      lines.push('')

      return lines.join('\n')
    },

    assertPassed: (result) =>
      result.passed
        ? Effect.void
        : Effect.fail(new ValidationFailedError({ errors: result.errors })),
  })
)


export const validateSchema = <A, I>(schema: Schema.Schema<A, I>, data: I, file: string) =>
  ValidationService.pipe(Effect.flatMap((service) => service.validateSchema(schema, data, file)))

export const validateAll = <A, E>(
  items: readonly A[],
  validator: (item: A, index: number) => Effect.Effect<ValidationIssue[], E>
) => ValidationService.pipe(Effect.flatMap((service) => service.validateAll(items, validator)))

export const createIssue = (issue: {
  file: string
  severity: ValidationSeverity
  message: string
  line?: number
  column?: number
  code?: string
}) => ValidationService.pipe(Effect.map((service) => service.createIssue(issue)))

export const combineResults = (results: readonly ValidationResult[]) =>
  ValidationService.pipe(Effect.map((service) => service.combineResults(results)))

export const formatResult = (result: ValidationResult, title?: string) =>
  ValidationService.pipe(Effect.map((service) => service.formatResult(result, title)))

export const assertPassed = (result: ValidationResult) =>
  ValidationService.pipe(Effect.flatMap((service) => service.assertPassed(result)))


export const noIssues = (): Effect.Effect<ValidationIssue[]> => Effect.succeed([])

export const error = (
  file: string,
  message: string,
  line?: number
): Effect.Effect<ValidationIssue[]> => Effect.succeed([{ file, severity: 'error', message, line }])

export const warning = (
  file: string,
  message: string,
  line?: number
): Effect.Effect<ValidationIssue[]> =>
  Effect.succeed([{ file, severity: 'warning', message, line }])

export const info = (
  file: string,
  message: string,
  line?: number
): Effect.Effect<ValidationIssue[]> => Effect.succeed([{ file, severity: 'info', message, line }])

export const combineIssues = (issuesArrays: ValidationIssue[][]): ValidationIssue[] =>
  issuesArrays.flat()
