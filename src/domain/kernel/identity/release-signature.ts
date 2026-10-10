/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { importEd25519PublicKey, verifyDetached } from './ed25519'

/**
 * How a downloaded Sovrium release is judged, with no network and no
 * filesystem: the Ed25519 release keys a binary ships, the detached signature
 * over an archive's exact bytes, the published sha256, and which URLs may be
 * trusted to deliver them. `sovrium update` and the `instance/engineInstall`
 * step both judge a release by these rules, so a release one accepts the other
 * accepts too.
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

/** Whether `key` has started: its `validFrom` parses and is not after `now`. */
const hasStarted = (key: ReleaseSigningKey, now: number): boolean => {
  const startsAt = Date.parse(key.validFrom)
  return Number.isFinite(startsAt) && startsAt <= now
}

/** The keys of `keys` whose `validFrom` has passed at `now`. */
export const startedReleaseKeys = (
  keys: readonly ReleaseSigningKey[],
  now: number
): readonly ReleaseSigningKey[] => keys.filter((key) => hasStarted(key, now))

/** A release key, as {@link isSignedByTrustedKey} needs it: its base64 public key. */
export interface TrustedReleaseKey {
  readonly publicKey: string
}

/**
 * Whether `signature` is a valid signature of `archive` by ANY of `keys`. A
 * `.sig` names no key, so every trusted key is tried; an unreadable key never
 * verifies anything.
 */
export const isSignedByTrustedKey = (
  archive: Readonly<Uint8Array>,
  signature: string,
  keys: readonly TrustedReleaseKey[]
): boolean =>
  keys.some((key) => {
    const publicKey = importEd25519PublicKey(key.publicKey)
    return publicKey !== undefined && verifyDetached(archive, signature, publicKey)
  })

/** A 64-character hex sha256, the first token of a published `.sha256` file. */
export const parsePublishedSha256 = (text: string): string | undefined => {
  const token = text.trim().split(/\s+/)[0]?.toLowerCase() ?? ''
  return /^[0-9a-f]{64}$/.test(token) ? token : undefined
}

/**
 * A loopback authority and nothing else: `localhost`, an address of
 * 127.0.0.0/8 or `[::1]`, with an optional port. Anything more — userinfo, a
 * path, a second host — is not loopback, since the URL built from it would
 * reach whatever host follows.
 */
const LOOPBACK_AUTHORITY = /^(?:localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d{1,5})?$/i

/**
 * `host` or `host:port` names this machine (127.0.0.0/8, `localhost`, `::1`),
 * and only this machine: `127.0.0.1:1@example.com` names `example.com`.
 */
export const isLoopbackHost = (host: string): boolean => LOOPBACK_AUTHORITY.test(host)

/** `https://<host>`, or `http://<host>` for a loopback test host — never otherwise. */
export const originFor = (host: string): string =>
  `${isLoopbackHost(host) ? 'http' : 'https'}://${host}`

/**
 * Whether a response's FINAL url (after redirects) may be trusted: HTTPS, or the
 * loopback test host. GitHub answers an asset download with a redirect to its
 * storage host, and a redirect is exactly where a downgrade to HTTP would hide.
 */
export const isTrustedFinalUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || isLoopbackHost(parsed.host)
  } catch {
    return false
  }
}

/** The URL of one asset of the release `version`, served by `host`. */
export const releaseAssetUrlOn = (host: string, version: string, file: string): string =>
  `${originFor(host)}/sovrium/sovrium/releases/download/v${version}/${file}`

/**
 * How long a release download may go without progress before it is abandoned.
 *
 * An INACTIVITY deadline, not a total one: the archive is ~70 MB, which an
 * honest slow link takes minutes to deliver, while a peer that accepted the
 * connection and stopped sending would otherwise hold the download forever.
 */
export const RELEASE_DOWNLOAD_STALL_TIMEOUT_MS = 30_000

/** The `<os>-<arch>` suffix of the release asset built for a platform and an architecture. */
export const releaseTargetFor = (platform: string, arch: string): string =>
  `${platform === 'darwin' ? 'darwin' : 'linux'}-${arch === 'arm64' ? 'arm64' : 'x64'}`
