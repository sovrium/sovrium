/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  anonymousGrant,
  servesNoAuthVisitor,
} from '@/domain/models/app/auth/anonymous-grant-service'
import { SIGNED_OUT_VISITOR_ROLE } from '@/domain/models/app/auth/permission-evaluation'
import { hasReadPermissionForRoles } from '@/domain/models/app/auth/permission-evaluator-service'
import { assignableRoleNames } from '@/domain/models/app/auth/roles'
import { isFieldReadableByCaller } from './field-read-filter-service'
import type { App } from '@/domain/models/app'

/**
 * Who will read what a generated artefact names: a signed-in person holding
 * one role, or a visitor who is not signed in. The answer to "may this reader
 * read that table, that field" is the records API's own — the table read gate
 * (`hasReadPermissionForRoles`, `anonymousGrant` for the visitor) and the
 * field read rules with their built-in defaults (`isFieldReadableByCaller`) —
 * so an artefact never names a table or a field the API would not name to the
 * same reader. `sovrium client` writes a file a front-end ships in public, and
 * it uses this to leave out everything its audience may not read.
 */
export type ReadAudience =
  { readonly kind: 'visitor' } | { readonly kind: 'role'; readonly role: string }

/** A visitor who is not signed in. */
export const VISITOR_AUDIENCE: ReadAudience = { kind: 'visitor' }

/**
 * The audience when none is named: a person holding the app's default role
 * (`auth.defaultRole`, else `member`), or, on an app nobody can sign in to,
 * the visitor.
 */
export const defaultReadAudience = (app: App): ReadAudience =>
  servesNoAuthVisitor(app)
    ? VISITOR_AUDIENCE
    : { kind: 'role', role: app.auth?.defaultRole ?? 'member' }

/** The roles an audience may name on `app`, sorted; none on an app nobody can sign in to. */
export const declaredAudienceRoles = (app: App): readonly string[] =>
  servesNoAuthVisitor(app) ? [] : [...assignableRoleNames(app)].toSorted()

/**
 * The audience `requested` names — `all` for the visitor, else a role the app
 * declares — the default when nothing is requested, or `undefined` for a role
 * the app does not declare.
 */
export const resolveReadAudience = (
  app: App,
  requested: string | undefined
): ReadAudience | undefined => {
  if (requested === undefined) return defaultReadAudience(app)
  if (requested === 'all') return VISITOR_AUDIENCE
  return declaredAudienceRoles(app).includes(requested)
    ? { kind: 'role', role: requested }
    : undefined
}

/** Whether `audience` may read the records of the table named `tableName`. */
export const audienceReadsTable = (
  app: App,
  tableName: string,
  audience: ReadAudience
): boolean => {
  const table = app.tables?.find((candidate) => candidate.name === tableName)
  if (table === undefined) return false
  return audience.kind === 'visitor'
    ? anonymousGrant(table, 'read', app)
    : hasReadPermissionForRoles(table, [audience.role], app)
}

/**
 * Whether `audience` may read `fieldName` of `tableName`, as the records API
 * decides it for that reader. The visitor is the API's signed-out principal,
 * which a field opened to `authenticated` does not admit — on an app with no
 * `auth` either, where nobody can sign in to be admitted by it.
 */
export const audienceReadsField = (
  app: App,
  tableName: string,
  fieldName: string,
  audience: ReadAudience
): boolean =>
  isFieldReadableByCaller(
    app,
    tableName,
    { role: audience.kind === 'visitor' ? SIGNED_OUT_VISITOR_ROLE : audience.role, groups: [] },
    fieldName
  )
