/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `crypto/*` action handlers — pure cryptographic primitives.
 *
 * `crypto/hash` — compute a one-way digest (`md5` / `sha256` / `sha512`) of
 * a string input, returned hex- or base64-encoded. Output: `{ hash }`.
 *
 * `crypto/hmac` — compute a keyed HMAC signature (`sha256` / `sha512`) of a
 * string input with a shared secret, returned hex- or base64-encoded.
 * Output: `{ signature }`.
 *
 * Both operators are deterministic, side-effect-free transforms — no
 * repository, port, or I/O is involved. Template references in `props`
 * (`{{trigger.data.X}}`, `$env.X`) are resolved by the run loop's
 * prop-substitution pass before the handler sees them, so by the time
 * these handlers run every prop is a concrete string.
 *
 * Implemented with Node's `crypto` module (available natively in Bun).
 * The work is synchronous and trivially fast, so it is wrapped in
 * `Effect.sync` rather than `Effect.tryPromise`.
 *
 * Wave: [internal ref].
 */

import { createHash, createHmac } from 'node:crypto'
import { Effect } from 'effect'
import { stringProp } from './shared'
import type { ActionHandler, ActionOutcome } from './shared'

/** Encodings accepted by `props.encoding`; `hex` is the default. */
type CryptoEncoding = 'hex' | 'base64'

/**
 * Normalise `props.encoding` to a concrete `BinaryToTextEncoding`. Any
 * value other than the literal `'base64'` falls back to `'hex'` — the
 * schema constrains the field to `hex | base64`, so this also covers the
 * absent-prop case.
 */
const resolveEncoding = (raw: unknown): CryptoEncoding => (raw === 'base64' ? 'base64' : 'hex')

/**
 * `crypto/hash` — produce a digest of `props.input` using `props.algorithm`.
 */
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

/**
 * `crypto/hmac` — produce a keyed HMAC signature of `props.input` using
 * `props.algorithm` and `props.secret`.
 */
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
