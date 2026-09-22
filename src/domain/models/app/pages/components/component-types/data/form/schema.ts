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
} from '../../../../../forms/visible-when'
import { SelectOptionSourceBindingSchema } from '../../form-controls/select-option-source'

// ---------------------------------------------------------------------------
// Condition operators / visible-when condition (re-exported from shared/)
// ---------------------------------------------------------------------------
//
// These primitives are defined in `src/domain/models/app/forms/visible-when.ts`
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
/**
 * Explicit input control for a form field.
 *
 * A table-bound form derives each field's control from the table column type, so
 * `control` is normally omitted. It becomes REQUIRED when the form is endpoint-
 * bound (`form.endpoint` set, no `dataSource`/`formRef`): there is no table to
 * derive a control from, so each field must name its own input — `text`, `email`,
 * `password`, `number`, `tel`, `url`, `textarea`, or `select` (a dropdown, which
 * also needs `options`).
 */
export const FormFieldControlSchema = Schema.Literals([
  'text',
  'email',
  'password',
  'number',
  'tel',
  'url',
  'textarea',
  'select',
]).annotate({
  title: 'Form Field Control',
  description:
    'Explicit input control for an endpoint-bound form field (text/email/password/number/tel/url/textarea/select). Omitted for table-bound forms (control derived from the column type).',
})

export const FormFieldConfigSchema = Schema.Struct({
  /**
   * Field identifier. For a table-bound form this is the table column name; for an
   * endpoint-bound form (`form.endpoint`) it is the JSON request-body key the
   * field's value is submitted under.
   */
  field: Schema.String.annotate({
    description:
      'Field identifier: a table column name (table-bound form) OR the JSON body key (endpoint-bound form)',
  }),
  /**
   * Explicit input control. Omitted for a table-bound form (derived from the
   * column type); REQUIRED per field for an endpoint-bound form (no table to
   * derive from). `select` additionally needs `options`.
   */
  control: Schema.optional(FormFieldControlSchema),
  /** Options for a `control: select` field ({ value, label? }; at least one). */
  options: Schema.optional(
    Schema.Array(
      Schema.Struct({
        /** The value submitted for this option. */
        value: Schema.String.annotate({ description: 'Option value submitted on choice' }),
        /** Display label (defaults to value). */
        label: Schema.optional(
          Schema.String.annotate({ description: 'Option display label (defaults to value)' })
        ),
      })
    ).pipe(
      Schema.check(Schema.isMinLength(1)),
      Schema.annotate({
        description: 'Dropdown options for a control: select field ({ value, label? })',
      })
    )
  ),
  /**
   * Resolve a `control: select` field's options from a table or a system read
   * endpoint instead of spelling them out.
   *
   * ─── WHY A LITERAL LIST IS NOT ALWAYS EXPRESSIBLE ──────────────────────────
   *
   * The same argument `editSelect.optionsSource` records one component over.
   * The values a form most often has to offer are facts about the app rather
   * than rows of a table: the roles a caller may assign are
   * `assignableRoleNames(app)` — the built-ins, the admin tier names, and every
   * name the operator declared in `auth.roles[]` — computed from the auth
   * config and stored in no table at all. A literal list cannot reach them, and
   * narrowing one to the built-ins was measured on a partner-shaped app to
   * share ZERO members with the roles that app declares. That is not a
   * degradation; it is a picker offering nothing the operator can pick.
   *
   * ─── SAME BINDING, SAME RESOLUTION, SAME RULE ──────────────────────────────
   *
   * {@link SelectOptionSourceBindingSchema} verbatim, resolved server-side by
   * the same pass that resolves a `select`'s and an `editSelect`'s, and REPLACED
   * with a concrete `options` array — so the endpoint, the table name and any
   * filter never reach the client bundle (security rule S4).
   *
   * Exactly one of `options` / `optionsSource` may be declared, enforced by
   * `collectPageBindingViolations` for the reason that file records for every
   * rule it holds: a `Schema.check` here would WRAP this struct and re-key the
   * published property universe. Both is two answers to one question with no
   * defensible precedence.
   *
   * @example
   * ```yaml
   * - field: role
   *   control: select
   *   label: Role
   *   optionsSource:
   *     system:
   *       endpoint: /api/admin/roles
   *       rowsKey: roles
   *     valueKey: name
   *     labelKey: name
   * ```
   */
  optionsSource: Schema.optional(SelectOptionSourceBindingSchema),
  /** Custom label (overrides field name) */
  label: Schema.optional(
    Schema.String.annotate({
      description: 'Custom label text (overrides default field name)',
    })
  ),
  /**
   * Guidance text rendered beside this control, associated with it via
   * `aria-describedby`. Overrides the bound field's own `description`.
   *
   * Needed for exactly one reason: an ENDPOINT-bound form (`form.endpoint`, no
   * `dataSource`/`formRef`) has no table field schema to resolve a
   * `description` from, so the override is the only way to give such a control
   * help text. Same reason the sibling `label` above exists, and the same reason
   * `FieldColumnSchema.label` ("Override header text (default: field name)")
   * exists on the data-table column — an established pattern, not a new one.
   *
   * On a table-bound form it stays a plain per-surface override: omit it and the
   * control resolves the bound field's `description`, then renders no help text.
   *
   * Distinct from `placeholder` below, which sits inside the empty input and
   * vanishes on focus.
   */
  description: Schema.optional(
    Schema.String.pipe(
      Schema.check(Schema.isNonEmpty({ message: 'description must not be empty' })),
      Schema.annotate({
        description:
          "Guidance text rendered beside the control and linked via aria-describedby (overrides the bound field's description). Required to describe a control on an endpoint-bound form, which has no table field schema to resolve from. Unlike a placeholder it persists once the user starts typing.",
        examples: ['Excluding VAT, in euros.', 'Format: SIRET, 14 digits, no spaces.'],
      })
    )
  ),
  /** Placeholder hint text */
  placeholder: Schema.optional(
    Schema.String.annotate({
      description: 'Placeholder text shown when field is empty',
    })
  ),
  /** Render as non-editable display */
  readOnly: Schema.optional(
    Schema.Boolean.annotate({
      description: 'If true, field is displayed but not editable',
    })
  ),
  /** Disable the field input */
  disabled: Schema.optional(
    Schema.Boolean.annotate({
      description: 'If true, field input is disabled',
    })
  ),
  /** Default value for new records */
  defaultValue: Schema.optional(
    Schema.Union([Schema.String, Schema.Finite, Schema.Boolean]).annotate({
      description: 'Default value for create mode. Supports static values or $variable references.',
    })
  ),
  /** Submit value without rendering input */
  hidden: Schema.optional(
    Schema.Boolean.annotate({
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
    Schema.String.annotate({
      description: 'Comma-separated MIME types or extensions (e.g. "image/*,.pdf")',
      examples: ['image/*', '.pdf,.doc,.docx', 'image/png,image/jpeg'],
    })
  ),
  /** Enable drag-and-drop zone for file uploads */
  dropZone: Schema.optional(
    Schema.Boolean.annotate({
      description: 'If true, renders a drag-and-drop area for file uploads',
    })
  ),
  /** Maximum number of files for multi-file upload fields */
  maxFiles: Schema.optional(
    Schema.Finite.pipe(
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0)),
      Schema.annotate({
        description: 'Maximum number of files allowed (for multiple-attachments fields)',
        examples: [1, 5, 10],
      })
    )
  ),
}).annotate({
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
export const FormLayoutSchema = Schema.Literals(['single-column', 'two-column', 'custom']).annotate(
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
  label: Schema.String.annotate({
    description: 'Group label displayed as a section divider above the fields',
  }),
  /** Field names belonging to this group */
  fields: Schema.Array(Schema.String).pipe(
    Schema.check(Schema.isMinLength(1)),
    Schema.annotate({
      description: 'Array of field names belonging to this group',
    })
  ),
}).annotate({
  title: 'Form Field Group',
  description: 'Groups form fields under a labeled section divider',
})

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------
//
// Note: ConditionOperator and VisibleWhen are re-exported above from
// `shared/visible-when` to avoid duplicate definitions.

/** @public Public type surface of the form schema; awaiting adoption at callsites. */
export type FormFieldControl = Schema.Schema.Type<typeof FormFieldControlSchema>
export type FormFieldConfig = Schema.Schema.Type<typeof FormFieldConfigSchema>
/** @public Public type surface of the form schema; awaiting adoption at callsites. */
export type FormLayout = Schema.Schema.Type<typeof FormLayoutSchema>
/** @public Public type surface of the form schema; awaiting adoption at callsites. */
export type FormFieldGroup = Schema.Schema.Type<typeof FormFieldGroupSchema>
