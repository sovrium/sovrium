/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { DatabaseError } from '@/domain/errors'
import type { App } from '@/domain/models/app'
import type { Effect } from 'effect'

/** The question `TableRepository` answers about stored files rather than rows. */
export interface TableFileReferences {
  /**
   * Whether any record names the stored file `key` — in any attachment field
   * of any table, a single cell or a list, trashed records included — read as
   * the system. What decides that a replaced file, or a purged record's file,
   * may be deleted. `except` leaves out the one record being purged.
   */
  readonly isFileNamedByAnyRecord: (
    app: App,
    key: string,
    except?: FileReferenceExclusion
  ) => Effect.Effect<boolean, DatabaseError>
}

/** The record a reference check leaves out: the one whose own cells name the file. */
export interface FileReferenceExclusion {
  readonly tableName: string
  readonly recordId: string
}
