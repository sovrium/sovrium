/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What every form-source adapter reads out of a snapshot, the same way: the
 * form definition, the response pages in order, and the fetch's index of the
 * files it downloaded.
 *
 * A form fetch writes `raw/form.json` and its response pages under
 * `raw/responses/page-NNNN.json`; an export file given directly is its own
 * single `raw/<file>` entry, read as the definition. Every value read here is
 * plain JSON; the adapters never see a URL they would have to fetch.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { attachmentIndexOf, IMPORT_ATTACHMENT_INDEX, type SnapshotAsset } from './snapshot-manifest'
import type { CanonicalValue } from './canonical-base'

type Json = Readonly<Record<string, unknown>>

/** The snapshot path of a form definition written by a fetch. */
export const FORM_DEFINITION_PATH = 'raw/form.json'

/** The snapshot path of the fetch's index of downloaded files. */
export const FORM_ATTACHMENT_INDEX = IMPORT_ATTACHMENT_INDEX

/** The snapshot path of one response page. */
export const responsePagePath = (page: number): string =>
  `raw/responses/page-${String(page).padStart(4, '0')}.json`

const RESPONSE_PAGE = /^raw\/responses\/page-\d{4}\.json$/

/** The objects of a list, anything else dropped. */
export const objectsOf = (value: unknown): readonly Json[] =>
  Array.isArray(value) ? value.filter(isRecord) : []

/** A text value, or `undefined`. */
export const textOf = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

/** One downloaded file. */
export type FormAsset = SnapshotAsset

/** What a form snapshot holds. */
export interface FormSnapshot {
  readonly definition: unknown
  readonly pages: readonly unknown[]
  readonly assets: ReadonlyMap<string, FormAsset>
  /** Every other `raw/` file, by path, for a tool that writes more. */
  readonly files: ReadonlyMap<string, unknown>
}

/** Read a snapshot's parsed `raw/` files as a form snapshot. */
export const readFormSnapshot = (files: ReadonlyMap<string, unknown>): FormSnapshot => {
  const fetched = files.has(FORM_DEFINITION_PATH)
  const [single] = [...files.keys()].filter((path) => path !== FORM_ATTACHMENT_INDEX).toSorted()
  return {
    definition: files.get(fetched ? FORM_DEFINITION_PATH : (single ?? FORM_DEFINITION_PATH)),
    pages: [...files.keys()]
      .filter((path) => RESPONSE_PAGE.test(path))
      .toSorted()
      .map((path) => files.get(path)),
    assets: attachmentIndexOf(files.get(FORM_ATTACHMENT_INDEX)),
    files,
  }
}

/** A file answer: the downloaded file when the fetch kept it, its name either way. */
export const attachmentValue = (
  assets: ReadonlyMap<string, FormAsset>,
  source: string,
  filename: string,
  mimeType?: string
): CanonicalValue => {
  const held = assets.get(source)
  return {
    kind: 'attachment',
    filename: held?.filename ?? filename,
    ...(held === undefined ? {} : { asset: held.asset }),
    ...(mimeType === undefined ? {} : { mimeType }),
  }
}

/** The last path segment of a URL, decoded: the name a file answer had. */
export const fileNameOfUrl = (url: string): string => {
  const path = URL.canParse(url) ? new URL(url).pathname : url
  const last = path.slice(path.lastIndexOf('/') + 1)
  try {
    return decodeURIComponent(last) || 'file'
  } catch {
    // A malformed escape: the raw segment is still a usable name.
    return last || 'file'
  }
}

/**
 * Markup with every tag removed: from each `<` to the next `>`, the same span
 * `/<[^>]*>/g` drops, found by a scan rather than a pattern-replace, so the
 * text is cut once, at the tag boundaries of the source. A `<` no `>` follows
 * is kept as text, as is a `>` no `<` opened.
 *
 * Every segment that a `>` closes held at most one tag's tail: the first `<` in
 * it opens the tag that `>` ends, and everything after that `<` is inside it.
 */
const withoutTags = (html: string): string =>
  html
    .split('>')
    .map((segment, index, segments) => {
      if (index === segments.length - 1) return segment
      const open = segment.indexOf('<')
      return open === -1 ? `${segment}>` : segment.slice(0, open)
    })
    .join('')

/** Text with its HTML tags removed and its entities read, for a label written in HTML. */
export const plainText = (html: string): string =>
  withoutTags(html.replace(/<br\s*\/?>/gi, ' '))
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&')
    .replace(/\s+/g, ' ')
    .trim()

/** Responses oldest first; ties keep the order the source served them in. */
export const oldestFirst = <A extends { readonly submittedAt: string }>(
  responses: readonly A[]
): readonly A[] => responses.toSorted((a, b) => a.submittedAt.localeCompare(b.submittedAt))

/**
 * An answer kept as the source gave it: text, a finite number, a yes/no, a
 * list of texts; anything else is kept as its JSON text rather than dropped.
 */
export const plainAnswer = (value: unknown): CanonicalValue | undefined => {
  if (value === null || value === undefined) return undefined
  if (Array.isArray(value) && value.every((one) => typeof one === 'string')) return value
  if (typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  return JSON.stringify(value)
}
