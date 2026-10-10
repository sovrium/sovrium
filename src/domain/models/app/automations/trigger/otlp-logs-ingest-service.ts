/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Read an OTLP/HTTP JSON logs request and flatten it into the records a run
 * receives as `trigger.data.records`, ready for `record/batchCreate`.
 *
 * The request is decoded through the LAX wire model
 * (`@/domain/models/api/automations/ingest`): 64-bit integers arrive as strings
 * or numbers, attribute values as any OTLP `AnyValue`, and an unknown key is
 * ignored. Every record is flattened across resources and scopes and carries
 * its resource's `service.name` and `deployment.environment`.
 */

import { Option, Schema } from 'effect'
import {
  otlpExportLogsRequestSchema,
  type OtlpExportLogsRequest,
  type TelemetryLogRecord,
  type TelemetryLogsData,
} from '@/domain/models/api/automations/ingest'

type ResourceLogs = NonNullable<OtlpExportLogsRequest['resourceLogs']>[number]
type KeyValue = NonNullable<NonNullable<ResourceLogs['resource']>['attributes']>[number]
type LogRecord = NonNullable<
  NonNullable<NonNullable<ResourceLogs['scopeLogs']>[number]['logRecords']>[number]
>

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** A 64-bit integer as a number when it is safe, else as it came. */
const intValueOf = (raw: unknown): unknown => {
  const number = typeof raw === 'string' ? Number(raw) : raw
  return typeof number === 'number' && Number.isSafeInteger(number) ? number : raw
}

/** The `values` list of an `arrayValue` or a `kvlistValue`, or none. */
const valuesOf = (container: unknown): readonly unknown[] =>
  isObject(container) && Array.isArray(container['values'])
    ? (container['values'] as readonly unknown[])
    : []

/** How each OTLP `AnyValue` member reads as a plain value. */
const ANY_VALUE_READERS: ReadonlyArray<readonly [string, (raw: unknown) => unknown]> = [
  ['stringValue', (raw) => raw],
  ['boolValue', (raw) => raw],
  ['doubleValue', (raw) => raw],
  ['intValue', intValueOf],
  ['bytesValue', (raw) => raw],
  ['arrayValue', (raw) => valuesOf(raw).map(anyValueOf)],
  ['kvlistValue', (raw) => attributesOf(valuesOf(raw) as readonly KeyValue[])],
]

/**
 * An OTLP `AnyValue` as a plain value: a string, a number (a 64-bit integer
 * sent as a string becomes a number when it is safe), a boolean, a list, or an
 * object for a `kvlistValue`. Anything unrecognised is kept as it came.
 */
export function anyValueOf(value: unknown): unknown {
  if (!isObject(value)) return value
  const reader = ANY_VALUE_READERS.find(([member]) => member in value)
  return reader === undefined ? value : reader[1](value[reader[0]])
}

/** OTLP attributes (a list of `{ key, value }`) as an object. */
function attributesOf(
  attributes: ReadonlyArray<KeyValue> | undefined
): Readonly<Record<string, unknown>> {
  return Object.fromEntries(
    (attributes ?? []).map((attribute) => [attribute.key, anyValueOf(attribute.value)])
  )
}

/** A body as text: a string as it is, anything else as JSON. */
const bodyText = (body: unknown): string => {
  const value = anyValueOf(body)
  if (value === undefined || value === null) return ''
  return typeof value === 'string' ? value : JSON.stringify(value)
}

/** Nanoseconds since the epoch (string or number) as ISO 8601; `undefined` for 0 or unreadable. */
const isoOfNanos = (nanos: string | number | undefined): string | undefined => {
  if (nanos === undefined) return undefined
  try {
    const millis = Number(
      BigInt(typeof nanos === 'number' ? Math.trunc(nanos) : nanos) / 1_000_000n
    )
    return millis > 0 ? new Date(millis).toISOString() : undefined
  } catch {
    return undefined
  }
}

/** The OTLP severity number ranges, lowest first. */
const SEVERITY_BANDS: ReadonlyArray<readonly [number, string]> = [
  [4, 'TRACE'],
  [8, 'DEBUG'],
  [12, 'INFO'],
  [16, 'WARN'],
  [20, 'ERROR'],
  [24, 'FATAL'],
]

/** Upper-case severity: the text when sent, else the band of the number. */
export const severityOf = (record: Pick<LogRecord, 'severityText' | 'severityNumber'>): string => {
  if (record.severityText !== undefined && record.severityText !== '') {
    return record.severityText.toUpperCase()
  }
  const number = record.severityNumber
  if (number === undefined || number < 1) return 'UNSPECIFIED'
  return SEVERITY_BANDS.find(([upper]) => number <= upper)?.[1] ?? 'FATAL'
}

const nonEmpty = (value: string | undefined): string | undefined =>
  value === undefined || value === '' ? undefined : value

const stringAttribute = (
  attributes: Readonly<Record<string, unknown>>,
  key: string
): string | undefined => {
  const value = attributes[key]
  return typeof value === 'string' ? nonEmpty(value) : undefined
}

const normaliseRecord = (
  record: LogRecord,
  resource: Readonly<Record<string, unknown>>,
  nowMs: number
): TelemetryLogRecord => {
  const service = stringAttribute(resource, 'service.name')
  const environment =
    stringAttribute(resource, 'deployment.environment') ??
    stringAttribute(resource, 'deployment.environment.name')
  const traceId = nonEmpty(record.traceId)
  const spanId = nonEmpty(record.spanId)
  return {
    time:
      isoOfNanos(record.timeUnixNano) ??
      isoOfNanos(record.observedTimeUnixNano) ??
      new Date(nowMs).toISOString(),
    severity: severityOf(record),
    body: bodyText(record.body),
    attributes: attributesOf(record.attributes),
    ...(service === undefined ? {} : { service }),
    ...(environment === undefined ? {} : { environment }),
    ...(traceId === undefined ? {} : { trace_id: traceId }),
    ...(spanId === undefined ? {} : { span_id: spanId }),
  }
}

/** Every record of a decoded request, flattened across resources and scopes. */
export const normaliseOtlpLogs = (
  request: OtlpExportLogsRequest,
  nowMs: number
): TelemetryLogsData => ({
  records: (request.resourceLogs ?? []).flatMap((resourceLogs) => {
    const resource = attributesOf(resourceLogs.resource?.attributes)
    return (resourceLogs.scopeLogs ?? []).flatMap((scopeLogs) =>
      (scopeLogs.logRecords ?? []).map((record) => normaliseRecord(record, resource, nowMs))
    )
  }),
})

/**
 * Decode a request body (already parsed as JSON) as an OTLP logs request;
 * `undefined` when it is not one.
 */
export const decodeOtlpLogsRequest = (body: unknown): OtlpExportLogsRequest | undefined =>
  Option.getOrUndefined(Schema.decodeUnknownOption(otlpExportLogsRequestSchema)(body))
