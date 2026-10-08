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
 * A private key is only ever read from the environment: the configuration is
 * code, and code reaches a git remote. `$env.NAME` is also what keeps the key
 * out of the run history, where resolved environment values are masked.
 */
export const ENV_REFERENCE_PATTERN = /^\$env\.[A-Z_][A-Z0-9_]*$/

/**
 * Crypto Sign Action (type: crypto, operator: sign)
 *
 * Make a detached Ed25519 signature over `data` (its UTF-8 bytes) with a
 * private key read from the environment. The signature is the standard 64-byte
 * Ed25519 signature, base64-encoded, so any Ed25519 implementation verifies it.
 */
export const CryptoSignActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('crypto').pipe(
    Schema.annotate({
      description: "Constant value 'crypto' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('sign').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'crypto' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    data: TemplateStringSchema.pipe(
      Schema.annotate({
        description: 'The text to sign; its UTF-8 bytes are signed (supports template variables)',
      })
    ),
    privateKey: Schema.String.annotate({
      howTo:
        'Write `$env.NAME` and declare NAME under `env`. The value is the 32-byte Ed25519 seed in base64, or a PKCS#8 PEM block (`-----BEGIN PRIVATE KEY-----`). A key written inline is refused: the configuration is code, and code reaches a git remote.',
      description:
        'Reference to the Ed25519 private key in the environment, written $env.NAME: a base64 32-byte seed or a PKCS#8 PEM',
    }).check(Schema.isPattern(ENV_REFERENCE_PATTERN)),
    algorithm: Schema.Literal('ed25519').pipe(
      Schema.annotate({ description: "Signature algorithm: always 'ed25519'" })
    ),
    keyId: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description:
            'Identifier of the key, returned beside the signature so a verifier knows which public key to use',
        })
      )
    ),
  }).annotate({
    description: 'What to sign, the environment variable holding the key, and the key identifier.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'CryptoSignAction',
    title: 'Crypto Sign Action',
    description: 'Make a detached Ed25519 signature with a private key from the environment',
  })
)

/** @public */
export type CryptoSignAction = Schema.Schema.Type<typeof CryptoSignActionSchema>
