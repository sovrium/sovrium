/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { FormFieldAutocompleteSchema } from '../../../../../forms/form-field-props'
import {
  ConditionOperatorSchema,
  VisibleWhenSchema,
  type VisibleWhenCondition,
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
export { ConditionOperatorSchema, VisibleWhenSchema }
export type { VisibleWhenCondition }

// ---------------------------------------------------------------------------
// Form field configuration
// ---------------------------------------------------------------------------

/**
 * Per-field configuration for form components
 *
 * Allows overriding label, placeholder, defaults, read-only state and hidden
 * submission for individual fields.
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
 * ```
 *
 * Conditional fields (`visibleWhen` / `requiredWhen` / `disabledWhen`) and the
 * file-upload options (`accept` / `dropZone` / `maxFiles`) are not here: they
 * belong to a form that takes something in, which is a top-level `forms[]`
 * entry placed on the page with `formRef`. `removed-keys.ts` tells an author
 * who still writes them where they went.
 */
/**
 * Explicit input control for a form field.
 *
 * A table-bound form derives each field's control from the table column type, so
 * `control` is normally omitted. It becomes REQUIRED when the form is endpoint-
 * bound (`form.endpoint` set, no `dataSource`/`formRef`): there is no table to
 * derive a control from, so each field must name its own input — `text`, `email`,
 * `password`, `number`, `tel`, `url`, `textarea`, `select` (a dropdown, which
 * also needs `options`), or `switch` (an on/off switch that submits a JSON
 * boolean, and takes no `options`).
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
  'switch',
  'rating',
]).annotate({
  title: 'Form Field Control',
  description:
    'Explicit input control for an endpoint-bound form field (text/email/password/number/tel/url/textarea/select/switch/rating). `rating` is a row of five stars that submits a whole number from 1 to 5. `switch` is an on/off switch that submits a JSON boolean — `true` when on, `false` when off, never omitted — and takes no options. Omitted for table-bound forms (control derived from the column type).',
})

/** The controls a `minLength` / `maxLength` rule means something on: the ones a visitor types text into. */
const LENGTH_RULE_CONTROLS: ReadonlySet<string> = new Set(['text', 'email', 'password', 'textarea'])

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
      Schema.annotate({
        description: 'Dropdown options for a control: select field ({ value, label? })',
      }),
      Schema.check(Schema.isMinLength(1))
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
      Schema.annotate({
        description:
          "Guidance text rendered beside the control and linked via aria-describedby (overrides the bound field's description). Required to describe a control on an endpoint-bound form, which has no table field schema to resolve from. Unlike a placeholder it persists once the user starts typing.",
        examples: ['Excluding VAT, in euros.', 'Format: SIRET, 14 digits, no spaces.'],
      }),
      Schema.check(Schema.isNonEmpty({ message: 'description must not be empty' }))
    )
  ),
  /** Placeholder hint text */
  placeholder: Schema.optional(
    Schema.String.annotate({
      description: 'Placeholder text shown when field is empty',
    })
  ),
  /**
   * The visitor must fill this control before the form sends.
   *
   * Needed on an ENDPOINT-bound form (`form.endpoint`), for the reason
   * `description` above gives: there is no table column whose own `required`
   * the control could inherit, so an empty "current password" went to the
   * endpoint and came back as a generic error toast. The control carries the
   * native `required` attribute, and an empty submit is stopped in the browser
   * and announced under the field, the way a table-bound form announces it. On
   * a table-bound form the bound column's own `required` already applies.
   */
  required: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'If true, the control must be filled before the form sends: an empty submit is stopped in the browser and the reason is announced under the field. Needed on an endpoint-bound form, which has no table column to inherit the rule from.',
    })
  ),
  /**
   * The fewest characters a `text`, `email`, `password` or `textarea` control
   * accepts. Checked in the browser before the form sends, and announced under
   * the field like a missing value. An empty control is judged by `required`,
   * not by this rule.
   */
  minLength: Schema.optional(
    Schema.Int.pipe(
      Schema.annotate({
        description:
          'Fewest characters a text, email, password or textarea control accepts. Checked before the form sends and announced under the field. An empty control is judged by `required`, not by this rule.',
        examples: [12],
      }),
      Schema.check(Schema.isGreaterThanOrEqualTo(1))
    )
  ),
  /**
   * The most characters a `text`, `email`, `password` or `textarea` control
   * accepts. The control stops taking input at that length.
   */
  maxLength: Schema.optional(
    Schema.Int.pipe(
      Schema.annotate({
        description:
          'Most characters a text, email, password or textarea control accepts; the control stops taking input at that length.',
        examples: [128],
      }),
      Schema.check(Schema.isGreaterThanOrEqualTo(1))
    )
  ),
  /**
   * Browser autofill hint for this control. Omitted, the control takes the
   * hint its type implies — an `email` column or control `email`, a
   * `phone-number` column or `tel` control `tel`, a `url` one `url` — and a
   * `password` control takes none, because only the author knows whether it
   * asks for the current password or a new one.
   */
  autocomplete: Schema.optional(FormFieldAutocompleteSchema),
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
  /**
   * Default value for new records. A `control: switch` field takes a boolean
   * (`true` opens it switched on) or a `$session.<field>` reference, filled in
   * the browser from the caller's own session.
   */
  defaultValue: Schema.optional(
    Schema.Union([Schema.String, Schema.Finite, Schema.Boolean]).annotate({
      description:
        'Default value for create mode. Supports static values or $variable references. A `switch` field takes a boolean or a `$session.<field>` reference.',
    })
  ),
  /** Submit value without rendering input */
  hidden: Schema.optional(
    Schema.Boolean.annotate({
      description: 'If true, field value is submitted but input is not rendered',
    })
  ),
  /**
   * Which column of a `main-aside` form the field sits in. Every field defaults
   * to `main`; the publishing fields of an editor (status, date, author) go to
   * the narrow `aside`. Ignored by the other layouts, which have one region.
   */
  region: Schema.optional(
    Schema.Literals(['main', 'aside']).annotate({
      description:
        "Which column of a main-aside form the field sits in: 'main' (default) or 'aside'. Ignored by the other layouts.",
    })
  ),
})
  .annotate({
    title: 'Form Field Config',
    description: 'Per-field configuration for a form component',
  })
  .check(
    Schema.makeFilter(
      (field: { readonly control?: string; readonly options?: unknown }) =>
        field.control !== 'switch' || field.options === undefined || 'a switch takes no options'
    ),
    Schema.makeFilter(
      (field: {
        readonly control?: string
        readonly minLength?: number
        readonly maxLength?: number
      }) =>
        (field.minLength === undefined && field.maxLength === undefined) ||
        field.control === undefined ||
        LENGTH_RULE_CONTROLS.has(field.control) ||
        'minLength and maxLength apply to a text, email, password or textarea control only'
    ),
    Schema.makeFilter(
      (field: { readonly minLength?: number; readonly maxLength?: number }) =>
        field.minLength === undefined ||
        field.maxLength === undefined ||
        field.minLength <= field.maxLength ||
        'minLength must not exceed maxLength'
    )
  )

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
// Type exports
// ---------------------------------------------------------------------------
//
// Note: ConditionOperatorSchema and VisibleWhenSchema are re-exported above from
// `shared/visible-when` to avoid duplicate definitions.

/** @public Public type surface of the form schema; awaiting adoption at callsites. */
export type FormFieldControl = Schema.Schema.Type<typeof FormFieldControlSchema>
export type FormFieldConfig = Schema.Schema.Type<typeof FormFieldConfigSchema>
/** @public Public type surface of the form schema; awaiting adoption at callsites. */
export type FormLayout = Schema.Schema.Type<typeof FormLayoutSchema>
