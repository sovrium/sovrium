/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Effect, Layer } from 'effect'
import { emitTelemetryLog, type LogAttributes } from '@/infrastructure/telemetry/telemetry-sink'

/**
 * Sovrium logging convention (unified observability runtime)
 * ==========================================================
 *
 * Levels — pick by intent, not by how bad it feels:
 *   - info  → lifecycle events (server listening/stopped, migrations applied,
 *             config loaded). Visible at the default log level.
 *   - debug → flow/tracing (per-step narration, "disabled — requires X" skips).
 *             Filtered out at the default level; shown when LOG_LEVEL=debug.
 *   - warn  → security or degradation (auth gate rejections, optional config
 *             missing, feature degrading but recovering).
 *   - error → a real failure. ALWAYS pass the caught error as the `cause` arg
 *             so its full `cause` chain is printed locally AND forwarded to
 *             Sentry (a wrapper alone names the operation, never the reason).
 *
 * Message shape:
 *   - Prefix every line with exactly one lowercase-kebab `[area]` tag naming the
 *     subsystem (`[server]`, `[migrations]`, `[schema]`, `[ai-rag]`, `[agents]`),
 *     NOT the enclosing function name.
 *   - Keep the message a short, stable, human sentence — no interpolated values.
 *
 * Structured data:
 *   - Pass the real Error/cause object as the second arg of `logError`
 *     (`logError(msg, cause, attrs)`) — NEVER `` `…${String(error)}` `` in the
 *     message (that drops the stack and skips Sentry).
 *   - Pass ids/entities as the `attributes` record (string→string), which rides
 *     the OTLP record: `logError('[cron] job failed', err, { jobId })`.
 */

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
    readonly debug: (message: string, attributes?: LogAttributes) => Effect.Effect<void>
    readonly info: (message: string, attributes?: LogAttributes) => Effect.Effect<void>
    readonly warn: (message: string, attributes?: LogAttributes) => Effect.Effect<void>
    readonly error: (
      message: string,
      cause?: unknown,
      attributes?: LogAttributes
    ) => Effect.Effect<void>
  }
>() {}

/**
 * Live logger implementation.
 *
 * Every method funnels through `emitTelemetryLog`, the single dual-write bridge
 * over the unified observability runtime: one call writes the `[ISO] [LEVEL] msg`
 * line to stdout AND exports the OTLP record (once telemetry is active). Level
 * filtering (the `LOG_LEVEL` debug gate) lives in that runtime's
 * `minimumLogLevel`; structured `attributes` (e.g. `request.id`) ride the OTLP
 * record only; an `error` cause is forwarded to the Sentry reporter AND printed
 * to stderr as its FULL `cause` chain (wrapper, then each `Caused by:` link).
 *
 * The chain matters: this docstring previously promised "a local stack", and the
 * code wrote `cause.stack` — which stops at the wrapper. A wrapped error's real
 * origin therefore reached neither stderr nor journald, and an incident's root
 * cause was unrecoverable. Both sinks now walk the chain via
 * `infrastructure/telemetry/error-chain`.
 */
export const LoggerLive = Layer.succeed(Logger, {
  debug: (message, attributes) =>
    Effect.sync(() => emitTelemetryLog('debug', message, undefined, attributes)),
  info: (message, attributes) =>
    Effect.sync(() => emitTelemetryLog('info', message, undefined, attributes)),
  warn: (message, attributes) =>
    Effect.sync(() => emitTelemetryLog('warn', message, undefined, attributes)),
  error: (message, cause, attributes) =>
    Effect.sync(() => emitTelemetryLog('error', message, cause, attributes)),
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
 * Log an error message with optional cause
 *
 * Use for unexpected errors, exceptions, and failure conditions.
 *
 * @param message - Error message (include context like [EMAIL], [AUTH])
 * @param cause - Optional error cause for stack trace + Sentry forwarding
 */
export const logError = (message: string, cause?: unknown, attributes?: LogAttributes): void =>
  emitTelemetryLog('error', message, cause, attributes)

/**
 * Log a warning message
 *
 * Use for non-critical issues that should be addressed but don't
 * prevent operation (missing optional config, deprecated usage, etc.).
 *
 * @param message - Warning message
 */
export const logWarning = (message: string, attributes?: LogAttributes): void =>
  emitTelemetryLog('warn', message, undefined, attributes)

/**
 * Log an info message
 *
 * Use for notable events during normal operation (startup, config loaded, etc.).
 *
 * @param message - Info message
 */
export const logInfo = (message: string, attributes?: LogAttributes): void =>
  emitTelemetryLog('info', message, undefined, attributes)

/**
 * Log a debug message
 *
 * Use for detailed debugging information (variable values, flow tracing).
 * These are typically filtered out in production.
 *
 * @param message - Debug message
 */
export const logDebug = (message: string, attributes?: LogAttributes): void =>
  emitTelemetryLog('debug', message, undefined, attributes)
