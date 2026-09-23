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
        'Guidance shown below the field, which stays visible while the person is typing.',
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
  /** Default value (literal or `$query.{name}` / `$user.{prop}` reference). */
  defaultValue: Schema.optional(
    Schema.Union([Schema.String, Schema.Finite, Schema.Boolean]).annotate({
      description:
        'Value the field starts with: a literal, `$query.{name}` to read a URL parameter, or `$user.{prop}` to read a property of the signed-in user.',
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
