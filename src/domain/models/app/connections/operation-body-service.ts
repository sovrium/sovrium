/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pure helpers for an operation body sent AS WRITTEN — `{ kind: raw }` and
 * `{ kind: multipart-related }`.
 *
 * The `in: body` parameters of the call do not become fields: they fill the
 * `{{params.<name>}}` placeholders of the body's `contentType`, `content` and
 * `file`. Inside a JSON content type a placeholder becomes the JSON encoding
 * of the value, so a string arrives quoted and escaped and an array as an
 * array; anywhere else it becomes the value as text.
 */

/** One `{{params.<name>}}` placeholder; group 1 is the parameter name. */
export const BODY_PLACEHOLDER = /\{\{\s*params\.([A-Za-z0-9_$-]+)\s*\}\}/g

/** The parameter names a template's placeholders read, in order. Pure. */
export const placeholderNames = (template: string): readonly string[] =>
  [...template.matchAll(BODY_PLACEHOLDER)].map((match) => match[1] ?? '')

/** The media type of a Content-Type value, without its parameters: `application/json`. */
export const mediaTypeOf = (contentType: string): string => (contentType.split(';')[0] ?? '').trim()

/** Whether a Content-Type names JSON (`application/json`, `application/*+json`). */
export const isJsonMediaType = (contentType: string): boolean =>
  /^application\/(?:[\w.+-]+\+)?json$/i.test(mediaTypeOf(contentType))

/** A value as text: a string verbatim, anything else as its JSON. */
const asText = (value: unknown): string =>
  value === undefined || value === null
    ? ''
    : typeof value === 'string'
      ? value
      : (JSON.stringify(value) ?? '')

/**
 * Fill a template's placeholders from the call's body values.
 *
 * `json: true` writes each value as JSON (`"Devis \"Marceau\""`, `["a"]`, an
 * absent value as `null`); otherwise as text (an absent value as nothing).
 */
export const fillBodyPlaceholders = (
  template: string,
  values: Readonly<Record<string, unknown>>,
  json: boolean
): string =>
  template.replace(BODY_PLACEHOLDER, (_match, name: string) =>
    json ? (JSON.stringify(values[name]) ?? 'null') : asText(values[name])
  )

/** One filled part of a multipart/related body: its content type and its bytes. */
export interface FilledBodyPart {
  readonly contentType: string
  readonly bytes: Uint8Array
}

/**
 * Assemble a multipart/related body (RFC 2387) from its filled parts and a
 * boundary: each part opened by `--<boundary>`, its `Content-Type` header and
 * a blank line, its bytes, then the closing `--<boundary>--`. The request's
 * Content-Type names the boundary and, as `type`, the first part's media type.
 */
export const assembleMultipartRelated = (
  parts: readonly FilledBodyPart[],
  boundary: string
): { readonly body: Uint8Array<ArrayBuffer>; readonly contentType: string } => {
  const encoder = new TextEncoder()
  const chunks = parts.flatMap((part) => [
    encoder.encode(`--${boundary}\r\nContent-Type: ${part.contentType}\r\n\r\n`),
    part.bytes,
    encoder.encode('\r\n'),
  ])
  // `Buffer.concat` copies the chunks into one fresh buffer: no shared state.
  const body = new Uint8Array(Buffer.concat([...chunks, encoder.encode(`--${boundary}--\r\n`)]))
  const first = mediaTypeOf(parts[0]?.contentType ?? 'application/octet-stream')
  return {
    body,
    contentType: `multipart/related; boundary=${boundary}; type="${first}"`,
  }
}
