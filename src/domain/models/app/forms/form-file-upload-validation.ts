/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Whether a file posted to a form's attachment field is one the field accepts.
 *
 * The page draws `accept` and `maxFileSize` into the file picker, but the
 * submission endpoint is public: a visitor posting by hand skips the page. So the
 * server answers the same two questions again, and answers the type question on
 * the CONTENT as well as on the claim:
 *
 *  - The type judged is the one the bytes announce when they announce one
 *    ({@link sniffContentType}: markup, or a raster image magic number), and the
 *    declared type otherwise. Markup is judged HTML or SVG whatever its name or
 *    declared type says.
 *  - A wildcard entry (`image/*`, `text/*`) never admits HTML or SVG: both can
 *    carry a script, so a field that wants one names it (`image/svg+xml`,
 *    `.svg`).
 *  - An extension entry admits a file by its name — but markup only when the
 *    extension itself names that markup type, so `headshot.png` carrying HTML is
 *    still refused by `.png`.
 *  - The size limit names the LARGEST size accepted: a file of exactly
 *    `maxFileSize` bytes is admitted.
 *
 * The admitted answer carries the type to STORE — the sniffed one when the
 * content announced it, so a file renamed or relabelled is catalogued as what it
 * is.
 */

import { sniffContentType } from '@/domain/kernel/identity/content-sniff'
import { canonicalMimeType } from '@/domain/kernel/identity/mime-types'

/** What an attachment field declares about the files it takes. */
export interface FormFileFieldLimits {
  readonly accept?: string
  readonly maxFileSize?: number
}

/** A posted file, as the server sees it before storing anything. */
export interface PostedFormFile {
  readonly name: string
  readonly declaredType: string
  readonly bytes: Uint8Array
}

/** The verdict on one posted file. */
export type FormFileAdmission =
  | { readonly admitted: true; readonly mimeType: string }
  | { readonly admitted: false; readonly reason: 'type' | 'size'; readonly message: string }

const FALLBACK_TYPE = 'application/octet-stream'

/** The type a posted file is judged and stored as. */
export const effectiveFileType = (file: Readonly<PostedFormFile>): string =>
  sniffContentType(file.bytes) ?? (canonicalMimeType(file.declaredType) || FALLBACK_TYPE)

/**
 * Whether one `accept` entry admits a file of `type` named `name` — the entry
 * lower-cased, a MIME entry canonical.
 *
 * Self-contained on purpose: it names nothing outside its own body, so the
 * page's file picker runs THIS function's source (`String(acceptEntryAdmits)`,
 * `render/forms/form-runtime-file-handlers.ts`) and refuses at the moment of
 * picking exactly what the server would refuse at submit. Keep it free of any
 * outer reference, or the picker's copy breaks.
 */
export function acceptEntryAdmits(entry: string, type: string, name: string): boolean {
  const markupByExtension: Readonly<Record<string, string>> = {
    '.svg': 'image/svg+xml',
    '.html': 'text/html',
    '.htm': 'text/html',
  }
  const scriptable = type === 'text/html' || type === 'image/svg+xml'
  if (entry.startsWith('.')) {
    if (!name.toLowerCase().endsWith(entry)) return false
    return !scriptable || markupByExtension[entry] === type
  }
  if (entry.endsWith('/*')) return !scriptable && type.startsWith(entry.slice(0, -1))
  return entry === type
}

/** An `accept` entry as {@link acceptEntryAdmits} reads it: lower-cased, a MIME entry canonical. */
const normalizedEntry = (entry: string): string =>
  entry.startsWith('.') || entry.endsWith('/*') ? entry : canonicalMimeType(entry)

/**
 * Whether the field's `accept` list admits a file of `type` named `name`. An
 * absent or empty list admits every type.
 */
export const isAcceptedFileType = (
  accept: string | undefined,
  type: string,
  name: string
): boolean => {
  const entries = (accept ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0)
  return (
    entries.length === 0 ||
    entries.some((entry) => acceptEntryAdmits(normalizedEntry(entry), type, name))
  )
}

/** Judge one posted file against its field's limits: size first, then type. */
export const admitFormFile = (
  limits: Readonly<FormFileFieldLimits>,
  file: Readonly<PostedFormFile>
): FormFileAdmission => {
  const size = file.bytes.length
  if (limits.maxFileSize !== undefined && size > limits.maxFileSize) {
    return {
      admitted: false,
      reason: 'size',
      message: `is larger than the ${limits.maxFileSize} bytes this field accepts`,
    }
  }
  const mimeType = effectiveFileType(file)
  if (!isAcceptedFileType(limits.accept, mimeType, file.name)) {
    return {
      admitted: false,
      reason: 'type',
      message: `does not accept files of type ${mimeType}`,
    }
  }
  return { admitted: true, mimeType }
}
