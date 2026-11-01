/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data, type Effect } from 'effect'

/** Database error for an upsert's merge-field lookup. */
export class UpsertMatchDatabaseError extends Data.TaggedError('UpsertMatchDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * The rows an upsert would merge onto, asked BEFORE it writes: the permission
 * gates read it to decide whether the write is a create, an update, or both,
 * and which existing rows a row-level rule must judge.
 */
export class UpsertMatchRepository extends Context.Service<
  UpsertMatchRepository,
  {
    /**
     * Whether any record's merge fields match a stored row, the rows the
     * caller's read rule hides (`hiddenIds`) never matching. A record missing
     * a merge field is skipped: the upsert refuses it anyway.
     */
    readonly anyMatch: (input: {
      readonly tableName: string
      readonly records: readonly { readonly fields: Readonly<Record<string, unknown>> }[]
      readonly fieldsToMergeOn: readonly string[]
      readonly hiddenIds: readonly string[]
    }) => Effect.Effect<boolean, UpsertMatchDatabaseError>

    /**
     * The ids of EVERY row whose merge fields equal `fields`: empty when a
     * merge field is missing or no row matches (the record would be created).
     */
    readonly matchingIds: (input: {
      readonly tableName: string
      readonly fields: Readonly<Record<string, unknown>>
      readonly fieldsToMergeOn: readonly string[]
    }) => Effect.Effect<readonly string[], UpsertMatchDatabaseError>
  }
>()('UpsertMatchRepository') {}
