/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data } from 'effect'

/** A generated file could not be written or attached; `message` says why and names the key. */
export class GeneratedFileWriteError extends Data.TaggedError('GeneratedFileWriteError')<{
  readonly message: string
}> {}
