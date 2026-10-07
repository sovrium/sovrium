/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * An optimistic-locked write whose token no longer matches the stored record.
 *
 * The caller sent the `updatedAt` it last read; the write compares it with the
 * stored value IN the statement that writes, and matched nothing because the
 * record changed since that read. The boundary answers `409 CONFLICT` so the
 * caller reloads and retries rather than overwriting an edit it never saw.
 *
 * Carries no `cause`: nothing failed underneath it, and a 409 must never carry
 * SQL text (standing rule S4).
 */
export class StaleWriteError extends Error {
  readonly _tag = 'StaleWriteError'
  readonly recordId: string

  constructor(message: string, recordId: string) {
    super(message)
    // eslint-disable-next-line functional/no-expression-statements -- Required for Error subclass
    this.name = 'StaleWriteError'
    // eslint-disable-next-line functional/no-expression-statements -- Required for Error subclass
    this.recordId = recordId
  }
}
