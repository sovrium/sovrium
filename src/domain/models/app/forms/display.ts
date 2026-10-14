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
  /**
   * Submit button text while the submission is in flight (`Sending…` by
   * default, in the page language; supports `$t:` keys). The button also
   * draws a spinner and is disabled for that time, so a second press or
   * Enter sends nothing. On a multi-step form it applies to the final submit;
   * Next always shows the built-in word, since its request only checks a step.
   */
  pendingLabel: Schema.optional(
    Schema.String.annotate({
      description:
        'Text printed on the submit button, beside a spinner, while the submission is in flight. The button is disabled for that time, so a second press sends nothing; when the success redirects to another page it stays so until the page has gone. Accepts a `$t:` key.',
      defaultNote: 'Sending…, in the page language',
    })
  ),
}).annotate({
  identifier: 'FormDisplay',
  title: 'Form Display',
  description: 'Cosmetic display options for the form renderer',
})

/** @public */
export type FormDisplay = Schema.Schema.Type<typeof FormDisplaySchema>
