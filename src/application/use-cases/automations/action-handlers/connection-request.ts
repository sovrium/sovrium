/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

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

/** A request ready for `fetch`, before authentication headers are merged. */
export interface OperationRequest {
  readonly url: string
  readonly method: string
  readonly headers: Readonly<Record<string, string>>
  readonly body?: string | FormData | undefined
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

const fitsType = (value: unknown, type: string): boolean => {
  if (type === 'string') return typeof value === 'string'
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value)
  if (type === 'integer') return typeof value === 'number' && Number.isInteger(value)
  if (type === 'boolean') return typeof value === 'boolean'
  if (type === 'array') return Array.isArray(value)
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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
  return coerced.every((item) => fitsType(item, itemType))
    ? { ok: true, value: coerced }
    : { ok: false, error: `parameter '${name}' expects items of type ${itemType}` }
}

/** The declared-type value of one parameter, or an error naming it. */
const coerceParam = (name: string, param: OperationParam, raw: unknown): Coerced => {
  if (param.type === 'array') return coerceArray(name, param, raw)
  const value =
    param.type === 'string' && typeof raw === 'number' ? String(raw) : coerceScalar(raw, param.type)
  return fitsType(value, param.type)
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

const encodeBody = (
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
      (Array.isArray(value) ? value : [value]).forEach((item) => form.append(name, asText(item)))
    )
    return { body: form }
  }
  return { body: JSON.stringify(Object.fromEntries(fields)), contentType: 'application/json' }
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
  if (bodyFields.length === 0) {
    return { ok: true, request: { url, method: operation.method, headers: headerParams } }
  }
  const encoded = encodeBody(operation.body ?? 'json', bodyFields)
  return {
    ok: true,
    request: {
      url,
      method: operation.method,
      headers:
        encoded.contentType === undefined
          ? headerParams
          : { ...headerParams, 'Content-Type': encoded.contentType },
      body: encoded.body,
    },
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
