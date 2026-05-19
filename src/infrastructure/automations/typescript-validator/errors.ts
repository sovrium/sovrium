/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data } from 'effect'

export class TSValidationError extends Data.TaggedError('TSValidationError')<{
  readonly automationId: string
  readonly actionIndex: number
  readonly file: string
  readonly line: number
  readonly column: number
  readonly message: string
}> {}
