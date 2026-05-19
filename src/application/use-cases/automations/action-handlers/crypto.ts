/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { createHash, createHmac } from 'node:crypto'
import { Effect } from 'effect'
import { stringProp } from './shared'
import type { ActionHandler, ActionOutcome } from './shared'

type CryptoEncoding = 'hex' | 'base64'

const resolveEncoding = (raw: unknown): CryptoEncoding => (raw === 'base64' ? 'base64' : 'hex')

export const handleCryptoHash: ActionHandler = (action, _app, _automation) =>
  Effect.sync(() => {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const input = stringProp(props, 'input')
    const algorithm = stringProp(props, 'algorithm')
    if (!algorithm) {
      return {
        status: 'failure',
        error: 'crypto.hash requires an `algorithm`',
      } as const satisfies ActionOutcome
    }
    const encoding = resolveEncoding(props['encoding'])
    const hash = createHash(algorithm).update(input).digest(encoding)
    return {
      status: 'success',
      output: { hash },
    } as const satisfies ActionOutcome
  })

export const handleCryptoHmac: ActionHandler = (action, _app, _automation) =>
  Effect.sync(() => {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const input = stringProp(props, 'input')
    const algorithm = stringProp(props, 'algorithm')
    if (!algorithm) {
      return {
        status: 'failure',
        error: 'crypto.hmac requires an `algorithm`',
      } as const satisfies ActionOutcome
    }
    const secret = stringProp(props, 'secret')
    const encoding = resolveEncoding(props['encoding'])
    const signature = createHmac(algorithm, secret).update(input).digest(encoding)
    return {
      status: 'success',
      output: { signature },
    } as const satisfies ActionOutcome
  })
