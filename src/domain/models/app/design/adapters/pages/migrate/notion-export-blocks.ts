/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The blocks a Notion export page is read into, shared by the HTML reader
 * (`notion-pages-parse.ts`) and the Markdown reader (`notion-pages-markdown.ts`),
 * and the one way both resolve a reference from a page to another file of the
 * export.
 *
 * A block is named the way Notion names it (`heading_1`, `callout`, `toggle`
 * …): the readers recognise, `notion-page-mappings.ts` decides what each name
 * becomes, and the converter (`notion-pages-migrate.ts`) applies that table.
 */

/** The Notion blocks whose content is a run of text. */
export type NotionTextBlock =
  'heading_1' | 'heading_2' | 'heading_3' | 'paragraph' | 'quote' | 'callout' | 'code'

/** One column of a column list, and the width the export wrote for it. */
export interface NotionColumn {
  readonly width?: string | undefined
  readonly children: readonly NotionBlock[]
}

/** A block, as recognised in the export. `other` is any block the reader names but carries nothing for. */
export type NotionBlock =
  | {
      readonly kind: 'text'
      readonly block: NotionTextBlock
      readonly text: string
      /** Every mention the text holds, verbatim as the export wrote it. */
      readonly mentions: readonly string[]
    }
  | { readonly kind: 'toggle'; readonly summary: string; readonly children: readonly NotionBlock[] }
  | { readonly kind: 'leaf'; readonly block: 'divider' | 'table_of_contents' }
  | { readonly kind: 'columns'; readonly columns: readonly NotionColumn[] }
  | {
      readonly kind: 'image'
      /** The image as the page referenced it: an export path, or an `https:` URL. */
      readonly src: string | undefined
      readonly alt: string | undefined
      /** The export entry the image is, when it is a file of the export. */
      readonly file: string | undefined
    }
  | { readonly kind: 'child_page'; readonly label: string; readonly target: string }
  | { readonly kind: 'child_database'; readonly title: string; readonly file?: string | undefined }
  | {
      readonly kind: 'other'
      readonly block: string
      /** The export entry the block shows, for an attachment. */
      readonly file?: string | undefined
    }

/** What a reader resolves a page's references against. */
export interface NotionReadContext {
  /** The page's folder inside the export, `''` at the root. */
  readonly folder: string
  /** The export entries that are pages. */
  readonly pageFiles: ReadonlySet<string>
}

const decodeHref = (href: string): string => {
  try {
    return decodeURIComponent(href)
  } catch {
    // A malformed escape is kept as written: it then resolves to no entry.
    return href
  }
}

/**
 * Resolve a relative reference from a page's folder to an export path, or
 * `undefined` when it leaves the export, is absolute or names a URL. A
 * reference never climbs above the export's root: that is how a page could
 * name a file outside the archive, and it is read as naming nothing.
 */
export const resolveExportPath = (folder: string, href: string): string | undefined => {
  const bare = decodeHref(href.split('#', 1)[0]?.split('?', 1)[0] ?? '')
  if (bare === '' || bare.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(bare)) return undefined
  const segments = [...(folder === '' ? [] : folder.split('/')), ...bare.split('/')]
  const resolved = segments.reduce<readonly string[] | undefined>((acc, segment) => {
    if (acc === undefined || segment === '.' || segment === '') return acc
    if (segment !== '..') return [...acc, segment]
    return acc.length === 0 ? undefined : acc.slice(0, -1)
  }, [])
  return resolved === undefined || resolved.length === 0 ? undefined : resolved.join('/')
}

/** The page of the export a reference names, or `undefined`. */
export const linkedPageOf = (href: string, context: NotionReadContext): string | undefined => {
  const target = resolveExportPath(context.folder, href)
  return target !== undefined && context.pageFiles.has(target) ? target : undefined
}

/** Whitespace a source file's own layout added, trimmed; a line break inside the text kept, blank lines folded. */
export const cleanText = (text: string): string =>
  text
    .split('\n')
    .map((line) => line.replace(/[ \t\r\f\v]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
