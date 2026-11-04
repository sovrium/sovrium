/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which signing session a road acts in: the signer a signing page's cookie
 * names (`signerId`), else the link `token`. A key naming nobody is not found
 * without reaching the data layer.
 */

import { Effect } from 'effect'
import { SignatureRequestRepository } from '@/application/ports/repositories/signatures/signature-request-repository'
import { NotFoundError } from '@/domain/errors'
import { signatureFlowNamed } from '@/domain/models/app/signatures/signature-request-service'
import type { App } from '@/domain/models/app'

/** The session a key names, whatever state it is in; `undefined` for a key naming nobody. */
const sessionOfKey = (signerId: string | undefined, token: string | undefined) =>
  Effect.gen(function* () {
    if ((signerId ?? '') === '' && (token ?? '') === '') return undefined
    const requests = yield* SignatureRequestRepository
    return signerId !== undefined && signerId !== ''
      ? yield* requests.sessionOfSigner(signerId)
      : yield* requests.session(token ?? '')
  })

/** The session a key opens with its flow, whatever state it is in; not found when it names nobody. */
export const sessionAndFlow = Effect.fn('signatures.session-and-flow')(function* (
  app: App,
  token: string | undefined,
  signerId?: string | undefined
) {
  const session = yield* sessionOfKey(signerId, token)
  const flow = session === undefined ? undefined : signatureFlowNamed(app, session.request.flowName)
  if (session === undefined || flow === undefined) {
    return yield* Effect.fail(new NotFoundError('Signing session not found'))
  }
  return { session, flow }
})
