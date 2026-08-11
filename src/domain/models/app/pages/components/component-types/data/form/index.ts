/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { FormNameSchema } from '../../../../../forms/name'
import {
  FetchResponseEnvelopeSchema,
  FetchSuccessResponseSchema,
  FetchToastResponseSchema,
} from '../../../action'
import { DataSourceSchema } from '../../../data-source'
import { actionFields } from '../../modules/action'
import { coreFields } from '../../modules/core'
import { dataBoundFields } from '../../modules/data-bound'
import { i18nFields } from '../../modules/i18n'
import { responsiveFields } from '../../modules/responsive'
import { visibilityFields } from '../../modules/visibility'
import { FormFieldConfigSchema, FormFieldGroupSchema } from './schema'

export const FormTypeLiteral = Schema.Literal('form')

/**
 * `data-form` is the canonical type literal used by the record-detail-view
 * user story (PG-04) and the quick-edit drawer pattern. It shares the same
 * `formFields` definition as `form` — the alias exists so schema authors can
 * differentiate the data-bound CRUD form variant from the generic `form`
 * container used elsewhere. The renderer dispatches identically for both.
 */
export const DataFormTypeLiteral = Schema.Literal('data-form')

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

/**
 * Custom-endpoint submit target for a `form` component.
 *
 * A `form` normally WRITES to its bound `app.tables` table (via the records API)
 * or a referenced `app.forms[]` (`formRef`). `endpoint` is a THIRD submit mode:
 * the form POSTs its collected field values as a JSON body (`{ [field]: value }`)
 * to an ARBITRARY `url` — a Better-Auth admin endpoint, a custom operate route,
 * anything — NOT the records API. It is the form-counterpart to the operate
 * `fetch` action (arbitrary endpoint) the same way `crud` (table-bound) pairs with
 * `fetch`.
 *
 * When `endpoint` is set, the form is NOT table-bound: omit `dataSource`/`formRef`,
 * and each field MUST name its own `control` (no table column type to derive from).
 * On a 2xx response (under `responseEnvelope`) the form fires `onSuccess` — reusing
 * the SHIPPED `FetchSuccessResponseSchema`, so `onSuccess.refetch` re-queries a
 * sibling data-bound component (a `dataSource.system` directory grid, for example)
 * and the new row appears without a reload. `onError` surfaces a toast on failure.
 *
 * This is the generic, reusable config equivalent of the bespoke admin
 * "Ajouter un utilisateur → email/rôle → Créer le compte → POST
 * /api/auth/admin/create-user → refresh directory" gesture.
 *
 * @example
 * ```yaml
 * type: form
 * title: Ajouter un utilisateur
 * endpoint:
 *   url: /api/auth/admin/create-user
 *   method: POST
 *   responseEnvelope: better-auth
 *   submitLabel: Créer le compte
 *   onSuccess: { type: toast, message: Compte créé, refetch: users-grid }
 *   onError: { type: toast, variant: destructive, message: Échec de la création }
 * fields:
 *   - { field: email, control: email, label: Adresse e-mail }
 *   - { field: role, control: select, label: Rôle, options: [{ value: member }, { value: admin }] }
 * ```
 */
export const FormEndpointSchema = Schema.Struct({
  /**
   * Custom submit URL (any absolute path or fully-qualified URL; NOT prefix-
   * restricted). May target a Better-Auth admin endpoint or any operate route.
   */
  url: Schema.String.annotations({
    description:
      'Custom submit URL (any path; not the records API). e.g. /api/auth/admin/create-user',
  }),
  /** HTTP method for the submit (defaults to POST). */
  method: Schema.optional(
    Schema.Literal('POST', 'PUT', 'PATCH').annotations({
      description: 'HTTP method for the custom-endpoint submit (defaults to POST)',
    })
  ),
  /**
   * How to interpret the response body when deciding success/error (default
   * `sovrium`). Set `better-auth` for the `/api/auth/admin/*` always-200
   * enumeration-safe envelope.
   */
  responseEnvelope: Schema.optional(FetchResponseEnvelopeSchema),
  /** Submit button label (defaults to the form's standard submit label). */
  submitLabel: Schema.optional(
    Schema.String.annotations({
      description: 'Submit button label (defaults to the form submit label)',
      examples: ['Créer le compte', 'Envoyer'],
    })
  ),
  /**
   * Success handler on a 2xx submit. The toast slot PLUS the shipped client-state
   * effects — a persistent inline `status` region and a sibling `refetch` (so a
   * sibling directory grid refreshes after the create).
   */
  onSuccess: Schema.optional(FetchSuccessResponseSchema),
  /** Toast shown when the submit resolves non-2xx or rejects. */
  onError: Schema.optional(FetchToastResponseSchema),
}).annotations({
  title: 'Form Endpoint',
  description:
    'Custom-endpoint submit target for a form: POST collected field values as JSON to an arbitrary url, with response-envelope tolerance and the shipped onSuccess effects (status + sibling refetch).',
})

export const formFields = {
  ...coreFields,
  ...responsiveFields,
  ...visibilityFields,
  ...actionFields,
  ...i18nFields,
  ...dataBoundFields,
  /**
   * Write-surface guard: `form` is a WRITE surface, so it OVERRIDES the
   * `dataSource` field that `dataBoundFields` spreads (which now permits the
   * `{ system: ... }` read-endpoint binding) back to the DB-only
   * `DataSourceSchema`. A form must submit to a declared `app.tables` table and
   * must NEVER bind to a system READ endpoint — a `form` config carrying
   * `dataSource.system` therefore fails to decode by design.
   */
  dataSource: Schema.optional(DataSourceSchema),
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
  /**
   * Custom-endpoint submit target. When set, the form POSTs its collected field
   * values as JSON to an arbitrary `url` (NOT the records API), then fires
   * `onSuccess` (toast + the shipped `status`/`refetch` effects). Mutually
   * exclusive with the table-bound `dataSource`/`formRef` write surfaces; each
   * field then needs an explicit `control`. See {@link FormEndpointSchema}.
   */
  endpoint: Schema.optional(FormEndpointSchema),
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
