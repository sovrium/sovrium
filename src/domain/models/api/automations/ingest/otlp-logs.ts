/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

/**
 * The OTLP/HTTP JSON logs wire model a receiver decodes
 * (`ExportLogsServiceRequest`, opentelemetry-proto `logs/v1`), and the
 * normalised records a `protocol: 'otlp-logs'` webhook run receives.
 *
 * Read LENIENTLY, like the Sentry model beside it: every field is optional
 * and unknown keys are ignored. Two encodings the JSON mapping allows are
 * both accepted: 64-bit integers (`timeUnixNano`, `intValue`) as strings or
 * as numbers, and attribute values as any `AnyValue` (string, int, double,
 * bool, array, kvlist, bytes) — kept as `unknown` here and flattened by the
 * normaliser, so a nested value never refuses a whole batch.
 *
 * Sovrium's own exporter is Effect's `OtlpLogger` with JSON serialisation
 * (`src/infrastructure/telemetry/observability-runtime.ts`), which owns its
 * encoding; this module only describes what arrives.
 */

/** OTLP JSON writes 64-bit integers as strings; some exporters write numbers. */
const otlpUint64Schema = Schema.Union([Schema.String, Schema.Finite]).annotate({
  description: 'A 64-bit integer, as a decimal string or a number',
})

export const otlpKeyValueSchema = Schema.Struct({
  key: Schema.String.annotate({ description: 'Attribute name' }),
  value: optionalField(
    Schema.Unknown.annotate({
      description: 'An OTLP AnyValue: stringValue, intValue, doubleValue, boolValue, …',
    })
  ),
}).annotate({ description: 'One OTLP attribute' })

export const otlpLogRecordSchema = Schema.Struct({
  timeUnixNano: optionalField(otlpUint64Schema),
  observedTimeUnixNano: optionalField(otlpUint64Schema),
  severityNumber: optionalField(
    Schema.Finite.annotate({ description: 'OTLP severity number, 1 (TRACE) to 24 (FATAL4)' })
  ),
  severityText: optionalField(
    Schema.String.annotate({ description: 'Severity as the exporter names it' })
  ),
  body: optionalField(Schema.Unknown.annotate({ description: 'The log body, an AnyValue' })),
  attributes: optionalField(Schema.Array(otlpKeyValueSchema)),
  traceId: optionalField(Schema.String.annotate({ description: '32-hex trace id' })),
  spanId: optionalField(Schema.String.annotate({ description: '16-hex span id' })),
}).annotate({ description: 'One OTLP log record, read leniently' })

const otlpScopeLogsSchema = Schema.Struct({
  scope: optionalField(
    Schema.Struct({
      name: optionalField(Schema.String),
      version: optionalField(Schema.String),
    }).annotate({ description: 'The instrumentation scope' })
  ),
  logRecords: optionalField(Schema.Array(otlpLogRecordSchema)),
}).annotate({ description: 'The records of one instrumentation scope' })

const otlpResourceLogsSchema = Schema.Struct({
  resource: optionalField(
    Schema.Struct({
      attributes: optionalField(Schema.Array(otlpKeyValueSchema)),
    }).annotate({
      description: 'The emitting resource: service.name, deployment.environment, …',
    })
  ),
  scopeLogs: optionalField(Schema.Array(otlpScopeLogsSchema)),
}).annotate({ description: 'The records of one resource' })

/** The body of `POST /v1/logs`. */
export const otlpExportLogsRequestSchema = Schema.Struct({
  resourceLogs: optionalField(Schema.Array(otlpResourceLogsSchema)),
}).annotate({ description: 'An OTLP/HTTP JSON ExportLogsServiceRequest' })

export type OtlpExportLogsRequest = Schema.Schema.Type<typeof otlpExportLogsRequestSchema>

// ─── Normalised trigger data (what an automation run receives) ──────────────

/** One record of `trigger.data.records`, shaped for `record/batchCreate`. */
export const telemetryLogRecordSchema = Schema.Struct({
  time: Schema.String.annotate({
    description: 'ISO 8601, from timeUnixNano, else observedTimeUnixNano',
  }),
  severity: Schema.String.annotate({
    description: 'Upper-case severity: severityText, else derived from severityNumber',
  }),
  body: Schema.String.annotate({ description: 'The body as text' }),
  attributes: Schema.Record(Schema.String, Schema.Unknown).annotate({
    description: "The record's own attributes, as an object",
  }),
  service: optionalField(Schema.String.annotate({ description: "The resource's service.name" })),
  environment: optionalField(
    Schema.String.annotate({ description: "The resource's deployment.environment" })
  ),
  trace_id: optionalField(Schema.String.annotate({ description: '32-hex trace id' })),
  span_id: optionalField(Schema.String.annotate({ description: '16-hex span id' })),
}).annotate({ description: 'One normalised log record' })

export type TelemetryLogRecord = Schema.Schema.Type<typeof telemetryLogRecordSchema>

/** `trigger.data` of a run started by one `POST /v1/logs` request. */
export const telemetryLogsDataSchema = Schema.Struct({
  records: Schema.Array(telemetryLogRecordSchema).annotate({
    description: 'Every record of the request, flattened across resources and scopes',
  }),
}).annotate({ description: 'What a run started by an OTLP logs request receives as trigger.data' })

export type TelemetryLogsData = Schema.Schema.Type<typeof telemetryLogsDataSchema>
