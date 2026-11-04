/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Wire contract of `GET /api/admin/tables/:table/records/:recordId/access`:
 * what each role, and each person granted the record, may do with ONE record.
 *
 * The answer names roles, fields and people, never a field value, and it is
 * evaluated as the records API decides access: table grants, field rules and
 * row-level predicates together. A verdict is `depends` only when a row-level
 * predicate compares the record with the reader, and the row then says how in
 * `condition`.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/kernel/config-parsing/optional-field'

/** Whether a reader may perform one operation on the record.
 * @public
 */
export const recordAccessVerdictSchema = Schema.Literals(['yes', 'no', 'depends']).annotate({
  description:
    'yes or no for this record; depends when a row-level rule compares the record with the reader, explained by condition',
})

/** @public */
export type RecordAccessVerdict = typeof recordAccessVerdictSchema.Type

const accessFields = {
  read: recordAccessVerdictSchema.annotate({ description: 'Whether the record is read' }),
  update: recordAccessVerdictSchema.annotate({ description: 'Whether the record may be changed' }),
  delete: recordAccessVerdictSchema.annotate({ description: 'Whether the record may be deleted' }),
  readableFields: Schema.Array(Schema.String).annotate({
    description: 'The fields read on this record, in declaration order',
  }),
  writableFields: Schema.Array(Schema.String).annotate({
    description: 'The fields that may be set on this record, in declaration order',
  }),
  condition: optionalField(
    Schema.String.annotate({
      description: 'The row-level rule a depends verdict rests on, in words',
    })
  ),
}

/** One role the app declares, evaluated against the record.
 * @public
 */
export const recordAccessRoleSchema = Schema.Struct({
  role: Schema.String.annotate({ description: 'A role the app declares' }),
  ...accessFields,
})

/** @public */
export type RecordAccessRole = typeof recordAccessRoleSchema.Type

/** One person a scope-table grant names for the record, evaluated as that person.
 * @public
 */
export const recordAccessGrantSchema = Schema.Struct({
  userName: Schema.String.annotate({ description: 'The name of the person granted the record' }),
  userEmail: Schema.String.annotate({
    description: 'The address of the person granted the record',
  }),
  role: Schema.String.annotate({ description: 'The role the grant gives' }),
  ...accessFields,
})

/** @public */
export type RecordAccessGrant = typeof recordAccessGrantSchema.Type

/** The response: the record, then a row per role and a row per grant-holder.
 * @public
 */
export const recordAccessResponseSchema = Schema.Struct({
  table: Schema.String.annotate({ description: 'The table the record belongs to' }),
  recordId: Schema.String.annotate({ description: 'The record evaluated' }),
  roles: Schema.Array(recordAccessRoleSchema).annotate({
    description: 'One row per role the app declares, highest first',
  }),
  grants: Schema.Array(recordAccessGrantSchema).annotate({
    description:
      'One row per person granted the record; empty on a table that is not a scope table',
  }),
}).annotate({ identifier: 'RecordAccessResponse' })

/** @public */
export type RecordAccessResponse = typeof recordAccessResponseSchema.Type
