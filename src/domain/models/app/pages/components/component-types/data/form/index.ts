/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { FormNameSchema } from '../../../../../forms/name'
import { actionFields } from '../../modules/action'
import { coreFields } from '../../modules/core'
import { dataBoundFields } from '../../modules/data-bound'
import { i18nFields } from '../../modules/i18n'
import { responsiveFields } from '../../modules/responsive'
import { visibilityFields } from '../../modules/visibility'
import { FormFieldConfigSchema, FormFieldGroupSchema } from './schema'

export const FormTypeLiteral = Schema.Literal('form')

/**
 * Prefill value supported by `inlinePrefill.prefill[<column>]`.
 *
 * Either a literal scalar/array (the value goes directly into the rendered
 * form) or a `$parent.<segment>` token resolved at render time from the host
 * page's `dataSource: { mode: 'single' }` record. The token form is
 * canonical when the host page exposes a parent record; literals are useful
 * for bootstrap defaults (e.g. `status: 'open'`) that don't depend on the
 * parent.
 *
 * The runtime resolver in `form-ref-resolver` handles both forms; the schema
 * accepts the union so inline-create authors can mix `'$parent.id'` with
 * `priority: 1` in the same `prefill` map without per-field type guards.
 */
const InlinePrefillValueSchema = Schema.Union(
  Schema.String,
  Schema.Number,
  Schema.Boolean,
  Schema.Array(Schema.String),
  Schema.Array(Schema.Number)
).annotations({
  description:
    'Literal value or `$parent.<field>` token resolved against the host page record at render time.',
})

/**
 * Inline-prefill configuration attached to a `formRef` page-form component.
 *
 * Used by the inline-relationship-create flow (Y-5): the host page exposes
 * a single record via `page.dataSource: { mode: 'single' }`, and the
 * embedded form auto-prefills the relationship column (e.g.
 * `project_id: '$parent.id'`) so the submitter never has to pick the parent
 * manually.
 *
 * - `prefill` — column-name → value/token map applied to the rendered form
 * - `lockPrefill` (default: false) — when true, the prefilled fields render
 *   as `<input type="hidden">` (no editable UI) and the server revalidates
 *   the parent's existence on submit; when false, the prefill becomes the
 *   field's initial value but the submitter can override it.
 *
 * The schema is intentionally permissive at this tier: the server-side
 * resolver in `form-ref-resolver` validates that the referenced parent
 * field exists on the host page's bound record and that the form's
 * `submitTo.table` actually has columns matching the prefill keys.
 * Validating those at schema load time would require crossing the
 * `pages` ↔ `forms` ↔ `tables` boundary, which is deferred to a follow-up
 * cross-validation pass once the inline-create feature stabilises.
 */
export const InlinePrefillSchema = Schema.Struct({
  prefill: Schema.Record({
    key: Schema.String,
    value: InlinePrefillValueSchema,
  }).annotations({
    description:
      'Map of form-field column name to prefill value. Supports `$parent.<field>` tokens that resolve against the host page record.',
  }),
  lockPrefill: Schema.optional(
    Schema.Boolean.annotations({
      description:
        'When true, prefilled fields render as hidden inputs and the server revalidates the parent on submit (returns 422 if the parent is gone).',
    })
  ),
}).annotations({
  identifier: 'InlinePrefill',
  title: 'Inline Prefill',
  description:
    'Auto-prefill relationship/scalar fields on an embedded form using values from the host page record.',
})

export const formFields = {
  ...coreFields,
  ...responsiveFields,
  ...visibilityFields,
  ...actionFields,
  ...i18nFields,
  ...dataBoundFields,
  /**
   * Multi-step wizard configuration for inline form components.
   *
   * Splits the form fields into sequential steps rendered with Next / Back
   * navigation. Fields listed in a step's `fields` array are shown for that
   * step only. `visibleWhen` conditions may reference fields from any step —
   * all values are retained globally so cross-step conditions evaluate correctly.
   *
   * Mutually exclusive with `formRef`.
   */
  wizard: Schema.optional(
    Schema.Struct({
      steps: Schema.NonEmptyArray(
        Schema.Struct({
          label: Schema.String.annotations({
            description: 'Step label shown in the progress indicator',
          }),
          fields: Schema.NonEmptyArray(Schema.String).annotations({
            description: 'Field names assigned to this step',
          }),
        })
      ).annotations({ description: 'Ordered list of wizard steps' }),
    }).annotations({
      description:
        'Multi-step wizard configuration. Splits form fields into sequential steps with Next/Back navigation.',
    })
  ),
  /**
   * Reference a top-level form by name. When set, the component renders the
   * referenced form inline; fields/steps/onSuccess flow from `app.forms[]`.
   *
   * Mutually exclusive with the inline form definition: when `formRef` is
   * set, `dataSource`, `fields`, and `fieldGroups` must NOT also be set
   * on the same component (cross-validated at the `AppSchema` level).
   */
  formRef: Schema.optional(
    FormNameSchema.annotations({
      description:
        'Reference a top-level form by name (app.forms[].name). Renders that form inline.',
    })
  ),
  /**
   * Inline-prefill configuration for embedded forms (Y-5).
   *
   * Only meaningful in combination with `formRef` on a host page that
   * exposes a `dataSource: { mode: 'single' }` record. When set, prefill
   * tokens like `'$parent.id'` resolve against the host record at render
   * time so the submitter never has to pick the parent record manually.
   *
   * `lockPrefill: true` further hides the prefilled fields and triggers
   * server-side parent revalidation on submit (404 → 422 mapping).
   */
  inlinePrefill: Schema.optional(InlinePrefillSchema),
  fields: Schema.optional(
    Schema.Array(FormFieldConfigSchema).pipe(
      Schema.minItems(1),
      Schema.annotations({
        description:
          'Per-field configuration for form component (labels, placeholders, visibility)',
      })
    )
  ),
  fieldGroups: Schema.optional(
    Schema.Array(FormFieldGroupSchema).pipe(
      Schema.minItems(1),
      Schema.annotations({ description: 'Groups form fields under labeled section dividers' })
    )
  ),
  layout: Schema.optional(
    Schema.Literal('single-column', 'two-column', 'custom').annotations({
      description: 'Form layout mode: single-column | two-column | custom',
    })
  ),
} as const

// Re-export all sub-schemas
export * from './schema'
