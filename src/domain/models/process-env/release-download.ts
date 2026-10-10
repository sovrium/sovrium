/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  EMBEDDED_RELEASE_SIGNING_KEYS,
  isLoopbackHost,
  releaseAssetUrlOn,
  startedReleaseKeys,
  type ReleaseSigningKey,
} from '@/domain/kernel/identity/release-signature'
import { parsePublicKeyring } from './host-actions'

/**
 * Where Sovrium releases are downloaded from, and which keys judge them —
 * read by `sovrium update` and by the `instance/engineInstall` step alike.
 *
 * `SOVRIUM_UPDATE_DOWNLOAD_HOST` names a mirror in place of `github.com`. A
 * mirror carries no trust: a release is accepted only when signed by a key the
 * running binary ships, so a mirror can withhold a release, never substitute
 * one. The one variable that changes the keys, `SOVRIUM_UPDATE_SIGNING_KEYS`,
 * is honoured only when the download host is loopback — a test stand-in.
 */

type Env = Readonly<Record<string, string | undefined>>

/** Replaces `github.com` as the host release assets are downloaded from. */
export const SOVRIUM_UPDATE_DOWNLOAD_HOST_VAR = 'SOVRIUM_UPDATE_DOWNLOAD_HOST'

/**
 * Replaces the embedded keys, in the `<id>:<base64>[,…]` format of
 * `SOVRIUM_BUNDLE_PUBLIC_KEYS`, so a spec can sign its stand-in release with a
 * key it has just generated. Honoured ONLY for a loopback download host.
 */
export const SOVRIUM_UPDATE_SIGNING_KEYS_VAR = 'SOVRIUM_UPDATE_SIGNING_KEYS'

/** The instant an override key is valid from: always already in the past. */
const OVERRIDE_VALID_FROM = '1970-01-01T00:00:00.000Z'

/** The download host releases come from: `SOVRIUM_UPDATE_DOWNLOAD_HOST`, else `github.com`. */
export const resolveReleaseDownloadHost = (env: Env = process.env): string =>
  env[SOVRIUM_UPDATE_DOWNLOAD_HOST_VAR] || 'github.com'

/** The download URL of one release asset, on the host the environment names. */
export const releaseAssetUrl = (version: string, file: string, env: Env = process.env): string =>
  releaseAssetUrlOn(resolveReleaseDownloadHost(env), version, file)

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
  readonly env?: Env
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
  return startedReleaseKeys(keys, options.now)
}

/**
 * The release keys a download from `host` is judged against, at `now`: the
 * `SOVRIUM_UPDATE_SIGNING_KEYS` override for a loopback host only, the
 * embedded keys for every other host. Throws on a malformed override.
 */
export const releaseKeysFor = (options: {
  readonly host: string
  readonly now: number
  readonly env?: Env
  readonly embedded?: readonly ReleaseSigningKey[]
}): readonly ReleaseSigningKey[] =>
  resolveReleaseSigningKeys({
    loopbackDownload: isLoopbackHost(options.host),
    now: options.now,
    ...(options.env === undefined ? {} : { env: options.env }),
    ...(options.embedded === undefined ? {} : { embedded: options.embedded }),
  })
