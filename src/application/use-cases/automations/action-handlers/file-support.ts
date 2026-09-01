/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { parse } from 'csv-parse/sync'
import { Data, Effect } from 'effect'
import { StorageService, UNATTRIBUTED_BUCKET } from '@/application/ports/services/storage-service'
import { sweepAgedTempFiles } from '@/application/use-cases/storage/sweep-temp-storage'
import { TEMP_STORAGE_PREFIX } from '@/domain/models/app/automations/actions/file/shared'
import {
  validateOutboundUrl,
  type OutboundUrlReason,
} from '@/infrastructure/utils/validate-outbound-url'

/**
 * Shared helpers for the `file:*` action handlers — MIME inference,
 * temp-key minting, source resolution (`data:` URI / HTTP URL / storage
 * key), and the RFC 4180 CSV codec.
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

export const extOf = (key: string | undefined): string => {
  if (!key) return ''
  const dot = key.lastIndexOf('.')
  if (dot === -1) return ''
  const segment = key.slice(dot)
  return /^\.[A-Za-z0-9]+$/.test(segment) ? segment : ''
}

export const tempKey = (suffix: string): string =>
  `${TEMP_STORAGE_PREFIX}${globalThis.crypto.randomUUID()}${suffix}`

/**
 * Store a `file:*` action's output bytes, returning `false` when the write
 * failed so callers can shape their own `error` outcome.
 *
 * This is the single write path for every file action, and therefore the one
 * place temp-storage reclamation hooks in: when the artifact lands under
 * `TEMP_STORAGE_PREFIX`, aged temp files are swept as part of the same step.
 * That is the whole trigger model — there is no scheduler — so any future
 * temp write must go through here to keep `tmp/automations/` bounded.
 */
export const uploadArtifact = (
  storage: Effect.Success<typeof StorageService>,
  key: string,
  bytes: Uint8Array,
  contentType: string
): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    const wrote = yield* Effect.result(storage.upload(key, bytes, contentType, UNATTRIBUTED_BUCKET))
    if (wrote._tag === 'Failure') return false
    if (key.startsWith(TEMP_STORAGE_PREFIX)) {
      yield* sweepAgedTempFiles(storage, { preserve: key })
    }
    return true
  })

// ---------------------------------------------------------------------------
// Source resolution: data: URI | http(s) URL | storage key
// ---------------------------------------------------------------------------

export interface ResolvedSource {
  readonly bytes: Uint8Array
  /** MIME type detected from the source itself (data URI / HTTP header). */
  readonly detectedMime?: string
}

/**
 * Tagged failure raised when an `http(s)://` `source` is rejected by the
 * outbound-URL SSRF guard BEFORE any fetch (loopback / link-local / RFC1918 /
 * unsupported-protocol). The tag lets `handleFileUpload` `Effect.either` this
 * specific failure and map it to an explicit `error` outcome — rather than the
 * old behaviour where a network failure degraded to empty bytes and silently
 * stored a benign-looking empty file. `reason` mirrors the `http.ts` /
 * `webhook.ts` siblings' `invalid_outbound_url_${reason}` message shape.
 */
export class OutboundUrlBlockedError extends Data.TaggedError('OutboundUrlBlockedError')<{
  readonly reason: OutboundUrlReason
}> {}

const parseDataUri = (source: string): ResolvedSource | undefined => {
  const match = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(source)
  if (!match) return undefined
  const [, mime, base64Flag, payload] = match
  const bytes = base64Flag
    ? new Uint8Array(Buffer.from(payload ?? '', 'base64'))
    : new TextEncoder().encode(decodeURIComponent(payload ?? ''))
  return mime ? { bytes, detectedMime: mime } : { bytes }
}

/**
 * Fetch an ALREADY-VALIDATED remote source over HTTP(S). The SSRF guard runs
 * in `fetchSource` before this is reached. Network/decode failures of a
 * permitted target are swallowed into an empty result (the handler then
 * surfaces a generic `error` outcome), so the promise never rejects. SSRF
 * blocks are NOT handled here — they short-circuit in `fetchSource` with a
 * tagged `OutboundUrlBlockedError` so they can never degrade to empty bytes.
 */
const fetchRemote = async (source: string): Promise<ResolvedSource> => {
  try {
    const response = await fetch(source)
    if (!response.ok) return { bytes: new Uint8Array(0) }
    const buf = await response.arrayBuffer()
    const headerMime = response.headers.get('content-type')?.split(';')[0]?.trim()
    return headerMime
      ? { bytes: new Uint8Array(buf), detectedMime: headerMime }
      : { bytes: new Uint8Array(buf) }
  } catch {
    return { bytes: new Uint8Array(0) }
  }
}

/**
 * Resolve an `http(s)://` source: reject private/loopback/link-local targets
 * via the always-on outbound-URL SSRF guard (relaxed only under the explicit
 * `SOVRIUM_ALLOW_PRIVATE_OUTBOUND=1` opt-out) BEFORE fetching, then fetch the
 * permitted URL. A block surfaces as `OutboundUrlBlockedError` on the effect's
 * error channel — never as empty bytes — so the upload handler can map it to an
 * explicit `error` outcome instead of silently storing an empty file.
 */
const fetchSource = (
  source: string
): Effect.Effect<ResolvedSource, OutboundUrlBlockedError, never> => {
  const validation = validateOutboundUrl(source)
  if (!validation.ok) {
    return Effect.fail(new OutboundUrlBlockedError({ reason: validation.issue.reason }))
  }
  return Effect.promise(() => fetchRemote(source))
}

/**
 * True when `source` carries its own bytes (a `data:` URI) or is fetchable over
 * the network — i.e. when `resolveSource` will NOT consult storage.
 *
 * Exported so a caller that wants storage's own "not found" diagnostics for a
 * plain key can branch BEFORE calling `resolveSource`, which deliberately
 * degrades a missing key to empty bytes.
 */
export const isSelfContainedSource = (source: string): boolean =>
  source.startsWith('data:') || /^https?:\/\//.test(source)

export const resolveSource = (
  source: string
): Effect.Effect<ResolvedSource, OutboundUrlBlockedError, StorageService> => {
  const dataUri = parseDataUri(source)
  if (dataUri) return Effect.succeed(dataUri)
  if (/^https?:\/\//.test(source)) return fetchSource(source)
  return Effect.gen(function* () {
    const storage = yield* StorageService
    const downloaded = yield* Effect.result(storage.download(source, UNATTRIBUTED_BUCKET))
    return downloaded._tag === 'Failure'
      ? { bytes: new Uint8Array(0) }
      : { bytes: downloaded.success }
  })
}

// ---------------------------------------------------------------------------
// CSV codec — RFC 4180 via `csv-parse`, plus the three decisions a parser
// cannot make for you: which byte encoding the document is in, how many leading
// lines to drop, and which delimiter it uses.
// ---------------------------------------------------------------------------

/** The delimiters `FileParseCsvActionSchema` accepts, in tie-break order. */
const DELIMITER_CANDIDATES: readonly string[] = [',', ';', '\t', '|']

/**
 * Quote a value for CSV output.
 *
 * The quoting decision is driven by the delimiter ACTUALLY in use, not by a
 * fixed character class: a value containing the active delimiter MUST be quoted
 * or it silently splits into two fields on re-read. The rest of the set is RFC
 * 4180's mandatory minimum (`"`, CR, LF) — nothing else is quoted, so a `;`
 * inside a comma-delimited file stays bare, which is legal and lossless.
 */
export const csvCell = (value: unknown, delimiter: string = ','): string => {
  const str = value === undefined || value === null ? '' : String(value)
  const mustQuote =
    str.includes('"') || str.includes('\n') || str.includes('\r') || str.includes(delimiter)
  return mustQuote ? `"${str.replace(/"/g, '""')}"` : str
}

/**
 * Decode CSV bytes as UTF-8, falling back to windows-1252 when the document is
 * not valid UTF-8 — what Excel FR still emits by default.
 *
 * This is an automatic FALLBACK rather than a declared `encoding` property on
 * purpose. An accented windows-1252 byte (0x80-0xFF) is never a valid
 * standalone UTF-8 sequence, so a fatal UTF-8 decode separates the two
 * encodings on its own: valid UTF-8 can never be mistaken for Latin-1, and the
 * operator never has to declare which one they were handed.
 */
export const decodeCsvBytes = (bytes: Uint8Array): string => {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

/** First line with non-whitespace content, or `undefined` for a blank document. */
const firstNonBlankLine = (text: string): string | undefined => {
  const nl = text.indexOf('\n')
  const line = (nl === -1 ? text : text.slice(0, nl)).replace(/\r$/, '')
  if (line.trim() !== '') return line
  return nl === -1 ? undefined : firstNonBlankLine(text.slice(nl + 1))
}

/**
 * Drop the first `count` non-blank PHYSICAL lines — that, and nothing else, is
 * what `skipRows` means. Header handling stays orthogonal (see `csvRows`), so
 * asking to skip a preamble can never silently change the output shape.
 *
 * The remainder is returned verbatim rather than re-joined, so a quoted field
 * further down keeps its exact bytes, CRLF included.
 */
export const dropLeadingLines = (text: string, count: number): string => {
  if (count <= 0) return text
  const nl = text.indexOf('\n')
  if (nl === -1) return ''
  const remaining = text.slice(0, nl).trim() === '' ? count : count - 1
  return dropLeadingLines(text.slice(nl + 1), remaining)
}

interface CountState {
  readonly inQuotes: boolean
  readonly count: number
}

/** Occurrences of `target` in `line` that sit outside any quoted field. */
const countOutsideQuotes = (line: string, target: string): number =>
  Array.from(line).reduce<CountState>(
    (state, ch) => {
      if (ch === '"') return { inQuotes: !state.inQuotes, count: state.count }
      if (!state.inQuotes && ch === target) return { ...state, count: state.count + 1 }
      return state
    },
    { inQuotes: false, count: 0 }
  ).count

/**
 * Detect the field delimiter by COUNT, not by first match.
 *
 * Counting is the whole point: a `;`-delimited French export whose header
 * legitimately contains one comma (`ville, pays`) must still read as
 * semicolon-delimited. First-match-wins collapsed it into a single column.
 * Occurrences inside quotes do not count; ties fall back to comma.
 *
 * ORDERING CONTRACT: `text` must ALREADY have had `skipRows` applied. A
 * preamble line such as `# Export CRM` contains none of the four candidates, so
 * sampling the raw document would fall through to the comma default and
 * mis-parse the real header underneath it. Taking post-skip text is therefore
 * deliberate, not an accident of call order — hence this takes the DOCUMENT and
 * picks its own sample line rather than trusting the caller to pass the right
 * one.
 */
export const autoDelimiter = (text: string): string => {
  const sample = firstNonBlankLine(text)
  if (sample === undefined) return ','
  const best = DELIMITER_CANDIDATES.map((d) => ({ d, n: countOutsideQuotes(sample, d) })).reduce(
    (a, b) => (b.n > a.n ? b : a)
  )
  return best.n > 0 ? best.d : ','
}

/**
 * Parse a whole CSV DOCUMENT into raw cell rows, or `undefined` when it is
 * malformed beyond recovery (an unterminated quote is the only case
 * `csv-parse` still refuses under `relax_quotes`).
 *
 * Document-level parsing is the point: a quoted field may contain the record
 * separator itself, so splitting on newlines BEFORE parsing — as the previous
 * hand-rolled codec did — tears a multi-line notes column into malformed rows.
 *
 * `trim: true` implements RFC 4180 §2.5 as the spec intends: whitespace is
 * trimmed around UNQUOTED fields only, leaving quoted content verbatim, so
 * `"  007  "` survives intact while `  008  ` is still tidied to `008`.
 */
export const parseCsvDocument = (
  text: string,
  delimiter: string
): ReadonlyArray<ReadonlyArray<string>> | undefined => {
  try {
    return parse(text, {
      delimiter,
      bom: true,
      trim: true,
      skip_empty_lines: true,
      relax_column_count: true,
      relax_quotes: true,
    }) as ReadonlyArray<ReadonlyArray<string>>
  } catch {
    return undefined
  }
}
