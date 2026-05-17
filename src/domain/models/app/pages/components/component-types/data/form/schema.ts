/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import {
  type ConditionOperator,
  ConditionOperatorSchema,
  type VisibleWhen,
  VisibleWhenSchema,
  type VisibleWhenCondition,
  VisibleWhenConditionSchema,
} from '../../../../../../shared/visible-when'

// ---------------------------------------------------------------------------
// Condition operators / visible-when condition (re-exported from shared/)
// ---------------------------------------------------------------------------
//
// These primitives are defined in `src/domain/models/shared/visible-when.ts`
// because both the top-level forms feature and this legacy in-page form
// component need them, and the helper crosses the `forms` ↔ `pages` boundary.
// Re-exported here for backward compatibility with existing imports of this file.
export { ConditionOperatorSchema, VisibleWhenSchema, VisibleWhenConditionSchema }
export type { ConditionOperator, VisibleWhen, VisibleWhenCondition }

// ---------------------------------------------------------------------------
// Form field configuration
// ---------------------------------------------------------------------------

/**
 * Per-field configuration for form components
 *
 * Allows overriding label, placeholder, defaults, read-only state,
 * hidden submission, and conditional visibility for individual fields.
 *
 * @example
 * ```yaml
 * fields:
 *   - field: firstName
 *     label: First Name
 *     placeholder: Enter your first name...
 *   - field: email
 *     readOnly: true
 *   - field: source
 *     defaultValue: website
 *     hidden: true
 *   - field: shippingAddress
 *     visibleWhen:
 *       field: deliveryMethod
 *       operator: eq
 *       value: shipping
 * ```
 */
export const FormFieldConfigSchema = Schema.Struct({
  /** Field name (must match a field in the bound table) */
  field: Schema.String.annotations({
    description: 'Field name from the table schema',
  }),
  /** Custom label (overrides field name) */
  label: Schema.optional(
    Schema.String.annotations({
      description: 'Custom label text (overrides default field name)',
    })
  ),
  /** Placeholder hint text */
  placeholder: Schema.optional(
    Schema.String.annotations({
      description: 'Placeholder text shown when field is empty',
    })
  ),
  /** Render as non-editable display */
  readOnly: Schema.optional(
    Schema.Boolean.annotations({
      description: 'If true, field is displayed but not editable',
    })
  ),
  /** Disable the field input */
  disabled: Schema.optional(
    Schema.Boolean.annotations({
      description: 'If true, field input is disabled',
    })
  ),
  /** Default value for new records */
  defaultValue: Schema.optional(
    Schema.Union(Schema.String, Schema.Number, Schema.Boolean).annotations({
      description: 'Default value for create mode. Supports static values or $variable references.',
    })
  ),
  /** Submit value without rendering input */
  hidden: Schema.optional(
    Schema.Boolean.annotations({
      description: 'If true, field value is submitted but input is not rendered',
    })
  ),
  /** Conditional visibility rule (supports OR / AND compound conditions) */
  visibleWhen: Schema.optional(VisibleWhenConditionSchema),
  /** Make field required when condition is met */
  requiredWhen: Schema.optional(VisibleWhenConditionSchema),
  /** Disable field when condition is met */
  disabledWhen: Schema.optional(VisibleWhenConditionSchema),

  // File upload properties (used when field type is attachment)
  /** Accepted file MIME types for upload fields */
  accept: Schema.optional(
    Schema.String.annotations({
      description: 'Comma-separated MIME types or extensions (e.g. "image/*,.pdf")',
      examples: ['image/*', '.pdf,.doc,.docx', 'image/png,image/jpeg'],
    })
  ),
  /** Enable drag-and-drop zone for file uploads */
  dropZone: Schema.optional(
    Schema.Boolean.annotations({
      description: 'If true, renders a drag-and-drop area for file uploads',
    })
  ),
  /** Maximum number of files for multi-file upload fields */
  maxFiles: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThan(0),
      Schema.annotations({
        description: 'Maximum number of files allowed (for multiple-attachments fields)',
        examples: [1, 5, 10],
      })
    )
  ),
}).annotations({
  title: 'Form Field Config',
  description: 'Per-field configuration for a form component',
})

// ---------------------------------------------------------------------------
// Form layout
// ---------------------------------------------------------------------------

/**
 * Form layout mode
 *
 * - `single-column`: Fields stacked vertically (default)
 * - `two-column`: Fields in a responsive 2-column grid
 * - `custom`: Fields wrapped in user-defined children sections
 */
export const FormLayoutSchema = Schema.Literal('single-column', 'two-column', 'custom').annotations(
  {
    title: 'Form Layout',
    description: 'Layout mode for form fields (default: single-column)',
  }
)

// ---------------------------------------------------------------------------
// Form field group
// ---------------------------------------------------------------------------

/**
 * Groups form fields under a labeled section divider
 *
 * @example
 * ```yaml
 * fieldGroups:
 *   - label: Personal Information
 *     fields: [firstName, lastName, dateOfBirth]
 *   - label: Contact Details
 *     fields: [email, phone, address]
 * ```
 */
export const FormFieldGroupSchema = Schema.Struct({
  /** Group label displayed as section divider */
  label: Schema.String.annotations({
    description: 'Group label displayed as a section divider above the fields',
  }),
  /** Field names belonging to this group */
  fields: Schema.Array(Schema.String).pipe(
    Schema.minItems(1),
    Schema.annotations({
      description: 'Array of field names belonging to this group',
    })
  ),
}).annotations({
  title: 'Form Field Group',
  description: 'Groups form fields under a labeled section divider',
})

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------
//
// Note: ConditionOperator and VisibleWhen are re-exported above from
// `shared/visible-when` to avoid duplicate definitions.

export type FormFieldConfig = Schema.Schema.Type<typeof FormFieldConfigSchema>
export type FormLayout = Schema.Schema.Type<typeof FormLayoutSchema>
export type FormFieldGroup = Schema.Schema.Type<typeof FormFieldGroupSchema>
