/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { PermissionValueSchema } from '../auth/permissions'
import { VisibleWhenConditionSchema } from './visible-when'

/**
 * Per-field permissions schema for forms.
 *
 * Currently exposes `read` — when the requesting role is NOT in the read
 * allowlist, the field VALUE is omitted from admin exports and the per-
 * submission detail JSON (the column header is retained in CSV; the key
 * is omitted in JSON detail responses). Mirrors the table-level
 * `PermissionValueSchema` contract — accepts `'all' | 'authenticated' |
 * string[]`. The intended primary use is `read: ['admin']` for sensitive
 * fields (SSN, PHI, payment info).
 *
 * Lives on `commonFieldProps` so every field discriminant inherits it.
 */
export const FormFieldPermissionsSchema = Schema.Struct({
  read: Schema.optional(PermissionValueSchema),
}).annotate({
  identifier: 'FormFieldPermissions',
  title: 'Form Field Permissions',
  description: 'Per-field read permissions for admin export + detail redaction',
})

/**
 * Common properties shared across all form-field discriminants.
 *
 * Spread into each concrete `FormFieldSchema` variant in
 * `src/domain/models/app/forms/fields/` to keep the per-kind structures DRY
 * without duplicating the visibility/required/disabled rule wiring.
 *
 * Lives in the `forms` slug because that is the feature it describes. The same
 * set is reused by the legacy in-page form component, which reaches it across
 * the one measured `pages` -> `forms` edge rather than owning a second copy.
 */
export const commonFieldProps = {
  /** Label shown to the submitter. Supports $t: i18n keys. */
  label: Schema.optional(
    Schema.String.annotate({
      description:
        'Label shown above the field to the person filling in the form. Accepts a `$t:` key to use a translated label.',
    })
  ),
  /** Placeholder text shown when the field is empty. */
  placeholder: Schema.optional(
    Schema.String.annotate({
      description:
        'Hint shown inside the empty field, which disappears as soon as the person starts typing.',
    })
  ),
  /** Help text shown below the field. */
  helpText: Schema.optional(
    Schema.String.annotate({
      description:
        'Guidance shown below the field, which stays visible while the person is typing. Accepts inline markdown: links (always opened in a new tab), bold, italic, code and line breaks.',
    })
  ),
  /** Whether the field is required (always true / always false). */
  required: Schema.optional(
    Schema.Boolean.annotate({
      description: 'Blocks submission while this field is left empty.',
    })
  ),
  /** Whether the field is read-only (display-only). */
  readOnly: Schema.optional(
    Schema.Boolean.annotate({
      description: 'Shows the value but prevents the person from changing it.',
    })
  ),
  /** Whether the field is hidden but submitted (server-only). */
  hidden: Schema.optional(
    Schema.Boolean.annotate({
      description: 'Keeps the field out of the rendered form while still submitting its value.',
    })
  ),
  /** Default value (literal, `$query.{name}` / `$user.{prop}` reference, or `$now`). */
  defaultValue: Schema.optional(
    Schema.Union([Schema.String, Schema.Finite, Schema.Boolean]).annotate({
      description:
        'Value the field starts with: a literal, `$query.{name}` to read a URL parameter, `$user.{prop}` to read a property of the signed-in user, or `$now` for the current date and time. The form starts from it wherever it is shown, embedded in a page or on its own.',
    })
  ),
  /**
   * Conditional visibility — show/hide based on another field's value.
   * Accepts a simple `{ field, operator, value }` rule OR a compound
   * `{ and: [...] }` / `{ or: [...] }` composition (which may nest).
   */
  visibleWhen: Schema.optional(VisibleWhenConditionSchema),
  /**
   * Conditional required — make required based on another field's value.
   * Same shape as `visibleWhen`; supports compound AND/OR composition.
   */
  requiredWhen: Schema.optional(VisibleWhenConditionSchema),
  /**
   * Conditional disabled — disable based on another field's value.
   * Same shape as `visibleWhen`; supports compound AND/OR composition.
   */
  disabledWhen: Schema.optional(VisibleWhenConditionSchema),
  /**
   * Per-field read permissions used by admin exports + per-submission
   * detail. When `read` excludes the requesting role, the field value
   * is omitted from CSV (column header retained, value blank) and from
   * the detail JSON (key omitted). See FormFieldPermissionsSchema.
   */
  permissions: Schema.optional(FormFieldPermissionsSchema),
} as const

/**
 * In-browser audio recording for an attachment field.
 *
 * Declared once and spread into both attachment-capable field kinds — the
 * standalone `inputType: attachment` field and a table-bound field whose column
 * is `single-attachment` / `multiple-attachments` — so the recorder is the same
 * option whichever way a form reaches its file input.
 *
 * The recording travels through the ordinary attachment pipeline: it is
 * uploaded to the field's resolved bucket and submitted as one more file, with
 * the same `{ url, name, size, mimeType }` metadata a picked file carries. A
 * transcript is NOT produced here; a record-created automation with
 * `ai/transcribe` writes it back onto the record.
 */
export const FormRecordAudioSchema = Schema.Struct({
  maxDurationSeconds: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        defaultNote: '7200',
        description:
          'Longest recording accepted, in seconds (1 to 7200, two hours). Recording stops by itself when the limit is reached; the file size is still capped by the field or bucket maxFileSize.',
      }),
      Schema.check(
        Schema.isInt(),
        Schema.isGreaterThanOrEqualTo(1),
        Schema.isLessThanOrEqualTo(7200)
      )
    )
  ),
}).annotate({
  title: 'Record Audio',
  description:
    'Adds a microphone recorder beside the file picker; the recording is submitted as an audio file.',
})

/** @public */
export type FormRecordAudio = Schema.Schema.Type<typeof FormRecordAudioSchema>

/**
 * The autofill field names of the WHATWG HTML standard, in two families.
 *
 * A CONTACT field name may be preceded by a `home`, `work`, `mobile`, `fax` or
 * `pager` hint; every other one may not. Written as data rather than as one
 * regular expression so the grammar below reads as the standard does, and so a
 * typo is refused by a list a reader can check by eye.
 */
const AUTOFILL_FIELD_NAMES: ReadonlySet<string> = new Set([
  'name',
  'honorific-prefix',
  'given-name',
  'additional-name',
  'family-name',
  'honorific-suffix',
  'nickname',
  'username',
  'new-password',
  'current-password',
  'one-time-code',
  'organization-title',
  'organization',
  'street-address',
  'address-line1',
  'address-line2',
  'address-line3',
  'address-level4',
  'address-level3',
  'address-level2',
  'address-level1',
  'country',
  'country-name',
  'postal-code',
  'cc-name',
  'cc-given-name',
  'cc-additional-name',
  'cc-family-name',
  'cc-number',
  'cc-exp',
  'cc-exp-month',
  'cc-exp-year',
  'cc-csc',
  'cc-type',
  'transaction-currency',
  'transaction-amount',
  'language',
  'bday',
  'bday-day',
  'bday-month',
  'bday-year',
  'sex',
  'url',
  'photo',
])

const AUTOFILL_CONTACT_FIELD_NAMES: ReadonlySet<string> = new Set([
  'tel',
  'tel-country-code',
  'tel-national',
  'tel-area-code',
  'tel-local',
  'tel-local-prefix',
  'tel-local-suffix',
  'tel-extension',
  'email',
  'impp',
])

const AUTOFILL_CONTACT_HINTS: ReadonlySet<string> = new Set([
  'home',
  'work',
  'mobile',
  'fax',
  'pager',
])

/** Drop `first` from the head of `tokens` when `matches` accepts it. */
const dropOptional = (
  tokens: readonly string[],
  matches: (token: string) => boolean
): readonly string[] => (tokens[0] !== undefined && matches(tokens[0]) ? tokens.slice(1) : tokens)

/**
 * Is `value` an autofill detail the HTML standard defines?
 *
 * `on` or `off` alone, or — in this order, separated by spaces — an optional
 * `section-<name>`, an optional `shipping` or `billing`, an optional contact
 * hint before a contact field name, ONE field name, and an optional trailing
 * `webauthn`. Compared case-insensitively, as browsers compare it.
 */
export const isAutofillDetail = (value: string): boolean => {
  const tokens = value.trim().toLowerCase().split(/\s+/)
  if (tokens.length === 1 && (tokens[0] === 'on' || tokens[0] === 'off')) return true
  const withoutWebauthn = tokens.at(-1) === 'webauthn' ? tokens.slice(0, -1) : tokens
  const afterSection = dropOptional(
    withoutWebauthn,
    (token) => token.startsWith('section-') && token.length > 'section-'.length
  )
  const afterMode = dropOptional(
    afterSection,
    (token) => token === 'shipping' || token === 'billing'
  )
  if (afterMode.length === 1) {
    const [field] = afterMode as readonly [string]
    return AUTOFILL_FIELD_NAMES.has(field) || AUTOFILL_CONTACT_FIELD_NAMES.has(field)
  }
  if (afterMode.length === 2) {
    const [hint, field] = afterMode as readonly [string, string]
    return AUTOFILL_CONTACT_HINTS.has(hint) && AUTOFILL_CONTACT_FIELD_NAMES.has(field)
  }
  return false
}

/**
 * The browser autofill hint a form field carries, as the HTML `autocomplete`
 * attribute.
 *
 * Omitted, a field takes the hint its TYPE implies — an email field `email`, a
 * phone field `tel`, a link field `url` — and a field whose type implies none
 * carries no attribute. Never derived from the field's NAME: a `name` column on
 * a product form is not a person's name. `off` turns autofill off for the one
 * field, and any other value must be an autofill detail the HTML standard
 * defines; a typo is refused when the config is loaded, because a browser
 * silently ignores a hint it does not know. The grammar is checked at the app
 * level (`form-autocomplete-validation.ts`), so the refusal names the form and
 * the field rather than their positions.
 */
export const FormFieldAutocompleteSchema = Schema.String.pipe(
  Schema.annotate({
    identifier: 'FormFieldAutocomplete',
    title: 'Form Field Autocomplete',
    description:
      "Browser autofill hint for this field, written to the input's `autocomplete` attribute. Omit it and the field takes the hint its type implies (`email` for an email field, `tel` for a phone field, `url` for a link field), or none. `off` turns autofill off for this field; any other value must be an autofill detail of the HTML standard, such as `given-name`, `organization`, `postal-code` or `shipping street-address`.",
    examples: ['given-name', 'organization', 'off', 'shipping postal-code', 'new-password'],
  })
)

/** @public */
export type FormFieldAutocomplete = Schema.Schema.Type<typeof FormFieldAutocompleteSchema>
