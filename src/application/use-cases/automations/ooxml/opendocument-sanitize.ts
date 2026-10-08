/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Result } from 'effect'
import { entryText, readOoxmlPackage, textEntry, writeOoxmlPackage } from './ooxml-package'
import { parseXmlPart, rewriteRoot, serializePart, type XmlElement } from './ooxml-tree'
import type { ZipEntry } from '../action-handlers/file-zip'
import type { ZipReadEntry } from '../action-handlers/file-zip-read'

/**
 * AN OPENDOCUMENT PACKAGE (`.odt`, `.ods`, `.odp`) CLEANED BEFORE IT LEAVES
 * FOR THE OFFICE ENGINE — the OpenDocument counterpart of
 * `office-package-sanitize.ts`.
 *
 * OpenDocument names what a consumer loads with an `xlink:href` attribute: a
 * linked picture (`draw:image`), a linked section (`text:section-source`), an
 * embedded object kept outside the package (`draw:object`), a floating frame,
 * a background picture, a template, a page to reload. LibreOffice follows
 * every one of them when it opens the file. So, in every XML part:
 *
 *  - an `xlink:href` that leaves the package — a URL of any scheme, an
 *    absolute path, a `..` segment, a UNC `\\host` path — is removed, except
 *    on a hyperlink (`text:a`, `draw:a`) whose target is `http:`, `https:` or
 *    `mailto:`, which a converter only writes into the PDF;
 *  - the elements that link a document to another source whatever their
 *    target — linked sections and tables, cell ranges, DDE connections — are
 *    removed with what they hold, and `xml:base` goes too, since it would
 *    re-anchor a relative reference outside the package.
 *
 * A reference inside the package (`Pictures/logo.png`, `./Object 1`, a
 * `#bookmark`) is kept. The xlink namespace is matched by its URI, whatever
 * prefix a part binds it to. A part that declares a document type, or does
 * not parse, makes the package unreadable: it is refused rather than sent.
 */

const XLINK_NS = 'http://www.w3.org/1999/xlink'

/** Elements that link the document to another source; removed whatever they point at. */
const LINKING_ELEMENTS: ReadonlySet<string> = new Set([
  'section-source',
  'table-source',
  'cell-range-source',
  'dde-source',
  'dde-connection-decl',
  'dde-connection',
  'dde-link',
])

/** Hyperlink elements, whose web and mail targets stay. */
const HYPERLINK_ELEMENTS: ReadonlySet<string> = new Set(['a'])

const SAFE_LINK_SCHEME = /^(?:https?|mailto):/i
const ANY_SCHEME = /^[a-z][a-z\d+.-]*:/i

const localName = (name: string): string => name.slice(name.indexOf(':') + 1)
const prefixOf = (name: string): string | undefined =>
  name.includes(':') ? name.slice(0, name.indexOf(':')) : undefined

/** `%2E%2E` read as `..`, as a URL resolver reads it; an undecodable escape stays as written. */
const decoded = (text: string): string =>
  Result.getOrElse(
    Result.try({ try: () => decodeURIComponent(text), catch: () => text }),
    () => text
  )

/** Whether a reference stays inside the package: relative, with no `..` segment. */
export const isInPackageReference = (href: string): boolean => {
  const target = decoded(href.trim())
  if (target === '' || target.startsWith('#')) return true
  if (ANY_SCHEME.test(target) || target.startsWith('/') || target.includes('\\')) return false
  return (
    target
      .split(/[?#]/, 1)[0]
      ?.split('/')
      .every((segment) => segment !== '..') ?? false
  )
}

/** Every prefix a part binds to the xlink namespace (`xlink` itself included). */
const xlinkPrefixes = (root: XmlElement): ReadonlySet<string> => {
  const walk = (element: XmlElement): readonly string[] => [
    ...Object.entries(element.attributes)
      .filter(([name, value]) => name.startsWith('xmlns:') && value === XLINK_NS)
      .map(([name]) => name.slice('xmlns:'.length)),
    ...element.children.flatMap((child) =>
      typeof child === 'object' && 'name' in child ? walk(child) : []
    ),
  ]
  return new Set(['xlink', ...walk(root)])
}

/** The element without an `xlink:href` that leaves the package, and without `xml:base`. */
const withoutExternalHref = (element: XmlElement, xlink: ReadonlySet<string>): XmlElement => {
  const hyperlink = HYPERLINK_ELEMENTS.has(localName(element.name))
  const kept = (name: string, value: string): boolean => {
    if (name === 'xml:base') return false
    const prefix = prefixOf(name)
    if (prefix === undefined || !xlink.has(prefix) || localName(name) !== 'href') return true
    return isInPackageReference(value) || (hyperlink && SAFE_LINK_SCHEME.test(value.trim()))
  }
  const attributes = Object.fromEntries(
    Object.entries(element.attributes).filter(([name, value]) => kept(name, value))
  )
  return Object.keys(attributes).length === Object.keys(element.attributes).length
    ? element
    : { ...element, attributes }
}

/** One part's tree with its external references removed (see the module header). */
export const stripOpenDocumentLinks = (root: XmlElement): XmlElement => {
  const xlink = xlinkPrefixes(root)
  return rewriteRoot(root, (element) =>
    LINKING_ELEMENTS.has(localName(element.name)) ? [] : [withoutExternalHref(element, xlink)]
  )
}

/** Text that could hold a reference worth parsing the part for. */
const MAY_LINK = /href|xml:base|-source|dde-/i
const DOCTYPE = /<!DOCTYPE/i

/** One XML part cleaned, `undefined` when it cannot be read safely. */
const cleanPart = (entry: ZipReadEntry): ZipEntry | undefined => {
  const text = entryText(entry)
  if (DOCTYPE.test(text)) return undefined
  if (!MAY_LINK.test(text)) return entry
  const parsed = parseXmlPart(text)
  if (!parsed.ok) return undefined
  const root = stripOpenDocumentLinks(parsed.part.root)
  return root === parsed.part.root
    ? entry
    : textEntry(entry.name, serializePart({ ...parsed.part, root }))
}

/**
 * The cleaned package, in its original entry order (so `mimetype` stays the
 * first entry, stored), or `undefined` when it is not a readable package.
 */
export const sanitizeOpenDocumentPackage = (bytes: Uint8Array): Uint8Array | undefined => {
  const read = readOoxmlPackage(bytes)
  if (!read.ok) return undefined
  const entries = read.entries.map((entry): ZipEntry | undefined =>
    entry.name.endsWith('.xml') ? cleanPart(entry) : entry
  )
  return entries.some((entry) => entry === undefined)
    ? undefined
    : writeOoxmlPackage(entries.filter((entry): entry is ZipEntry => entry !== undefined))
}
