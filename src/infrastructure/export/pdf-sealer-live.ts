/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `PdfSealer` over the deployment's environment: the seal key and chain are
 * read from `SIGNATURE_SEAL_KEY` and `SIGNATURE_SEAL_CERT_CHAIN` when a
 * completion asks for them, checked as the boot checked them, and the CMS is
 * built by `crypto/cades-seal.ts`. The key never leaves this module: no log,
 * no error message and no span attribute carries any part of it.
 */

import { createHash } from 'node:crypto'
import { Effect, Layer } from 'effect'
import { PdfSealer, SealFailure } from '@/application/ports/services/pdf-sealer'
import { ProcessEnv } from '@/application/ports/services/process-env'
import {
  checkSealMaterial,
  parseSignatureEnv,
  type SealMaterial,
} from '@/domain/models/process-env/signatures'
import { certificateDerOf, prepareSeal } from '@/infrastructure/crypto/cades-seal'

/** The seal this deployment holds, `undefined` without one, or why it cannot sign. */
const sealMaterial = Effect.gen(function* () {
  const parsed = parseSignatureEnv(yield* ProcessEnv)
  if (!parsed.ok) return yield* new SealFailure({ message: parsed.error })
  const { seal } = parsed.config
  if (seal === undefined) return undefined
  const checked = checkSealMaterial(seal)
  return checked.ok ? checked.material : yield* new SealFailure({ message: checked.error })
})

/** SHA-256 of the seal certificate, hexadecimal. */
const certificateSha256 = (material: SealMaterial): string =>
  createHash('sha256')
    .update(certificateDerOf(material.chainPem[0] ?? ''))
    .digest('hex')

export const PdfSealerLive = Layer.succeed(
  PdfSealer,
  PdfSealer.of({
    configured: sealMaterial.pipe(
      Effect.map((material) => (material === undefined ? undefined : certificateSha256(material))),
      Effect.withSpan('signatures.seal-configured')
    ),
    sign: Effect.fn('signatures.seal-sign')(function* (digest: Uint8Array) {
      const material = yield* sealMaterial
      if (material === undefined) {
        return yield* new SealFailure({ message: 'This server has no seal key configured' })
      }
      return yield* Effect.tryPromise({
        try: () => prepareSeal(material, digest),
        catch: (cause) => new SealFailure({ message: 'The seal could not sign', cause }),
      })
    }),
  })
)
