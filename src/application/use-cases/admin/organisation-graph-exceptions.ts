/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The declared narrowings of a grant, as the Matrix draws them BENEATH its grid.
 *
 * A Matrix cell says "engineer may read invoices". That is the grant, and it is
 * not the whole truth whenever the table also narrows WHICH COLUMNS or WHICH
 * ROWS that read covers. A glyph cannot show either, so the exceptions list is
 * the only thing on this body that can say so.
 *
 * ─── TWO DECLARATIONS, WRITTEN YEARS APART, READ HERE AS ONE IDEA ────────────
 *
 * AppSchema declares exactly two narrowings, and they do not live together:
 *
 *   - `tables[].permissions.fields[] = { field, read?, write? }`  -> scope `field`
 *   - `tables[].rowLevelPermissions.{read,write,create,delete}.when` -> scope `row`
 *
 * The second is NOT inside `permissions` — it is a sibling key on the table.
 * This is the first surface in the product that reads the two as one sentence:
 * "the grid's cell is not the whole truth for this table."
 *
 * ─── WHAT IS PUBLISHED, AND THE ONE THING THAT IS NOT ────────────────────────
 *
 * Field names, role names and the SHAPE of the grant — all NAMES, the class this
 * body already carries everywhere. `group:<name>` entries survive verbatim,
 * because that prefix is a convention the evaluator decodes at runtime rather
 * than part of the declared type, and stripping it would publish a role that
 * does not exist.
 *
 * A row predicate's configured VALUE is never published, in any field, not even
 * inside the rendered `detail`. An admin-tier caller can already read those
 * literals through `GET /api/admin/config/schema`, so carrying one would widen
 * nothing legally — it would still be the first VALUE on a body whose rule is
 * that every string is a NAME or a sentence about names, and the narrower body
 * is the one to ship (S4). That is the identical argument that keeps `email` off
 * a `person` node. What an operator needs from a predicate is not the comparison
 * but the SCOPING: reads of this table are filtered, and on these fields.
 *
 * The scoping is therefore read off the predicate TREE rather than off its
 * leaves' values: a composite AND/OR group keys on several fields, and each one
 * is a row.
 *
 * ─── WHY `undeclared` IS NOT A PUBLISHABLE RUNG ──────────────────────────────
 *
 * `classifyPermissionRung` has four values and this list publishes three. An
 * exception IS a declaration, so a row reading "nothing was declared here" would
 * be a row for every field of every table that declares no restriction — the
 * list would become a census of the configuration, and the one thing it is for
 * is telling an operator which cells of the Matrix are lying.
 *
 * @see src/application/use-cases/admin/organisation-graph.ts (the assembly)
 * @see src/domain/models/api/admin/organisation/graph.ts (the wire contract)
 */

import { tableNodeId, unique } from '@/application/use-cases/admin/organisation-graph-projection'
import {
  classifyPermissionRung,
  isOpenToEveryone,
} from '@/domain/models/app/auth/permission-evaluation'
import type { AdminOrganisationGraphException } from '@/domain/models/api/admin/organisation/graph'
import type { App } from '@/domain/models/app'
import type { PermissionValue } from '@/domain/models/app/auth/permissions'
import type { RowLevelWhen } from '@/domain/models/app/tables/row-level-permissions'

type AppTable = NonNullable<App['tables']>[number]

/** The two operations a per-FIELD restriction can narrow, in published order. */
const FIELD_OPS = ['read', 'write'] as const
type FieldOp = (typeof FIELD_OPS)[number]

/** The four operations a per-ROW predicate can narrow, in published order. */
const ROW_OPS = ['read', 'write', 'create', 'delete'] as const
type RowOp = (typeof ROW_OPS)[number]

/** The three rungs an exception may publish — `undeclared` is not one of them. */
type PublishedRung = 'everyone' | 'any-session' | 'roles'

/**
 * The shape of a declared grant, or `undefined` when nothing was declared.
 *
 * Read through the domain's own classifier rather than by comparing against the
 * ladder literals: a second reading of what a permission MEANS is a second
 * answer to "who can reach what", and the two would drift.
 */
const publishedRung = (permission: PermissionValue | undefined): PublishedRung | undefined => {
  const rung = classifyPermissionRung(permission)
  return rung === 'undeclared' ? undefined : rung
}

/**
 * The role names a permission declares, or `undefined` when it names none.
 *
 * `typeof permission === 'string'` rather than `Array.isArray`: the two open
 * rungs are the only string members of the union, and `Array.isArray` narrows a
 * `readonly string[]` to a mutable `any[]`, losing the element type.
 */
const declaredRoles = (permission: PermissionValue): readonly string[] | undefined =>
  typeof permission === 'string' ? undefined : permission

/**
 * How a field restriction reads as one sentence, per rung.
 *
 * The open rungs are asked through the domain's own narrow predicates rather
 * than by comparing against the ladder literal: a second reading of what `all`
 * MEANS is a second answer to "who can reach what", and the two would drift.
 */
const fieldDetail = (op: FieldOp, field: string, permission: PermissionValue): string => {
  const roles = declaredRoles(permission)
  if (roles === undefined) {
    return isOpenToEveryone(permission)
      ? `Everyone may ${op} ${field}.`
      : `Any signed-in account may ${op} ${field}.`
  }
  return roles.length === 0
    ? `No role may ${op} ${field}.`
    : `Only ${roles.join(', ')} may ${op} ${field}.`
}

/**
 * One row per declared `{ field, read?, write? }` entry and operation.
 *
 * `roles` is omitted when the declaration names none — including the degenerate
 * `read: []`, which narrows to nobody and is still a narrowing worth reporting.
 * The wire contract forbids an empty `roles` array, so the alternative would be
 * to drop the strongest restriction there is.
 */
const fieldException = (
  table: AppTable,
  field: string,
  op: FieldOp,
  permission: PermissionValue
): AdminOrganisationGraphException => {
  const rung = publishedRung(permission)
  const roles = declaredRoles(permission)
  return {
    id: `exception:field:${table.name}:${op}:${field}`,
    resourceNodeId: tableNodeId(table.name),
    resource: table.name,
    scope: 'field',
    op,
    field,
    ...(rung === undefined ? {} : { rung }),
    ...(roles === undefined || roles.length === 0 ? {} : { roles }),
    detail: fieldDetail(op, field, permission),
  }
}

const fieldExceptionsFor = (table: AppTable): readonly AdminOrganisationGraphException[] =>
  (table.permissions?.fields ?? []).flatMap((entry) =>
    FIELD_OPS.flatMap((op) => {
      const permission = entry[op]
      return permission === undefined ? [] : [fieldException(table, entry.field, op, permission)]
    })
  )

/**
 * Every field a `when` predicate keys on, walking composite AND/OR groups.
 *
 * `'conditions' in when` is the discriminant: a group carries that key and a
 * single triple does not. Nesting is arbitrary, so the walk recurses.
 */
const predicateFields = (when: RowLevelWhen): readonly string[] =>
  'conditions' in when ? when.conditions.flatMap(predicateFields) : [when.field]

/** How a row predicate reads as one sentence — the scoping, never the comparison. */
const ROW_DETAIL: Readonly<Record<RowOp, string>> = {
  read: 'Reads are filtered on',
  write: 'Writes are filtered on',
  create: 'Creates are constrained on',
  delete: 'Deletions are filtered on',
}

/**
 * One row per operation and per field the predicate keys on.
 *
 * `rung` and `roles` are both ABSENT: a predicate names no role at all, and a
 * rung on a row exception would claim the scoping is role-shaped when it is not.
 */
const rowExceptionsFor = (table: AppTable): readonly AdminOrganisationGraphException[] => {
  const declared = table.rowLevelPermissions
  if (declared === undefined) return []
  return ROW_OPS.flatMap((op) => {
    const when = declared[op]?.when
    if (when === undefined) return []
    return unique(predicateFields(when)).map((field) => ({
      id: `exception:row:${table.name}:${op}:${field}`,
      resourceNodeId: tableNodeId(table.name),
      resource: table.name,
      scope: 'row' as const,
      op,
      field,
      detail: `${ROW_DETAIL[op]} ${field}.`,
    }))
  })
}

/**
 * Drop any row whose id a previous row already took.
 *
 * `permissions.fields[]` is an array, so a configuration may declare the same
 * column twice; ids must stay unique within the list, because a duplicate makes
 * two narrowings one addressable row.
 */
const byUniqueId = (
  exceptions: readonly AdminOrganisationGraphException[]
): readonly AdminOrganisationGraphException[] =>
  exceptions.filter(
    (exception, index) => exceptions.findIndex((other) => other.id === exception.id) === index
  )

/**
 * Every declared narrowing the configuration carries, across every table.
 *
 * Total and pure: it reads the live app already in hand and costs no query,
 * exactly like the grant fold beside it. A table declaring neither key
 * contributes nothing — an exceptions list that grew a row per unrestricted
 * field would be a census rather than a list of what a cell cannot show.
 */
export const deriveExceptions = (app: App): readonly AdminOrganisationGraphException[] =>
  byUniqueId(
    (app.tables ?? []).flatMap((table) => [
      ...fieldExceptionsFor(table),
      ...rowExceptionsFor(table),
    ])
  )
