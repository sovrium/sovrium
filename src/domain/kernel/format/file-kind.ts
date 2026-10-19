/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A file type as a person names it: `application/pdf` is a PDF, `image/png` a
 * PNG, and `image/*` is images. A drop zone saying what it takes says it this
 * way, never with the MIME type a server checks.
 *
 * A format's short name reads the same in every language, so it is the word
 * itself; a family (`image/*`) is named in the page language by whoever draws
 * it, from the {@link FileFamily} returned.
 */

/** The families a wildcard MIME type names. */
export type FileFamily = 'image' | 'video' | 'audio' | 'text'

/** A type's name: a format's short name, or the family a wildcard names. */
export type FileKind = { readonly word: string } | { readonly family: FileFamily }

/** The formats whose short name is not their subtype upper-cased. */
const KNOWN_FORMATS: Readonly<Record<string, string>> = {
  'application/pdf': 'PDF',
  'image/jpeg': 'JPEG',
  'image/webp': 'WebP',
  'image/svg+xml': 'SVG',
  'text/plain': 'TXT',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.ms-excel': 'XLS',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'application/vnd.ms-powerpoint': 'PPT',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
  'audio/mpeg': 'MP3',
}

const FAMILIES: ReadonlySet<string> = new Set(['image', 'video', 'audio', 'text'])

/**
 * What `mime` is called. A wildcard names its family; a known format its short
 * name; any other type its subtype upper-cased when that is a short word
 * (`image/png` → `PNG`, `application/x-zip` → `ZIP`), else the type as written.
 */
export function fileKindOf(mime: string): FileKind {
  const type = mime.trim().toLowerCase()
  const [major = '', minor = ''] = type.split('/')
  if (minor === '*' && FAMILIES.has(major)) return { family: major as FileFamily }
  const known = KNOWN_FORMATS[type]
  if (known !== undefined) return { word: known }
  const subtype = minor.replace(/^x-/, '').replace(/\+.*$/, '')
  return /^[a-z0-9]{2,5}$/.test(subtype) ? { word: subtype.toUpperCase() } : { word: mime }
}
