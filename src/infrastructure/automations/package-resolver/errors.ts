/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data } from 'effect'

/**
 * Failure raised when resolving a declared npm package fails at server
 * startup. Surfaces the offending package specifier so the operator can
 * fix the typo / publish / install before the listener binds.
 */
export class PackageResolutionError extends Data.TaggedError('PackageResolutionError')<{
  readonly pkg: string
  readonly cause: unknown
}> {
  override get message(): string {
    const detail =
      this.cause instanceof Error
        ? this.cause.message
        : typeof this.cause === 'string'
          ? this.cause
          : 'unknown package resolution error'
    return `Failed to resolve package "${this.pkg}": ${detail}`
  }
}
