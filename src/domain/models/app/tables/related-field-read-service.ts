/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * May this reader see field F of related table T?
 *
 * A relationship's label (`_display`) and a lookup both copy a value of
 * ANOTHER table onto the record being read. That value reaches the reader
 * inside the request for the record, outside the related table's own route,
 * so neither the table middleware nor the field filter of the related table
 * ever ran for it. This is the one place both are asked again — the label and
 * the lookup ask the same question, so they get the same answer.
 *
 * Two steps, exactly the checks a direct read of the same column goes
 * through: the related TABLE must admit the reader
 * ({@link mayReadRelatedTable}), and the named FIELD of it must be readable by
 * them. Whether the linked ROW is the reader's is a third question, asked with
 * the rows in hand by the callers (a row-level rule needs the stored values).
 */

import { toGroupReference } from '@/domain/models/app/auth/groups/group-reference'
import { hasReadPermissionForCaller } from '@/domain/models/app/auth/permission-evaluator-service'
import { isFieldReadableByCaller } from './field-read-filter-service'
import type { App } from '@/domain/models/app'

/**
 * Who reads: an account role and the groups it belongs to (un-prefixed),
 * matched by `group:<name>` grants exactly as the record read matches them —
 * and whether she is a visitor who is not signed in.
 *
 * `signedOut` comes from the session's IDENTITY (its user id is the guest
 * sentinel), never from the role's name: an app may call one of its own roles
 * `guest`, and a member signed in under it is a signed-in member.
 */
export interface RelatedReader {
  readonly role: string
  readonly groups?: readonly string[] | undefined
  readonly signedOut: boolean
}

/**
 * May `reader` read rows of `relatedTableName` at all — its TABLE read grant?
 *
 * The table gate every door shares ({@link hasReadPermissionForCaller}): the
 * reader's role and groups, inheritance and override resolved, and a visitor
 * who is not signed in admitted only by a resolved `'all'` — a related value
 * bypasses the records route's middleware that answers her 401 elsewhere. An
 * undeclared table admits nobody.
 */
export const mayReadRelatedTable = (
  app: App,
  reader: RelatedReader,
  relatedTableName: string
): boolean => {
  const relatedTable = app.tables?.find((t) => t.name === relatedTableName)
  if (relatedTable === undefined) return false
  const effectiveRoles = [reader.role, ...(reader.groups ?? []).map(toGroupReference)]
  return hasReadPermissionForCaller(
    relatedTable,
    { effectiveRoles, signedOut: reader.signedOut },
    app
  )
}

/**
 * May `reader` see `fieldName` of `relatedTableName` — the table's read grant,
 * then the field's? Without this a column reserved for admins on `authors`
 * reached every viewer of `posts` one hop away, as a label or a lookup.
 */
export const mayReadRelatedField = (
  app: App,
  reader: RelatedReader,
  relatedTableName: string,
  fieldName: string
): boolean =>
  mayReadRelatedTable(app, reader, relatedTableName) &&
  isFieldReadableByCaller(
    app,
    relatedTableName,
    { role: reader.role, groups: reader.groups ?? [] },
    fieldName
  )
