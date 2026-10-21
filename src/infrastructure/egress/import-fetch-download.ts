/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The attachment half of `sovrium import fetch`: one file a source's answer
 * linked to, downloaded while its link is fresh.
 *
 * - Its URL goes through `validateOutboundUrl`, unless it sits on the loopback
 *   override's own origin.
 * - A redirect is followed by hand, at most `MAX_REDIRECT_HOPS` times, and every
 *   hop is judged again as the first URL was; the credential travels to a hop
 *   only on its own origin.
 * - The body is read under an inactivity deadline and a size cap, and the file
 *   is named by the SHA-256 of its bytes.
 */

import { createHash } from 'node:crypto'
import { Effect, Option } from 'effect'
import { egressRetrySchedule } from './egress-retry'
import { discardBody, MAX_REDIRECT_HOPS, REDIRECT_STATUSES } from './follow-redirects'
import { ImportFetchError } from './import-fetch-client'
import { validateOutboundUrl } from './validate-outbound-url'
import { withFetchStallTimeout } from './with-fetch-timeout'

const DOWNLOAD_STALL_MS = 60_000
/** An attachment past this size is skipped rather than downloaded: 512 MiB. */
const MAX_ASSET_BYTES = 512 * 1024 * 1024

/** A downloaded attachment, named by its hash. */
export interface DownloadedAsset {
  readonly sha256: string
  readonly bytes: Uint8Array
}

/** What one download answered: its status and its body, the body absent when refused or past the cap. */
interface DownloadAnswer {
  readonly status: number
  readonly bytes: Uint8Array | undefined
}

/** An answer with no body to keep: a hop the guard refused, or a redirect chain past its cap. */
const REFUSED_HOP: DownloadAnswer = { status: 0, bytes: undefined }

/** A downloaded body, or none when the answer was refused or the file is past the size cap. */
const readCappedBody = async (response: Response): Promise<DownloadAnswer> => {
  if (!response.ok) return { status: response.status, bytes: undefined }
  const declared = Number(response.headers.get('content-length') ?? 0)
  if (declared > MAX_ASSET_BYTES) return { status: response.status, bytes: undefined }
  const bytes = new Uint8Array(await response.arrayBuffer())
  return { status: response.status, bytes: bytes.byteLength > MAX_ASSET_BYTES ? undefined : bytes }
}

/** One answer of a download: the place a redirect points to, or the body. */
type DownloadHop =
  | { readonly kind: 'redirect'; readonly location: string }
  | { readonly kind: 'answer'; readonly answer: DownloadAnswer }

const readHop = async (response: Response): Promise<DownloadHop> => {
  const location = REDIRECT_STATUSES.has(response.status) ? response.headers.get('location') : null
  if (location === null || location === '') {
    return { kind: 'answer', answer: await readCappedBody(response) }
  }
  await discardBody(response)
  return { kind: 'redirect', location }
}

/** The credential a download carries: none unless the file sits where the token belongs. */
export interface DownloadCredential {
  readonly origin: string
  readonly headers: Readonly<Record<string, string>>
}

/** Where a download may go, and what each place is sent. */
interface DownloadPolicy {
  /** The loopback override's own origin, trusted like the vendor's hosts. */
  readonly overrideOrigin: string | undefined
  readonly credential: DownloadCredential | undefined
}

/** Whether a URL may be requested: on the override's origin, or accepted by the outbound guard. */
const isReachable = (url: URL, policy: DownloadPolicy): boolean =>
  (policy.overrideOrigin !== undefined && url.origin === policy.overrideOrigin) ||
  validateOutboundUrl(url.href).ok

/** The headers a URL is sent: the credential on its own origin (or the override's), nothing elsewhere. */
const headersFor = (url: URL, policy: DownloadPolicy): Readonly<Record<string, string>> =>
  policy.credential !== undefined &&
  (url.origin === policy.credential.origin || url.origin === policy.overrideOrigin)
    ? policy.credential.headers
    : {}

/**
 * Download `url`, following redirects by hand: each hop is judged as the first
 * URL was, and a hop the guard refuses, or one past `MAX_REDIRECT_HOPS`, ends
 * the download with nothing kept. `fetch`'s own following would judge the first
 * URL only and send the request wherever the answer pointed.
 */
const downloadFollowingGuardedRedirects = async (
  url: URL,
  policy: DownloadPolicy,
  hopsLeft: number
): Promise<DownloadAnswer> => {
  const hop = await withFetchStallTimeout(
    url,
    { method: 'GET', headers: headersFor(url, policy), redirect: 'manual' },
    DOWNLOAD_STALL_MS,
    readHop
  )
  if (hop.kind === 'answer') return hop.answer
  const next = URL.parse(hop.location, url.href)
  if (hopsLeft === 0 || next === null || !isReachable(next, policy)) return REFUSED_HOP
  return downloadFollowingGuardedRedirects(next, policy, hopsLeft - 1)
}

/** A downloaded file named by its hash, or the refusal an expired link earns. */
const assetOf = ({
  status,
  bytes,
}: DownloadAnswer): Effect.Effect<Option.Option<DownloadedAsset>, ImportFetchError> =>
  status === 403 || status === 410
    ? Effect.fail(
        new ImportFetchError({
          message: 'an attachment link expired before it was downloaded; fetch again',
          resumable: true,
        })
      )
    : Effect.succeed(
        Option.map(Option.fromUndefinedOr(bytes), (held) => ({
          sha256: createHash('sha256').update(held).digest('hex'),
          bytes: held,
        }))
      )

/**
 * Download one attachment URL the source returned. A URL `validateOutboundUrl`
 * refuses — unless it is on the loopback override's own origin — or a file past
 * the size cap gives `None`: the attachment is counted as skipped.
 *
 * `credential` is sent ONLY when the URL is on `credential.origin` (a vendor
 * whose files need the token, Typeform's) or on the loopback override: a file
 * hosted anywhere else never receives the operator's token.
 */
export const downloadSourceAsset = (
  url: string,
  overrideOrigin: string | undefined,
  credential?: DownloadCredential
): Effect.Effect<Option.Option<DownloadedAsset>, ImportFetchError> => {
  const parsed = URL.parse(url)
  const policy: DownloadPolicy = { overrideOrigin, credential }
  if (parsed === null || !isReachable(parsed, policy)) return Effect.succeedNone
  return Effect.tryPromise({
    try: () => downloadFollowingGuardedRedirects(parsed, policy, MAX_REDIRECT_HOPS),
    // The host only: an attachment's path may itself be a signed, expiring credential.
    catch: () =>
      new ImportFetchError({
        message: `an attachment download from ${parsed.host} stopped`,
        resumable: true,
      }),
  }).pipe(
    Effect.flatMap(assetOf),
    Effect.retry({
      schedule: egressRetrySchedule(),
      while: (error) => error.resumable && !error.message.includes('expired'),
    }),
    Effect.withSpan('import.download-source-asset')
  )
}
