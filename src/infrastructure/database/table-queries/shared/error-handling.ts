/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { SessionContextError, ValidationError } from '@/infrastructure/database'

/* eslint-disable functional/prefer-immutable-types -- Error handler factories for Effect.tryPromise catch: returns mutable Error class instances, parameter signature fixed as (error: unknown) by Effect API */

/**
 * Create a catch handler that preserves known error types and wraps unknowns in SessionContextError.
 *
 * Replaces the repeated pattern:
 * ```
 * catch: (error) =>
 *   error instanceof SessionContextError ? error
 *     : new SessionContextError(message, error)
 * ```
 *
 * @param message - Error message for wrapping unknown errors
 * @returns A catch handler suitable for Effect.tryPromise
 */
export function wrapDatabaseError(message: string): (error: unknown) => SessionContextError {
  return (error: unknown): SessionContextError =>
    error instanceof SessionContextError ? error : new SessionContextError(message, error)
}

/**
 * Create a catch handler that preserves SessionContextError and ValidationError,
 * wrapping all other errors in SessionContextError.
 *
 * Used in batch operations where ValidationError may propagate from inner Effect programs.
 *
 * @param message - Error message for wrapping unknown errors
 * @returns A catch handler suitable for Effect.tryPromise
 */
export function wrapDatabaseErrorWithValidation(
  message: string
): (error: unknown) => SessionContextError | ValidationError {
  return (error: unknown): SessionContextError | ValidationError => {
    if (error instanceof SessionContextError) return error
    if (error instanceof ValidationError) return error
    return new SessionContextError(message, error)
  }
}
