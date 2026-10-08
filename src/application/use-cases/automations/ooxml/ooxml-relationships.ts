/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { entryText, textEntry } from './ooxml-package'
import { stripExternalRelationships } from './ooxml-sanitize'
import { parseXmlPart, serializePart } from './ooxml-tree'
import type { ZipEntry } from '../action-handlers/file-zip'
import type { ZipReadEntry } from '../action-handlers/file-zip-read'

/**
 * The relationship parts of a whole package, external targets removed — the
 * one implementation the Word fill (`docx-structure.ts`) and the conversion
 * sanitizer (`office-package-sanitize.ts`) share.
 *
 * EVERY `*.rels` part is parsed: a text prefilter on `TargetMode="External"`
 * misses `TargetMode="&#69;xternal"`, which the XML parser — and LibreOffice —
 * read as `External`. Part names are matched case-insensitively, as the Open
 * Packaging Conventions compare them.
 */

const RELS = /^(.*?)_rels\/([^/]*)\.rels$/i

/** `word/_rels/document.xml.rels` → `word/document.xml`; `_rels/.rels` → `''` (the package). */
export const relsSourceOf = (name: string): string | undefined => {
  const match = RELS.exec(name)
  return match === null ? undefined : `${match[1] ?? ''}${match[2] ?? ''}`
}

/** The key a part's lost ids are filed under: OPC part names ignore case. */
const partKey = (name: string): string => name.toLowerCase()

export interface PackageRelationships {
  /** The relationship parts that lost a target, rewritten, by entry name. */
  readonly rewritten: ReadonlyMap<string, ZipEntry>
  /** The ids each source part lost; read with {@link removedIdsOf}. */
  readonly removed: ReadonlyMap<string, ReadonlySet<string>>
}

export type PackageRelationshipsResult =
  | { readonly ok: true; readonly value: PackageRelationships }
  | { readonly ok: false; readonly part: string; readonly message: string }

/** Strip every relationship part of a package; the first unparseable one refuses it. */
export const stripPackageRelationships = (
  entries: ReadonlyArray<ZipReadEntry>
): PackageRelationshipsResult => {
  const parts = entries
    .filter((entry) => relsSourceOf(entry.name) !== undefined)
    .map((entry) => ({ entry, parsed: parseXmlPart(entryText(entry)) }))
  const broken = parts.find((part) => !part.parsed.ok)
  if (broken !== undefined && !broken.parsed.ok) {
    return { ok: false, part: broken.entry.name, message: broken.parsed.message }
  }
  const stripped = parts.flatMap(({ entry, parsed }) => {
    if (!parsed.ok) return []
    const { root, removedIds } = stripExternalRelationships(parsed.part.root)
    return removedIds.size === 0 ? [] : [{ entry, part: { ...parsed.part, root }, removedIds }]
  })
  return {
    ok: true,
    value: {
      rewritten: new Map(
        stripped.map((s) => [s.entry.name, textEntry(s.entry.name, serializePart(s.part))])
      ),
      removed: new Map(
        stripped.map((s) => [partKey(relsSourceOf(s.entry.name) ?? ''), s.removedIds])
      ),
    },
  }
}

/** The ids the part named `name` lost — none when its relationships kept every target. */
export const removedIdsOf = (
  relationships: PackageRelationships,
  name: string
): ReadonlySet<string> => relationships.removed.get(partKey(name)) ?? new Set<string>()
