/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The two record writes — `POST /records` and `PATCH /records/:recordId`.
 *
 * They are one module because they are one shape wearing two verbs: both stamp
 * authorship by FIELD TYPE, both split the many-to-many fields out of the
 * statement and write the junction rows after it, both filter the echoed row
 * through the caller's read permissions, and both return the same envelope
 * (system fields at the root, user fields nested AND flat). Separating them
 * would put those four decisions in two places and invite the next change to
 * land in only one of them — which is how a `POST` and a `PATCH` against the
 * same table come to disagree about what they echo.
 *
 * The junction half lives in `record-link-enrichment.ts`, shared with the
 * reads; the single-record address refusal comes from `read-record-programs.ts`,
 * where its docstring explains why every verb under `/records/:recordId` has to
 * raise it identically.
 */

import { Effect } from 'effect'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import { isGuestSession, SYSTEM_USER_ID } from '@/domain/models/app/auth/guest-session'
import {
  buildCreateAuthorshipOverrides,
  buildCurrentUserDefaults,
  buildUpdateAuthorshipOverrides,
} from '@/domain/models/app/tables/authorship-fields'
import { normalizeDateValuesIn } from '@/domain/models/app/tables/empty-date-service'
import { filterReadableFields } from '@/domain/models/app/tables/field-read-filter-service'
import { enrichRecordWithAttachmentUrls } from './attachment-url-enricher'
import { omitFromWriteEcho, writeEchoReaderOf } from './hidden-lookup-omission'
import { refuseUnreadableLinkTargets } from './link-target-check'
import { getManyToManyFieldSpecs } from './many-to-many-fields'
import { refuseWhenNoSingleIdAddress } from './read-record-programs'
import { announceRecordWrites } from './record-change-announcement'
import {
  clearedManyToManySpecs,
  clearManyToManyLinks,
  splitManyToManyFields,
  writeManyToManyLinks,
} from './record-link-enrichment'
import { transformRecord } from './record-transformer'
import type { LinkReader } from './linked-row-visibility'
import type { TransformedRecord } from './record-transformer'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type { DatabaseError, ForeignKeyViolationError } from '@/domain/errors'
import type { App } from '@/domain/models/app'

interface CreateRecordConfig {
  readonly session: Readonly<UserSession>
  readonly tableName: string
  readonly fields: Readonly<Record<string, unknown>>
  readonly app?: App
  readonly userRole?: string
  /** The caller's groups: a field read grant may name a group. */
  readonly userGroups?: readonly string[]
  /** See `ListRecordsConfig.origin` in `list-records-program.ts`. */
  readonly origin?: string
  /**
   * Whose read rules judge the rows the record links to, when that is not the
   * writing session with `userRole` — a visitor's create is written by the
   * system but judged as the visitor. Absent with no `userRole`, links are
   * judged for existence only.
   */
  readonly linkReader?: LinkReader
}

/**
 * [internal ref]: stamp every `created-by`/`updated-by`-typed column BY NAME with the
 * authenticated actor. The infra authorship injection only fills the LITERAL
 * `created_by`/`updated_by` columns (discovered via DB introspection); a
 * custom-named field (e.g. `author`, generated TEXT NOT NULL under auth) would
 * otherwise be left NULL and 500 the INSERT. Resolving by FIELD TYPE here (the
 * application layer, where the table schema is available) mirrors
 * `writeBoundTableRecord` in submit-form.ts.
 *
 * `phase: 'create'` stamps both created-by AND updated-by fields (a fresh row
 * is created-and-last-modified by the same actor); `phase: 'update'` re-stamps
 * only updated-by fields. Guest sessions are skipped — no real actor exists to
 * stamp a custom-named field, and the infra normalizes the literal columns to
 * NULL. On create, the literal `created_by` is still re-overridden downstream
 * by the infra, so the AUTHORSHIP-013 contract (user-supplied value ignored)
 * is preserved.
 */
const applyAuthorshipOverrides = (input: {
  readonly phase: 'create' | 'update'
  readonly fields: Readonly<Record<string, unknown>>
  readonly tables: App['tables'] | undefined
  readonly tableName: string
  readonly userId: string
}): Readonly<Record<string, unknown>> => {
  const { phase, fields, tables, tableName, userId } = input
  if (isGuestSession(userId)) return { ...fields }
  const overrides =
    phase === 'create'
      ? buildCreateAuthorshipOverrides(tables, tableName, userId)
      : buildUpdateAuthorshipOverrides(tables, tableName, userId)
  // A `user` field defaulting to `$currentUser` is filled with a person, so
  // the system actor — which is no account — leaves it empty. The defaults
  // name only the fields the caller left empty (absent, null or ''), so they
  // go after the fields: a value the caller names always stays.
  const defaults =
    phase === 'create' && userId !== SYSTEM_USER_ID
      ? buildCurrentUserDefaults(tables, tableName, userId, fields)
      : {}
  return { ...fields, ...defaults, ...overrides }
}

/**
 * Whose read rules judge the rows a write links to: the reader the caller
 * named, else the writing session under `userRole`, else nobody — a write with
 * no reader identity (a seed, an automation nobody started) links as the
 * system, checked for existence only.
 */
const linkReaderOf = (
  session: Readonly<UserSession>,
  userRole: string | undefined,
  linkReader: LinkReader | undefined
): LinkReader | undefined =>
  linkReader ?? (userRole === undefined ? undefined : { session, role: userRole })

/**
 * The user fields a write hands back for the caller named by `userRole` and
 * `userGroups`: the record less the fields they may not read, transformed (and
 * enriched, on create). `undefined` when no caller is named — the record is
 * then answered as stored.
 */
const readableEchoFields = (
  record: Readonly<Record<string, unknown>>,
  ctx: {
    readonly app?: App | undefined
    readonly tableName: string
    readonly userRole?: string | undefined
    readonly userGroups?: readonly string[] | undefined
    readonly enrich?: (record: TransformedRecord) => TransformedRecord
  }
): Readonly<TransformedRecord['fields']> | undefined => {
  const { app, tableName, userRole } = ctx
  if (app === undefined || userRole === undefined || userRole === '') return undefined
  const caller = { role: userRole, groups: ctx.userGroups ?? [] }
  const filtered = filterReadableFields({ app, tableName, caller, record })
  const transformed = transformRecord(filtered, { app, tableName })
  return (ctx.enrich === undefined ? transformed : ctx.enrich(transformed)).fields
}

export function createRecordProgram(config: CreateRecordConfig) {
  const { session, tableName, app, userRole, origin } = config
  const fields = normalizeDateValuesIn(app?.tables, tableName, config.fields)
  return Effect.gen(function* () {
    const repo = yield* TableRepository

    // Links are judged before anything is written, so a refused one leaves no record.
    yield* refuseUnreadableLinkTargets({
      ...{ app, session, tableName, writes: [{ fields }] },
      reader: linkReaderOf(session, userRole, config.linkReader),
    })

    // [internal ref]: see applyAuthorshipOverrides.
    const fieldsWithAuthorship = applyAuthorshipOverrides({
      phase: 'create',
      fields,
      tables: app?.tables,
      tableName,
      userId: session.userId,
    })

    // [internal ref]: a many-to-many relationship field has no base column — split it
    // out of the base INSERT (it would try to write a phantom column → 500) and
    // write the junction rows after the base row (real id) is created.
    const { baseFields, links } = splitManyToManyFields(
      fieldsWithAuthorship,
      getManyToManyFieldSpecs(app?.tables, tableName)
    )

    // Create record with session context
    const created = yield* repo.createRecord(session, tableName, baseFields)
    yield* writeManyToManyLinks(repo, tableName, created.id as string | number, links)

    // The answer holds no more than the writer's own read of the record.
    const [record = created] = yield* omitFromWriteEcho(
      app,
      tableName,
      [created],
      writeEchoReaderOf(session, { ...config, userRole })
    )

    // B-01: enrich attachment fields with signedUrl / url on the create-record
    // response so callers see the same shape they get back on GET / LIST.
    const enrich = (rec: TransformedRecord): TransformedRecord =>
      enrichRecordWithAttachmentUrls(rec, { app, tableName, origin: origin ?? '' })

    const transformed = enrich(transformRecord(record, app ? { app, tableName } : undefined))

    // Field-level read filtering, for the caller (role and groups) when named
    const filteredFields = readableEchoFields(record, { ...config, enrich }) ?? transformed.fields

    // Return in format expected by tests: system fields at root, user fields
    // both nested (canonical) and at the root (flat alias). The flat alias
    // supports specs that read `record.file` instead of `record.fields.file`.
    return {
      ...filteredFields,
      id: transformed.id,
      fields: filteredFields,
      createdAt: transformed.createdAt,
      updatedAt: transformed.updatedAt,
      ...(transformed.createdBy ? { createdBy: transformed.createdBy } : {}),
      ...(transformed.updatedBy ? { updatedBy: transformed.updatedBy } : {}),
      ...(transformed.deletedBy ? { deletedBy: transformed.deletedBy } : {}),
    }
  }).pipe(announceRecordWrites(app), Effect.withSpan('tables.create-record-program'))
}

/**
 * [internal ref] (update): resolve the base row for an update while handling the
 * many-to-many split. A `many-to-many` relationship field has no base column, so
 * it is split OUT of the SET clause and its ids written to the junction table —
 * mirroring the create path. Without the split the field name reaches the base
 * UPDATE (no such column), the update matches nothing, and the route 404s.
 *
 * Updates the base columns when there is at least one to write; a pure m2m PATCH
 * (only relationship arrays) fetches the existing row instead so the junction
 * write targets a real record and the response reflects it. Returns `{}` when a
 * pure m2m PATCH targets a missing row (the caller surfaces that as a 404).
 * No-op split for tables/patches with no m2m field.
 */
const resolveUpdatedBaseRecord = (
  session: Readonly<UserSession>,
  tableName: string,
  recordId: string,
  params: {
    readonly fields: Readonly<Record<string, unknown>>
    readonly app?: App
    readonly userRole?: string
    readonly linkReader?: LinkReader
  }
): Effect.Effect<
  Record<string, unknown>,
  DatabaseError | ForeignKeyViolationError,
  TableRepository | DataSourceRepository | AuthRepository
> =>
  Effect.gen(function* () {
    const repo = yield* TableRepository
    const reader = linkReaderOf(session, params.userRole, params.linkReader)
    // Judged before the first write; a key the row already holds is not a new link.
    const held = repo.getRecord(session, tableName, recordId)
    yield* refuseUnreadableLinkTargets({
      ...{ app: params.app, session, tableName, reader },
      writes: [{ fields: params.fields, held }],
    })

    const m2mSpecs = getManyToManyFieldSpecs(params.app?.tables, tableName)
    const { baseFields, links } = splitManyToManyFields(params.fields, m2mSpecs)

    // [internal ref]: re-stamp every `updated-by`-typed column BY NAME with the updating
    // actor (created-by fields are never touched on update).
    const baseWithAuthorship = applyAuthorshipOverrides({
      phase: 'update',
      fields: baseFields,
      tables: params.app?.tables,
      tableName,
      userId: session.userId,
    })

    const record =
      Object.keys(baseWithAuthorship).length > 0
        ? yield* repo.updateRecord(session, tableName, recordId, {
            fields: baseWithAuthorship,
            app: params.app,
          })
        : ((yield* repo.getRecord(session, tableName, recordId)) ?? {})

    if (Object.keys(record).length === 0) return {}

    // Write the m2m junction rows (idempotent add semantics), then remove the
    // links of any field the change clears (`null` or `[]`).
    yield* writeManyToManyLinks(repo, tableName, record.id as string | number, links)
    yield* clearManyToManyLinks({
      app: params.app,
      tableName,
      recordId: record.id as string | number,
      cleared: clearedManyToManySpecs(params.fields, m2mSpecs),
      reader,
    })
    return record
  })

/** What an update writes, and who the record it hands back is read as. */
interface UpdateRecordParams {
  readonly fields: Readonly<Record<string, unknown>>
  readonly app?: App
  readonly userRole?: string
  /** The caller's groups: a field read grant may name a group. */
  readonly userGroups?: readonly string[]
  /**
   * Who a cleared many-to-many field is cleared for, when that is not the
   * session's own role — a run started by hand clears as its starter. Absent
   * with no `userRole` too, every link of a cleared field is removed.
   */
  readonly linkReader?: LinkReader
}

export function updateRecordProgram(
  session: Readonly<UserSession>,
  tableName: string,
  recordId: string,
  params: UpdateRecordParams
) {
  return Effect.gen(function* () {
    yield* refuseWhenNoSingleIdAddress(params.app, tableName)

    // [internal ref] (update): resolve the base row, handling the many-to-many split +
    // junction write. Extracted so this generator stays under the complexity cap.
    const written = yield* resolveUpdatedBaseRecord(session, tableName, recordId, {
      ...params,
      fields: normalizeDateValuesIn(params.app?.tables, tableName, params.fields),
    })

    // Pure m2m PATCH against a missing row: surface empty so the route 404s.
    if (Object.keys(written).length === 0) return {}

    // The answer holds no more than the writer's own read of the record.
    const [record = written] = yield* omitFromWriteEcho(
      params.app,
      tableName,
      [written],
      writeEchoReaderOf(session, params)
    )

    // Transform with app context to include table-specific fields like created_at/updated_at
    const transformed = transformRecord(record, { app: params.app, tableName })

    // Field-level read filtering, for the caller (role and groups) when named
    const filteredFields =
      readableEchoFields(record, { ...params, tableName }) ?? transformed.fields

    // Return in format expected by tests: system fields at root, user fields
    // both nested (canonical) and at the root (flat alias). Mirrors the
    // create-record response so PATCH and POST share the same envelope.
    return {
      ...filteredFields,
      // A record id reads as a string on every records-API response, as on create.
      id: transformed.id,
      fields: filteredFields,
      createdAt: transformed.createdAt,
      updatedAt: transformed.updatedAt,
      ...(transformed.createdBy ? { createdBy: transformed.createdBy } : {}),
      ...(transformed.updatedBy ? { updatedBy: transformed.updatedBy } : {}),
      ...(transformed.deletedBy ? { deletedBy: transformed.deletedBy } : {}),
    }
  }).pipe(
    announceRecordWrites(params.app),
    Effect.withSpan('tables.update-record-program', { attributes: { tableName, recordId } })
  )
}
