/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema, Struct } from 'effect'
import { FieldIdSchema } from '@/domain/kernel/identity/branded-ids'
import { FieldNameSchema } from '@/domain/models/app/tables/fields/field-name'

/**
 * The field's own property set, before annotation.
 *
 * Kept as a bare `Schema.Struct` (rather than inlining it into
 * `BaseFieldSchema`) for exactly one reason: field projection
 * (`mapFields(Struct.omit([...]))`) is a method on the struct, and `button`
 * needs a `label`-less base (see
 * `BaseFieldWithoutLabelSchema` below). Everything else should extend
 * `BaseFieldSchema`.
 */
const baseFieldStruct = Schema.Struct({
  id: Schema.optional(FieldIdSchema),
  name: FieldNameSchema,
  /**
   * External display name shown to END USERS.
   *
   * `name` is explicitly an INTERNAL identifier — its own schema opens
   * "Internal identifier name used for database columns and programmatic
   * references" and constrains it to lowercase/underscore/63-char database
   * naming. Until this property existed it was also the ONLY name a field had,
   * so every user-facing surface (record-drawer panels, auto-generated form
   * controls, auto-generated column headers) had no choice but to print the raw
   * `snake_case` identifier at the end user.
   *
   * `label` separates the two audiences: `name` stays the database/API
   * identifier, `label` is what a human reads.
   *
   * RESOLUTION ORDER on every surface: a surface-level override (e.g.
   * `recordFields[].label`, `columns[].label`, `fields[].label`) wins, then this
   * field-level `label`, then the RAW `name` verbatim.
   *
   * The final fallback is deliberately raw — `unit_price` renders as
   * `unit_price`, NOT "Unit price". Humanizing it would silently restyle every
   * heading in every already-shipped app with no config edit, so whether to
   * humanize is a separate decision, not a side effect of this one.
   *
   * Empty strings are rejected rather than treated as "unset", so a blank label
   * can never render as a blank heading.
   */
  label: Schema.optional(
    Schema.String.pipe(
      Schema.check(Schema.isNonEmpty({ message: 'label must not be empty' })),
      Schema.annotate({
        title: 'Field Label',
        description:
          'External display name shown to end users, in place of the internal `name`. Resolution order on every surface: surface-level override, then this label, then the raw `name` verbatim.',
        examples: ['Unit price', 'Prix unitaire', 'Email address', 'Date de création'],
      })
    )
  ),
  /**
   * Author-written guidance rendered BESIDE the field — under the control on an
   * auto-generated form, beside the value in a record-drawer panel.
   *
   * Distinct from a placeholder: a placeholder sits INSIDE the empty input and
   * disappears the moment the user focuses or types, which is precisely when
   * guidance is needed. A `description` persists, and on a form it is associated
   * with the control via `aria-describedby` so a screen reader announces it with
   * the field rather than orphaning it.
   *
   * Follows the same resolution order as `label`: a surface-level override (e.g.
   * `recordFields[].description`, `fields[].description`) wins, then this
   * field-level `description`, then nothing is rendered.
   *
   * Empty strings are rejected rather than treated as "unset", so a blank
   * description can never render as an empty help-text node.
   */
  description: Schema.optional(
    Schema.String.pipe(
      Schema.check(Schema.isNonEmpty({ message: 'description must not be empty' })),
      Schema.annotate({
        title: 'Field Description',
        description:
          'Author-written guidance rendered beside the field (under the control on a form, beside the value in a drawer) and associated with the control via aria-describedby. Unlike a placeholder it persists once the user starts typing.',
        examples: [
          'Excluding VAT, in euros.',
          'We only use this to send the receipt — it is never shared.',
          'Format: SIRET, 14 digits, no spaces.',
        ],
      })
    )
  ),
  required: Schema.optional(Schema.Boolean),
  unique: Schema.optional(Schema.Boolean),
  indexed: Schema.optional(Schema.Boolean),
})

/**
 * Base Field Schema
 *
 * Common properties shared across all field types.
 * All field types should extend this base schema and add their specific properties.
 *
 * @example
 * ```typescript
 * export const CustomFieldSchema = BaseFieldSchema.pipe(
 *   Schema.fieldsAssign({
 *     type: Schema.Literal('custom'),
 *     customProperty: Schema.String
 *   })
 * )
 * ```
 */
export const BaseFieldSchema = baseFieldStruct.pipe(
  Schema.annotate({
    title: 'Base Field',
    description: 'Base field properties: id, name, label, description, required, unique, indexed',
  })
)

/**
 * `BaseFieldSchema` minus `label` — the base for `button` fields ONLY.
 *
 * WHY THIS EXISTS. `Schema.extend` rejects a duplicated property key outright
 * ("Unsupported schema or overlapping types") — it throws at MODULE-IMPORT time,
 * not at decode time, and not even when the two declarations agree (an
 * `optional(String)` re-declared as `optional(String)` throws just the same;
 * measured on this change). `button` already spends the top-level `label` key on
 * its own REQUIRED button TEXT, so extending the labelled base would take the
 * whole `AppSchema` down on load.
 *
 * The two `label`s are genuinely different properties that collided on a name:
 * a field's `label` is the display name of the COLUMN, while a button field's
 * `label` is the text printed INSIDE the button. Merging them would be wrong
 * even if Effect allowed it, and re-keying the button's text is a breaking
 * change to a shipped, required property. So `button` opts out of the
 * field-level `label` and keeps its own; its column headings continue to fall
 * back to the raw `name`. `description` does NOT collide and `button` gets it
 * like every other type.
 */
export const BaseFieldWithoutLabelSchema = baseFieldStruct.mapFields(Struct.omit(['label'])).pipe(
  Schema.annotate({
    title: 'Base Field (without label)',
    description:
      'Base field properties minus `label`, for the button field type which spends that key on its own required button text',
  })
)

/** @public */
export type BaseField = Schema.Schema.Type<typeof BaseFieldSchema>
