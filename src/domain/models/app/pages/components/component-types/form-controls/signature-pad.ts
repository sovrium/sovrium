/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `signature-pad` — the control that writes a `signature` field, and the
 * reading that shows one.
 *
 * ─── A SIGNATURE IS A STATEMENT, NOT A DRAWING ────────────────────────────
 *
 * The stored value is the `signature` field's struct: the image, the signer's
 * name, the instant, the method (drawn or typed) and the exact `statement` the
 * signer agreed to. The statement is declared HERE, on the control, because it
 * is the sentence the reader sees above the well; it is copied into the stored
 * value at signing so a later edit of the config cannot change what an
 * existing signature says it agreed to.
 *
 * ─── THE TYPED PATH IS ALWAYS OFFERED BY DEFAULT ───────────────────────────
 *
 * Drawing with a pointer is impossible for some readers, so `allowTyped`
 * defaults to true: typing one's full name is a signature too. An author may
 * turn it off where a drawn mark is required, and owns that choice.
 *
 * A signed field is write-once: once it holds a value the control renders the
 * reading ("Signed by … on …") and no well, whoever reads it.
 */

import { Schema } from 'effect'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const SignaturePadTypeLiteral = Schema.Literal('signature-pad')

export const signaturePadFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  field: Schema.String.pipe(
    Schema.annotate({
      description: 'The `signature` field of the bound record this pad writes and reads',
      examples: ['client_signature'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  statement: Schema.String.pipe(
    Schema.annotate({
      description:
        'The sentence the signer agrees to, shown above the well and stored with the signature. Supports $t: and $record references.',
      examples: ['I approve the quote of $record.total for $record.client.'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  height: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        description: 'Height of the signing well in pixels (default: 160)',
        examples: [160, 200],
      }),
      Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 80, maximum: 480 }))
    )
  ),
  penWidth: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        description: 'Stroke width of the pen in pixels (default: 2)',
        examples: [2, 3],
      }),
      Schema.check(Schema.isBetween({ minimum: 1, maximum: 8 }))
    )
  ),
  allowTyped: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'Offer "Type your name instead" beside the well (default: true), so a reader who cannot draw can still sign',
    })
  ),
} as const
