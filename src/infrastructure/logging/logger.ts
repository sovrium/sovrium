/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Effect, Layer } from 'effect'

/**
 * Logger service for application-wide logging
 *
 * Provides structured logging with log levels:
 * - debug: Detailed diagnostic information
 * - info: General informational messages
 * - warn: Warning messages for potential issues
 * - error: Error messages for failures
 */
export class Logger extends Context.Tag('Logger')<
  Logger,
  {
    readonly debug: (message: string, ...args: unknown[]) => Effect.Effect<void>
    readonly info: (message: string, ...args: unknown[]) => Effect.Effect<void>
    readonly warn: (message: string, ...args: unknown[]) => Effect.Effect<void>
    readonly error: (message: string, error?: unknown) => Effect.Effect<void>
  }
>() {}

/**
 * Format log message with timestamp
 */
const formatLogMessage = (level: string, message: string): string => {
  const timestamp = new Date().toISOString()
  return `[${timestamp}] [${level}] ${message}`
}

/**
 * Console-based logger implementation
 *
 * Uses console.* methods for output with structured formatting
 * Format: [2025-01-15T10:30:00.000Z] [LEVEL] message
 */
export const LoggerLive = Layer.succeed(Logger, {
  debug: (message, ...args) =>
    Effect.sync(() => {
      if (process.env.LOG_LEVEL === 'debug' || process.env.NODE_ENV === 'development') {
        console.debug(formatLogMessage('DEBUG', message), ...args)
      }
    }),

  info: (message, ...args) =>
    Effect.sync(() => {
      console.log(formatLogMessage('INFO', message), ...args)
    }),

  warn: (message, ...args) =>
    Effect.sync(() => {
      console.warn(formatLogMessage('WARN', message), ...args)
    }),

  error: (message, error) =>
    Effect.sync(() => {
      if (error) {
        console.error(formatLogMessage('ERROR', message), error)
      } else {
        console.error(formatLogMessage('ERROR', message))
      }
    }),
})

/**
 * Silent logger for testing
 *
 * Discards all log messages
 */
export const LoggerSilent = Layer.succeed(Logger, {
  debug: () => Effect.void,
  info: () => Effect.void,
  warn: () => Effect.void,
  error: () => Effect.void,
})

// ============================================================================
// Convenience Functions for Non-Effect Contexts
// ============================================================================

/**
 * Convenience logging functions for non-Effect contexts
 *
 * These functions provide a bridge to use the Logger service from code that
 * doesn't use Effect.gen (async callbacks, module initialization, etc.).
 *
 * Implementation: Thin wrapper around Logger service that automatically
 * provides LoggerLive layer and runs the Effect synchronously.
 *
 * Why use this instead of console.*:
 * 1. Consistent formatting with Logger service (timestamps, levels)
 * 2. Single source of truth for logging implementation
 * 3. Log levels for filtering (error, warning, info, debug)
 * 4. Future-proof: easy to add log aggregation, tracing, etc.
 *
 * @example
 * ```typescript
 * import { logError, logWarning, logInfo } from '@/infrastructure/logging/logger'
 *
 * // In a non-Effect callback (e.g., Better Auth email handler)
 * try {
 *   await sendEmail(...)
 * } catch (error) {
 *   logError('[EMAIL] Failed to send email', error)
 * }
 * ```
 */

/**
 * Run a Logger service Effect synchronously with LoggerLive layer
 *
 * This is safe for logging effects as they don't require async operations
 * and complete synchronously.
 */
const runLogEffect = <A>(effect: Effect.Effect<A, never, Logger>): void => {
  // eslint-disable-next-line functional/no-expression-statements -- Side effect for logging
  Effect.runSync(effect.pipe(Effect.provide(LoggerLive)))
}

/**
 * Log an error message with optional cause
 *
 * Use for unexpected errors, exceptions, and failure conditions.
 *
 * @param message - Error message (include context like [EMAIL], [AUTH])
 * @param cause - Optional error cause for stack trace
 */
export const logError = (message: string, cause?: unknown): void => {
  runLogEffect(
    Effect.gen(function* () {
      const logger = yield* Logger
      yield* logger.error(message, cause)
    })
  )
}

/**
 * Log a warning message
 *
 * Use for non-critical issues that should be addressed but don't
 * prevent operation (missing optional config, deprecated usage, etc.).
 *
 * @param message - Warning message
 */
export const logWarning = (message: string): void => {
  runLogEffect(
    Effect.gen(function* () {
      const logger = yield* Logger
      yield* logger.warn(message)
    })
  )
}

/**
 * Log an info message
 *
 * Use for notable events during normal operation (startup, config loaded, etc.).
 *
 * @param message - Info message
 */
export const logInfo = (message: string): void => {
  runLogEffect(
    Effect.gen(function* () {
      const logger = yield* Logger
      yield* logger.info(message)
    })
  )
}

/**
 * Log a debug message
 *
 * Use for detailed debugging information (variable values, flow tracing).
 * These are typically filtered out in production.
 *
 * @param message - Debug message
 */
export const logDebug = (message: string): void => {
  runLogEffect(
    Effect.gen(function* () {
      const logger = yield* Logger
      yield* logger.debug(message)
    })
  )
}

/**
 * Create a logger with a fixed prefix for a specific module
 *
 * @example
 * ```typescript
 * const emailLogger = createModuleLogger('EMAIL')
 * emailLogger.error('Failed to send') // Logs: [EMAIL] Failed to send
 * emailLogger.warn('SMTP not configured')
 * ```
 */
export const createModuleLogger = (module: string) => ({
  error: (message: string, cause?: unknown) => logError(`[${module}] ${message}`, cause),
  warning: (message: string) => logWarning(`[${module}] ${message}`),
  info: (message: string) => logInfo(`[${module}] ${message}`),
  debug: (message: string) => logDebug(`[${module}] ${message}`),
})
