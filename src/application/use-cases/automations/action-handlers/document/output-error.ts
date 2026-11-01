/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data } from 'effect'

/**
 * A generated file could not be written or attached; `message` says why and
 * names the key. `callerRefused` marks the refusal of a hand-started run's
 * starter, which the step reports as the records API's `Resource not found`
 * and nothing more.
 */
export class GeneratedFileWriteError extends Data.TaggedError('GeneratedFileWriteError')<{
  readonly message: string
  readonly callerRefused?: true
}> {}
