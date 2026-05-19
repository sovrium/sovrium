/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export class StaticGenerationError extends Error {
  readonly _tag = 'StaticGenerationError'
  override readonly cause?: unknown

  constructor(options: { readonly message: string; readonly cause?: unknown }) {
    super(options.message)
    this.name = 'StaticGenerationError'
    this.cause = options.cause
  }
}
