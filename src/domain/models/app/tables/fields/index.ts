/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
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

const FieldUnionSchema = Schema.Union(
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
  UnknownFieldSchema
)

export const FieldsSchema = Schema.Array(FieldUnionSchema).pipe(
  Schema.minItems(1),
  Schema.annotations({ title: 'Table Fields' }),
  Schema.transform(
    Schema.Array(
      FieldUnionSchema.pipe(Schema.annotations({ identifier: 'FieldWithRequiredId' }))
    ).pipe(Schema.minItems(1)),
    {
      strict: true,
      decode: (fields) =>
        autoGenerateFieldIds(fields as ReadonlyArray<Record<string, unknown>>) as ReadonlyArray<
          Schema.Schema.Type<typeof FieldUnionSchema>
        >,
      encode: (fields) => fields,
    }
  ),
  Schema.filter((fields) => {
    const ids = fields.map((field) => field.id)
    const uniqueIds = new Set(ids)
    return ids.length === uniqueIds.size || 'Field IDs must be unique within the table'
  }),
  Schema.filter((fields) => {
    const names = fields.map((field) => field.name)
    const uniqueNames = new Set(names)
    return names.length === uniqueNames.size || 'Field names must be unique within the table'
  }),
  Schema.filter((fields) => {
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
  }),
  Schema.filter((fields) => {
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
  }),
  Schema.annotations({
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

export const READONLY_COMPUTED_FIELD_TYPES: ReadonlySet<string> = new Set([
  'formula',
  'rollup',
  'count',
  'lookup',
  'autonumber',
])

export const isReadonlyComputedFieldType = (fieldType: string): boolean =>
  READONLY_COMPUTED_FIELD_TYPES.has(fieldType)
