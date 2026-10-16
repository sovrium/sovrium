/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  UserAccessRepository,
  type RecordLabelSource,
  type UserAccessAccount,
  type UserAccessDatabaseError,
  type UserAccessFilter,
  type UserAccessRow,
} from '@/application/ports/repositories/auth/user-access-repository'
import { declaresWriteOnly } from '@/domain/models/app/tables/write-only-field-service'
import type { App } from '@/domain/models/app'

/** One grant, with what a reader needs to read it without a second request. */
export interface ReadableGrant {
  readonly grant: UserAccessRow
  /** The account the grant names; absent when no account has that id. */
  readonly account: UserAccessAccount | undefined
  /** One label per entry of `grant.recordIds`, in the same order. */
  readonly recordLabels: readonly string[]
}

/**
 * Where the records of `tableSlug` take their label from: the table's first
 * declared `single-line-text` field that is not write-only. None when the app
 * declares no such table or the table declares no such field — its records are
 * then labelled by id.
 *
 * The listing answers admin-equivalent callers only, and the admin bypass
 * reads every field but one kind: a `writeOnly` value is returned to no role,
 * the admin included (`isFieldReadableByCaller`). A secret kept in the first
 * text field — a PIN, a passphrase — would otherwise be printed as the
 * record's name.
 */
const labelSourceFor = (app: App, tableSlug: string): RecordLabelSource | undefined => {
  const table = app.tables?.find((candidate) => candidate.name === tableSlug)
  const field = table?.fields.find(
    (candidate) => candidate.type === 'single-line-text' && !declaresWriteOnly(candidate)
  )
  if (table === undefined || field === undefined) return undefined
  return {
    tableName: table.name,
    primaryKey: table.primaryKey?.field || 'id',
    labelField: field.name,
  }
}

/** The label of every record the grants of one table name, keyed by record id. */
const labelsOfTable = (app: App, tableSlug: string, grants: readonly UserAccessRow[]) =>
  Effect.gen(function* () {
    const source = labelSourceFor(app, tableSlug)
    if (source === undefined) return new Map<string, string>()
    const ids = grants.flatMap((grant) => grant.recordIds)
    const labels = yield* (yield* UserAccessRepository).labelRecords(source, ids)
    return new Map(labels.map((entry) => [entry.id, entry.label]))
  })

/**
 * List the grants matching `filter`, oldest first, each with the account it
 * names and a readable label for each record — in one read for the accounts
 * and one per scope table for the labels, never one per grant.
 *
 * A record no label resolves for (the table declares no single-line-text
 * field, the record does not exist, its label is empty) is labelled by its id,
 * so a grant always reads as naming something.
 */
export const listReadableGrants = (
  app: App,
  filter: Readonly<UserAccessFilter>
): Effect.Effect<readonly ReadableGrant[], UserAccessDatabaseError, UserAccessRepository> =>
  Effect.gen(function* () {
    const repo = yield* UserAccessRepository
    const grants = yield* repo.list(filter)
    const accounts = yield* repo.findAccounts(grants.map((grant) => grant.userId))
    const accountById = new Map(accounts.map((account) => [account.id, account]))
    const tableSlugs = [...new Set(grants.map((grant) => grant.tableSlug))]
    const labelMaps = yield* Effect.forEach(tableSlugs, (slug) =>
      labelsOfTable(
        app,
        slug,
        grants.filter((grant) => grant.tableSlug === slug)
      )
    )
    const labelsBySlug = new Map(tableSlugs.map((slug, index) => [slug, labelMaps[index]]))
    return grants.map((grant) => {
      const labels = labelsBySlug.get(grant.tableSlug)
      return {
        grant,
        account: accountById.get(grant.userId),
        recordLabels: grant.recordIds.map((id) => labels?.get(id) ?? id),
      }
    })
  }).pipe(Effect.withSpan('tables.list-readable-grants'))
