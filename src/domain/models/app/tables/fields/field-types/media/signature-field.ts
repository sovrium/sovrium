/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from '../base-field'

/**
 * Signature Field
 *
 * Stores one signature: the drawn (or typed) mark as an image in a bucket, the
 * signer's name, the instant of signing, the method, and the exact statement
 * the signer agreed to. It is written by a `signature-pad` and is WRITE-ONCE:
 * once it holds a value, an update that changes it is refused, so a signed
 * record cannot be silently re-signed. Clearing it needs the record deleted or
 * an explicit operator action, never an ordinary edit.
 *
 * The stored value is a structure, not a string:
 * `{ image, signerName, signedAt, statement, method }` where `image` is the
 * bucket key of the PNG and `method` is `drawn` or `typed`.
 *
 * @example
 * ```yaml
 * fields:
 *   - id: 7
 *     name: client_signature
 *     type: signature
 *     bucket: signatures
 * ```
 */
export const SignatureFieldSchema = BaseFieldSchema.pipe(
  Schema.fieldsAssign({
    type: Schema.Literal('signature').pipe(
      Schema.annotate({
        description: "Constant value 'signature' for type discrimination in discriminated unions",
      })
    ),
    bucket: Schema.optional(
      Schema.String.pipe(
        Schema.annotate({
          description:
            'Bucket the signature image is stored in. References a bucket in app.buckets; omitted, the built-in system bucket is used.',
          examples: ['signatures'],
        })
      )
    ),
  }),
  Schema.annotate({
    title: 'Signature Field',
    description:
      'Stores one signature — image, signer name, date, method and the statement agreed to. Written once by a signature-pad; a signed value cannot be changed by an edit.',
    examples: [{ id: 7, name: 'client_signature', type: 'signature', bucket: 'signatures' }],
  })
)
