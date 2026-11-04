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
 * statement and hand the junction rows to the same write (one transaction), both filter the echoed row
 * through the caller's read permissions, and both return the same envelope
 * (system fields at the root, user fields nested AND flat). Separating them
 * would put those four decisions in two places and invite the next change to
 * land in only one of them — which is how a `POST` and a `PATCH` against the
 * same table come to disagree about what they echo.
 *
 * The junction half lives in `record-link-enrichment.ts`, shared with the reads;
 * the single-record address refusal comes from `read-record-programs.ts`, whose
 * docstring explains why every verb under `/records/:recordId` raises it identically.
 */

import { Effect } from 'effect'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import { ProcessEnv, type ProcessEnvShape } from '@/application/ports/services/process-env'
import { filterReadableFields } from '@/domain/models/app/tables/field-read-filter-service'
import { transformRecord } from '@/domain/models/app/tables/record-transformer-service'
import { languageMergesIn } from '@/domain/models/app/tables/translatable-write-service'
import { storedValuesIn } from '@/domain/models/app/tables/user-list-field-service'
import { enrichRecordWithAttachmentUrls } from './attachment-url-enricher'
import { applyAuthorshipOverrides } from './authorship-overrides'
import { omitFromWriteEcho, writeEchoReaderOf } from './hidden-lookup-omission'
import { namedAccounts, refuseUnreadableLinkTargets } from './link-target-check'
import { getManyToManyFieldSpecs } from './many-to-many-fields'
import { refuseWhenNoSingleIdAddress } from './read-record-programs'
import { announceRecordWrites } from './record-change-announcement'
import {
  mergeManyToManyFields,
  removedLinksOf,
  splitManyToManyFields,
} from './record-link-enrichment'
import { refuseSelfLinkCycle } from './self-link-cycle-check'
import { settleSignatureWrites, writeOnceColumnsOf } from './signature-write-once-check'
import { readWrittenLinkLists } from './to-many-link-reads'
import { writeOnlyBlock } from './write-only-presence'
import type { LinkReader } from './linked-row-visibility'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type { InTransactionRuleJudge } from '@/application/ports/repositories/tables/in-transaction-rule-judge'
import type { TableReadError } from '@/application/ports/repositories/tables/table-repository'
import type {
  BusinessRuleViolationError,
  ForeignKeyViolationError,
  StaleWriteError,
  ValidationError,
} from '@/domain/errors'
import type { App } from '@/domain/models/app'
import type { TransformedRecord } from '@/domain/models/app/tables/record-transformer-service'

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
 * `userGroups`: the record less the fields they may not read, transformed and
 * enriched. `undefined` when no caller is named — the record is then answered
 * as stored.
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

/**
 * The user fields a write echoes: the record less what the caller may not read,
 * then each many-to-many list the write named, read back as a read lists it.
 */
const echoedFields = (
  session: Readonly<UserSession>,
  echo: {
    readonly record: Readonly<Record<string, unknown>>
    readonly transformed: TransformedRecord
    readonly written: Readonly<Record<string, unknown>>
    readonly readable: Parameters<typeof readableEchoFields>[1]
    readonly linkReader?: LinkReader | undefined
  }
) =>
  Effect.gen(function* () {
    const { app, tableName, userRole } = echo.readable
    const links = yield* readWrittenLinkLists(app, tableName, echo.transformed.id, {
      written: echo.written,
      reader: linkReaderOf(session, userRole, echo.linkReader),
    })
    return mergeManyToManyFields(
      readableEchoFields(echo.record, echo.readable) ?? echo.transformed.fields,
      echo.transformed.id,
      links
    ) as TransformedRecord['fields']
  })

/** A write echo's attachment fields, given the download URLs a read hands out. */
const attachmentUrlsOf =
  (app: App | undefined, tableName: string, origin: string | undefined, env: ProcessEnvShape) =>
  (rec: TransformedRecord): TransformedRecord =>
    enrichRecordWithAttachmentUrls(rec, { app, tableName, origin: origin ?? '', env })

export function createRecordProgram(config: CreateRecordConfig) {
  const { session, tableName, app, userRole, origin } = config
  const stored = storedValuesIn(app?.tables, tableName, config.fields)
  const fields = languageMergesIn(app, tableName, stored)
  return Effect.gen(function* () {
    const repo = yield* TableRepository

    // Links are judged before anything is written, so a refused one leaves no record.
    yield* refuseUnreadableLinkTargets({
      ...{ app, session, tableName, writes: [{ fields }] },
      reader: linkReaderOf(session, userRole, config.linkReader),
    })

    const [settled = fields] = yield* settleSignatureWrites({
      ...{ app, tableName, writes: [{ fields }] },
    })
    const fieldsWithAuthorship = applyAuthorshipOverrides({
      ...{ phase: 'create', fields: settled, tables: app?.tables, tableName },
      userId: session.userId,
    })

    // A many-to-many field has no base column: its junction rows are written after
    // the base row (real id), in the same transaction — a refused link leaves no record.
    const { baseFields, links } = splitManyToManyFields(
      fieldsWithAuthorship,
      getManyToManyFieldSpecs(app?.tables, tableName)
    )

    const accounts = namedAccounts(app, tableName, [fields])
    const created = yield* repo.createRecord(session, tableName, baseFields, { links, accounts })

    // The answer holds no more than the writer's own read of the record.
    const [record = created] = yield* omitFromWriteEcho(
      app,
      tableName,
      [created],
      writeEchoReaderOf(session, { ...config, userRole })
    )

    // Attachment fields carry their download URLs, as a GET or LIST answers them.
    const enrich = attachmentUrlsOf(app, tableName, origin, yield* ProcessEnv)

    const transformed = enrich(transformRecord(record, app ? { app, tableName } : undefined))

    const filteredFields = yield* echoedFields(session, {
      ...{ record, transformed, written: config.fields, linkReader: config.linkReader },
      readable: { ...config, enrich },
    })

    // System fields at the root, user fields nested (canonical) and flat (`record.file`).
    return {
      ...filteredFields,
      id: transformed.id,
      fields: filteredFields,
      createdAt: transformed.createdAt,
      updatedAt: transformed.updatedAt,
      ...(transformed.createdBy ? { createdBy: transformed.createdBy } : {}),
      ...(transformed.updatedBy ? { updatedBy: transformed.updatedBy } : {}),
      ...(transformed.deletedBy ? { deletedBy: transformed.deletedBy } : {}),
      ...writeOnlyBlock({ ...config, record }),
    }
  }).pipe(announceRecordWrites(app), Effect.withSpan('tables.create-record-program'))
}

/** What the base-row write of an update is given. */
interface BaseRecordUpdate {
  readonly fields: Readonly<Record<string, unknown>>
  readonly app?: App
  readonly userRole?: string
  readonly linkReader?: LinkReader
  readonly expectedUpdatedAt?: string
  readonly auditContext?: Readonly<Record<string, string>>
  readonly linkLists?: 'replace'
  readonly judge?: InTransactionRuleJudge | undefined
}

/** How the base-row write of an update fails, a business rule's refusal included. */
type BaseRecordUpdateFailure =
  | TableReadError
  | ForeignKeyViolationError
  | StaleWriteError
  | ValidationError
  | BusinessRuleViolationError

/**
 * the many-to-many junction-write rule (update): write the row and its many-to-many links as ONE write.
 *
 * A `many-to-many` relationship field has no base column, so it is split OUT of
 * the SET clause and its ids written to the junction table — mirroring the
 * create path. Without the split the field name reaches the base UPDATE (no
 * such column), the update matches nothing, and the route 404s.
 *
 * Everything the change reads is read first — the link targets it may name,
 * the links a cleared field removes — and everything it writes goes to ONE
 * `updateRecord` call, which applies the row, the new links and the removed
 * links in one transaction, with the optimistic-lock token checked in the
 * row's own UPDATE. So a refused link or a stale token keeps nothing.
 *
 * A pure m2m PATCH (only relationship arrays) leaves the row as it is and
 * changes its links only; it returns `{}` when the row is missing (the caller
 * surfaces that as a 404). No-op split for tables/patches with no m2m field.
 */
const resolveUpdatedBaseRecord = (
  session: Readonly<UserSession>,
  tableName: string,
  recordId: string,
  params: BaseRecordUpdate
): Effect.Effect<
  Record<string, unknown>,
  BaseRecordUpdateFailure,
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
    const { app, fields } = params
    yield* refuseSelfLinkCycle({ app, session, tableName, recordId, fields })
    const [settled = fields] = yield* settleSignatureWrites({
      ...{ app, tableName, writes: [{ fields, held }] },
    })
    const m2mSpecs = getManyToManyFieldSpecs(params.app?.tables, tableName)
    const { baseFields, links } = splitManyToManyFields(settled, m2mSpecs)

    // [internal ref]: re-stamp every `updated-by`-typed column BY NAME with the updating
    // actor (created-by fields are never touched on update).
    const baseWithAuthorship = applyAuthorshipOverrides({
      phase: 'update',
      fields: baseFields,
      tables: params.app?.tables,
      tableName,
      userId: session.userId,
    })

    // A pure m2m PATCH targets a live row: a missing or deleted one is a 404.
    const writesRow = Object.keys(baseWithAuthorship).length > 0
    if (!writesRow && (yield* repo.getRecord(session, tableName, recordId)) === null) return {}

    const unlinks = yield* removedLinksOf({ ...params, tableName, recordId, reader, m2mSpecs })
    const { expectedUpdatedAt, auditContext, judge } = params
    return yield* repo.updateRecord(session, tableName, recordId, {
      ...{ fields: baseWithAuthorship, app: params.app, links, unlinks },
      writeOnce: writeOnceColumnsOf(app, tableName),
      accounts: namedAccounts(params.app, tableName, [params.fields]),
      ...(expectedUpdatedAt === undefined ? {} : { expectedUpdatedAt }),
      ...(auditContext === undefined ? {} : { auditContext }),
      ...(judge === undefined ? {} : { judge }),
    })
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
  /**
   * The `updatedAt` the caller last read. Checked inside the write itself: when
   * the record changed since, nothing is written and the program fails with
   * `StaleWriteError`.
   */
  readonly expectedUpdatedAt?: string
  /** The surface the change is recorded as made through (a form edit link). */
  readonly auditContext?: Readonly<Record<string, string>>
  /**
   * `replace`: a many-to-many list in the change is the whole set of links the
   * writer keeps, so the readable links it leaves out are removed. Absent, a
   * list ADDS its links, as the records API documents.
   */
  readonly linkLists?: 'replace'
  /** The request origin, for the attachment URLs of the echo — as on create. */
  readonly origin?: string
  /** The table's business rules, judged inside the write on the row as it stands there. */
  readonly judge?: InTransactionRuleJudge | undefined
}

export function updateRecordProgram(
  session: Readonly<UserSession>,
  tableName: string,
  recordId: string,
  params: UpdateRecordParams
) {
  return Effect.gen(function* () {
    yield* refuseWhenNoSingleIdAddress(params.app, tableName)

    // The base row, with the many-to-many split and junction write (apart for the complexity cap)
    const written = yield* resolveUpdatedBaseRecord(session, tableName, recordId, {
      ...params,
      fields: languageMergesIn(
        params.app,
        tableName,
        storedValuesIn(params.app?.tables, tableName, params.fields)
      ),
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

    // Attachment fields carry their download URLs, as the create echo and a read do
    const enrich = attachmentUrlsOf(params.app, tableName, params.origin, yield* ProcessEnv)
    const transformed = enrich(transformRecord(record, { app: params.app, tableName }))

    const filteredFields = yield* echoedFields(session, {
      ...{ record, transformed, written: params.fields, linkReader: params.linkReader },
      readable: { ...params, tableName, enrich },
    })

    // The create echo's envelope: system fields at root, user fields nested and flat.
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
      ...writeOnlyBlock({ ...params, tableName, record }),
    }
  }).pipe(
    announceRecordWrites(params.app),
    Effect.withSpan('tables.update-record-program', { attributes: { tableName, recordId } })
  )
}
