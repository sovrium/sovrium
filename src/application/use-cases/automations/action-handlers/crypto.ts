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
 * Wave: the automations actions crypto requirement.
 */

import { createHash, createHmac } from 'node:crypto'
import { Effect } from 'effect'
import {
  importEd25519PrivateKey,
  importEd25519PublicKey,
  signDetached,
  verifyDetached,
} from '@/domain/kernel/identity/ed25519'
import { findBundlePublicKey } from '@/domain/models/process-env/host-actions'
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
  }).pipe(Effect.withSpan('automations.handle-crypto-hash'))

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
  }).pipe(Effect.withSpan('automations.handle-crypto-hmac'))

const failure = (error: string): ActionOutcome => ({ status: 'failure', error, retryable: false })

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text)

/**
 * `crypto/sign` — a detached Ed25519 signature of the UTF-8 bytes of
 * `props.data`, base64. Output: `{ signature, keyId? }`.
 *
 * `privateKey` is declared as `$env.NAME` (the schema refuses anything else),
 * so by the time it reaches this handler it holds the variable's value: a
 * base64 32-byte seed or a PKCS#8 PEM. A value still reading `$env.` means the
 * variable is not set. The key never appears in the output, and the run
 * history masks every `$env` value.
 */
export const handleCryptoSign: ActionHandler = (action, _app, _automation) =>
  Effect.sync((): ActionOutcome => {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const keyText = stringProp(props, 'privateKey')
    if (keyText === '' || keyText.startsWith('$env.')) {
      return failure(`crypto.sign: the private key variable ${keyText || '(none)'} is not set`)
    }
    const privateKey = importEd25519PrivateKey(keyText)
    if (privateKey === undefined) {
      return failure(
        'crypto.sign: the private key is neither a base64 32-byte Ed25519 seed nor a PKCS#8 PEM'
      )
    }
    const { keyId } = props
    return {
      status: 'success',
      output: {
        signature: signDetached(utf8(stringProp(props, 'data')), privateKey),
        ...(typeof keyId === 'string' && keyId !== '' ? { keyId } : {}),
      },
    }
  }).pipe(Effect.withSpan('automations.handle-crypto-sign'))

/** The public key a verify step names, or why it cannot be had. */
const verifyingKey = (props: Readonly<Record<string, unknown>>) => {
  const { publicKey: inline, keyId } = props
  if (typeof inline === 'string' && inline !== '') {
    return importEd25519PublicKey(inline) ?? 'crypto.verify: publicKey is not an Ed25519 public key'
  }
  if (typeof keyId === 'string' && keyId !== '') {
    const trusted = findBundlePublicKey(keyId, process.env)
    if (trusted === undefined) {
      return `crypto.verify: no key "${keyId}" in SOVRIUM_BUNDLE_PUBLIC_KEYS`
    }
    return (
      importEd25519PublicKey(trusted) ??
      `crypto.verify: the key "${keyId}" is not an Ed25519 public key`
    )
  }
  return 'crypto.verify: give publicKey or keyId'
}

/**
 * `crypto/verify` — whether `props.signature` is a valid Ed25519 signature of
 * the UTF-8 bytes of `props.data`. Output: `{ valid }`.
 *
 * A signature that does not verify — another key, altered data, not base64,
 * the wrong length — is a VERDICT, `valid: false` on a successful step that a
 * workflow branches on. A public key that cannot be read, or a `keyId` the
 * keyring does not hold, is a configuration fault and fails the step.
 */
export const handleCryptoVerify: ActionHandler = (action, _app, _automation) =>
  Effect.sync((): ActionOutcome => {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const key = verifyingKey(props)
    if (typeof key === 'string') return failure(key)
    const valid = verifyDetached(
      utf8(stringProp(props, 'data')),
      stringProp(props, 'signature'),
      key
    )
    return { status: 'success', output: { valid } }
  }).pipe(Effect.withSpan('automations.handle-crypto-verify'))
