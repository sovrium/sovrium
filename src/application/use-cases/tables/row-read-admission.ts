/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The rows of a table a reader may read, with the grants that admit them —
 * the records API's one answer for its list, its single read and the links to
 * many records into the table (`rowReadAdmission` decides; this reads the
 * grants it decides on).
 *
 * The grants are read only on a table listed in `auth.scopeTables`, for a
 * signed-in reader who is not admin-equivalent: everyone else's answer comes
 * from the schema alone, at no query.
 */

import { Effect } from 'effect'
import { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import { NotFoundError } from '@/domain/errors'
import { isGuestSession } from '@/domain/models/app/auth/guest-session'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import {
  admitsRow,
  rowReadAdmission,
  type RowGrants,
  type RowReadAdmission,
} from '@/domain/models/app/tables/row-read-admission-service'
import { logError } from '@/infrastructure/logging/logger'
import { getUserAccessRoles } from './user-groups'
import type { LinkReader } from './linked-row-visibility'
import type { QueryFilter } from '@/application/ports/repositories/tables/table-repository'
import type { App } from '@/domain/models/app'

/** What a read of `tableName` admits its reader, and the grants behind it. */
export interface ReaderRows {
  readonly admission: RowReadAdmission
  readonly grants: RowGrants
}

const EVERY_ROW: ReaderRows = { admission: { kind: 'every-row' }, grants: new Map() }

/**
 * The rows of `tableName` the reader's grants name, each with the roles
 * granted on it. A lookup fault fails CLOSED — the reader holds no grant — and
 * is logged: a grant can only widen what is read.
 */
const loadRowGrants = (
  tableName: string,
  userId: string
): Effect.Effect<RowGrants, never, DataSourceRepository> =>
  Effect.gen(function* () {
    const repo = yield* DataSourceRepository
    const roles = yield* getUserAccessRoles(userId)
    const byRole = yield* Effect.forEach(roles, (role) =>
      repo.fetchUserAssignments(userId, tableName, role).pipe(
        Effect.tapCause((cause) =>
          Effect.sync(() =>
            logError('[PERMISSIONS] Scope grant lookup failed; reading without it', cause, {
              tableSlug: tableName,
              userId,
            })
          )
        ),
        // effect-swallow: failing closed — without the grant the reader reads fewer rows, never more.
        Effect.orElseSucceed(() => [] as readonly string[]),
        Effect.map((ids) => ids.map((id) => [String(id), role] as const))
      )
    )
    return byRole
      .flat()
      .reduce<ReadonlyMap<string, readonly string[]>>(
        (grants, [id, role]) => new Map([...grants, [id, [...(grants.get(id) ?? []), role]]]),
        new Map()
      )
  })

/**
 * The rows of `tableName` `reader` may read ({@link RowReadAdmission}) and
 * the grants that admit them. Asked once the table's read rule has let her in.
 */
export const readerRowsOf = (
  app: App | undefined,
  tableName: string,
  reader: LinkReader
): Effect.Effect<ReaderRows, never, DataSourceRepository> =>
  Effect.gen(function* () {
    if (app?.auth === undefined || isAdminEquivalent(reader.role, app)) return EVERY_ROW
    const signedOut = isGuestSession(reader.session.userId)
    const scoped = !signedOut && (app.auth.scopeTables ?? []).includes(tableName)
    const grants = scoped ? yield* loadRowGrants(tableName, reader.session.userId) : new Map()
    const related = { role: reader.role, groups: reader.groups ?? [], signedOut }
    return { admission: rowReadAdmission(app, tableName, related, grants), grants }
  }).pipe(Effect.withSpan('tables.reader-rows-of'))

/**
 * A list's filter narrowed to the rows its reader may read: unchanged for
 * every row, `id IN` the granted rows, and refused as a table that does not
 * exist when she may read none.
 */
export const filterToReaderRows = (
  filter: QueryFilter | undefined,
  admission: RowReadAdmission
): Effect.Effect<QueryFilter | undefined, NotFoundError> => {
  if (admission.kind === 'no-row') {
    return Effect.fail(new NotFoundError('Table not found')).pipe(
      Effect.withSpan('tables.narrow-list-to-reader-rows')
    )
  }
  const narrowed = (ids: readonly string[]): QueryFilter => ({
    and: [...(filter?.and ?? []), { field: 'id', operator: 'in', value: ids }],
  })
  return Effect.succeed(admission.kind === 'every-row' ? filter : narrowed(admission.ids)).pipe(
    Effect.withSpan('tables.narrow-list-to-reader-rows')
  )
}

/**
 * The grants a single read of the row `id` is shaped with, or the refusal of a
 * row its reader may not read — answered exactly as a row that does not exist.
 */
export const grantsForReadableRow = (
  app: App | undefined,
  tableName: string,
  reader: LinkReader,
  id: unknown
): Effect.Effect<RowGrants, NotFoundError, DataSourceRepository> =>
  readerRowsOf(app, tableName, reader).pipe(
    Effect.flatMap(({ admission, grants }) =>
      admitsRow(admission, String(id))
        ? Effect.succeed(grants)
        : Effect.fail(new NotFoundError('Record not found'))
    ),
    Effect.withSpan('tables.grants-for-readable-row')
  )
