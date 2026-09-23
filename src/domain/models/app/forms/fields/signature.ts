/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { commonFieldProps } from '../form-field-props'

/**
 * Signature field — captures a hand-drawn or typed signature.
 */
export const SignatureFieldSchema = Schema.Struct({
  kind: Schema.Literal('signature').annotate({
    description: 'Which kind of field this is. It decides which of the other keys apply.',
  }),
  name: Schema.String.annotate({
    description:
      'Identifier for this field within the form; it is the key the answer is stored and reported under.',
  }).pipe(Schema.check(Schema.isPattern(/^[a-zA-Z][a-zA-Z0-9_-]*$/))),
  ...commonFieldProps,
}).annotate({
  identifier: 'SignatureField',
  title: 'Signature Field',
  description: 'Captures a hand-drawn or typed signature',
})

export type SignatureField = Schema.Schema.Type<typeof SignatureFieldSchema>
