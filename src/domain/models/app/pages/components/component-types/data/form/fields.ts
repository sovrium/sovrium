/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { CssLengthSchema } from '../../../../../css-length'
import { FormNameSchema } from '../../../../../forms/name'
import {
  FetchResponseEnvelopeSchema,
  FetchToastResponseSchema,
  fetchSuccessReloadConflict,
  fetchSuccessResponseFields,
} from '../../../action'
import { DataSourceSchema } from '../../../data-source'
import { ButtonVariantSchema } from '../../../shared-schemas'
import { actionFields } from '../../modules/action'
import { coreFields } from '../../modules/core'
import { dataBoundFields } from '../../modules/data-bound'
import { i18nFields } from '../../modules/i18n'
import { responsiveFields } from '../../modules/responsive'
import { visibilityFields } from '../../modules/visibility'
import { FormFieldConfigSchema } from './schema'
import { FormSectionsSchema } from './sections'

/**
 * The page `form` literal — the form that WORKS ON DATA ALREADY IN THE APP.
 *
 * It does exactly four things: edit the record a page shows (`dataSource` with
 * `mode: single` and a `crud` update action), post its fields to an endpoint of
 * the author's own (`endpoint`), draw the sign-in and sign-up forms (an `auth`
 * action), and place a top-level form on the page (`formRef`).
 *
 * ─── IT NEVER CREATES A TABLE ROW ON ITS OWN ───────────────────────────────
 *
 * A form that TAKES SOMETHING IN — a new record, with a multi-step layout,
 * conditional fields, file uploads, a success page, field groups — is a
 * top-level `forms[]` entry, and `formRef` is the only bridge that puts one on
 * an app page. A second copy of each of those capabilities behind
 * `action: { type: crud, operation: create }` would drift from the first, so
 * each exists once, in `forms[]`. The keys the page form lost are refused at load with
 * a message naming their `forms[]` home (`removed-keys.ts`), and a `crud`
 * create action on a `form` is refused by `form-create-path-validation.ts`.
 *
 * ─── THERE WAS A SECOND LITERAL, AND IT DECLARED NOTHING OF ITS OWN ────────
 *
 * `data-form` was registered beside this one and built from the SAME
 * `formFields` object and dispatched to the same renderer, so the two
 * spellings differed only in which of them an author had last seen — the
 * drift a second name buys. `retired-types.ts` carries the row that tells an
 * author where it went.
 */
export const FormTypeLiteral = Schema.Literal('form')

/**
 * Prefill value supported by `inlinePrefill.prefill[<column>]`.
 *
 * Either a literal scalar/array (the value goes directly into the rendered
 * form) or a token resolved at render time: `$parent.<segment>` /
 * `$record.<segment>` from the host page's `dataSource: { mode: 'single' }`
 * record, `$now`, or `$user.<prop>` from the signed-in viewer. The token form is
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
    'Literal value, or a token resolved while the page renders: `$parent.<field>` or `$record.<field>` for a field of the page record, `$now` for the current date and time, `$user.<prop>` for a property of the signed-in viewer (dropped when nobody is signed in).',
})

/**
 * Inline-prefill configuration attached to a `formRef` embed of a top-level
 * form.
 *
 * Used by the inline-relationship-create flow: the host page exposes a single
 * record via `page.dataSource: { mode: 'single' }`, and the embedded form
 * auto-prefills the relationship column (e.g. `project_id: '$parent.id'`) so
 * the submitter never has to pick the parent manually.
 *
 * - `prefill` — column-name → value/token map applied to the rendered form
 * - `lockPrefill` (default: false) — when true, the prefilled fields render
 *   as `<input type="hidden">` (no editable UI) and the server revalidates
 *   the parent's existence on submit; when false, the prefill becomes the
 *   field's initial value but the submitter can override it.
 *
 * A page form declared in place (no `formRef`) cannot carry it: such a form
 * no longer creates records, and an edit form already starts from the record
 * it edits. `form-create-path-validation.ts` refuses it there.
 *
 * The schema is intentionally permissive at this tier: the server-side
 * resolver in `form-ref-resolver` validates that the referenced parent field
 * exists on the host page's bound record and that the form's
 * `submitTo.table` has columns matching the prefill keys.
 */
export const InlinePrefillSchema = Schema.Struct({
  prefill: Schema.Record(Schema.String, InlinePrefillValueSchema).annotate({
    description:
      'Map of form-field column name to prefill value. Supports `$parent.<field>` / `$record.<field>` tokens that resolve against the host page record, `$now`, and `$user.<prop>`. Fields it does not name keep their own defaults.',
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
    'Prefill fields of a form placed with `formRef` from the host page record — typically the parent link (`$parent.id`) of a record added from inside that record. Only on a `formRef` embed.',
})

/**
 * Success handler of an endpoint form — the fetch success slot, plus the two
 * effects only a FORM can honour.
 *
 * ─── WHY THE FORM GETS ITS OWN SLOT ────────────────────────────────────────
 *
 * The success slot of a `fetch` action is shared with the file upload and every
 * standalone button, and none of those has fields to clear or a dialog it was
 * opened in. So `close` and `reset` live HERE, on the one surface that has
 * both, rather than on the shared slot where they would validate and do
 * nothing for every other consumer. A table-bound form already closes the
 * dialog it sits in after a write and resets through `FormOnSuccess`'s `reset`
 * variant; an endpoint form had neither, so a dialog that invites a member or
 * creates an API key stayed open over the values just sent.
 *
 * ─── THE SAME REFUSAL AS THE SHARED SLOT, WIDENED ──────────────────────────
 *
 * `reload` replaces the document, so the dialog and the fields it would close or
 * clear are gone before either effect could run: declaring `close` or `reset`
 * beside it is refused, exactly as `status` and `refetch` are.
 *
 * The check is piped after the annotation, for the reason given on
 * `FetchSuccessResponseSchema`.
 */
export const FormEndpointSuccessResponseSchema = Schema.Struct({
  ...fetchSuccessResponseFields,
  /** Close the dialog or sheet the form sits in once the request succeeds. */
  close: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'When true, closes the dialog or sheet the form sits in once the request succeeds, the way a dialog closes after a table write. A form that sits in no dialog has nothing to close.',
      examples: [true],
    })
  ),
  /** Clear the form back to its defaults once the request succeeds. */
  reset: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'When true, puts every field back to its default value once the request succeeds, so the next submission starts from a clean form instead of the values just sent.',
      examples: [true],
    })
  ),
}).pipe(
  Schema.annotate({
    title: 'Form Endpoint Success Response',
    description:
      'Success handler for an endpoint form: the fetch success slot (toast, status, refetch, reload) plus close, which closes the dialog the form sits in, and reset, which clears the fields. reload is mutually exclusive with status, refetch, close and reset.',
  }),
  Schema.check(
    Schema.makeFilter((response) => {
      const shared = fetchSuccessReloadConflict(response)
      if (shared !== true || response.reload !== true) return shared
      if (response.close !== undefined) {
        return "onSuccess declares both 'reload' and 'close' — the reload replaces the page the dialog is drawn on, so there is nothing left to close. Keep one: 'reload' to recompose the page server-side, or 'close' to close the dialog and stay on the page."
      }
      if (response.reset !== undefined) {
        return "onSuccess declares both 'reload' and 'reset' — the reload replaces the form along with the page, so its fields come back empty anyway. Keep one: 'reload' to recompose the page server-side, or 'reset' to clear the fields and stay on the page."
      }
      return true
    })
  )
)

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
   * sibling directory grid refreshes after the create) — and the two only a form
   * honours: `close` the dialog it sits in, `reset` its fields. See
   * {@link FormEndpointSuccessResponseSchema}.
   */
  onSuccess: Schema.optional(FormEndpointSuccessResponseSchema),
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
   * Reference a top-level form by name. When set, the component renders the
   * referenced form inline; fields/steps/onSuccess flow from `app.forms[]`.
   *
   * Mutually exclusive with the inline form definition: when `formRef` is
   * set, `dataSource` and `fields` must NOT also be set on the same component
   * (cross-validated at the `AppSchema` level).
   */
  formRef: Schema.optional(
    FormNameSchema.annotate({
      description:
        'Place a top-level form (app.forms[].name) on this page. The only way to let someone add a record from inside an app page: the page form never creates a table row on its own.',
    })
  ),
  /**
   * Inline-prefill configuration for a `formRef` embed placed on a record page.
   *
   * On a host page that exposes a `dataSource: { mode: 'single' }` record —
   * whether the form sits directly on the page, in a tab panel or in a dialog —
   * prefill tokens like `'$parent.id'` resolve against the host record at
   * render time so the submitter never has to pick the parent record manually.
   * Refused on a form declared in place (one without `formRef`).
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
          'Per-field configuration for the form: labels, help text, placeholders, defaults, read-only, disabled and hidden fields, and the control or choices of an endpoint form.',
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  layout: Schema.optional(
    Schema.Literals(['single-column', 'two-column', 'main-aside', 'custom']).annotate({
      description:
        "Form layout mode: single-column | two-column | main-aside | custom. 'main-aside' sets the fields whose region is 'aside' — and the submit button — in a narrow column beside the others from the lg breakpoint up, and stacks everything on one column below it.",
    })
  ),
  /**
   * The width of a `main-aside` form's narrow column. The main column takes
   * the rest. Ignored by the other layouts.
   */
  asideWidth: Schema.optional(
    CssLengthSchema.annotate({
      description:
        'Width of the aside column of a main-aside form, in px or rem (default 20rem). The main column takes the rest. Ignored by the other layouts.',
      examples: ['340px', '20rem'],
    })
  ),
  /**
   * Whether the form draws its own title and description above its fields.
   * A form placed under a page heading that already says what it is for —
   * a referenced form whose title repeats the page's — turns it off.
   */
  showHeader: Schema.optional(
    Schema.Boolean.annotate({
      description:
        "Whether the form draws its own title and description above its fields (default: true). Turn it off when the page's own heading already says what the form is for.",
    })
  ),
  /**
   * Titled groups of fields — layout only. See {@link FormSectionsSchema} for
   * why a section never hides, steps or conditions its fields.
   */
  sections: Schema.optional(FormSectionsSchema),
  /**
   * Where each field's label sits. `top` (the default) stacks it above the
   * control; `side` puts the label and its help text on the left and the
   * control on the right, one row per field — the settings-page shape, where
   * a reader scans the labels down one column. Below the `md` breakpoint a
   * `side` form stacks like a `top` one, since there is no room for two
   * columns. Orthogonal to `layout`, which arranges the fields rather than
   * their labels.
   */
  labelPlacement: Schema.optional(
    Schema.Literals(['top', 'side']).annotate({
      description:
        "Where each field's label sits: top (default, above the control) or side (label and help on the left, control on the right, one row per field — stacked again below the md breakpoint).",
    })
  ),
  /**
   * Keep the save bar in view while the form scrolls, and say how many fields
   * have changed. For long edit forms: the bar reads "3 unsaved changes ·
   * Discard · Save", Save is enabled only once something changed, and leaving
   * the page with unsaved changes asks first.
   */
  stickyActions: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'Pin the save bar to the bottom of the viewport while the form scrolls, with the count of unsaved changes and a Discard button; Save enables only once a field changed, and leaving with unsaved changes asks first (default: false).',
    })
  ),
} as const

// Re-export all sub-schemas
