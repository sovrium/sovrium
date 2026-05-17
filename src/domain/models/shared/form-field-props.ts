/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { VisibleWhenConditionSchema } from './visible-when'

/**
 * Common properties shared across all form-field discriminants.
 *
 * Spread into each concrete `FormFieldSchema` variant in
 * `src/domain/models/app/forms/fields/` to keep the per-kind structures DRY
 * without duplicating the visibility/required/disabled rule wiring.
 *
 * Lives in `src/domain/models/shared/` because the same set is reused by the
 * top-level forms feature and (potentially) by the legacy in-page form
 * component if it ever consolidates onto these primitives.
 */
export const commonFieldProps = {
  /** Label shown to the submitter. Supports $t: i18n keys. */
  label: Schema.optional(Schema.String),
  /** Placeholder text shown when the field is empty. */
  placeholder: Schema.optional(Schema.String),
  /** Help text shown below the field. */
  helpText: Schema.optional(Schema.String),
  /** Whether the field is required (always true / always false). */
  required: Schema.optional(Schema.Boolean),
  /** Whether the field is read-only (display-only). */
  readOnly: Schema.optional(Schema.Boolean),
  /** Whether the field is hidden but submitted (server-only). */
  hidden: Schema.optional(Schema.Boolean),
  /** Default value (literal or `$query.{name}` / `$user.{prop}` reference). */
  defaultValue: Schema.optional(Schema.Union(Schema.String, Schema.Number, Schema.Boolean)),
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
} as const
