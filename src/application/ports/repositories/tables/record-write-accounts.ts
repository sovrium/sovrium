/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { DatabaseError, ForeignKeyViolationError, StaleWriteError } from '@/domain/errors'

/**
 * The accounts a list of people (`user`, `allowMultiple`) names in one write,
 * under that field's name. The write confirms them inside its own transaction
 * and holds them until it commits, so an account erased meanwhile is refused
 * rather than stored.
 */
export interface AccountReference {
  readonly field: string
  readonly ids: readonly string[]
}

/** What a write stores beside its row, in the row's own transaction. */
export interface RecordWriteExtras<Link> {
  readonly links?: readonly Link[]
  readonly accounts?: readonly AccountReference[]
}

/** How a single-record update can fail. */
export type UpdateRecordFailure = DatabaseError | StaleWriteError | ForeignKeyViolationError
