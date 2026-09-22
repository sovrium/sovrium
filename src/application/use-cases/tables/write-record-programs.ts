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
import { isGuestSession } from '@/domain/models/app/auth/guest-session'
import {
  buildCreateAuthorshipOverrides,
  buildUpdateAuthorshipOverrides,
} from '@/domain/models/app/tables/authorship-fields'
import { filterReadableFields } from '@/domain/models/app/tables/field-read-filter-service'
import { enrichRecordWithAttachmentUrls } from './attachment-url-enricher'
import { getManyToManyFieldSpecs } from './many-to-many-fields'
import { refuseWhenNoSingleIdAddress } from './read-record-programs'
import { splitManyToManyFields, writeManyToManyLinks } from './record-link-enrichment'
import { transformRecord } from './record-transformer'
import type { TransformedRecord } from './record-transformer'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { DatabaseError } from '@/domain/errors'
import type { App } from '@/domain/models/app'

interface CreateRecordConfig {
  readonly session: Readonly<UserSession>
  readonly tableName: string
  readonly fields: Readonly<Record<string, unknown>>
  readonly app?: App
  readonly userRole?: string
  /** See `ListRecordsConfig.origin` in `list-records-program.ts`. */
  readonly origin?: string
}

/**
 * GAP-16: stamp every `created-by`/`updated-by`-typed column BY NAME with the
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
  return { ...fields, ...overrides }
}

export function createRecordProgram(config: CreateRecordConfig) {
  const { session, tableName, fields, app, userRole, origin } = config
  return Effect.gen(function* () {
    const repo = yield* TableRepository

    // GAP-16: see applyAuthorshipOverrides.
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
    const record = yield* repo.createRecord(session, tableName, baseFields)
    yield* writeManyToManyLinks(repo, tableName, record.id as string | number, links)

    // B-01: enrich attachment fields with signedUrl / url on the create-record
    // response so callers see the same shape they get back on GET / LIST.
    const enrich = (rec: TransformedRecord): TransformedRecord =>
      enrichRecordWithAttachmentUrls(rec, { app, tableName, origin: origin ?? '' })

    const transformed = enrich(transformRecord(record, app ? { app, tableName } : undefined))

    // Apply field-level read permissions filtering
    // If app and userRole are provided, filter fields based on permissions
    const filteredFields =
      app && userRole
        ? (() => {
            const filteredRecord = filterReadableFields({
              app,
              tableName,
              userRole,
              record,
            })

            // Transform filtered record to get only user fields (exclude system fields)
            const transformedFiltered = enrich(transformRecord(filteredRecord, { app, tableName }))
            return transformedFiltered.fields
          })()
        : transformed.fields

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
  }).pipe(Effect.withSpan('tables.create-record-program'))
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
  }
): Effect.Effect<Record<string, unknown>, DatabaseError, TableRepository> =>
  Effect.gen(function* () {
    const repo = yield* TableRepository
    const m2mSpecs = getManyToManyFieldSpecs(params.app?.tables, tableName)
    const { baseFields, links } = splitManyToManyFields(params.fields, m2mSpecs)

    // GAP-16: re-stamp every `updated-by`-typed column BY NAME with the updating
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

    // Write the m2m junction rows (idempotent add semantics).
    yield* writeManyToManyLinks(repo, tableName, record.id as string | number, links)
    return record
  })

export function updateRecordProgram(
  session: Readonly<UserSession>,
  tableName: string,
  recordId: string,
  params: {
    readonly fields: Readonly<Record<string, unknown>>
    readonly app?: App
    readonly userRole?: string
  }
) {
  return Effect.gen(function* () {
    yield* refuseWhenNoSingleIdAddress(params.app, tableName)

    // [internal ref] (update): resolve the base row, handling the many-to-many split +
    // junction write. Extracted so this generator stays under the complexity cap.
    const record = yield* resolveUpdatedBaseRecord(session, tableName, recordId, params)

    // Pure m2m PATCH against a missing row: surface empty so the route 404s.
    if (Object.keys(record).length === 0) return {}

    // Transform with app context to include table-specific fields like created_at/updated_at
    const transformed = transformRecord(record, { app: params.app, tableName })

    // Apply field-level read permissions filtering
    // If app and userRole are provided, filter fields based on permissions
    const filteredFields =
      params.app && params.userRole
        ? (() => {
            const filteredRecord = filterReadableFields({
              app: params.app!,
              tableName,
              userRole: params.userRole!,
              record,
            })

            // Transform filtered record to get only user fields (exclude system fields)
            const transformedFiltered = transformRecord(filteredRecord, {
              app: params.app,
              tableName,
            })
            return transformedFiltered.fields
          })()
        : transformed.fields

    // Return in format expected by tests: system fields at root, user fields
    // both nested (canonical) and at the root (flat alias). Mirrors the
    // create-record response so PATCH and POST share the same envelope.
    // Preserve original ID type (number if it was number in database).
    const originalId = record.id
    return {
      ...filteredFields,
      id: typeof originalId === 'number' ? originalId : transformed.id,
      fields: filteredFields,
      createdAt: transformed.createdAt,
      updatedAt: transformed.updatedAt,
      ...(transformed.createdBy ? { createdBy: transformed.createdBy } : {}),
      ...(transformed.updatedBy ? { updatedBy: transformed.updatedBy } : {}),
      ...(transformed.deletedBy ? { deletedBy: transformed.deletedBy } : {}),
    }
  }).pipe(Effect.withSpan('tables.update-record-program', { attributes: { tableName, recordId } }))
}
