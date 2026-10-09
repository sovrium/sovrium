/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { StorageService, UNATTRIBUTED_BUCKET } from '@/application/ports/services/storage-service'
import { sweepAgedTempFiles } from '@/application/use-cases/storage/sweep-temp-storage'
import { FILE_SOURCE_FETCH_TIMEOUT_MS } from '@/domain/kernel/time/timeouts'
import { TEMP_STORAGE_PREFIX } from '@/domain/models/app/automations/actions/file/shared'
import { guardedFetch, type GuardedFetchRefusalReason } from '@/infrastructure/egress/guarded-fetch'
import type { UploadTarget } from '@/application/ports/services/storage-service'

/**
 * Shared helpers for the `file:*` action handlers — MIME inference,
 * temp-key minting and source resolution (`data:` URI / HTTP URL / storage
 * key). The RFC 4180 CSV codec is `file-csv.ts`.
 */

// ---------------------------------------------------------------------------
// MIME helpers
// ---------------------------------------------------------------------------

const MIME_BY_EXT: Readonly<Record<string, string>> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  csv: 'text/csv',
  txt: 'text/plain',
  json: 'application/json',
  html: 'text/html',
  htm: 'text/html',
  xml: 'application/xml',
  yaml: 'application/yaml',
  yml: 'application/yaml',
}

export const mimeByExt = (key: string | undefined): string | undefined => {
  if (!key) return undefined
  const dot = key.lastIndexOf('.')
  if (dot === -1) return undefined
  return MIME_BY_EXT[key.slice(dot + 1).toLowerCase()]
}

/** The extension (with its dot) a MIME type is stored under, or `''` for one this table does not name. */
export const extByMime = (mime: string): string => {
  const ext = Object.entries(MIME_BY_EXT).find(([, known]) => known === mime)?.[0]
  return ext === undefined ? '' : `.${ext}`
}

export const extOf = (key: string | undefined): string => {
  if (!key) return ''
  const dot = key.lastIndexOf('.')
  if (dot === -1) return ''
  const segment = key.slice(dot)
  return /^\.[A-Za-z0-9]+$/.test(segment) ? segment : ''
}

export const tempKey = (suffix: string): string =>
  `${TEMP_STORAGE_PREFIX}${globalThis.crypto.randomUUID()}${suffix}`

/** The bytes a `file:*` action writes, with the MIME type they are stored under. */
interface ArtifactFile {
  readonly bytes: Uint8Array
  readonly contentType: string
}

/** The write + temp sweep both exported write paths share; each opens its own span. */
const writeArtifact = (
  storage: Effect.Success<typeof StorageService>,
  key: string,
  file: ArtifactFile,
  target: UploadTarget
): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    const wrote = yield* Effect.result(storage.upload(key, file.bytes, file.contentType, target))
    if (wrote._tag === 'Failure') return false
    if (key.startsWith(TEMP_STORAGE_PREFIX)) {
      yield* sweepAgedTempFiles(storage, { preserve: key })
    }
    return true
  })

/**
 * Store a `file:*` action's output bytes, returning `false` when the write
 * failed so callers can shape their own `error` outcome. `target` is the
 * binding the write records (and the automation behind it, for a document
 * output); {@link uploadArtifact} records none.
 *
 * This is the single write path for every file action, and therefore the one
 * place temp-storage reclamation hooks in: when the artifact lands under
 * `TEMP_STORAGE_PREFIX`, aged temp files are swept as part of the same step.
 * That is the whole trigger model — there is no scheduler — so any future
 * temp write must go through here to keep `tmp/automations/` bounded.
 */
export const uploadArtifactTo = (
  storage: Effect.Success<typeof StorageService>,
  key: string,
  file: ArtifactFile,
  target: UploadTarget
): Effect.Effect<boolean, never> =>
  writeArtifact(storage, key, file, target).pipe(Effect.withSpan('automations.upload-artifact'))

/** {@link uploadArtifactTo} with no bucket: the write path of every artifact a step makes. */
export const uploadArtifact = (
  storage: Effect.Success<typeof StorageService>,
  key: string,
  bytes: Uint8Array,
  contentType: string
): Effect.Effect<boolean, never> =>
  writeArtifact(storage, key, { bytes, contentType }, UNATTRIBUTED_BUCKET).pipe(
    Effect.withSpan('automations.upload-artifact')
  )

// ---------------------------------------------------------------------------
// Source resolution: data: URI | http(s) URL | storage key
// ---------------------------------------------------------------------------

export interface ResolvedSource {
  readonly bytes: Uint8Array
  /** MIME type detected from the source itself (data URI / HTTP header). */
  readonly detectedMime?: string
}

/**
 * Tagged failure raised when an `http(s)://` `source`, or a redirect it
 * answers with, is rejected by the outbound-URL SSRF guard before that address
 * is requested (loopback / link-local / RFC1918 / unsupported-protocol / a
 * chain longer than five redirects). The tag lets `handleFileUpload` `Effect.either` this
 * specific failure and map it to an explicit `error` outcome — rather than the
 * old behaviour where a network failure degraded to empty bytes and silently
 * stored a benign-looking empty file. `reason` mirrors the `http.ts` /
 * `webhook.ts` siblings' `invalid_outbound_url_${reason}` message shape.
 */
export class OutboundUrlBlockedError extends Data.TaggedError('OutboundUrlBlockedError')<{
  readonly reason: GuardedFetchRefusalReason
}> {}

/** A `data:` URI: a media type, an optional `;base64`, a comma, then the payload. */
const DATA_URI = /^data:([^;,]*)(;base64)?,(.*)$/s

const parseDataUri = (source: string): ResolvedSource | undefined => {
  const match = DATA_URI.exec(source)
  if (!match) return undefined
  const [, mime, base64Flag, payload] = match
  const bytes = base64Flag
    ? new Uint8Array(Buffer.from(payload ?? '', 'base64'))
    : new TextEncoder().encode(decodeURIComponent(payload ?? ''))
  return mime ? { bytes, detectedMime: mime } : { bytes }
}

/** The largest source read, in bytes (100 MiB) — the default upload cap. */
export const FILE_SOURCE_MAX_BYTES = 104_857_600

const NO_BYTES: ResolvedSource = { bytes: new Uint8Array(0) }

/**
 * Fetch a remote source over HTTP(S) through `guardedFetch`, which checks the
 * URL and every redirect hop against the SSRF guard and reads at most
 * {@link FILE_SOURCE_MAX_BYTES}. A refusal comes back as `{ blocked }` so it can
 * never degrade to empty bytes. Network failures, a non-2xx and a source past
 * the cap are swallowed into an empty result (the handler then surfaces a
 * generic `error` outcome), so the promise never rejects.
 *
 * The call is bounded by `FILE_SOURCE_FETCH_TIMEOUT_MS`, for the headers of
 * each hop and then for the body: a permitted-but-unresponsive host cannot hold
 * this automation run's fiber open.
 */
const fetchRemote = async (
  source: string,
  headers: Readonly<Record<string, string>>
): Promise<ResolvedSource | { readonly blocked: GuardedFetchRefusalReason }> => {
  try {
    // The declared headers carry the service's key: dropped on a hop to another origin.
    const sent = await guardedFetch(
      source,
      { headers },
      {
        timeoutMs: FILE_SOURCE_FETCH_TIMEOUT_MS,
        maxBodyBytes: FILE_SOURCE_MAX_BYTES,
        credentialHeaders: Object.keys(headers),
      }
    )
    if (!sent.ok) return { blocked: sent.reason }
    const { response } = sent
    if (!response.ok || response.truncated) return NO_BYTES
    const headerMime = response.headers.get('content-type')?.split(';')[0]?.trim()
    return headerMime
      ? { bytes: response.body, detectedMime: headerMime }
      : { bytes: response.body }
  } catch {
    return NO_BYTES
  }
}

/**
 * Resolve an `http(s)://` source: reject private/loopback/link-local targets —
 * the source and every redirect it answers with — via the always-on outbound-URL
 * SSRF guard (relaxed only under the explicit `SOVRIUM_ALLOW_PRIVATE_OUTBOUND=1`
 * opt-out). A block surfaces as `OutboundUrlBlockedError` on the effect's error
 * channel — never as empty bytes — so the upload handler can map it to an
 * explicit `error` outcome instead of silently storing an empty file.
 */
const fetchSource = (
  source: string,
  headers: Readonly<Record<string, string>>
): Effect.Effect<ResolvedSource, OutboundUrlBlockedError, never> =>
  // effect-promise: total -- `fetchRemote` wraps `guardedFetch` in a try/catch returning zero bytes, and a non-2xx or oversized source returns zero bytes too. The SSRF refusal it returns IS the typed failure this function reports; a network miss is deliberately not one.
  Effect.promise(() => fetchRemote(source, headers)).pipe(
    Effect.filterOrFail(
      (fetched): fetched is ResolvedSource => !('blocked' in fetched),
      // The predicate admitted every `ResolvedSource`, so `refused` is the refusal.
      (refused) =>
        new OutboundUrlBlockedError({
          reason: 'blocked' in refused ? refused.blocked : 'invalid-url',
        })
    )
  )

/**
 * True when `source` carries its own bytes (a `data:` URI) or is fetchable over
 * the network — i.e. when `resolveSource` will NOT consult storage.
 *
 * Exported so a caller that wants storage's own "not found" diagnostics for a
 * plain key can branch BEFORE calling `resolveSource`, which deliberately
 * degrades a missing key to empty bytes.
 */
export const isSelfContainedSource = (source: string): boolean =>
  // The same pattern `parseDataUri` reads: a malformed `data:` text (no comma)
  // falls through to storage there, so it is a stored key here too.
  DATA_URI.test(source) || /^https?:\/\//.test(source)

export const resolveSource = (
  source: string,
  headers: Readonly<Record<string, string>> = {}
): Effect.Effect<ResolvedSource, OutboundUrlBlockedError, StorageService> => {
  const dataUri = parseDataUri(source)
  if (dataUri) return Effect.succeed(dataUri)
  // The inline data URI is parsed above and opens no span — there is no
  // resource to wait on. The two that fetch bytes do.
  if (/^https?:\/\//.test(source)) {
    return fetchSource(source, headers).pipe(Effect.withSpan('automations.resolve-source'))
  }
  return Effect.gen(function* () {
    const storage = yield* StorageService
    const downloaded = yield* Effect.result(storage.download(source, UNATTRIBUTED_BUCKET))
    return downloaded._tag === 'Failure'
      ? { bytes: new Uint8Array(0) }
      : { bytes: downloaded.success }
  }).pipe(Effect.withSpan('automations.resolve-source'))
}
