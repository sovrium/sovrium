/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createPrivateKey, createPublicKey, sign, verify, type KeyObject } from 'node:crypto'

/**
 * Detached Ed25519 signatures (RFC 8032), the standard 64-byte form any
 * Ed25519 verifier accepts.
 *
 * Keys travel as text: a public key as its 32 raw bytes in base64 or an SPKI
 * PEM block, a private key as its 32-byte seed in base64 or a PKCS#8 PEM block.
 * The raw forms are wrapped in the fixed DER prefix of their container, which
 * is how `node:crypto` imports a bare Ed25519 key — no third-party library and
 * nothing asynchronous, so this works the same under `bun run` and in the
 * compiled binary.
 *
 * Every reader answers `undefined` for text it cannot read, and the verifier
 * answers `false` for a signature it cannot read: a malformed signature is a
 * signature that does not verify, while an unreadable KEY is the caller's
 * configuration fault, which it reports as such.
 */

/** DER prefix of an Ed25519 SubjectPublicKeyInfo; the 32 key bytes follow. */
const SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')

/** DER prefix of an Ed25519 PKCS#8 PrivateKeyInfo; the 32 seed bytes follow. */
const PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex')

/** Length of an Ed25519 public key or seed, in bytes. */
export const ED25519_KEY_BYTES = 32

/** Length of an Ed25519 signature, in bytes. */
export const ED25519_SIGNATURE_BYTES = 64

const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/

/** The bytes of a canonical base64 string, or `undefined` when it is not one. */
export const decodeBase64 = (text: string): Uint8Array | undefined =>
  BASE64.test(text) ? new Uint8Array(Buffer.from(text, 'base64')) : undefined

const isPem = (text: string): boolean => text.trimStart().startsWith('-----BEGIN ')

/** An imported Ed25519 key, private or public, as `node:crypto` holds it. */
export type Ed25519Key = Readonly<KeyObject>

/** Run a key import, answering `undefined` when it throws or is not an Ed25519 key. */
const ed25519Key = (load: () => Ed25519Key): Ed25519Key | undefined => {
  try {
    const key = load()
    return key.asymmetricKeyType === 'ed25519' ? key : undefined
  } catch {
    return undefined
  }
}

/** Read a public key: 32 raw bytes in base64, or an SPKI PEM block. */
export const importEd25519PublicKey = (text: string): Ed25519Key | undefined => {
  const trimmed = text.trim()
  if (isPem(trimmed)) return ed25519Key(() => createPublicKey(trimmed))
  const raw = decodeBase64(trimmed)
  if (raw?.byteLength !== ED25519_KEY_BYTES) return undefined
  return ed25519Key(() =>
    createPublicKey({ key: Buffer.concat([SPKI_PREFIX, raw]), format: 'der', type: 'spki' })
  )
}

/** Read a private key: the 32-byte seed in base64, or a PKCS#8 PEM block. */
export const importEd25519PrivateKey = (text: string): Ed25519Key | undefined => {
  const trimmed = text.trim()
  if (isPem(trimmed)) return ed25519Key(() => createPrivateKey(trimmed))
  const seed = decodeBase64(trimmed)
  if (seed?.byteLength !== ED25519_KEY_BYTES) return undefined
  return ed25519Key(() =>
    createPrivateKey({ key: Buffer.concat([PKCS8_PREFIX, seed]), format: 'der', type: 'pkcs8' })
  )
}

/** The detached signature of `data`, base64. `privateKey` comes from {@link importEd25519PrivateKey}. */
export const signDetached = (data: Readonly<Uint8Array>, privateKey: Ed25519Key): string =>
  sign(undefined, data as Uint8Array, privateKey as KeyObject).toString('base64')

/**
 * Whether `signatureBase64` is a valid signature of `data` by `publicKey`.
 * A signature that is not base64 or not 64 bytes long does not verify.
 */
export const verifyDetached = (
  data: Readonly<Uint8Array>,
  signatureBase64: string,
  publicKey: Ed25519Key
): boolean => {
  const signature = decodeBase64(signatureBase64.trim())
  if (signature?.byteLength !== ED25519_SIGNATURE_BYTES) return false
  return verify(undefined, data as Uint8Array, publicKey as KeyObject, signature)
}
