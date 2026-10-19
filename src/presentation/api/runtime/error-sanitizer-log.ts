/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { logDebug, logError, logWarning } from '@/infrastructure/logging/logger'

/**
 * The two log levels the error sanitizer writes at, injectable so a unit test
 * can observe which one a classification reached without touching the
 * process-wide logger.
 */
export interface SanitizerLog {
  readonly error: (message: string, cause?: unknown) => void
  readonly warn: (message: string) => void
}

export const DEFAULT_SANITIZER_LOG: SanitizerLog = {
  error: (message, cause) => logError(message, cause),
  warn: (message) => logWarning(message),
}

/** Debug-level detail for an error, whatever its classification; filtered out in production. */
const logDebugDetails = (error: unknown): void => {
  const isObject = error !== null && typeof error === 'object'
  logDebug(`[API Error - error type] ${typeof error}`)
  logDebug(
    `[API Error - error own keys] ${isObject ? Object.keys(error).join(', ') : 'not an object'}`
  )
  logDebug(
    `[API Error - error all keys] ${isObject ? Object.getOwnPropertyNames(error).join(', ') : 'not an object'}`
  )
  const fields = (error ?? {}) as { _tag?: unknown; message?: unknown; details?: unknown }
  logDebug(`[API Error - error _tag] ${String(fields._tag)}`)
  logDebug(`[API Error - error message] ${String(fields.message)}`)
  logDebug(`[API Error - error details] ${JSON.stringify(fields.details)}`)
}

/**
 * Log an error the API is about to answer.
 *
 * A request refused because of the caller's own input (`callerSide` names the
 * classification) is an ordinary 4xx: one warn line with the request id, the
 * answer and the classification — no stack and no driver text, which can echo
 * submitted values (S4). Anything else is a server-side fault and keeps the
 * error-level log with its cause.
 */
export const logAnsweredError = (
  input: {
    readonly error: unknown
    readonly requestId: string | undefined
    /** The status and code answered, e.g. `400 VALIDATION_ERROR`. */
    readonly answered: string
    readonly callerSide: string | undefined
  },
  log: SanitizerLog
): void => {
  if (input.callerSide !== undefined) {
    log.warn(
      `[API Error] requestId=${input.requestId} answered ${input.answered} (${input.callerSide})`
    )
  } else {
    log.error(`[API Error] requestId=${input.requestId}`, input.error)
  }
  logDebugDetails(input.error)
}
