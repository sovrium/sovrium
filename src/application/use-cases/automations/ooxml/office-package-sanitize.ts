/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { entryText, readOoxmlPackage, textEntry, writeOoxmlPackage } from './ooxml-package'
import { removedIdsOf, stripPackageRelationships } from './ooxml-relationships'
import { partMayNeedCleaning, sanitizePartRoot } from './ooxml-sanitize'
import { parseXmlPart, serializePart } from './ooxml-tree'
import type { ZipEntry } from '../action-handlers/file-zip'
import type { ZipReadEntry } from '../action-handlers/file-zip-read'

/**
 * A WHOLE OFFICE PACKAGE (`.docx`, `.xlsx`, `.pptx`) CLEANED BEFORE IT LEAVES
 * FOR THE OFFICE ENGINE: every external relationship but a web or mail
 * hyperlink removed, references to them dropped, linked media dropped, and
 * fetching field codes (`INCLUDEPICTURE`, `INCLUDETEXT`, …) unwrapped to
 * their result — the
 * sanitizer `generateDocx` runs on its output, applied to a file converted as
 * it is. The engine is then never asked to fetch anything; its network lock is
 * the second wall, not the only one.
 */

/** An XML part without fetching fields, linked media or references to removed relationships. */
const cleanPart = (entry: ZipReadEntry, removed: ReadonlySet<string>): ZipEntry | undefined => {
  const text = entryText(entry)
  if (!partMayNeedCleaning(text, removed)) return entry
  const parsed = parseXmlPart(text)
  if (!parsed.ok) return undefined
  const root = sanitizePartRoot(parsed.part.root, removed)
  return root === parsed.part.root
    ? entry
    : textEntry(entry.name, serializePart({ ...parsed.part, root }))
}

/** The cleaned package, or `undefined` when it is not a readable Office package. */
export const sanitizeOfficePackage = (bytes: Uint8Array): Uint8Array | undefined => {
  const read = readOoxmlPackage(bytes)
  if (!read.ok) return undefined
  const relationships = stripPackageRelationships(read.entries)
  if (!relationships.ok) return undefined
  const entries = read.entries.map((entry): ZipEntry | undefined => {
    const cleaned = relationships.value.rewritten.get(entry.name)
    if (cleaned !== undefined) return cleaned
    if (!entry.name.toLowerCase().endsWith('.xml')) return entry
    return cleanPart(entry, removedIdsOf(relationships.value, entry.name))
  })
  return entries.some((entry) => entry === undefined)
    ? undefined
    : writeOoxmlPackage(entries.filter((entry): entry is ZipEntry => entry !== undefined))
}
