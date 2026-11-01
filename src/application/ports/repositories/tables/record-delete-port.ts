/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { InTransactionRuleJudge } from './in-transaction-rule-judge'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { BusinessRuleViolationError, DatabaseError } from '@/domain/errors'
import type { App } from '@/domain/models/app'
import type { Effect } from 'effect'

/** What a single-record delete answers. */
export interface RecordDeleteOutcome {
  success: boolean
  setNullPerformed: boolean
  restrictViolation: boolean
}

/** How a single-record delete can fail, a business rule's refusal included. */
export type DeleteRecordFailure = DatabaseError | BusinessRuleViolationError

/**
 * Delete a record — to the trash when the table keeps one, cascading by its
 * links (`app`). `judge` is the table's business rules, judged inside the
 * delete's transaction on the row as it stands there ({@link InTransactionRuleJudge}).
 */
export type DeleteRecord = (
  session: Readonly<UserSession>,
  tableName: string,
  recordId: string,
  options?: { readonly app?: App; readonly judge?: InTransactionRuleJudge }
) => Effect.Effect<RecordDeleteOutcome, DeleteRecordFailure>

/** Delete a record for good, `judge` judging the table's rules inside the transaction. */
export type PermanentlyDeleteRecord = (
  session: Readonly<UserSession>,
  tableName: string,
  recordId: string,
  judge?: InTransactionRuleJudge
) => Effect.Effect<boolean, DeleteRecordFailure>
