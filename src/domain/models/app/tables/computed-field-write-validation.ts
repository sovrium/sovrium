/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * "Which computed fields does this write name?" — asked once, for every door a
 * record write comes through: the single-record create and update, the native
 * form update, the batch create, update and upsert, the bulk-form update and the
 * MCP write tools.
 *
 * A `formula`, `rollup`, `count`, `lookup` or `autonumber` field holds no value
 * of its own, so a write naming one is refused, never stripped: a silent drop
 * would report a write that did not happen. Naming the key is enough — `null`
 * (a clear) is a write like any other value.
 *
 * Source of truth for the types: {@link isReadonlyComputedFieldType}.
 */

import { forbiddenWriteFields, type FieldWriter } from './field-write-permission-service'
import { isReadonlyComputedFieldType } from './fields/field'
import type { App } from '@/domain/models/app'

/** The shape this rule needs from a field declaration. */
type ComputedFieldCandidate = { readonly name: string; readonly type: string }

/**
 * The names of every computed field any of the payloads names, in the table's
 * field-declaration order — so the first one is the field a refusal names,
 * whatever order the caller wrote its keys in. Empty when the write may proceed.
 */
export const findComputedFieldWrites = (
  tableFields: readonly ComputedFieldCandidate[] | undefined,
  payloads: readonly Readonly<Record<string, unknown>>[]
): readonly string[] =>
  (tableFields ?? [])
    .filter(
      (field) =>
        isReadonlyComputedFieldType(field.type) &&
        payloads.some((payload) => Object.hasOwn(payload, field.name))
    )
    .map((field) => field.name)

/**
 * {@link findComputedFieldWrites}, less the fields the writer may not write.
 *
 * A computed field she may not write — one she may not read, under the default
 * rule — is the field write rule's to answer, exactly as an ordinary field she
 * may not write is: a `404`, or a strip where the door strips. Naming it in a
 * `400` would tell her the table holds a computed field of that name, which the
 * answer for an ordinary hidden field never does.
 */
export const findWritableComputedFieldWrites = (
  app: App,
  tableName: string,
  writer: FieldWriter,
  payloads: readonly Readonly<Record<string, unknown>>[]
): readonly string[] =>
  findComputedFieldWrites(
    app.tables?.find((table) => table.name === tableName)?.fields,
    payloads
  ).filter(
    (name) => forbiddenWriteFields(app, tableName, writer, { [name]: undefined }).length === 0
  )

/** The refusal message every door gives for a write to a readonly field. */
export const readonlyFieldWriteMessage = (fieldName: string): string =>
  `Cannot write to readonly field '${fieldName}'`
