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
