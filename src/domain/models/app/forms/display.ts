/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Form Display
 *
 * Cosmetic display options for the form renderer. None affect submission
 * semantics — only how the form looks to the submitter.
 */
export const FormDisplaySchema = Schema.Struct({
  /** Per-form theme overrides. */
  theme: Schema.optional(
    Schema.Struct({
      primaryColor: Schema.optional(Schema.String),
      backgroundColor: Schema.optional(Schema.String),
      borderRadius: Schema.optional(Schema.String),
    })
  ),
  /** Submit button label (`Submit` by default; supports `$t:` keys). */
  submitLabel: Schema.optional(Schema.String),
}).annotate({
  identifier: 'FormDisplay',
  title: 'Form Display',
  description: 'Cosmetic display options for the form renderer',
})

/** @public */
export type FormDisplay = Schema.Schema.Type<typeof FormDisplaySchema>
