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
      primaryColor: Schema.optional(
        Schema.String.annotate({
          description: 'Colour used for the submit button and other accents on this form only.',
        })
      ),
      backgroundColor: Schema.optional(
        Schema.String.annotate({ description: 'Background colour behind this form only.' })
      ),
      borderRadius: Schema.optional(
        Schema.String.annotate({
          description: "How rounded the corners of this form's inputs and buttons are.",
        })
      ),
    }).annotate({
      description:
        'Colour and corner overrides applied to this form only, on top of the app design.',
    })
  ),
  /** Submit button label (`Submit` by default; supports `$t:` keys). */
  submitLabel: Schema.optional(
    Schema.String.annotate({
      description: 'Text printed on the submit button. Accepts a `$t:` key.',
      defaultNote: 'Submit',
    })
  ),
}).annotate({
  identifier: 'FormDisplay',
  title: 'Form Display',
  description: 'Cosmetic display options for the form renderer',
})

/** @public */
export type FormDisplay = Schema.Schema.Type<typeof FormDisplaySchema>
