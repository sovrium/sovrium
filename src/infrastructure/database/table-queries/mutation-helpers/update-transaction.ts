/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { StaleWriteError } from '@/domain/errors'
import { injectUpdateAuthorship } from './authorship-helpers'
import { resolveArrayColumnTypes } from './column-value-encoding'
import {
  removeManyToManyLinksInTransaction,
  writeManyToManyLinksInTransaction,
  type ManyToManyLink,
} from './many-to-many-helpers'
import { fetchRecordById } from './record-fetch-helpers'
import {
  buildUpdateSetClauseCRUD,
  executeRecordUpdateCRUD,
  lockTokenToEnforce,
  storedRecordCarriesToken,
  validateFieldsNotEmpty,
} from './update-helpers'
import type { App } from '@/domain/models/app'
import type { Session } from '@/infrastructure/auth/better-auth/schema'
import type { DrizzleTransaction } from '@/infrastructure/database'

/** What a single-record update writes, inside its one transaction. */
export interface UpdateRecordInput {
  readonly fields: Readonly<Record<string, unknown>>
  readonly app?: App
  /** Many-to-many links to add with the row (idempotent). */
  readonly links?: readonly ManyToManyLink[]
  /** Many-to-many links to remove with the row (a pair not linked is a no-op). */
  readonly unlinks?: readonly ManyToManyLink[]
  /** The optimistic-lock token the caller last read (`updatedAt`). */
  readonly expectedUpdatedAt?: string
  /**
   * Who the change is recorded as made through, when not the records API (a form
   * edit link: `{ form, submission }`). With it, the update's activity entry
   * holds this context and only the written fields whose values changed; without
   * it, the whole row before and after, as every records-API update records it.
   */
  readonly auditContext?: Readonly<Record<string, string>>
}

/** What the update transaction hands back to the logging that follows the commit. */
interface UpdateTransactionOutcome {
  readonly recordBefore: Record<string, unknown> | undefined
  readonly updatedRecord: Record<string, unknown>
  /** Whether the row itself was written — a links-only update leaves it as it is. */
  readonly rowWritten: boolean
}

/** The record an update targets, and who writes it. */
interface UpdateTarget {
  readonly session: Readonly<Session>
  readonly tableName: string
  readonly recordId: string
}

/** Add then remove the record's many-to-many links on the open transaction. */
const writeLinkChanges = (
  tx: Readonly<DrizzleTransaction>,
  target: { readonly sourceTable: string; readonly sourceId: string | number },
  input: Readonly<UpdateRecordInput>
): Promise<unknown> =>
  writeManyToManyLinksInTransaction(tx, { ...target, links: input.links ?? [] }).then(() =>
    removeManyToManyLinksInTransaction(tx, { ...target, links: input.unlinks ?? [] })
  )

/**
 * A links-only update: the row is left as it is (no UPDATE to carry the token,
 * so the token is compared on the row read inside this same transaction).
 */
async function updateLinksOnly(
  tx: Readonly<DrizzleTransaction>,
  target: UpdateTarget,
  input: Readonly<UpdateRecordInput>,
  before: Readonly<Record<string, unknown>> | undefined
): Promise<UpdateTransactionOutcome> {
  if (before === undefined) return { recordBefore: undefined, updatedRecord: {}, rowWritten: false }
  const tokenMs = lockTokenToEnforce(input.expectedUpdatedAt, before)
  if (tokenMs !== undefined && !storedRecordCarriesToken(before, tokenMs)) {
    throw new StaleWriteError(
      `Record ${target.recordId} in ${target.tableName} changed since it was read`,
      target.recordId
    )
  }
  const sourceId = before['id'] as string | number
  return writeLinkChanges(tx, { sourceTable: target.tableName, sourceId }, input).then(() => ({
    recordBefore: { ...before },
    updatedRecord: { ...before },
    rowWritten: false,
  }))
}

/**
 * The update transaction: the row (its optimistic-lock token checked in the
 * UPDATE itself), then its link changes, on the same `tx` — so a refused link
 * or a stale token throws out of the body and the driver rolls back every part
 * of the change. With no columns to write, only the links change.
 */
export async function runUpdateRecordTransaction(
  tx: Readonly<DrizzleTransaction>,
  target: UpdateTarget,
  input: Readonly<UpdateRecordInput>
): Promise<UpdateTransactionOutcome> {
  const { session, tableName, recordId } = target
  const before = await fetchRecordById(tx, tableName, recordId)
  if (Object.keys(input.fields).length === 0) return updateLinksOnly(tx, target, input, before)

  const fields = await injectUpdateAuthorship(input.fields, session.userId, tx, tableName)
  const entries = await validateFieldsNotEmpty(fields)
  // Same resolution the CREATE path performs, and for the same reason: a
  // `text[]` column needs a native array literal, a `jsonb` one needs JSON, and
  // PostgreSQL rejects the wrong choice outright.
  const setClause = buildUpdateSetClauseCRUD(
    entries,
    await resolveArrayColumnTypes(tx, tableName, [fields])
  )
  const expectedUpdatedAtMs = lockTokenToEnforce(input.expectedUpdatedAt, before)
  const updated = await executeRecordUpdateCRUD(
    tx,
    { tableName, recordId, expectedUpdatedAtMs },
    setClause
  )
  const sourceId = updated['id'] as string | number
  return writeLinkChanges(tx, { sourceTable: tableName, sourceId }, input).then(() => ({
    recordBefore: before,
    updatedRecord: updated,
    rowWritten: true,
  }))
}

/**
 * What an update's activity entry records. The records API keeps the whole row
 * before and after, unchanged columns included for context. A write made
 * through another surface that names itself (`auditContext`, a form edit link)
 * records that context and only the written fields whose values changed.
 */
export function updateActivityChanges(
  params: Readonly<UpdateRecordInput>,
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown>
): Record<string, unknown> {
  if (params.auditContext === undefined) return { before, after }
  const changed = Object.keys(params.fields).filter(
    (key) => JSON.stringify(before?.[key]) !== JSON.stringify(after[key])
  )
  const pick = (row: Record<string, unknown> | undefined) =>
    Object.fromEntries(changed.map((key) => [key, row?.[key]]))
  return { ...params.auditContext, before: pick(before), after: pick(after) }
}
