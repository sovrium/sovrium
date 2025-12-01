/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data } from 'effect'

/**
 * Error during schema initialization
 *
 * This error is thrown when database schema initialization fails,
 * indicating that table creation or migration failed.
 */
export class SchemaInitializationError extends Data.TaggedError('SchemaInitializationError')<{
  readonly message: string
  readonly cause?: unknown
}> {}
