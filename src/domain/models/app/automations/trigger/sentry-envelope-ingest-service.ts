/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Read a Sentry envelope and normalise its items into what a run receives.
 *
 * The envelope is NDJSON framed in BYTES, not lines: an item header with a
 * `length` is followed by exactly that many bytes, which may themselves hold
 * newlines and multi-byte characters (an attachment). Splitting on `\n` would
 * misframe every item after such a payload, so the reader walks byte offsets.
 *
 * Every item is decoded through the LAX ingest schemas of the wire model
 * (`@/domain/models/api/automations/ingest`): another SDK's shapes — a
 * `warning` level, a date-string timestamp, tags as pairs, `exception` as a
 * bare list — are accepted and normalised, unknown keys are ignored. Items
 * other than `event` and `transaction` are skipped without being decoded.
 *
 * Every run-starting kind may occur ONCE per envelope, as the Sentry protocol
 * itself requires of `event` and `transaction`. Each such item starts one run
 * per receiver while the sender's budget counts the request once, so without
 * this bound one envelope of a thousand events would start a thousand runs for
 * the price of one request. An envelope repeating a kind is malformed.
 */

import { Option, Schema } from 'effect'
import {
  sentryEnvelopeHeaderSchema,
  sentryEnvelopeItemHeaderSchema,
  sentryIngestEventSchema,
  sentryIngestTransactionSchema,
  type SentryEnvelopeHeader,
  type SentryIngestEvent,
  type SentryIngestTransaction,
  type TelemetryEventData,
  type TelemetryTransactionData,
} from '@/domain/models/api/automations/ingest'

/** One decoded item a run can start from. */
export type SentryEnvelopeItem =
  | { readonly kind: 'event'; readonly payload: SentryIngestEvent }
  | { readonly kind: 'transaction'; readonly payload: SentryIngestTransaction }

/** A parsed envelope: its header and the items that start runs, in order. */
export interface SentryEnvelope {
  readonly header: SentryEnvelopeHeader
  readonly items: readonly SentryEnvelopeItem[]
}

const NEWLINE = 0x0a

/** Upper bound on items read from one envelope; a client sends a handful. */
const MAX_ITEMS = 1000

const utf8 = new TextDecoder('utf-8', { fatal: true })

/** The offset of the next newline at or after `from`, or the end of the bytes. */
const lineEndOf = (bytes: Uint8Array, from: number): number => {
  const index = bytes.indexOf(NEWLINE, from)
  return index === -1 ? bytes.length : index
}

/** A decoded value, or `MALFORMED` when the bytes are not what was expected. */
const MALFORMED = Symbol('malformed')
type Decoded<A> = A | typeof MALFORMED

const parseJson = (bytes: Uint8Array): Decoded<unknown> => {
  try {
    return JSON.parse(utf8.decode(bytes)) as unknown
  } catch {
    return MALFORMED
  }
}

const decodeAs = <S extends Schema.Top & { readonly DecodingServices: never }>(
  schema: S,
  bytes: Uint8Array
): Decoded<S['Type']> => {
  const value = parseJson(bytes)
  if (value === MALFORMED) return MALFORMED
  return Option.getOrElse(
    Schema.decodeUnknownOption(schema)(value),
    (): typeof MALFORMED => MALFORMED
  )
}

/** The item a payload starts, `undefined` for a type that starts none. */
const decodeItem = (type: string, payload: Uint8Array): Decoded<SentryEnvelopeItem | undefined> => {
  if (type === 'event') {
    const event = decodeAs(sentryIngestEventSchema, payload)
    return event === MALFORMED ? MALFORMED : { kind: 'event', payload: event }
  }
  if (type === 'transaction') {
    const transaction = decodeAs(sentryIngestTransactionSchema, payload)
    return transaction === MALFORMED ? MALFORMED : { kind: 'transaction', payload: transaction }
  }
  return undefined
}

interface Framed {
  readonly type: string
  readonly payload: Uint8Array
  readonly next: number
}

/** Frame one item at `offset`: its header line, then its payload by length or by line. */
const frameItem = (bytes: Uint8Array, offset: number): Decoded<Framed> => {
  const headerEnd = lineEndOf(bytes, offset)
  const itemHeader = decodeAs(sentryEnvelopeItemHeaderSchema, bytes.subarray(offset, headerEnd))
  if (itemHeader === MALFORMED) return MALFORMED
  const start = Math.min(headerEnd + 1, bytes.length)
  const { length } = itemHeader
  if (length === undefined) {
    const end = lineEndOf(bytes, start)
    return { type: itemHeader.type, payload: bytes.subarray(start, end), next: end + 1 }
  }
  if (!Number.isInteger(length) || length < 0 || start + length > bytes.length) return MALFORMED
  // A length-delimited payload may be followed by its own newline.
  const end = start + length
  const next = bytes[end] === NEWLINE ? end + 1 : end
  return { type: itemHeader.type, payload: bytes.subarray(start, end), next }
}

/** The offset of the next non-blank line at or after `offset`. */
const skipBlankLines = (bytes: Uint8Array, offset: number): number =>
  offset < bytes.length && bytes[offset] === NEWLINE ? skipBlankLines(bytes, offset + 1) : offset

/** Whether `read` already holds an item of `kind`: a second one makes the envelope malformed. */
const repeatsKind = (read: readonly SentryEnvelopeItem[], kind: SentryEnvelopeItem['kind']) =>
  read.some((item) => item.kind === kind)

/** Read every item from `offset` to the end; `MALFORMED` when any is. */
const readItems = (
  bytes: Uint8Array,
  offset: number,
  read: readonly SentryEnvelopeItem[],
  count: number
): Decoded<readonly SentryEnvelopeItem[]> => {
  const at = skipBlankLines(bytes, offset)
  if (at >= bytes.length) return read
  if (count >= MAX_ITEMS) return MALFORMED
  const framed = frameItem(bytes, at)
  if (framed === MALFORMED) return MALFORMED
  const item = decodeItem(framed.type, framed.payload)
  if (item === MALFORMED) return MALFORMED
  if (item !== undefined && repeatsKind(read, item.kind)) return MALFORMED
  return readItems(bytes, framed.next, item === undefined ? read : [...read, item], count + 1)
}

/**
 * Parse an envelope's bytes. `undefined` when the bytes are not an envelope:
 * a header that is not a JSON object, an item header without a type, a length
 * running past the end, an event or transaction payload that is not JSON, a
 * second event or a second transaction, or more than {@link MAX_ITEMS} items.
 */
export const parseSentryEnvelope = (bytes: Uint8Array): SentryEnvelope | undefined => {
  const headerEnd = lineEndOf(bytes, 0)
  const header = decodeAs(sentryEnvelopeHeaderSchema, bytes.subarray(0, headerEnd))
  if (header === MALFORMED) return undefined
  const items = readItems(bytes, headerEnd + 1, [], 0)
  return items === MALFORMED ? undefined : { header, items }
}

// ─── Normalisation ──────────────────────────────────────────────────────────

/** Epoch seconds or a date string, as ISO 8601; `undefined` when unreadable. */
const isoOf = (timestamp: number | string | undefined): string | undefined => {
  if (timestamp === undefined) return undefined
  const date = typeof timestamp === 'number' ? new Date(timestamp * 1000) : new Date(timestamp)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

/** Epoch milliseconds of a timestamp, `undefined` when unreadable. */
const millisOf = (timestamp: number | string | undefined): number | undefined => {
  const iso = isoOf(timestamp)
  return iso === undefined ? undefined : Date.parse(iso)
}

/**
 * A frame's file, relative to the application's source root: a `file://`
 * prefix is dropped, a dependency path starts at `node_modules/`, and an
 * application path containing `/src/` starts at `src/`. Two hosts reporting
 * the same line then name it the same way, and no host path is kept.
 */
export const relativeFrameFilename = (filename: string): string => {
  const path = filename.startsWith('file://') ? filename.slice('file://'.length) : filename
  const dependency = path.indexOf('/node_modules/')
  if (dependency !== -1) return path.slice(dependency + 1)
  const source = path.indexOf('/src/')
  return source === -1 ? path : path.slice(source + 1)
}

/** Keep only the defined entries of an object. */
const defined = <T extends Readonly<Record<string, unknown>>>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T

/** Tags as an object of strings, whether sent as an object or as `[key, value]` pairs. */
const tagsOf = (
  tags: Readonly<Record<string, unknown>> | ReadonlyArray<ReadonlyArray<unknown>> | undefined
): Readonly<Record<string, string>> | undefined => {
  if (tags === undefined) return undefined
  const entries = Array.isArray(tags)
    ? tags.flatMap((pair: ReadonlyArray<unknown>) =>
        pair.length >= 2 && typeof pair[0] === 'string' ? [[pair[0], pair[1]] as const] : []
      )
    : Object.entries(tags)
  return Object.fromEntries(
    entries
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)])
  )
}

type IngestException = NonNullable<SentryIngestEvent['exception']>
type IngestExceptionValue = Extract<IngestException, ReadonlyArray<unknown>>[number]

const exceptionValuesOf = (exception: IngestException | undefined) => {
  if (exception === undefined) return []
  return Array.isArray(exception)
    ? (exception as ReadonlyArray<IngestExceptionValue>)
    : ((exception as { readonly values?: ReadonlyArray<IngestExceptionValue> }).values ?? [])
}

const normaliseException = (
  value: IngestExceptionValue
): TelemetryEventData['exception'][number] => ({
  type: value.type ?? 'Error',
  value: value.value ?? '',
  frames: (value.stacktrace?.frames ?? []).map((frame) => {
    const filename = frame.filename ?? frame.abs_path
    return defined({
      filename: filename === undefined ? undefined : relativeFrameFilename(filename),
      function: frame.function,
      lineno: frame.lineno,
      colno: frame.colno,
      in_app: frame.in_app,
    })
  }),
})

const messageOf = (event: SentryIngestEvent): string | undefined => {
  const { message, logentry } = event
  const fromMessage =
    typeof message === 'string' ? message : (message?.formatted ?? message?.message)
  return fromMessage ?? logentry?.formatted ?? logentry?.message
}

/** The crash-site application frame of the outermost exception, `<filename> in <function>`. */
const culpritOf = (
  outermost: TelemetryEventData['exception'][number] | undefined
): string | undefined => {
  const frames = outermost?.frames ?? []
  const crashSite = frames.findLast((frame) => frame.in_app === true) ?? frames.at(-1)
  if (crashSite?.filename === undefined) return undefined
  return crashSite.function === undefined
    ? crashSite.filename
    : `${crashSite.filename} in ${crashSite.function}`
}

const requestOf = (request: SentryIngestEvent['request']): TelemetryEventData['request'] =>
  request === undefined
    ? undefined
    : defined({ method: request.method, url: request.url, headers: tagsOf(request.headers) })

/**
 * What a run started by an `event` item receives as `trigger.data`. `nowMs` is
 * the time (epoch ms) the event is dated when the client sent no readable timestamp.
 */
export const normaliseSentryEvent = (
  event: SentryIngestEvent,
  nowMs: number
): TelemetryEventData => {
  const exception = exceptionValuesOf(event.exception).map(normaliseException)
  const outermost = exception.at(-1)
  const message = messageOf(event)
  const title =
    outermost === undefined
      ? (message ?? '<unlabeled event>')
      : `${outermost.type}: ${outermost.value}`
  return defined({
    kind: 'event' as const,
    event_id: event.event_id,
    timestamp: isoOf(event.timestamp) ?? new Date(nowMs).toISOString(),
    level: event.level ?? 'error',
    platform: event.platform,
    title,
    culprit: culpritOf(outermost),
    message,
    exception,
    release: event.release,
    environment: event.environment,
    server_name: event.server_name,
    request: requestOf(event.request),
    tags: tagsOf(event.tags),
  })
}

/** Milliseconds between two instants, to the microsecond. */
const durationOf = (startMs: number, endMs: number): number =>
  Math.round((endMs - startMs) * 1000) / 1000

type IngestSpan = NonNullable<SentryIngestTransaction['spans']>[number]

const normaliseSpan = (span: IngestSpan): TelemetryTransactionData['spans'][number] => {
  const startMs = millisOf(span.start_timestamp)
  const endMs = millisOf(span.timestamp)
  return defined({
    span_id: span.span_id,
    op: span.op,
    description: span.description,
    start: isoOf(span.start_timestamp),
    end: isoOf(span.timestamp),
    duration_ms:
      startMs === undefined || endMs === undefined ? undefined : durationOf(startMs, endMs),
    status: span.status,
    data: span.data,
  })
}

const httpStatusOf = (tags: Readonly<Record<string, string>> | undefined): number | undefined => {
  const raw = tags?.['http.status_code']
  if (raw === undefined) return undefined
  const status = Number(raw)
  return Number.isFinite(status) ? status : undefined
}

type IngestTrace = NonNullable<NonNullable<SentryIngestTransaction['contexts']>['trace']>

/** The root span's identity and outcome, from `contexts.trace`. */
const traceFieldsOf = (trace: IngestTrace | undefined) => ({
  op: trace?.op,
  status: trace?.status,
  trace_id: trace?.trace_id,
  span_id: trace?.span_id,
})

/**
 * What a run started by a `transaction` item receives as `trigger.data`. `nowMs`
 * (epoch ms) dates a transaction the client sent without readable timestamps.
 */
export const normaliseSentryTransaction = (
  transaction: SentryIngestTransaction,
  nowMs: number
): TelemetryTransactionData => {
  const endMs = millisOf(transaction.timestamp) ?? nowMs
  const startMs = millisOf(transaction.start_timestamp) ?? endMs
  const tags = tagsOf(transaction.tags)
  return defined({
    kind: 'transaction' as const,
    event_id: transaction.event_id,
    name: transaction.transaction ?? '<unlabeled transaction>',
    ...traceFieldsOf(transaction.contexts?.trace),
    http_status: httpStatusOf(tags),
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
    duration_ms: durationOf(startMs, endMs),
    db_queries: transaction.measurements?.['db.queries']?.value,
    spans: (transaction.spans ?? []).map(normaliseSpan),
    release: transaction.release,
    environment: transaction.environment,
    server_name: transaction.server_name,
    tags,
  })
}

/** The `trigger.data` of one item, whatever its kind. */
export const normaliseSentryItem = (
  item: SentryEnvelopeItem,
  nowMs: number
): TelemetryEventData | TelemetryTransactionData =>
  item.kind === 'event'
    ? normaliseSentryEvent(item.payload, nowMs)
    : normaliseSentryTransaction(item.payload, nowMs)
