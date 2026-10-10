/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

/**
 * The Sentry envelope wire model, shared by the two readers of the same bytes.
 *
 * - The EMITTER (`src/infrastructure/telemetry/sentry-envelope.ts`) writes the
 *   strict payloads at the bottom of this file: Sovrium's own events always
 *   say `level: 'error'`, `platform: 'javascript'`, and so on.
 * - The RECEIVER (a webhook trigger declaring `protocol: 'sentry'`) decodes
 *   the LAX schemas below: another Sentry-compatible SDK sends `warning`
 *   levels, a `python` platform, `exception` as a bare list, a date string as
 *   its timestamp, and keys nobody here has heard of. Every field is
 *   optional and widened, and an unknown key is ignored, never refused — a
 *   receiver that rejected what a real SDK sends would lose the very errors
 *   it exists to collect.
 *
 * `sentry-envelope.test.ts` encodes the strict payloads and decodes them with
 * the lax schemas, so the emitter can never write what the receiver cannot
 * read. Field names are Sentry's (snake_case), not ours.
 *
 * The NORMALISED shapes — what an automation run receives as `trigger.data`
 * — are at the end: {@link TelemetryEventDataSchema} and
 * {@link TelemetryTransactionDataSchema}.
 */

// ─── Envelope framing ─────────────────────────────────────────────────────────

/** First line of an envelope. Every key is optional; `dsn` is never trusted for auth. */
export const sentryEnvelopeHeaderSchema = Schema.Struct({
  event_id: optionalField(
    Schema.String.annotate({ description: 'Id of the event the envelope carries' })
  ),
  sent_at: optionalField(
    Schema.String.annotate({ description: 'RFC 3339 time the client sent the envelope' })
  ),
  dsn: optionalField(
    Schema.String.annotate({
      description: 'DSN the client was configured with; informational only, never an authority',
    })
  ),
}).annotate({ description: 'Sentry envelope header (the first NDJSON line)' })

export type SentryEnvelopeHeader = Schema.Schema.Type<typeof sentryEnvelopeHeaderSchema>

/**
 * The header line before each item. When `length` is present the payload is
 * exactly that many BYTES and may itself contain newlines (an attachment);
 * when absent the payload runs to the next newline.
 */
export const sentryEnvelopeItemHeaderSchema = Schema.Struct({
  type: Schema.String.annotate({
    description: "Item type: 'event' and 'transaction' are read; any other type is skipped",
  }),
  length: optionalField(
    Schema.Finite.annotate({ description: 'Payload length in bytes, when the client sent one' })
  ),
  content_type: optionalField(
    Schema.String.annotate({ description: 'Payload media type, when the client sent one' })
  ),
  filename: optionalField(
    Schema.String.annotate({ description: 'Attachment file name, when the item is an attachment' })
  ),
}).annotate({ description: 'Sentry envelope item header' })

export type SentryEnvelopeItemHeader = Schema.Schema.Type<typeof sentryEnvelopeItemHeaderSchema>

// ─── Lax ingest payloads (what a receiver accepts) ───────────────────────────

/** Epoch seconds (Sovrium, most SDKs) or an RFC 3339 string (some SDKs). */
const sentryTimestampSchema = Schema.Union([Schema.Finite, Schema.String]).annotate({
  description: 'Epoch seconds, or an RFC 3339 date string',
})

/** Any JSON object, read loosely. */
const looseObjectSchema = Schema.Record(Schema.String, Schema.Unknown)

export const sentryIngestStackFrameSchema = Schema.Struct({
  filename: optionalField(Schema.String.annotate({ description: 'Source file of the frame' })),
  abs_path: optionalField(
    Schema.String.annotate({ description: 'Absolute path of the source file' })
  ),
  module: optionalField(Schema.String.annotate({ description: 'Module of the frame' })),
  function: optionalField(Schema.String.annotate({ description: 'Function of the frame' })),
  lineno: optionalField(Schema.Finite.annotate({ description: 'Line number' })),
  colno: optionalField(Schema.Finite.annotate({ description: 'Column number' })),
  in_app: optionalField(
    Schema.Boolean.annotate({ description: 'Whether the frame is application code' })
  ),
}).annotate({ description: 'One stack frame, as any Sentry-compatible client sends it' })

export const sentryIngestExceptionValueSchema = Schema.Struct({
  type: optionalField(Schema.String.annotate({ description: 'Exception type, e.g. ValueError' })),
  value: optionalField(Schema.String.annotate({ description: 'Exception message' })),
  module: optionalField(Schema.String.annotate({ description: 'Module defining the type' })),
  stacktrace: optionalField(
    Schema.Struct({
      frames: optionalField(Schema.Array(sentryIngestStackFrameSchema)),
    }).annotate({ description: 'Frames, oldest first (the crash site last)' })
  ),
}).annotate({ description: 'One link of an exception chain' })

/** `{ values: [...] }` as the protocol documents, or the bare list older SDKs send. */
const sentryIngestExceptionSchema = Schema.Union([
  Schema.Struct({ values: optionalField(Schema.Array(sentryIngestExceptionValueSchema)) }),
  Schema.Array(sentryIngestExceptionValueSchema),
]).annotate({ description: 'The exception chain, oldest first' })

/** A tag map, or the list of `[key, value]` pairs some SDKs send. */
const sentryTagsSchema = Schema.Union([
  looseObjectSchema,
  Schema.Array(Schema.Array(Schema.Unknown)),
]).annotate({ description: 'Tags, as an object or a list of [key, value] pairs' })

export const sentryIngestRequestSchema = Schema.Struct({
  method: optionalField(Schema.String.annotate({ description: 'HTTP method' })),
  url: optionalField(Schema.String.annotate({ description: 'Request URL' })),
  headers: optionalField(
    Schema.Union([looseObjectSchema, Schema.Array(Schema.Array(Schema.Unknown))]).annotate({
      description: 'Request headers, as an object or a list of pairs',
    })
  ),
}).annotate({ description: 'The HTTP request the event happened in' })

export const sentryIngestEventSchema = Schema.Struct({
  event_id: optionalField(Schema.String.annotate({ description: '32-hex event id' })),
  timestamp: optionalField(sentryTimestampSchema),
  platform: optionalField(Schema.String.annotate({ description: 'Client platform' })),
  level: optionalField(
    Schema.String.annotate({ description: 'fatal, error, warning, info or debug' })
  ),
  logger: optionalField(Schema.String.annotate({ description: 'Logger name' })),
  transaction: optionalField(
    Schema.String.annotate({ description: 'Transaction the event happened in' })
  ),
  release: optionalField(Schema.String.annotate({ description: 'Release identifier' })),
  environment: optionalField(Schema.String.annotate({ description: 'Environment name' })),
  server_name: optionalField(Schema.String.annotate({ description: 'Host that sent it' })),
  message: optionalField(
    Schema.Union([
      Schema.String,
      Schema.Struct({
        formatted: optionalField(Schema.String),
        message: optionalField(Schema.String),
      }),
    ]).annotate({ description: 'A message event, as a string or an object' })
  ),
  logentry: optionalField(
    Schema.Struct({
      formatted: optionalField(Schema.String),
      message: optionalField(Schema.String),
    }).annotate({ description: 'A message event, as newer SDKs send it' })
  ),
  exception: optionalField(sentryIngestExceptionSchema),
  request: optionalField(sentryIngestRequestSchema),
  tags: optionalField(sentryTagsSchema),
  contexts: optionalField(looseObjectSchema.annotate({ description: 'Client contexts' })),
}).annotate({ description: "An 'event' item payload, read leniently" })

export type SentryIngestEvent = Schema.Schema.Type<typeof sentryIngestEventSchema>

export const sentryIngestSpanSchema = Schema.Struct({
  span_id: optionalField(Schema.String.annotate({ description: '16-hex span id' })),
  parent_span_id: optionalField(Schema.String.annotate({ description: 'Parent span id' })),
  trace_id: optionalField(Schema.String.annotate({ description: '32-hex trace id' })),
  op: optionalField(Schema.String.annotate({ description: 'Span operation, e.g. db.query' })),
  description: optionalField(Schema.String.annotate({ description: 'Span description' })),
  start_timestamp: optionalField(sentryTimestampSchema),
  timestamp: optionalField(sentryTimestampSchema),
  status: optionalField(Schema.String.annotate({ description: 'Span status' })),
  data: optionalField(looseObjectSchema.annotate({ description: 'Free-form span data' })),
}).annotate({ description: 'One span of a transaction, read leniently' })

export const sentryIngestTransactionSchema = Schema.Struct({
  event_id: optionalField(Schema.String.annotate({ description: '32-hex event id' })),
  type: optionalField(Schema.String.annotate({ description: "Always 'transaction'" })),
  transaction: optionalField(
    Schema.String.annotate({ description: 'Transaction name, e.g. GET /api/tables/:id/records' })
  ),
  start_timestamp: optionalField(sentryTimestampSchema),
  timestamp: optionalField(sentryTimestampSchema),
  platform: optionalField(Schema.String.annotate({ description: 'Client platform' })),
  release: optionalField(Schema.String.annotate({ description: 'Release identifier' })),
  environment: optionalField(Schema.String.annotate({ description: 'Environment name' })),
  server_name: optionalField(Schema.String.annotate({ description: 'Host that sent it' })),
  contexts: optionalField(
    Schema.Struct({
      trace: optionalField(
        Schema.Struct({
          trace_id: optionalField(Schema.String),
          span_id: optionalField(Schema.String),
          op: optionalField(Schema.String),
          status: optionalField(Schema.String),
        }).annotate({ description: 'The root span of the transaction' })
      ),
    }).annotate({ description: 'Client contexts; only the trace context is read' })
  ),
  spans: optionalField(Schema.Array(sentryIngestSpanSchema)),
  tags: optionalField(sentryTagsSchema),
  measurements: optionalField(
    Schema.Record(
      Schema.String,
      Schema.Struct({ value: Schema.Finite, unit: optionalField(Schema.String) })
    ).annotate({ description: 'Numeric measurements, e.g. db.queries' })
  ),
}).annotate({ description: "A 'transaction' item payload, read leniently" })

export type SentryIngestTransaction = Schema.Schema.Type<typeof sentryIngestTransactionSchema>

// ─── Strict payloads (what Sovrium's own emitter writes) ─────────────────────

/** A parsed V8 stack frame in Sentry's `stacktrace.frames[]` shape. */
export const sentryStackFrameSchema = Schema.Struct({
  filename: Schema.String,
  function: optionalField(Schema.String),
  lineno: optionalField(Schema.Finite),
  colno: optionalField(Schema.Finite),
  /** `true` for application frames (outside `node_modules`). */
  in_app: Schema.Boolean,
})

export type SentryStackFrame = Schema.Schema.Type<typeof sentryStackFrameSchema>

/** One link of an `exception.values[]` chain: a single `Error` of a `cause` chain. */
export const sentryExceptionValueSchema = Schema.Struct({
  type: Schema.String,
  value: Schema.String,
  stacktrace: Schema.Struct({ frames: Schema.Array(sentryStackFrameSchema) }),
})

export type SentryExceptionValue = Schema.Schema.Type<typeof sentryExceptionValueSchema>

/** A Sentry error event payload (the subset Sovrium emits). */
export const sentryEventSchema = Schema.Struct({
  event_id: Schema.String,
  timestamp: Schema.Finite,
  platform: Schema.Literal('javascript'),
  level: Schema.Literal('error'),
  release: Schema.String,
  environment: Schema.String,
  server_name: Schema.String,
  exception: Schema.Struct({ values: Schema.Array(sentryExceptionValueSchema) }),
  request: optionalField(
    Schema.Struct({
      method: Schema.String,
      url: Schema.String,
      headers: Schema.Record(Schema.String, Schema.String),
    })
  ),
})

export type SentryEvent = Schema.Schema.Type<typeof sentryEventSchema>

/**
 * ONE entry of a transaction's `spans[]`. Flat: parentage travels inside
 * `data` (`trace_id`, `parent_span_id`), because a lax receiver that declares
 * neither key at the top level silently drops them there.
 */
export const sentrySpanSchema = Schema.Struct({
  span_id: Schema.String,
  op: Schema.String,
  description: Schema.String,
  start_timestamp: Schema.Finite,
  timestamp: Schema.Finite,
  status: Schema.String,
  data: Schema.Record(Schema.String, Schema.String),
})

export type SentrySpan = Schema.Schema.Type<typeof sentrySpanSchema>

/** A Sentry performance transaction payload (the subset Sovrium emits). */
export const sentryTransactionSchema = Schema.Struct({
  event_id: Schema.String,
  type: Schema.Literal('transaction'),
  transaction: Schema.String,
  start_timestamp: Schema.Finite,
  timestamp: Schema.Finite,
  platform: Schema.Literal('javascript'),
  release: Schema.String,
  environment: Schema.String,
  contexts: Schema.Struct({
    trace: Schema.Struct({
      trace_id: Schema.String,
      span_id: Schema.String,
      op: Schema.Literal('http.server'),
      status: Schema.String,
    }),
  }),
  /** Flat list of the CHILD spans the request opened; the root is the transaction. */
  spans: Schema.Array(sentrySpanSchema),
  /** Filterable key/value pairs. */
  tags: Schema.Record(Schema.String, Schema.String),
  /** Numeric per-transaction measurements. */
  measurements: Schema.Record(
    Schema.String,
    Schema.Struct({ value: Schema.Finite, unit: Schema.String })
  ),
})

export type SentryTransaction = Schema.Schema.Type<typeof sentryTransactionSchema>

// ─── Normalised trigger data (what an automation run receives) ──────────────

const isoTimestamp = (description: string) => Schema.String.annotate({ description })

export const telemetryFrameSchema = Schema.Struct({
  filename: optionalField(
    Schema.String.annotate({
      description: "Source file, cut to start at 'src/' when it contains '/src/'",
    })
  ),
  function: optionalField(Schema.String.annotate({ description: 'Function name' })),
  lineno: optionalField(Schema.Finite.annotate({ description: 'Line number' })),
  colno: optionalField(Schema.Finite.annotate({ description: 'Column number' })),
  in_app: optionalField(
    Schema.Boolean.annotate({ description: 'Whether the frame is application code' })
  ),
}).annotate({ description: 'One normalised stack frame' })

export const telemetryExceptionSchema = Schema.Struct({
  type: Schema.String.annotate({ description: 'Exception type' }),
  value: Schema.String.annotate({ description: 'Exception message' }),
  frames: Schema.Array(telemetryFrameSchema).annotate({
    description: 'Frames, oldest first (the crash site last)',
  }),
}).annotate({ description: 'One normalised link of an exception chain' })

const telemetryCommonFields = {
  event_id: optionalField(Schema.String.annotate({ description: 'Event id as sent' })),
  release: optionalField(Schema.String.annotate({ description: 'Release as sent' })),
  environment: optionalField(Schema.String.annotate({ description: 'Environment as sent' })),
  server_name: optionalField(Schema.String.annotate({ description: 'Host as sent' })),
  tags: optionalField(
    Schema.Record(Schema.String, Schema.String).annotate({
      description: 'Tags as an object of strings',
    })
  ),
}

/** `trigger.data` of a run started by an `event` item. */
export const telemetryEventDataSchema = Schema.Struct({
  kind: Schema.Literal('event').annotate({ description: "Always 'event'" }),
  ...telemetryCommonFields,
  timestamp: isoTimestamp('ISO 8601 time of the event'),
  level: Schema.String.annotate({ description: "Level as sent; 'error' when absent" }),
  platform: optionalField(Schema.String.annotate({ description: 'Platform as sent' })),
  title: Schema.String.annotate({
    description: "'Type: value' of the outermost exception, or the message",
  }),
  culprit: optionalField(
    Schema.String.annotate({
      description: "Crash-site application frame, '<filename> in <function>'",
    })
  ),
  message: optionalField(Schema.String.annotate({ description: 'Formatted message, if any' })),
  exception: Schema.Array(telemetryExceptionSchema).annotate({
    description: 'The exception chain, oldest first; empty for a message event',
  }),
  request: optionalField(
    Schema.Struct({
      method: optionalField(Schema.String),
      url: optionalField(Schema.String),
      headers: optionalField(Schema.Record(Schema.String, Schema.String)),
    }).annotate({ description: 'The request, as sent' })
  ),
}).annotate({ description: 'What a run started by a Sentry event receives as trigger.data' })

export type TelemetryEventData = Schema.Schema.Type<typeof telemetryEventDataSchema>

export const telemetrySpanSchema = Schema.Struct({
  span_id: optionalField(Schema.String),
  op: optionalField(Schema.String),
  description: optionalField(Schema.String),
  start: optionalField(isoTimestamp('ISO 8601 start')),
  end: optionalField(isoTimestamp('ISO 8601 end')),
  duration_ms: optionalField(Schema.Finite.annotate({ description: 'Duration in milliseconds' })),
  status: optionalField(Schema.String),
  data: optionalField(Schema.Record(Schema.String, Schema.Unknown)),
}).annotate({ description: 'One normalised span' })

/** `trigger.data` of a run started by a `transaction` item. */
export const telemetryTransactionDataSchema = Schema.Struct({
  kind: Schema.Literal('transaction').annotate({ description: "Always 'transaction'" }),
  ...telemetryCommonFields,
  name: Schema.String.annotate({ description: 'Transaction name' }),
  op: optionalField(Schema.String.annotate({ description: 'Root operation, e.g. http.server' })),
  status: optionalField(Schema.String.annotate({ description: 'Root status, e.g. ok' })),
  http_status: optionalField(
    Schema.Finite.annotate({ description: 'The http.status_code tag, as a number' })
  ),
  start: isoTimestamp('ISO 8601 start'),
  end: isoTimestamp('ISO 8601 end'),
  duration_ms: Schema.Finite.annotate({ description: 'Duration in milliseconds' }),
  db_queries: optionalField(
    Schema.Finite.annotate({ description: 'The db.queries measurement, when sent' })
  ),
  trace_id: optionalField(Schema.String.annotate({ description: '32-hex trace id' })),
  span_id: optionalField(Schema.String.annotate({ description: '16-hex root span id' })),
  spans: Schema.Array(telemetrySpanSchema).annotate({
    description: 'The spans the client sent, already sampled',
  }),
}).annotate({
  description: 'What a run started by a Sentry transaction receives as trigger.data',
})

export type TelemetryTransactionData = Schema.Schema.Type<typeof telemetryTransactionDataSchema>
