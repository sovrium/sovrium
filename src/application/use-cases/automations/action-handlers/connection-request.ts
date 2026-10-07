/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { fitsParamType } from '@/domain/models/app/connections'
import {
  fillBodyPlaceholders,
  isJsonMediaType,
} from '@/domain/models/app/connections/operation-body-service'
import type { ConnectionOperation, OperationParam } from '@/domain/models/app/connections'

/**
 * Pure request building for `connection/call`: turn one declared operation and
 * the values a step passes into the URL, headers and body that go on the wire.
 *
 * Every value is placed where its parameter says (`in: path | query | header |
 * body`) and encoded by the engine — a path value fills exactly one segment
 * (`encodeURIComponent`, so a `/` inside it stays inside it), a query array is
 * sent as repeated keys. Values arrive here AFTER template substitution, so a
 * template that rendered a number as the string `"50"` is coerced back to the
 * declared type; a value that cannot be coerced fails the step, naming the
 * parameter — the load-time check could not see it.
 */

/**
 * One payload of a body sent as written, placeholders filled: its content
 * type, and either its text or the file whose bytes it carries (a storage key,
 * a `data:` URI or an `https://` URL, read by the caller).
 */
export type WrittenBodyPiece = { readonly contentType: string } & (
  | { readonly text: string; readonly file?: undefined }
  | { readonly file: string; readonly text?: undefined }
)

/** A `raw` or `multipart-related` body, filled but with its files not yet read. */
export type WrittenBodyPlan =
  | { readonly kind: 'raw'; readonly piece: WrittenBodyPiece }
  | { readonly kind: 'multipart-related'; readonly parts: readonly WrittenBodyPiece[] }

/** A field of a `json`, `form` or `multipart` body: a value, or a file still to be read. */
export type BodyField =
  | { readonly kind: 'value'; readonly name: string; readonly value: unknown }
  | {
      readonly kind: 'file'
      readonly name: string
      readonly file: unknown
      readonly encoding?: 'base64' | undefined
    }

/** A `json`, `form` or `multipart` body carrying a `file` parameter, its files not yet read. */
export interface FieldBodyPlan {
  readonly kind: 'json' | 'form' | 'multipart'
  readonly fields: readonly BodyField[]
}

/** A request ready for `fetch`, before authentication headers are merged. */
export interface OperationRequest {
  readonly url: string
  readonly method: string
  readonly headers: Readonly<Record<string, string>>
  readonly body?: string | FormData | Uint8Array<ArrayBuffer> | undefined
  /**
   * A body sent as written, still to be completed by the caller: its files are
   * read (an effect this pure builder cannot run) and it is then assembled
   * into `body` and its Content-Type header.
   */
  readonly writtenBody?: WrittenBodyPlan | undefined
  /** A field body with a `file` parameter, encoded by the caller once its files are read. */
  readonly fieldBody?: FieldBodyPlan | undefined
}

export type BuildResult =
  | { readonly ok: true; readonly request: OperationRequest }
  | { readonly ok: false; readonly error: string }

const PATH_PARAM = /\{([^}]+)\}/g

/** Coerce a scalar that went through template rendering back to its declared type. */
const coerceScalar = (value: unknown, type: string): unknown => {
  if (typeof value !== 'string') return value
  if ((type === 'integer' || type === 'number') && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : value
  }
  if (type === 'boolean' && (value === 'true' || value === 'false')) return value === 'true'
  return value
}

type Coerced =
  { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly error: string }

/** The items of an array parameter, each coerced to the declared item type. */
const coerceArray = (name: string, param: OperationParam, raw: unknown): Coerced => {
  const items: unknown = typeof raw === 'string' ? safeJsonArray(raw) : raw
  if (!Array.isArray(items)) return { ok: false, error: `parameter '${name}' expects array` }
  const itemType = param.items?.type
  if (itemType === undefined) return { ok: true, value: items }
  const coerced = items.map((item) => coerceScalar(item, itemType))
  return coerced.every((item) => fitsParamType(item, itemType, 'runtime'))
    ? { ok: true, value: coerced }
    : { ok: false, error: `parameter '${name}' expects items of type ${itemType}` }
}

/** The declared-type value of one parameter, or an error naming it. */
const coerceParam = (name: string, param: OperationParam, raw: unknown): Coerced => {
  if (param.type === 'array') return coerceArray(name, param, raw)
  const value =
    param.type === 'string' && typeof raw === 'number' ? String(raw) : coerceScalar(raw, param.type)
  return fitsParamType(value, param.type, 'runtime')
    ? { ok: true, value }
    : { ok: false, error: `parameter '${name}' expects ${param.type}` }
}

const safeJsonArray = (raw: string): unknown => {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return raw
  }
}

/** A scalar as it travels in a URL or a header. */
const asText = (value: unknown): string =>
  typeof value === 'string' ? value : (JSON.stringify(value) ?? '')

/** The declared parameters paired with the values passed, coerced; or the first error. */
const resolveParams = (
  operation: ConnectionOperation,
  params: Readonly<Record<string, unknown>>
):
  | {
      readonly ok: true
      readonly values: ReadonlyArray<readonly [string, OperationParam, unknown]>
    }
  | { readonly ok: false; readonly error: string } => {
  const declared = operation.params ?? {}
  const entries = Object.entries(declared).filter(([name]) => params[name] !== undefined)
  const missing = Object.entries(declared).find(
    ([name, param]) =>
      (param.required === true || param.in === 'path') &&
      (params[name] === undefined || params[name] === null || params[name] === '')
  )
  if (missing !== undefined) {
    return { ok: false, error: `required parameter '${missing[0]}' has no value` }
  }
  const coerced = entries.map(
    ([name, param]) => [name, param, coerceParam(name, param, params[name])] as const
  )
  const failed = coerced.find(([, , result]) => !result.ok)
  if (failed !== undefined && !failed[2].ok) return { ok: false, error: failed[2].error }
  return {
    ok: true,
    values: coerced.map(
      ([name, param, result]) => [name, param, result.ok ? result.value : undefined] as const
    ),
  }
}

/** Join a base URL and an operation path without doubling or losing the slash. */
const joinUrl = (baseUrl: string, path: string): string =>
  `${baseUrl.replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`

/** Append query pairs to a URL, repeating the key for each item of an array. */
export const appendQuery = (
  url: string,
  pairs: ReadonlyArray<readonly [string, unknown]>
): string => {
  const encoded = pairs.flatMap(([name, value]) =>
    (Array.isArray(value) ? value : [value]).map(
      (item) => `${encodeURIComponent(name)}=${encodeURIComponent(asText(item))}`
    )
  )
  if (encoded.length === 0) return url
  return `${url}${url.includes('?') ? '&' : '?'}${encoded.join('&')}`
}

/** Replace (or add) one query parameter of a URL — the page, offset or cursor. */
export const withQueryParam = (url: string, name: string, value: string): string => {
  const parsed = new URL(url)
  parsed.searchParams.set(name, value)
  return parsed.toString()
}

/**
 * Encode a field body. In a `multipart` body a `Blob` value — a `file`
 * parameter, read — is appended as a file part, carrying its own name and type.
 */
export const encodeBody = (
  kind: 'json' | 'form' | 'multipart',
  fields: ReadonlyArray<readonly [string, unknown]>
): { readonly body: string | FormData; readonly contentType?: string } => {
  if (kind === 'form') {
    return {
      body: new URLSearchParams(
        fields.flatMap(([name, value]) =>
          (Array.isArray(value) ? value : [value]).map(
            (item) => [name, asText(item)] as [string, string]
          )
        )
      ).toString(),
      contentType: 'application/x-www-form-urlencoded',
    }
  }
  if (kind === 'multipart') {
    const form = new FormData()
    fields.forEach(([name, value]) =>
      (Array.isArray(value) ? value : [value]).forEach((item) =>
        item instanceof Blob ? form.append(name, item) : form.append(name, asText(item))
      )
    )
    return { body: form }
  }
  return { body: JSON.stringify(Object.fromEntries(fields)), contentType: 'application/json' }
}

/** A request carrying an encoded field body, its Content-Type set when the encoding names one. */
export const withEncodedBody = (
  request: OperationRequest,
  encoded: ReturnType<typeof encodeBody>
): OperationRequest => ({
  url: request.url,
  method: request.method,
  headers:
    encoded.contentType === undefined
      ? request.headers
      : { ...request.headers, 'Content-Type': encoded.contentType },
  body: encoded.body,
})

type WrittenBody = Extract<ConnectionOperation['body'], { readonly kind: string }>
type WrittenSource = {
  readonly contentType: string
  readonly content?: string
  readonly file?: string
}

/** One body or part with its placeholders filled from the call's body values. */
const fillPiece = (
  source: WrittenSource,
  values: Readonly<Record<string, unknown>>
): WrittenBodyPiece => {
  const contentType = fillBodyPlaceholders(source.contentType, values, false)
  return source.file !== undefined
    ? { contentType, file: fillBodyPlaceholders(source.file, values, false) }
    : {
        contentType,
        text: fillBodyPlaceholders(source.content ?? '', values, isJsonMediaType(contentType)),
      }
}

/** The plan of a body sent as written: the `in: body` values fill its placeholders. */
const writtenBodyPlan = (
  body: WrittenBody,
  values: Readonly<Record<string, unknown>>
): WrittenBodyPlan =>
  body.kind === 'raw'
    ? { kind: 'raw', piece: fillPiece(body, values) }
    : { kind: 'multipart-related', parts: body.parts.map((part) => fillPiece(part, values)) }

/**
 * The plan of a field body carrying a `file` parameter, or `undefined` when it
 * carries none. Its files are read by the caller (an effect this builder
 * cannot run), which then encodes the body.
 */
const fileFieldBody = (
  operation: ConnectionOperation,
  values: ReadonlyArray<readonly [string, OperationParam, unknown]>,
  bodyFields: ReadonlyArray<readonly [string, unknown]>
): FieldBodyPlan | undefined => {
  const fileParams = new Map(
    values
      .filter(([, param]) => param.in === 'body' && param.type === 'file')
      .map(([name, param]) => [name, param] as const)
  )
  if (fileParams.size === 0 || typeof operation.body === 'object') return undefined
  const fields = bodyFields.map(([name, value]): BodyField => {
    const param = fileParams.get(name)
    return param === undefined
      ? { kind: 'value', name, value }
      : { kind: 'file', name, file: value, encoding: param.encoding }
  })
  return { kind: operation.body ?? 'json', fields }
}

/**
 * Build the request for one call of `operation` against `baseUrl` with the
 * step's `params`. Authentication is NOT added here — the caller merges the
 * connection's auth headers, which win over nothing and lose to nothing: a
 * header parameter named `Authorization` would be the operator's explicit
 * choice and is kept.
 */
export const buildOperationRequest = (input: {
  readonly baseUrl: string
  readonly operation: ConnectionOperation
  readonly params: Readonly<Record<string, unknown>>
}): BuildResult => {
  const { baseUrl, operation, params } = input
  const resolved = resolveParams(operation, params)
  if (!resolved.ok) return resolved
  const byPlace = (place: OperationParam['in']) =>
    resolved.values
      .filter(([, param]) => param.in === place)
      .map(([name, , value]) => [name, value] as const)
  const pathValues = new Map(byPlace('path'))
  const path = operation.path.replace(PATH_PARAM, (_match, name: string) =>
    encodeURIComponent(asText(pathValues.get(name)))
  )
  const url = appendQuery(joinUrl(baseUrl, path), byPlace('query'))
  const headerParams = Object.fromEntries(
    byPlace('header').map(([name, value]) => [name, asText(value)])
  )
  const bodyFields = byPlace('body')
  const head: OperationRequest = { url, method: operation.method, headers: headerParams }
  // A body sent as written: the `in: body` values fill its placeholders and
  // are not sent as fields. Its files are read by the caller.
  if (typeof operation.body === 'object') {
    const writtenBody = writtenBodyPlan(operation.body, Object.fromEntries(bodyFields))
    return { ok: true, request: { ...head, writtenBody } }
  }
  if (bodyFields.length === 0) return { ok: true, request: head }
  const fieldBody = fileFieldBody(operation, resolved.values, bodyFields)
  if (fieldBody !== undefined) return { ok: true, request: { ...head, fieldBody } }
  return {
    ok: true,
    request: withEncodedBody(head, encodeBody(operation.body ?? 'json', bodyFields)),
  }
}

/** Read a dot path (`meta.next_page`) out of a decoded body. */
export const readDotPath = (value: unknown, path: string): unknown =>
  path
    .split('.')
    .filter((segment) => segment !== '')
    .reduce<unknown>(
      (current, segment) =>
        current !== null && typeof current === 'object'
          ? (current as Record<string, unknown>)[segment]
          : undefined,
      value
    )

/** The URL marked `rel="next"` in a `Link` response header, if any. */
export const nextLinkOf = (header: string | null): string | undefined =>
  header
    ?.split(',')
    .map((part) => part.match(/<([^>]+)>\s*;\s*rel="?next"?/i)?.[1])
    .find((candidate) => candidate !== undefined)

/**
 * The delay a `Retry-After` header asks for, in ms: delta-seconds or an
 * HTTP date. `undefined` when absent or unreadable.
 */
export const retryAfterMs = (header: string | null, now: number): number | undefined => {
  if (header === null || header.trim() === '') return undefined
  const seconds = Number(header)
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
  const date = Date.parse(header)
  return Number.isNaN(date) ? undefined : Math.max(0, date - now)
}
