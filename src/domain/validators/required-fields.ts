/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * "Which `required` fields did this write omit?" — asked once, for every write
 * route.
 *
 * This lived as two independent copies: one behind `POST /records`
 * (`presentation/api/validation/rules/field-rules.ts`) and one behind
 * `POST /records/upsert`
 * (`presentation/api/routes/tables/record/create-record-helpers.ts`). They then
 * drifted: the create copy learned the `default` exemption (GAP-10,
 * [internal ref]) and the upsert copy did not. The visible
 * result was two routes giving OPPOSITE answers to the same config — a field
 * declared `required: true, default: 'draft'` created fine through
 * `POST /records` and was rejected by `POST /records/upsert` with
 * `Required field is missing`, naming a field whose value the column supplies.
 * On both dialects, on both the create and the update branch.
 *
 * One function, so the next rule to be added arrives at every route at once.
 */

/** The shape this rule needs from a field declaration. */
type RequiredFieldCandidate = {
  readonly name: string
  readonly required?: boolean
}

/** The shape this rule needs from a table declaration. */
type RequiredFieldTable = {
  readonly fields: readonly RequiredFieldCandidate[]
  readonly primaryKey?: {
    readonly fields?: readonly string[]
    readonly field?: string
  }
}

/**
 * True when a field carries a user-declared `default`.
 *
 * Such a field satisfies `required` even when omitted: the generated column
 * gets a `DEFAULT` clause, so the value IS supplied — by the database rather
 * than by the caller. Rejecting the write would demand a value the operator
 * deliberately arranged not to have to send.
 *
 * `undefined` is not a default: `{ default: undefined }` and an absent key mean
 * the same thing to the DDL generator, so they must mean the same thing here.
 */
export const hasUserDefault = (field: object): boolean =>
  'default' in field && (field as { readonly default?: unknown }).default !== undefined

/**
 * The names of every `required` field this payload omits, in declaration order.
 *
 * Omission is KEY PRESENCE — `{ name: null }` is present, and is left to the
 * column to reject; see `domain/errors/driver-failure.ts` for how that arrives
 * back as a 400 rather than a 500.
 *
 * Exempt: primary-key fields (generated), and fields carrying a user `default`.
 */
export const findMissingRequiredFieldNames = (
  table: RequiredFieldTable | undefined,
  fields: Readonly<Record<string, unknown>>
): readonly string[] => {
  if (!table) return []

  const primaryKeyFields = new Set(
    table.primaryKey?.fields ?? (table.primaryKey?.field ? [table.primaryKey.field] : [])
  )

  return table.fields
    .filter(
      (field) =>
        field.required === true &&
        !(field.name in fields) &&
        !primaryKeyFields.has(field.name) &&
        !hasUserDefault(field)
    )
    .map((field) => field.name)
}
