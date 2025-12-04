/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Logger } from 'effect'

/**
 * Effect-based logging bridge for non-Effect contexts
 *
 * This module provides helper functions to use Effect's structured logging
 * from non-Effect contexts (async callbacks, module initialization, etc.).
 *
 * Why use this instead of console.*:
 * 1. Structured logging with consistent format
 * 2. Log levels for filtering (error, warning, info, debug)
 * 3. Cause chain support for error context
 * 4. Future-proof: easy to add log aggregation, tracing, etc.
 *
 * @example
 * ```typescript
 * import { logError, logWarning, logInfo } from '@/infrastructure/logging/effect-logger'
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
 * Custom logger that formats messages with timestamp and level
 */
const structuredLogger = Logger.make(({ logLevel, message, cause }) => {
  const timestamp = new Date().toISOString()
  const level = logLevel.label.toUpperCase()
  const messageStr = typeof message === 'string' ? message : JSON.stringify(message)

  // Format: [2025-01-15T10:30:00.000Z] [ERROR] message
  const formatted = `[${timestamp}] [${level}] ${messageStr}`

  // Use appropriate console method based on log level
  switch (logLevel._tag) {
    case 'Error':
    case 'Fatal': {
      console.error(formatted, cause ?? '')
      break
    }
    case 'Warning': {
      console.warn(formatted)
      break
    }
    case 'Info': {
      console.info(formatted)
      break
    }
    default: {
      console.log(formatted)
    }
  }
})

/**
 * Run an Effect logging operation synchronously
 *
 * This is safe for logging effects as they don't require external services
 * and complete synchronously.
 */
const runLogEffect = <A>(effect: Effect.Effect<A>): void => {
  // eslint-disable-next-line functional/no-expression-statements -- Side effect for logging
  Effect.runSync(
    effect.pipe(Effect.provide(Logger.replace(Logger.defaultLogger, structuredLogger)))
  )
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
    cause
      ? Effect.logError(message).pipe(Effect.annotateLogs('cause', String(cause)))
      : Effect.logError(message)
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
  runLogEffect(Effect.logWarning(message))
}

/**
 * Log an info message
 *
 * Use for notable events during normal operation (startup, config loaded, etc.).
 *
 * @param message - Info message
 */
export const logInfo = (message: string): void => {
  runLogEffect(Effect.logInfo(message))
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
  runLogEffect(Effect.logDebug(message).pipe(Effect.withLogSpan('debug')))
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
