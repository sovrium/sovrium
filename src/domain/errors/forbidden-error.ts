/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Forbidden error for authorization failures
 */
export class ForbiddenError extends Error {
  readonly _tag = 'ForbiddenError'

  constructor(message: string) {
    super(message)
    // eslint-disable-next-line functional/no-expression-statements -- Required for Error subclass
    this.name = 'ForbiddenError'
  }
}
