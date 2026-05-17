/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Raw batch list program (no permission filtering, no field projection).
 *
 * Returns the full row payload for every record matching the supplied
 * filter. Intended for the bulk-gate path (Z-3 row-level enforcement)
 * that needs to evaluate which ids in a batch the user is allowed to
 * read+mutate via a SINGLE round trip (`id IN (…) AND <readClause> AND
 * <writeOrDeleteClause>`) rather than the historical per-id reduce.
 *
 * The optional `includeDeleted` flag is passed through so delete/restore
 * gates can include soft-deleted rows when needed.
 *
 * Lives in its own file to keep `programs.ts` under the 400-line ESLint
 * size budget — adding the helper inline pushed `programs.ts` to 411
 * effective lines.
 */

import { Effect } from 'effect'
import { TableRepository } from '@/application/ports/repositories/table-repository'
import type { UserSession } from '@/application/ports/models/user-session'
import type { SessionContextError } from '@/domain/errors'

export function rawListRecordsProgram(
  session: Readonly<UserSession>,
  tableName: string,
  filter: Parameters<TableRepository['Type']['listRecords']>[0]['filter'],
  includeDeleted?: boolean
): Effect.Effect<readonly Record<string, unknown>[], SessionContextError, TableRepository> {
  return Effect.gen(function* () {
    const repo = yield* TableRepository
    return yield* repo.listRecords({ session, tableName, filter, includeDeleted })
  })
}
