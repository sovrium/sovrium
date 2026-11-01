/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data } from 'effect'

/**
 * Error for static site generation failures: a file the generator could not
 * read, write or format. `cause` carries the underlying failure.
 */
export class StaticGenerationError extends Data.TaggedError('StaticGenerationError')<{
  readonly message: string
  readonly cause?: unknown
}> {}
