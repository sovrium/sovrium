/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What `record/read` and `record/list` hand the run: each record exactly as
 * `GET /api/tables/:table/records/:id` answers the run's caller — string ids
 * and relationship values, the many-to-many lists, `_display`, `createdAt` and
 * `updatedAt`, every field both at the top level and under `fields`. A run
 * nobody started reads as an admin does.
 *
 * The rows arrive already judged by `record-read-scope.ts` (the caller's
 * row-level rule, the columns they may read, the lookups through a link they
 * may not read); this module only shapes them, through the records API's own
 * shaper, so the two surfaces cannot drift apart.
 */

import { Effect } from 'effect'
import {
  AuthRepository,
  type AuthDatabaseError,
} from '@/application/ports/repositories/auth/auth-repository'
import { shapeRecordsForReader } from '@/application/use-cases/tables/read-record-programs'
import { buildGuestSession, buildSystemSession } from '../build-guest-session'
import { singleUserFieldNames, withHydratedId } from '../hydrated-field-reference'
import { runLinkReader, type RunReadAccess } from './record-caller-gate'
import type { ActionOutcome, AutomationContext } from './shared'
import type { AiComputeStatusRepository } from '@/application/ports/repositories/ai/ai-compute-status-repository'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import type { LinkReader } from '@/application/use-cases/tables/linked-row-visibility'
import type { App } from '@/domain/models/app'

/** The reader of a run nobody started: every field, every link, as an admin reads them. */
const systemReader = (): LinkReader => ({
  session: buildSystemSession(),
  role: 'admin',
  groups: [],
})

/**
 * The reader of a scoped run whose starter cannot be named. Unreachable today —
 * a scoped access implies a hand-started run with a user — but it must fail
 * CLOSED: the rows were judged for the starter, so reading their links and
 * labels as an admin would hand the run what the starter may not see.
 */
const narrowestReader = (): LinkReader => ({
  session: buildGuestSession(),
  role: 'viewer',
  groups: [],
})

/** Who the records API would be answering: the run's starter, or the system. */
const readerOfRun = (
  access: RunReadAccess,
  automation: AutomationContext
): Effect.Effect<LinkReader, never, AuthRepository> =>
  access.kind === 'scoped'
    ? runLinkReader(automation).pipe(Effect.map((reader) => reader ?? narrowestReader()))
    : Effect.succeed(systemReader())

/**
 * The origin an attachment's `url` or `signedUrl` is built on. A run has no
 * request to take it from, and its output often leaves the app — an email, a
 * webhook call — where a path is not a link, so it is the app's `BASE_URL`
 * when one is set, and a path from the site root otherwise.
 */
const attachmentOrigin = (env: Readonly<Record<string, string | undefined>>): string =>
  env['BASE_URL']?.trim().replace(/\/+$/, '') ?? ''

/** The top-level keys of a shaped record that are not a field of the table. */
const ENVELOPE_KEYS = new Set([
  'id',
  'fields',
  'createdAt',
  'updatedAt',
  'createdBy',
  'updatedBy',
  'deletedBy',
  '_display',
  '_aiCompute',
])

/**
 * Narrow a shaped record to the fields a `record/list` asked for, keeping its
 * envelope — the id, the timestamps and the display block — as the records
 * API's `?fields=` keeps them.
 */
const selectFields = (
  record: Readonly<Record<string, unknown>>,
  selected: ReadonlySet<string>
): Readonly<Record<string, unknown>> => {
  const keep = (key: string): boolean => ENVELOPE_KEYS.has(key) || selected.has(key)
  const fields = (record['fields'] ?? {}) as Readonly<Record<string, unknown>>
  return {
    ...Object.fromEntries(Object.entries(record).filter(([key]) => keep(key))),
    fields: Object.fromEntries(Object.entries(fields).filter(([key]) => selected.has(key))),
  }
}

type ShapedRecord = Readonly<Record<string, unknown>>

/** The account ids a set of records holds in the named fields, where the reader kept them. */
const heldUserIds = (
  records: readonly ShapedRecord[],
  names: readonly string[]
): readonly string[] => {
  const held = records.flatMap((record) => {
    const fields = (record['fields'] ?? {}) as ShapedRecord
    return names.flatMap((name) => [record[name], fields[name]])
  })
  return [
    ...new Set(held.filter((value): value is string => typeof value === 'string' && value !== '')),
  ]
}

/**
 * Each single `user` field of the records as the person — `id`, `name`,
 * `email` — exactly as a record trigger hands it over: the field itself still
 * renders as the account id, its sub-paths read the person. Only a field the
 * reader kept is expanded, so a run that may not read it learns nothing; the
 * people of the whole set are read in one lookup. An id no account holds stays
 * the bare id.
 */
const expandUserFields = (
  app: App,
  tableName: string,
  records: readonly ShapedRecord[]
): Effect.Effect<readonly ShapedRecord[], AuthDatabaseError, AuthRepository> =>
  Effect.gen(function* () {
    const names = singleUserFieldNames(app, tableName)
    const ids = heldUserIds(records, names)
    if (ids.length === 0) return records
    const people = yield* (yield* AuthRepository).findUserContactsByIds(ids)
    const expand = (source: ShapedRecord): ShapedRecord =>
      Object.fromEntries(
        names.flatMap((name) => {
          const id = source[name]
          const person = typeof id === 'string' ? people.get(id) : undefined
          return person === undefined || typeof id !== 'string'
            ? []
            : [[name, withHydratedId({ id, ...person }, id)] as const]
        })
      )
    return records.map((record) => {
      const fields = (record['fields'] ?? {}) as ShapedRecord
      return {
        ...record,
        ...expand(record),
        ...(record['fields'] === undefined ? {} : { fields: { ...fields, ...expand(fields) } }),
      }
    })
  })

/**
 * Build the canonical read success output, SHARED by `record/read` and
 * `record/list`. Surfaces both `record` (first row or undefined) and `records`
 * (the whole array), so `{{getUser.record.email}}` works for the single-row
 * case AND `{{listActive.records}}` for the set case.
 *
 * Sharing it is what makes the `record.read` split operator split invisible downstream: a
 * config migrating a filtered `read` to a `list` keeps every template it had.
 * Do not give `list` its own envelope.
 */
export const buildReadOutput = (
  rows: readonly Readonly<Record<string, unknown>>[],
  context: {
    readonly app: App
    readonly tableName: string
    readonly access: RunReadAccess
    readonly automation: AutomationContext
    /** A `record/list`'s `fields`: the fields each record keeps. */
    readonly fields?: readonly string[]
  }
): Effect.Effect<
  ActionOutcome,
  never,
  TableRepository | AuthRepository | DataSourceRepository | AiComputeStatusRepository
> =>
  Effect.gen(function* () {
    const { app, tableName, fields } = context
    const reader = yield* readerOfRun(context.access, context.automation)
    const config = {
      app,
      tableName,
      session: reader.session,
      userRole: reader.role,
      userGroups: reader.groups ?? [],
      origin: attachmentOrigin(process.env),
    }
    // One read per relation for the whole set, never one per row.
    const shaped = yield* Effect.result(shapeRecordsForReader(config, rows))
    if (shaped._tag === 'Failure') {
      const { failure } = shaped
      return { status: 'failure', error: failure.message } as const
    }
    const expanded = yield* Effect.result(expandUserFields(app, tableName, shaped.success))
    if (expanded._tag === 'Failure') {
      return { status: 'failure', error: 'Failed to read the people the records name' } as const
    }
    const selected = fields === undefined ? undefined : new Set(fields)
    const records = expanded.success.map((record) =>
      selected === undefined ? record : selectFields(record, selected)
    )
    return { status: 'success', output: { record: records[0] ?? undefined, records } } as const
  }).pipe(Effect.withSpan('automations.build-read-output'))
