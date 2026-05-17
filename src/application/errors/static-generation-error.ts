/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Error class for static site generation failures.
 *
 * Follows the standard domain error pattern: plain Error subclass with
 * readonly `_tag` property for Effect discriminated union matching.
 */
export class StaticGenerationError extends Error {
  readonly _tag = 'StaticGenerationError'
  override readonly cause?: unknown

  constructor(options: { readonly message: string; readonly cause?: unknown }) {
    super(options.message)
    // eslint-disable-next-line functional/no-expression-statements -- Required for Error subclass
    this.name = 'StaticGenerationError'
    // eslint-disable-next-line functional/no-expression-statements -- Required for Error subclass
    this.cause = options.cause
  }
}
