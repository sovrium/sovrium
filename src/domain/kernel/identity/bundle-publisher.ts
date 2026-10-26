/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Who published a bundle opened with `sovrium init --from-bundle`.
 *
 * The publisher signs the exact bytes of `manifest.json` with Ed25519 and puts
 * the detached signature in the root entry `manifest.sig`
 * (`{ keyId, algorithm: "ed25519", value }`), outside the manifest's own entry
 * list since it signs the manifest. The keys it is checked against are the
 * bundle-publisher keys the binary embeds — never the release key
 * `sovrium update` trusts, never a Cloud host's `SOVRIUM_BUNDLE_PUBLIC_KEYS`.
 *
 * | The archive carries                               | Verdict      |
 * | ------------------------------------------------- | ------------ |
 * | a signature by a known key that verifies          | `verified`   |
 * | no `manifest.sig`                                 | `unverified` |
 * | a signature by a key id the binary does not know  | `unverified` |
 * | a signature by a known key that does not verify   | `refused`    |
 * | a `manifest.sig` that cannot be read as one       | `refused`    |
 *
 * An unknown key proves nothing about who published the bundle, so it reads
 * exactly like no signature, and its key id is never offered as a name. A
 * signature that does not verify is tampering, not absence. The verdict
 * answers "who published this", never "is this safe to unpack": every bundle,
 * verified or not, goes through the same refusals.
 */

import { importEd25519PublicKey, verifyDetached } from './ed25519'

/** A bundle-publisher public key: its id and its 32 raw bytes in base64. */
export interface BundlePublisherKey {
  readonly keyId: string
  readonly publicKey: string
}

/** The publisher verdict of one archive. */
export type BundlePublisherVerdict =
  | { readonly verdict: 'verified'; readonly keyId: string }
  | { readonly verdict: 'unverified'; readonly reason: 'unsigned' | 'unknown-key' }
  | { readonly verdict: 'refused'; readonly reason: string }

/** The `manifest.sig` entry as the publisher writes it. */
interface SignatureEntry {
  readonly keyId: string
  readonly value: string
}

const refused = (reason: string): BundlePublisherVerdict => ({ verdict: 'refused', reason })

const nonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value !== ''

/** The JSON value of `bytes`, or `undefined` when they are not JSON. */
const parseJson = (bytes: Uint8Array): unknown => {
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown
  } catch {
    return undefined
  }
}

/** `manifest.sig` read as a detached Ed25519 signature, or `undefined` when it is not one. */
const readSignatureEntry = (bytes: Uint8Array): SignatureEntry | undefined => {
  const raw = parseJson(bytes)
  if (typeof raw !== 'object' || raw === null) return undefined
  const { keyId, algorithm, value } = raw as Record<string, unknown>
  if (algorithm !== 'ed25519' || !nonEmptyString(keyId) || !nonEmptyString(value)) return undefined
  return { keyId, value }
}

/** Judge `manifest.sig` (or its absence) against the exact manifest bytes and the trusted keys. */
export const bundlePublisherVerdict = (input: {
  readonly manifestBytes: Uint8Array
  /** The bytes of the `manifest.sig` entry, `undefined` when the archive has none. */
  readonly signatureEntry: Uint8Array | undefined
  readonly keys: readonly BundlePublisherKey[]
}): BundlePublisherVerdict => {
  if (input.signatureEntry === undefined) return { verdict: 'unverified', reason: 'unsigned' }
  const signature = readSignatureEntry(input.signatureEntry)
  if (signature === undefined) {
    return refused('manifest.sig is not a detached Ed25519 signature ({ keyId, algorithm, value })')
  }
  const key = input.keys.find((candidate) => candidate.keyId === signature.keyId)
  // An unknown key proves nothing about who published the bundle: it reads
  // exactly like no signature, and its id is never offered as a name.
  if (key === undefined) return { verdict: 'unverified', reason: 'unknown-key' }
  const publicKey = importEd25519PublicKey(key.publicKey)
  if (publicKey === undefined) return refused('the publisher key is not an Ed25519 public key')
  return verifyDetached(input.manifestBytes, signature.value, publicKey)
    ? { verdict: 'verified', keyId: key.keyId }
    : refused('the publisher signature does not verify: the manifest was changed after signing')
}
