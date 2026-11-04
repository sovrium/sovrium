/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

const parseJsonOrUndefined = (raw: string): unknown => {
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

/** The media type of a `Content-Type` value, lower-cased, its parameters dropped. */
const mediaTypeOf = (contentType: string | undefined): string =>
  (contentType ?? '').split(';')[0]?.trim().toLowerCase() ?? ''

const isJsonMediaType = (mediaType: string): boolean =>
  mediaType === 'application/json' || mediaType.endsWith('+json')

/** What a run reads of an uploaded file part: never its bytes. */
interface FilePart {
  readonly name: string
  readonly type: string
  readonly size: number
}

type FieldValue = string | FilePart
type Fields = Readonly<Record<string, FieldValue | readonly FieldValue[]>>

/** Collect named values; a name sent more than once is the list of its values. */
const collectFields = (entries: Iterable<readonly [string, FieldValue]>): Fields =>
  [...entries].reduce<Fields>((fields, [key, value]) => {
    const seen = fields[key]
    if (seen === undefined) return { ...fields, [key]: value }
    return {
      ...fields,
      [key]: Array.isArray(seen) ? [...seen, value] : [seen as FieldValue, value],
    }
  }, {})

/** The fields of a form-encoded body; a field sent more than once is the list of its values. */
const decodeFormFields = (raw: string): Fields => collectFields(new URLSearchParams(raw))

const describePart = (value: string | Blob): FieldValue =>
  typeof value === 'string'
    ? value
    : {
        name: value instanceof File ? value.name : '',
        type: value.type.split(';')[0]?.trim() ?? '',
        size: value.size,
      }

/**
 * The parts of a `multipart/form-data` body, parsed from its raw bytes: a
 * text part is its value, a file part its name, type and size in bytes. A
 * body that does not parse as multipart reads as its raw text.
 */
const decodeMultipartParts = async (
  bytes: Uint8Array<ArrayBuffer>,
  raw: string,
  contentType: string
): Promise<unknown> => {
  try {
    const form = await new Response(bytes, { headers: { 'content-type': contentType } }).formData()
    return collectFields(
      [...form.entries()].map(([key, value]) => [key, describePart(value)] as const)
    )
  } catch {
    return raw
  }
}

/**
 * Decode a webhook request body into the value a run reads as
 * `trigger.data.body`, by its `Content-Type`:
 *
 * - none sent, or JSON (`application/json`, `*+json`): parsed; a body that
 *   is not valid JSON reads as no body, as it always has;
 * - `application/x-www-form-urlencoded` (any `charset`): its decoded fields;
 * - `multipart/form-data`: read by {@link readWebhookBody}, from the bytes;
 * - anything else: parsed when it is JSON, else the raw text.
 *
 * An empty body is no body. Signature checks never read this value: they run
 * over the raw bytes before it is decoded.
 */
export const decodeWebhookBody = (raw: string, contentType: string | undefined): unknown => {
  if (raw === '') return undefined
  const mediaType = mediaTypeOf(contentType)
  if (mediaType === 'application/x-www-form-urlencoded') return decodeFormFields(raw)
  if (mediaType === '' || isJsonMediaType(mediaType)) return parseJsonOrUndefined(raw)
  return parseJsonOrUndefined(raw) ?? raw
}

/**
 * Read a webhook request body as `trigger.data.body`: a `multipart/form-data`
 * body is parsed from its raw bytes (a file part read as text would be
 * corrupted), every other body is decoded by {@link decodeWebhookBody} from
 * its text. Never rejects.
 */
export const readWebhookBody = (
  bytes: Uint8Array<ArrayBuffer>,
  raw: string,
  contentType: string | undefined
): Promise<unknown> =>
  raw !== '' && mediaTypeOf(contentType) === 'multipart/form-data'
    ? decodeMultipartParts(bytes, raw, contentType ?? '')
    : Promise.resolve(decodeWebhookBody(raw, contentType))
