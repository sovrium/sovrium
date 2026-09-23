/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema, SchemaGetter } from 'effect'
import {
  AiCategorizeFieldSchema,
  AiExtractFieldSchema,
  AiGenerateFieldSchema,
  AiSentimentFieldSchema,
  AiSummaryFieldSchema,
  AiTagFieldSchema,
  AiTranslateFieldSchema,
  ArrayFieldSchema,
  AutonumberFieldSchema,
  BarcodeFieldSchema,
  ButtonFieldSchema,
  CheckboxFieldSchema,
  CodeFieldSchema,
  ColorFieldSchema,
  CountFieldSchema,
  CreatedAtFieldSchema,
  CreatedByFieldSchema,
  CurrencyFieldSchema,
  DateFieldSchema,
  DateTimeFieldSchema,
  DecimalFieldSchema,
  DeletedAtFieldSchema,
  DeletedByFieldSchema,
  DurationFieldSchema,
  EmailFieldSchema,
  FormulaFieldSchema,
  GeolocationFieldSchema,
  IntegerFieldSchema,
  JsonFieldSchema,
  LongTextFieldSchema,
  LookupFieldSchema,
  MultiSelectFieldSchema,
  MultipleAttachmentsFieldSchema,
  PercentageFieldSchema,
  PhoneNumberFieldSchema,
  ProgressFieldSchema,
  RatingFieldSchema,
  RelationshipFieldSchema,
  RichTextFieldSchema,
  RollupFieldSchema,
  SingleAttachmentFieldSchema,
  SingleLineTextFieldSchema,
  SingleSelectFieldSchema,
  StatusFieldSchema,
  TimeFieldSchema,
  UnknownFieldSchema,
  UpdatedAtFieldSchema,
  UpdatedByFieldSchema,
  UrlFieldSchema,
  UserFieldSchema,
} from './field-types'

/**
 * Auto-generate field IDs for fields that don't have one.
 *
 * Fields without explicit IDs get auto-generated numeric IDs.
 * IDs are assigned sequentially starting from the highest existing ID + 1.
 * Fields with explicit IDs keep them unchanged.
 */
const autoGenerateFieldIds = (
  fields: ReadonlyArray<Record<string, unknown>>
): ReadonlyArray<Record<string, unknown>> => {
  const maxId = fields.reduce((max, field) => {
    if (field.id !== undefined && typeof field.id === 'number') {
      return Math.max(max, field.id)
    }
    return max
  }, 0)

  const { fieldsWithIds } = fields.reduce<{
    fieldsWithIds: ReadonlyArray<Record<string, unknown>>
    nextId: number
  }>(
    (acc, field) => {
      if (field.id === undefined) {
        return {
          fieldsWithIds: [...acc.fieldsWithIds, { ...field, id: acc.nextId }],
          nextId: acc.nextId + 1,
        }
      }
      return {
        ...acc,
        fieldsWithIds: [...acc.fieldsWithIds, field],
      }
    },
    { fieldsWithIds: [], nextId: maxId + 1 }
  )

  return fieldsWithIds
}

/**
 * Union of all supported field type schemas
 */
const FieldUnionSchema = Schema.Union(
  // Text field types (individual schemas)
  [
    SingleLineTextFieldSchema,
    LongTextFieldSchema,
    PhoneNumberFieldSchema,
    EmailFieldSchema,
    UrlFieldSchema,
    IntegerFieldSchema,
    DecimalFieldSchema,
    CurrencyFieldSchema,
    PercentageFieldSchema,
    DateFieldSchema,
    DateTimeFieldSchema,
    TimeFieldSchema,
    CheckboxFieldSchema,
    SingleSelectFieldSchema,
    MultiSelectFieldSchema,
    RelationshipFieldSchema,
    SingleAttachmentFieldSchema,
    MultipleAttachmentsFieldSchema,
    FormulaFieldSchema,
    RollupFieldSchema,
    LookupFieldSchema,
    CountFieldSchema,
    UserFieldSchema,
    CreatedAtFieldSchema,
    CreatedByFieldSchema,
    UpdatedAtFieldSchema,
    UpdatedByFieldSchema,
    DeletedAtFieldSchema,
    DeletedByFieldSchema,
    RatingFieldSchema,
    DurationFieldSchema,
    RichTextFieldSchema,
    StatusFieldSchema,
    ButtonFieldSchema,
    AutonumberFieldSchema,
    BarcodeFieldSchema,
    ColorFieldSchema,
    ProgressFieldSchema,
    GeolocationFieldSchema,
    JsonFieldSchema,
    ArrayFieldSchema,
    CodeFieldSchema,
    AiCategorizeFieldSchema,
    AiExtractFieldSchema,
    AiGenerateFieldSchema,
    AiSentimentFieldSchema,
    AiSummaryFieldSchema,
    AiTagFieldSchema,
    AiTranslateFieldSchema,
    UnknownFieldSchema,
  ]
)

/**
 * Table Fields
 *
 * Collection of all supported field types in a table.
 * Each field type has specific properties and validation rules.
 * Fields are the columns in your database tables and determine
 * what data can be stored and how it is validated.
 *
 * Field IDs are optional in input — they are auto-generated sequentially
 * when omitted, similar to how table IDs are auto-generated.
 *
 * @see [internal ref] for full specification
 */
export const FieldsSchema = Schema.Array(FieldUnionSchema).pipe(
  Schema.annotate({
    title: 'Table Fields',
    description:
      'Columns of the table, in the order they are shown by default. Each one picks a field type, which decides how the value is stored, validated and edited.',
  }),
  Schema.check(Schema.isMinLength(1)),
  // EFFECT 4: see the sibling note in `tables/index.ts` — `Schema.transform`
  // becomes `Schema.decodeTo` + a `SchemaTransformation`.
  Schema.decodeTo(
    Schema.Array(
      FieldUnionSchema.pipe(Schema.annotate({ identifier: 'FieldWithRequiredId' }))
    ).pipe(Schema.check(Schema.isMinLength(1))),
    {
      decode: SchemaGetter.transform(
        (fields) =>
          autoGenerateFieldIds(fields as ReadonlyArray<Record<string, unknown>>) as ReadonlyArray<
            Schema.Schema.Type<typeof FieldUnionSchema>
          >
      ),
      // v3 spelled the identity encode `(x) => x` under `strict: true`. v4 has
      // no `strict` on the transform; the equivalent escape hatch is
      // `passthrough({ strict: false })` — the two sides differ only in whether
      // `id` is required, and the auto-generation above is precisely what makes
      // that true, so the identity is sound in both directions.
      encode: SchemaGetter.passthrough({ strict: false }),
    }
  ),
  Schema.check(
    Schema.makeFilter((fields) => {
      const ids = fields.map((field) => field.id)
      const uniqueIds = new Set(ids)
      return ids.length === uniqueIds.size || 'Field IDs must be unique within the table'
    })
  ),
  Schema.check(
    Schema.makeFilter((fields) => {
      const names = fields.map((field) => field.name)
      const uniqueNames = new Set(names)
      return names.length === uniqueNames.size || 'Field names must be unique within the table'
    })
  ),
  Schema.check(
    Schema.makeFilter((fields) => {
      // Validate count fields reference existing relationship-type fields
      const countFields = fields.filter((field) => field.type === 'count')

      const invalidResult = countFields
        .map((countField) => {
          const { relationshipField } = countField as { relationshipField: string }
          return validateComputedFieldRelationship({
            fields,
            computedFieldName: countField.name,
            computedFieldType: 'count',
            relationshipField,
          })
        })
        .find((result) => result !== true)

      return invalidResult !== undefined ? invalidResult : true
    })
  ),
  Schema.check(
    Schema.makeFilter((fields) => {
      // Validate rollup fields reference existing relationship-type fields
      const rollupFields = fields.filter((field) => field.type === 'rollup')

      const invalidResult = rollupFields
        .map((rollupField) => {
          const { relationshipField } = rollupField as { relationshipField: string }
          return validateComputedFieldRelationship({
            fields,
            computedFieldName: rollupField.name,
            computedFieldType: 'rollup',
            relationshipField,
          })
        })
        .find((result) => result !== true)

      return invalidResult !== undefined ? invalidResult : true
    })
  ),
  Schema.annotate({
    title: 'Table Fields',
    description:
      'Collection of all supported field types. Each field defines a column in the database table with specific validation and behavior.',
    examples: [
      [
        {
          id: 1,
          name: 'email',
          type: 'email' as const,
          required: true,
        },
        {
          id: 2,
          name: 'age',
          type: 'integer' as const,
          min: 0,
          max: 150,
        },
      ],
    ],
  })
)

export type Fields = Schema.Schema.Type<typeof FieldsSchema>

/**
 * Narrow a single field-union member down to its `type` literal, discarding
 * the {@link UnknownFieldSchema} catch-all branch (whose `type` is a filtered
 * `Schema.String`, i.e. plain `string`).
 *
 * The discard matters: a bare `Fields[number]['type']` collapses to `string`
 * because `'status' | string` absorbs every literal. Distributing FIRST over
 * the union of field OBJECTS and rejecting the member whose `type` is
 * assignable-from `string` keeps the literals intact.
 */
type KnownFieldTypeOf<F> = F extends { readonly type: infer T }
  ? string extends T
    ? never
    : T
  : never

/**
 * Union of every RECOGNIZED field-type discriminator (`'status'`,
 * `'single-select'`, `'progress'`, …) — the catch-all unknown type is excluded.
 *
 * Derived from {@link FieldsSchema}, so adding a field schema to
 * `FieldUnionSchema` automatically widens this union. That is the mechanism
 * that makes the presentation-layer field dispatches TOTAL: they are written
 * as `satisfies Record<FieldType, …>` tables, so a newly declared field type
 * fails to compile until every dispatch site declares how to handle it.
 *
 * @see src/presentation/utils/field-type-behavior.ts
 */
export type FieldType = KnownFieldTypeOf<Fields[number]>

/**
 * Validate that a computed field (count or rollup) references a valid relationship field.
 *
 * This helper validates that:
 * 1. The relationshipField exists in the current table's fields
 * 2. The relationshipField is a relationship type
 *
 * Used by both count and rollup field validation to ensure they reference valid relationships.
 *
 * @param params - Validation parameters
 * @returns Error message if validation fails, true if valid
 */
export const validateComputedFieldRelationship = (params: {
  readonly fields: ReadonlyArray<{ readonly name: string; readonly type: string }>
  readonly computedFieldName: string
  readonly computedFieldType: 'count' | 'rollup'
  readonly relationshipField: string
}): string | true => {
  const { fields, computedFieldName, computedFieldType, relationshipField } = params
  const fieldsByName = new Map(fields.map((field) => [field.name, field]))
  const referencedField = fieldsByName.get(relationshipField)

  if (!referencedField) {
    const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1)
    return `${capitalize(computedFieldType)} field "${computedFieldName}" references relationshipField "${relationshipField}" not found in the same table`
  }

  if (referencedField.type !== 'relationship') {
    const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1)
    return `${capitalize(computedFieldType)} field "${computedFieldName}" relationshipField "${relationshipField}" must reference a relationship field`
  }

  return true
}

/**
 * Field TYPES that are system-managed / computed and therefore READ-ONLY on
 * create and update. A direct user write to a field of one of these types must
 * be rejected with a clean 4xx (NOT a DB-layer crash).
 *
 * These fall into two families:
 *   - Computed: `formula`/`rollup`/`count`/`lookup` are derived from other
 *     columns (emitted as `GENERATED ALWAYS AS`, trigger-maintained, or
 *     view-computed) — see `sql-column-generators.ts`.
 *   - System-managed: `autonumber` is DB-assigned; the authorship/timestamp
 *     types (`created-at`/`updated-at`/`created-by`/`updated-by`/
 *     `deleted-at`/`deleted-by`) are populated by the platform, never the
 *     caller.
 *
 * Read-only-ness is TYPE-driven, NOT `default`-driven: a user-declared
 * `default` is an overridable fallback (the column gets a SQL `DEFAULT`
 * clause), so a field merely carrying a `default` stays writable.
 *
 * Scope: ONLY the truly-computed field types — those with NO legitimate user
 * write path, where a supplied value is an error (a direct write returns a
 * clean 4xx instead of crashing the GENERATED-column INSERT). Authorship /
 * timestamp types (`created-by`/`updated-by`/`created-at`/`updated-at`/
 * `deleted-at`/`deleted-by`) are deliberately EXCLUDED: they are
 * system-stamped, so a user-supplied value is silently ignored/overridden by
 * the authorship + soft-delete pipelines (the request returns 201), NOT
 * rejected — see `injectCreateAuthorship`.
 *
 * Single source of truth for the create/update validation pipeline.
 */
export const READONLY_COMPUTED_FIELD_TYPES: ReadonlySet<string> = new Set([
  'formula',
  'rollup',
  'count',
  'lookup',
  'autonumber',
])

/**
 * True when a field of this TYPE is system-managed / computed and must reject
 * a direct user write. See {@link READONLY_COMPUTED_FIELD_TYPES}.
 */
export const isReadonlyComputedFieldType = (fieldType: string): boolean =>
  READONLY_COMPUTED_FIELD_TYPES.has(fieldType)
