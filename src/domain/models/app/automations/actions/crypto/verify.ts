/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

/**
 * Crypto Verify Action (type: crypto, operator: verify)
 *
 * Check a detached Ed25519 signature over `data` (its UTF-8 bytes). The public
 * key is given inline (`publicKey`), or named (`keyId`) among the keys of
 * `SOVRIUM_BUNDLE_PUBLIC_KEYS` — exactly one of the two.
 *
 * A signature that does not verify — wrong key, altered data, not base64, not
 * 64 bytes — is a successful step answering `valid: false`, so a workflow
 * branches on it. A public key that cannot be read, or a `keyId` the
 * environment does not hold, fails the step: that is a configuration fault, not
 * a verdict.
 */
export const CryptoVerifyActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('crypto').pipe(
    Schema.annotate({
      description: "Constant value 'crypto' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('verify').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'crypto' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    data: TemplateStringSchema.pipe(
      Schema.annotate({
        description:
          'The text that was signed; its UTF-8 bytes are checked (supports template variables)',
      })
    ),
    signature: TemplateStringSchema.pipe(
      Schema.annotate({
        description: 'The base64 detached Ed25519 signature to check (supports template variables)',
      })
    ),
    publicKey: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description:
            'The Ed25519 public key: 32 raw bytes in base64, or an SPKI PEM block. Give this or keyId',
        })
      )
    ),
    keyId: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description:
            'Identifier of a public key in SOVRIUM_BUNDLE_PUBLIC_KEYS (<id>:<base64>[,…]). Give this or publicKey',
        })
      )
    ),
    algorithm: Schema.Literal('ed25519').pipe(
      Schema.annotate({ description: "Signature algorithm: always 'ed25519'" })
    ),
  })
    .annotate({
      description: 'What was signed, the signature, and the public key that should verify it.',
    })
    .pipe(
      Schema.check(
        Schema.makeFilter(({ publicKey, keyId }) =>
          (publicKey === undefined) === (keyId === undefined)
            ? 'give exactly one of publicKey and keyId'
            : undefined
        )
      )
    ),
}).pipe(
  Schema.annotate({
    identifier: 'CryptoVerifyAction',
    title: 'Crypto Verify Action',
    description: 'Check a detached Ed25519 signature and answer { valid }',
  })
)

/** @public */
export type CryptoVerifyAction = Schema.Schema.Type<typeof CryptoVerifyActionSchema>
