/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Ed25519 public keys a `sovrium update` trusts to have signed a release.
 *
 * A release archive's `.sig` is a detached signature over its exact bytes. The
 * published sha256 sits on the same release page a tamperer would edit, so it
 * proves integrity and never authorship; the signature, checked against a key
 * shipped INSIDE the running binary, proves who built the archive.
 *
 * A key is trusted from its `validFrom` instant on, which is how a rotation is
 * staged: the next key ships one release before it starts signing, and both
 * stay in the list until every supported version carries the new one.
 */

import { parsePublicKeyring } from '@/domain/models/process-env/host-actions'

/** One trusted release key: its identifier, its 32 raw bytes in base64, and when it starts. */
export interface ReleaseSigningKey {
  readonly id: string
  readonly publicKey: string
  /** ISO 8601 instant from which a signature by this key is accepted. */
  readonly validFrom: string
}

/**
 * The release keys this binary trusts. Only the PUBLIC half lives here: the
 * private key is held D8 (a CI secret plus an offline copy) and
 * never enters the repository. A rotation ([internal ref] D6) appends the next key
 * one release before it starts signing, and removes the old one two releases
 * later. Removing the last entry makes every self-update of a binary install
 * refuse (fail closed) unless the operator passes --insecure-skip-checksum.
 */
export const EMBEDDED_RELEASE_SIGNING_KEYS: readonly ReleaseSigningKey[] = [
  {
    id: 'sovrium-release-2026-10',
    publicKey: 'uzZiNLZgfcvphKt/migBwIh4zENL2YNZE0FWTeJaLFY=',
    validFrom: '2026-10-08',
  },
]

/**
 * Replaces the embedded keys, in the `<id>:<base64>[,…]` format of
 * `SOVRIUM_BUNDLE_PUBLIC_KEYS`, so a spec can sign its stand-in release with a
 * key it has just generated. Honoured ONLY for a loopback download host.
 */
export const SOVRIUM_UPDATE_SIGNING_KEYS_VAR = 'SOVRIUM_UPDATE_SIGNING_KEYS'

/** The instant an override key is valid from: always already in the past. */
const OVERRIDE_VALID_FROM = '1970-01-01T00:00:00.000Z'

/** Whether `key` has started: its `validFrom` parses and is not after `now`. */
const hasStarted = (key: ReleaseSigningKey, now: number): boolean => {
  const startsAt = Date.parse(key.validFrom)
  return Number.isFinite(startsAt) && startsAt <= now
}

/**
 * The keys a download is judged against, at `now`.
 *
 * The override applies only when `loopbackDownload` — the download host is a
 * local stand-in for GitHub. A release fetched from anywhere else is always
 * judged against the embedded keys, so the variable can never make a real
 * download trust a key the binary does not ship. A malformed override throws,
 * naming the variable; the caller turns that into a refusal.
 */
export const resolveReleaseSigningKeys = (options: {
  readonly loopbackDownload: boolean
  readonly now: number
  readonly env?: Readonly<Record<string, string | undefined>>
  readonly embedded?: readonly ReleaseSigningKey[]
}): readonly ReleaseSigningKey[] => {
  const env = options.env ?? process.env
  const embedded = options.embedded ?? EMBEDDED_RELEASE_SIGNING_KEYS
  const override = env[SOVRIUM_UPDATE_SIGNING_KEYS_VAR]?.trim() ?? ''
  const keys =
    override !== '' && options.loopbackDownload
      ? parsePublicKeyring(SOVRIUM_UPDATE_SIGNING_KEYS_VAR, env).map((key) => ({
          id: key.keyId,
          publicKey: key.publicKey,
          validFrom: OVERRIDE_VALID_FROM,
        }))
      : embedded
  return keys.filter((key) => hasStarted(key, options.now))
}
