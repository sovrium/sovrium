/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ArrayFieldSchema } from './field-types/array-field'
import { AutonumberFieldSchema } from './field-types/autonumber-field'
import { BarcodeFieldSchema } from './field-types/barcode-field'
import { ButtonFieldSchema } from './field-types/button-field'
import { CheckboxFieldSchema } from './field-types/checkbox-field'
import { ColorFieldSchema } from './field-types/color-field'
import { CountFieldSchema } from './field-types/count-field'
import { CreatedAtFieldSchema } from './field-types/created-at-field'
import { CreatedByFieldSchema } from './field-types/created-by-field'
import { CurrencyFieldSchema } from './field-types/currency-field'
import { DateFieldSchema } from './field-types/date-field'
import { DecimalFieldSchema } from './field-types/decimal-field'
import { DurationFieldSchema } from './field-types/duration-field'
import { EmailFieldSchema } from './field-types/email-field'
import { FormulaFieldSchema } from './field-types/formula-field'
import { GeolocationFieldSchema } from './field-types/geolocation-field'
import { IntegerFieldSchema } from './field-types/integer-field'
import { JsonFieldSchema } from './field-types/json-field'
import { LongTextFieldSchema } from './field-types/long-text-field'
import { LookupFieldSchema } from './field-types/lookup-field'
import { MultiSelectFieldSchema } from './field-types/multi-select-field'
import { MultipleAttachmentsFieldSchema } from './field-types/multiple-attachments-field'
import { PercentageFieldSchema } from './field-types/percentage-field'
import { PhoneNumberFieldSchema } from './field-types/phone-number-field'
import { ProgressFieldSchema } from './field-types/progress-field'
import { RatingFieldSchema } from './field-types/rating-field'
import { RelationshipFieldSchema } from './field-types/relationship-field'
import { RichTextFieldSchema } from './field-types/rich-text-field'
import { RollupFieldSchema } from './field-types/rollup-field'
import { SingleAttachmentFieldSchema } from './field-types/single-attachment-field'
import { SingleLineTextFieldSchema } from './field-types/single-line-text-field'
import { SingleSelectFieldSchema } from './field-types/single-select-field'
import { StatusFieldSchema } from './field-types/status-field'
import { UpdatedAtFieldSchema } from './field-types/updated-at-field'
import { UpdatedByFieldSchema } from './field-types/updated-by-field'
import { UrlFieldSchema } from './field-types/url-field'
import { UserFieldSchema } from './field-types/user-field'

/**
 * Table Fields
 *
 * Collection of all supported field types in a table.
 * Each field type has specific properties and validation rules.
 * Fields are the columns in your database tables and determine
 * what data can be stored and how it is validated.
 *
 * @see docs/specifications/roadmap/tables/fields.md for full specification
 */
export const FieldsSchema = Schema.Array(
  Schema.Union(
    // Text field types (individual schemas)
    SingleLineTextFieldSchema,
    LongTextFieldSchema,
    PhoneNumberFieldSchema,
    EmailFieldSchema,
    UrlFieldSchema,
    // Number field types (individual schemas)
    IntegerFieldSchema,
    DecimalFieldSchema,
    CurrencyFieldSchema,
    PercentageFieldSchema,
    // Other field types
    DateFieldSchema,
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
    ArrayFieldSchema
  )
).pipe(
  Schema.minItems(1),
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
    // Validate count fields reference existing relationship fields
    const countFields = fields.filter((field) => field.type === 'count')
    const fieldNames = new Set(fields.map((field) => field.name))

    const invalidCountField = countFields.find((countField) => {
      const { relationshipField } = countField as { relationshipField: string }
      return !fieldNames.has(relationshipField)
    })

    return (
      !invalidCountField ||
      `Count field "${invalidCountField.name}" references relationshipField "${(invalidCountField as { relationshipField: string }).relationshipField}" not found in the same table`
    )
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
