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
import { ButtonVariantSchema } from '../../../shared-schemas'
import { actionFields } from '../../modules/action'
import { coreFields } from '../../modules/core'
import { dataBoundFields } from '../../modules/data-bound'
import { i18nFields } from '../../modules/i18n'
import { responsiveFields } from '../../modules/responsive'
import { visibilityFields } from '../../modules/visibility'
import { FormFieldConfigSchema, FormFieldGroupSchema } from './schema'

/**
 * The one form literal, in both of its modes.
 *
 * A `form` is STATIC when it declares no `dataSource`: it collects the fields
 * declared on it and submits them to a `formRef` or an `endpoint`. It is
 * TABLE-BOUND when it declares one: the same fields resolve against that
 * table's columns and the submit writes a record back through the records API.
 * `dataSource` is what decides, and nothing else about the component changes.
 *
 * ─── THERE WAS A SECOND LITERAL, AND IT DECLARED NOTHING OF ITS OWN ────────
 *
 * `data-form` was registered beside this one and built from the SAME
 * `formFields` object — not a similar one, the same reference — and dispatched
 * to the same `renderFormFromDispatch` in the registry. So the two spellings
 * differed in exactly one respect: which of them an author had last seen. That
 * is the drift a second name buys, and the reason the catalogue reshape retires
 * a duplicate rather than aliasing it (`retired-types.ts` carries the row that
 * tells an author where it went).
 *
 * The mode distinction the second name was reaching for is real and is still
 * here; it just lives on `dataSource`, where a reader can see it on the config
 * in front of them rather than having to know which of two type names implies
 * it.
 */
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
const InlinePrefillValueSchema = Schema.Union([
  Schema.String,
  Schema.Finite,
  Schema.Boolean,
  Schema.Array(Schema.String),
  Schema.Array(Schema.Finite),
]).annotate({
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
  prefill: Schema.Record(Schema.String, InlinePrefillValueSchema).annotate({
    description:
      'Map of form-field column name to prefill value. Supports `$parent.<field>` tokens that resolve against the host page record.',
  }),
  lockPrefill: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'When true, prefilled fields render as hidden inputs and the server revalidates the parent on submit (returns 422 if the parent is gone).',
    })
  ),
}).annotate({
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
  url: Schema.String.annotate({
    description:
      'Custom submit URL (any path; not the records API). e.g. /api/auth/admin/create-user',
  }),
  /** HTTP method for the submit (defaults to POST). */
  method: Schema.optional(
    Schema.Literals(['POST', 'PUT', 'PATCH']).annotate({
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
    Schema.String.annotate({
      description: 'Submit button label (defaults to the form submit label)',
      examples: ['Créer le compte', 'Envoyer'],
    })
  ),
  /**
   * Visual weight of the submit button, in the platform button recipe's own
   * words.
   *
   * ─── WHY THE KEY EXISTS ────────────────────────────────────────────────────
   *
   * An endpoint form's submit takes `computeButtonDefaultClasses()` at its
   * defaults, which is the `default` variant — the page's primary fill. That is
   * right for a page whose main action IS the form, and wrong for a page that
   * stacks SEVERAL small forms: the console's profile page draws six one-row
   * settings forms, so it draws six near-black primary buttons down the column
   * and none of them is the page's main action. The surface's answer until now
   * was a scoped `[&>button[type=submit]]:` override painted from outside the
   * component, which is a second styling vocabulary for something the button
   * schema already says.
   *
   * ─── THE SAME VOCABULARY, NOT A SECOND ONE ─────────────────────────────────
   *
   * {@link ButtonVariantSchema} verbatim — the member list a `button` component
   * accepts, resolved through the same `VARIANT_CLASS` recipe — so a submit and a
   * standalone `button` asking for `secondary` cannot drift apart. It is NOT
   * narrowed the way `RowActionVariantSchema` is: that narrowing exists because
   * `fab`, `link` and `outline` have no drawing in a 24px table row, and a form
   * submit is an ordinary inline button with room for every one of them.
   *
   * ─── WHY IT SITS HERE AND NOT ON A SHARED LEVEL ────────────────────────────
   *
   * There is no shared level to put it on. A submit is drawn at FOUR sites and
   * `submitLabel` — the same question, already settled — is declared separately
   * at each: here, on `AuthActionSchema`, on `CrudActionSchema`, and on
   * `FormDisplaySchema` for a top-level `app.forms[]`. Lifting this key to the
   * `form` component's top level would make one declaration cover three buttons
   * this component does not draw — a `formRef` form's submit belongs to the
   * referenced `app.forms[]`, and a table-bound form's belongs to the CRUD
   * island — so the key would have three owners and no defined precedence. When
   * one of those three surfaces needs it, it gets its own `submitVariant` beside
   * its own `submitLabel`, which is the shape this file already has.
   *
   * Omission keeps painting exactly what it paints today, so no existing form
   * changes by a byte.
   */
  submitVariant: Schema.optional(
    ButtonVariantSchema.annotate({
      description:
        "Visual weight of the submit button, from the platform button vocabulary (the same members a `button` component accepts). Omit for the primary 'default' fill, unchanged. Set 'secondary' when a page stacks several small forms and a column of primary buttons would make every row look like the page's main action.",
      examples: ['secondary', 'ghost', 'destructive'],
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
}).annotate({
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
          label: Schema.String.annotate({
            description: 'Step label shown in the progress indicator',
          }),
          fields: Schema.NonEmptyArray(
            Schema.String.annotate({ description: 'One field name, as the form declares it' })
          ).annotate({
            description: 'Field names assigned to this step',
          }),
        }).annotate({
          description: 'One step of the wizard: its label, and the fields it collects',
        })
      ).annotate({ description: 'Ordered list of wizard steps' }),
    }).annotate({
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
    FormNameSchema.annotate({
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
      Schema.annotate({
        description:
          'Per-field configuration for form component (labels, placeholders, visibility)',
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  fieldGroups: Schema.optional(
    Schema.Array(FormFieldGroupSchema).pipe(
      Schema.annotate({ description: 'Groups form fields under labeled section dividers' }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  layout: Schema.optional(
    Schema.Literals(['single-column', 'two-column', 'custom']).annotate({
      description: 'Form layout mode: single-column | two-column | custom',
    })
  ),
} as const

// Re-export all sub-schemas
