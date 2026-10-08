/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Option, Schema } from 'effect'
import { importEd25519PublicKey, verifyDetached } from '@/domain/kernel/identity/ed25519'
import { findBundlePublicKey } from '@/domain/models/process-env/host-actions'
import { BUNDLE_MANIFEST_ENTRY, bundleManifestSchema } from './bundle-manifest'
import { verifyBundle } from './bundle-verification'
import type { VerifiedBundle } from '@/application/ports/services/instance-supervisor'

/**
 * Check a bundle a host is asked to run, before anything of it is written.
 *
 * 1. `signature` must be a detached Ed25519 signature over the EXACT bytes of
 *    the archive's `manifest.json`, by the key `keyId` names in
 *    `SOVRIUM_BUNDLE_PUBLIC_KEYS`. Signing the bytes rather than re-serialised
 *    JSON means the signer and every verifier agree without a canonical form.
 * 2. The manifest must be a bundle manifest WITHOUT an embedded `signature`
 *    field: that reserved field is not how a fleet signs, and a reader must
 *    not silently ignore a signature it was handed.
 * 3. Every entry must then match the manifest (`verifyBundle`): size, sha256,
 *    nothing unlisted, `configHash`. The manifest covers every byte, so the one
 *    signature authenticates the whole archive.
 *
 * Only a bundle passing all three becomes a {@link VerifiedBundle}, the one
 * shape the supervisor writes as a release.
 */

export type SignedBundleVerdict =
  | ({ readonly _tag: 'Verified' } & VerifiedBundle)
  | { readonly _tag: 'Refused'; readonly reason: string }

const refused = (reason: string): SignedBundleVerdict => ({ _tag: 'Refused', reason })

const decodeManifest = Schema.decodeUnknownOption(bundleManifestSchema)

const parseJson = (bytes: Readonly<Uint8Array>): unknown => {
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown
  } catch {
    return undefined
  }
}

interface SignedBundleInput {
  readonly entries: ReadonlyMap<string, Uint8Array>
  readonly keyId: string
  readonly signature: string
  readonly env?: Readonly<Record<string, string | undefined>>
}

/** Why the signature over `manifestBytes` is not good, or `undefined` when it is. */
const signatureProblem = (
  input: SignedBundleInput,
  manifestBytes: Readonly<Uint8Array>
): string | undefined => {
  const publicKeyText = findBundlePublicKey(input.keyId, input.env ?? process.env)
  if (publicKeyText === undefined) {
    return `no key "${input.keyId}" is trusted in SOVRIUM_BUNDLE_PUBLIC_KEYS`
  }
  const publicKey = importEd25519PublicKey(publicKeyText)
  if (publicKey === undefined)
    return `the trusted key "${input.keyId}" is not an Ed25519 public key`
  return verifyDetached(manifestBytes, input.signature, publicKey)
    ? undefined
    : `the bundle signature does not verify with key "${input.keyId}"`
}

/**
 * Step 1 alone, over the manifest read before any other entry: why its
 * signature is not good, or `undefined` when it is.
 */
export const manifestSignatureProblem = (
  manifestBytes: Readonly<Uint8Array>,
  signed: Pick<SignedBundleInput, 'keyId' | 'signature' | 'env'>
): string | undefined => signatureProblem({ ...signed, entries: new Map() }, manifestBytes)

export const verifySignedBundle = (input: SignedBundleInput): SignedBundleVerdict => {
  const manifestBytes = input.entries.get(BUNDLE_MANIFEST_ENTRY)
  if (manifestBytes === undefined) return refused(`the bundle holds no ${BUNDLE_MANIFEST_ENTRY}`)
  const badSignature = signatureProblem(input, manifestBytes)
  if (badSignature !== undefined) return refused(badSignature)
  const raw = parseJson(manifestBytes)
  if (raw !== null && typeof raw === 'object' && 'signature' in raw) {
    return refused(
      `${BUNDLE_MANIFEST_ENTRY} carries its own signature field; this host verifies a detached signature over the manifest only`
    )
  }
  const manifest = decodeManifest(raw)
  if (Option.isNone(manifest)) return refused(`${BUNDLE_MANIFEST_ENTRY} is not a bundle manifest`)
  const problems = verifyBundle(manifest.value, input.entries)
  if (problems.length > 0) {
    return refused(`the bundle does not match its manifest: ${problems.join('; ')}`)
  }
  return { _tag: 'Verified', entries: input.entries, verifiedWith: input.keyId }
}
