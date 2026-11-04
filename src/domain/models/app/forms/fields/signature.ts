/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { commonFieldProps } from '../form-field-props'

/**
 * Where a form signature is stored besides the submission.
 *
 * - `{ column }` — a `signature` field of the form's `submitTo.table`. The
 *   engine writes it from the signature the visitor gave; a column a signing
 *   flow owns is refused (bind the flow instead).
 * - `{ flow, signer? }` — a signer of a declared signing flow. The form then
 *   only accepts a signature inside that flow's signing session, from the
 *   signer the link was sent to (`signer` narrows it to one signer).
 */
export const SignatureFieldBindSchema = Schema.Union([
  Schema.Struct({
    column: Schema.String.pipe(
      Schema.annotate({
        description:
          "A signature field of the form's submitTo.table that receives the signature. Not one a signing flow owns.",
        examples: ['client_signature'],
      }),
      Schema.check(Schema.isMinLength(1))
    ),
  }).annotate({
    identifier: 'SignatureFieldColumnBind',
    title: 'Bind To A Signature Column',
    description: 'Store the signature in a signature field of the table the form writes to.',
  }),
  Schema.Struct({
    flow: Schema.String.pipe(
      Schema.annotate({
        description: 'A signing flow declared under signatures.',
        examples: ['employment_contract'],
      }),
      Schema.check(Schema.isMinLength(1))
    ),
    signer: Schema.optional(
      Schema.String.pipe(
        Schema.annotate({
          description:
            'One signer of that flow. Left out, the signer the open signing link was sent to.',
          examples: ['employee'],
        }),
        Schema.check(Schema.isMinLength(1))
      )
    ),
  }).annotate({
    identifier: 'SignatureFieldFlowBind',
    title: 'Bind To A Signing Flow',
    description:
      'Sign as a signer of a declared signing flow. The form accepts it only inside that flow’s signing session.',
  }),
]).annotate({
  description:
    'Where the signature is stored besides the submission: a signature column of the table the form writes to, or a signer of a signing flow. Left out, it is stored in the submission only.',
})

/**
 * Signature field — captures a hand-drawn or typed signature.
 *
 * The server authors what is stored: the image the visitor drew, her name, the
 * instant, the method and the exact statement she was shown. The statement is
 * `statement` when declared, else the field's label as rendered; the browser
 * never supplies it.
 */
export const SignatureFieldSchema = Schema.Struct({
  kind: Schema.Literal('signature').annotate({
    description: 'Which kind of field this is. It decides which of the other keys apply.',
  }),
  name: Schema.String.annotate({
    description:
      'Identifier for this field within the form; it is the key the answer is stored and reported under.',
  }).pipe(Schema.check(Schema.isPattern(/^[a-zA-Z][a-zA-Z0-9_-]*$/))),
  statement: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'The sentence the signer agrees to, shown above the signing well and stored with her signature. A $t: key is accepted. Left out, the field’s label is the statement.',
        examples: ['I accept the terms of this quote.'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  bind: Schema.optional(SignatureFieldBindSchema),
  ...commonFieldProps,
}).annotate({
  identifier: 'SignatureField',
  title: 'Signature Field',
  description:
    'Captures a hand-drawn or typed signature, with the statement it agrees to; optionally stored in a signature column or given as a signer of a signing flow',
})

export type SignatureField = Schema.Schema.Type<typeof SignatureFieldSchema>
