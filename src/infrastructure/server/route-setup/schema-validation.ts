/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Either, Schema } from 'effect'
import { ArrayFormatter } from 'effect/ParseResult'
import { AppSchema, type App } from '@/domain/models/app'

export interface ValidationError {
  readonly field: string
  readonly path: string
  readonly message: string
}

export interface ValidationResult {
  readonly valid: boolean
  readonly errors: ReadonlyArray<ValidationError>
}

export const validateSnapshot = (snapshot: unknown): ValidationResult => {
  const result = Schema.decodeUnknownEither(AppSchema)(snapshot)
  if (Either.isRight(result)) return { valid: true, errors: [] }
  const issues = ArrayFormatter.formatErrorSync(result.left)
  const errors = issues.map((issue) => {
    const pointer = `/${issue.path.join('/')}`
    return { field: pointer, path: pointer, message: issue.message }
  })
  return { valid: false, errors }
}

export const decodeSnapshotToApp = (snapshot: unknown): App | undefined => {
  const result = Schema.decodeUnknownEither(AppSchema)(snapshot)
  return Either.isRight(result) ? result.right : undefined
}
