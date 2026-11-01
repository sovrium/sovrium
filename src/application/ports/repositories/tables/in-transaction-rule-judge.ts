/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { BusinessRuleViolationError } from '@/domain/errors'

/**
 * The rows a write will change, as its own transaction reads them, keyed by
 * record id — except an upsert's, keyed by the position of the upsert row: the
 * record a row matched under its position (`'0'`, `'1'`…), and a row that
 * matches no record — it will be created — as the row it creates, under
 * {@link upsertCreateKey}. For an update or a delete a row that is missing or
 * in the trash is absent; for a restore only the rows in the trash are
 * present, as they will stand restored. An absent row is the write's to
 * answer.
 */
export type JudgedRows = ReadonlyMap<string, Readonly<Record<string, unknown>>>

/**
 * The key an upsert hands the judge a row it will CREATE under: its position,
 * marked so it is never read as the record a row matched.
 */
export const upsertCreateKey = (index: number): string => `create:${index}`

/**
 * A table's business rules, ready to judge a write on the rows it changes.
 *
 * The repository calls it INSIDE the write's transaction, right after it read
 * those rows — on PostgreSQL behind a per-record lock every judged write of the
 * record takes, on SQLite inside a transaction that runs alone — so two writes
 * to one record are judged one after the other, the second on what the first
 * left. A refusal is returned, the repository throws it, and the transaction
 * rolls back with nothing written.
 *
 * Synchronous and pure: whatever else the rules read (the records a lookup
 * leaf names) was read before the transaction opened, so the judgement issues
 * no statement of its own inside it.
 */
export type InTransactionRuleJudge = (
  rows: JudgedRows
) => Readonly<BusinessRuleViolationError> | undefined
