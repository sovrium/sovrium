/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { commonFieldProps } from '../../../shared/form-field-props'

/**
 * Signature field — captures a hand-drawn or typed signature.
 */
export const SignatureFieldSchema = Schema.Struct({
  kind: Schema.Literal('signature'),
  name: Schema.String.pipe(Schema.pattern(/^[a-zA-Z][a-zA-Z0-9_-]*$/)),
  ...commonFieldProps,
}).annotations({
  identifier: 'SignatureField',
  title: 'Signature Field',
  description: 'Captures a hand-drawn or typed signature',
})

export type SignatureField = Schema.Schema.Type<typeof SignatureFieldSchema>
