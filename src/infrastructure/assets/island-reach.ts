/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The part of the island bundle a set of generated pages can reach, read off
 * the bundle's own import graph — what a static build writes under
 * `assets/islands/`, instead of the whole bundle.
 *
 * A page reaches:
 *
 * 1. every island file its HTML names (the entry's `<script src>`, an inert
 *    `<template data-island-entry>`, a `modulepreload` link), and every file
 *    those import statically — what the browser fetches before a line runs;
 * 2. for every island type it mounts (`data-island="<type>"`, or
 *    `data-island-deferred="<type>"` for one woken on demand, the command
 *    palette among them), that island's chunk and every file it imports,
 *    statically or lazily — a loader it imports from the entry's closure
 *    (the registry exports the editors' loaders the data table calls) included.
 *
 * The chunk of a type is found where the browser finds it: the island
 * registry, a module of the entry's static closure, maps each type to a loader
 * whose body is an `import("./…")`. The emitted text is scanned for the
 * `<type>:` properties whose value is such an import, inline or through an
 * identifier bound to one — the module NAME a chunk carries is never read.
 *
 * Nothing here can make a page lose a file: a type the registry does not name
 * answers `undefined`, and the caller writes the whole bundle instead.
 */

import {
  collectStaticClosure,
  resolveSibling,
  type IslandChunkReader,
} from './island-preload-manifest'

/** An island file a page names, relative to `/assets/islands/`, its query dropped. */
const ISLAND_REFERENCE = /\/assets\/islands\/([^"'\s)?#]+)/g

/** A mounted island type, mounted now or woken on demand. */
const ISLAND_MARKER = /\bdata-island(?:-deferred)?="([^"]+)"/g

/** What one generated page reaches into the island bundle. */
export interface IslandPageReach {
  /** The island files it names, relative to `/assets/islands/`. */
  readonly files: ReadonlySet<string>
  /** The island types it mounts. */
  readonly types: ReadonlySet<string>
}

/** The island files and types a generated page names. */
export const islandPageReachOf = (html: string): IslandPageReach => ({
  files: new Set([...html.matchAll(ISLAND_REFERENCE)].flatMap((match) => match[1] ?? [])),
  types: new Set([...html.matchAll(ISLAND_MARKER)].flatMap((match) => match[1] ?? [])),
})

/** A dynamic `import("./x.js")` and the specifier it names. */
const DYNAMIC_IMPORT = /\bimport\(\s*["']([^"']+)["']\s*\)/g

/** The relative specifiers of the dynamic imports in a text. */
const dynamicSpecifiersOf = (text: string): readonly string[] =>
  [...text.matchAll(DYNAMIC_IMPORT)]
    .flatMap((match) => match[1] ?? [])
    .filter((specifier) => specifier.startsWith('.'))

/** The characters that open and close a nesting level. */
const OPENERS: Readonly<Record<string, string>> = { '(': ')', '[': ']', '{': '}' }
const CLOSERS: ReadonlySet<string> = new Set([')', ']', '}'])

/** Where a scan stands: its bracket depth, and the quote it sits inside. */
interface ScanState {
  depth: number
  quote: string | undefined
}

/** One character outside a string: `true` when it ends the expression. */
const endsExpression = (state: ScanState, char: string): boolean => {
  if (char === '"' || char === "'" || char === '`') state.quote = char
  else if (OPENERS[char] !== undefined) state.depth += 1
  else if (CLOSERS.has(char)) {
    if (state.depth === 0) return true
    state.depth -= 1
  } else if ((char === ',' || char === ';') && state.depth === 0) return true
  return false
}

/**
 * The expression starting at `start`: the text up to the first `,` or `;` (or
 * the close of the level it sits in) outside any bracket or string.
 */
const expressionAt = (text: string, start: number): string => {
  const state: ScanState = { depth: 0, quote: undefined }
  for (let at = start; at < text.length; at += 1) {
    const char = text[at] as string
    if (state.quote === undefined) {
      if (endsExpression(state, char)) return text.slice(start, at)
    } else if (char === '\\') at += 1
    else if (char === state.quote) state.quote = undefined
  }
  return text.slice(start)
}

/** An identifier bound by `name = …`, never `==`, `===` or `=>`. */
const BINDING = /(?:^|[^\w$.])([A-Za-z_$][\w$]*)\s*=(?![=>])/g

/** Each identifier of a file bound to an expression holding one dynamic import, and its specifier. */
const loadersOf = (text: string): ReadonlyMap<string, string> =>
  new Map(
    [...text.matchAll(BINDING)].flatMap((match) => {
      const name = match[1]
      if (name === undefined) return []
      const value = expressionAt(text, (match.index ?? 0) + match[0].length)
      const specifiers = dynamicSpecifiersOf(value)
      return specifiers.length === 1 ? [[name, specifiers[0] as string] as const] : []
    })
  )

/** A property named `type`, bare or quoted, as an object literal writes it. */
const propertyPattern = (type: string): RegExp => {
  const escaped = type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const bare = /^[A-Za-z_$][\w$]*$/.test(type) ? `|(?:^|[{,\\s])${escaped}` : ''
  return new RegExp(`(?:["']${escaped}["']${bare})\\s*:`, 'g')
}

const IDENTIFIER = /[A-Za-z_$][\w$]*/g

/** One file of the entry's closure: its path, its text, its loaders. */
interface ScannedFile {
  readonly path: string
  readonly text: string
  readonly loaders: ReadonlyMap<string, string>
}

/**
 * The chunks a property value loads: its inline dynamic imports, else the
 * loader each identifier in it is bound to — in its own file first.
 */
const chunksOfValue = (
  value: string,
  file: ScannedFile,
  files: readonly ScannedFile[]
): readonly string[] => {
  const inline = dynamicSpecifiersOf(value).map((specifier) => resolveSibling(file.path, specifier))
  if (inline.length > 0) return inline
  return [...value.matchAll(IDENTIFIER)].flatMap((match) => {
    const name = match[0]
    const own = file.loaders.get(name)
    if (own !== undefined) return [resolveSibling(file.path, own)]
    const elsewhere = files.flatMap((other) => {
      const specifier = other.loaders.get(name)
      return specifier === undefined ? [] : [resolveSibling(other.path, specifier)]
    })
    return elsewhere.length === 1 ? elsewhere : []
  })
}

/**
 * The chunks the registry loads for `type`, or `undefined` when no file of the
 * closure names the type at all. An empty list is an island the entry carries.
 */
const chunksOfType = (
  type: string,
  files: readonly ScannedFile[]
): readonly string[] | undefined => {
  const found = files.flatMap((file) =>
    [...file.text.matchAll(propertyPattern(type))].map((match) =>
      chunksOfValue(expressionAt(file.text, (match.index ?? 0) + match[0].length), file, files)
    )
  )
  return found.length === 0 ? undefined : [...new Set(found.flat())]
}

/** A named import clause and the specifier it imports from: `import{a as b,c}from"./x.js"`. */
const NAMED_IMPORT = /\bimport\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g

/** A namespace import and its specifier: `import*as R from"./x.js"`. */
const NAMESPACE_IMPORT = /\bimport\s*\*\s*as\s+[\w$]+\s+from\s*["']([^"']+)["']/g

/** An export clause, `export{a as b,c}`, never `export{…}from`. */
const EXPORT_CLAUSE = /\bexport\s*\{([^}]*)\}(?!\s*from)/g

/** A declaration exported where it is bound: `export const a = …`. */
const EXPORTED_DECLARATION = /\bexport\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g

/** The `[left, right]` names of one clause entry, `a as b` or `a`. */
const clauseEntriesOf = (clause: string): ReadonlyArray<readonly [string, string]> =>
  clause.split(',').flatMap((entry) => {
    const [left, right] = entry.trim().split(/\s+as\s+/)
    return left === undefined || left === '' ? [] : [[left, right ?? left] as const]
  })

/**
 * The loaders a file exports, by the name it exports them under: a chunk that
 * imports one of them lazily loads what the loader names, although the import
 * sits in the exporting file. The registry exports the rich-text and code
 * editors' loaders this way, and the data table calls them.
 */
const exportedLoadersOf = (file: ScannedFile): ReadonlyMap<string, string> => {
  const byClause = [...file.text.matchAll(EXPORT_CLAUSE)].flatMap((match) =>
    clauseEntriesOf(match[1] ?? '')
  )
  const byDeclaration = [...file.text.matchAll(EXPORTED_DECLARATION)].flatMap((match) =>
    match[1] === undefined ? [] : [[match[1], match[1]] as const]
  )
  return new Map(
    [...byClause, ...byDeclaration].flatMap(([local, exported]) => {
      const specifier = file.loaders.get(local)
      return specifier === undefined
        ? []
        : [[exported, resolveSibling(file.path, specifier)] as const]
    })
  )
}

/** The entry-closure files a chunk can borrow a loader from, by path. */
type SharedLoaders = ReadonlyMap<string, ReadonlyMap<string, string>>

/**
 * The chunks a file loads through loaders it imports from a file of the entry's
 * closure: the loaders it names, or every one a namespace import can reach.
 */
const borrowedChunksOf = (path: string, text: string, shared: SharedLoaders): readonly string[] => {
  const named = [...text.matchAll(NAMED_IMPORT)].flatMap((match) => {
    const loaders = shared.get(resolveSibling(path, match[2] ?? ''))
    if (loaders === undefined) return []
    return clauseEntriesOf(match[1] ?? '').flatMap(([exported]) => loaders.get(exported) ?? [])
  })
  const namespaced = [...text.matchAll(NAMESPACE_IMPORT)].flatMap((match) => [
    ...(shared.get(resolveSibling(path, match[1] ?? ''))?.values() ?? []),
  ])
  return [...named, ...namespaced]
}

/**
 * Every file `start` reaches, statically or lazily — a loader it borrows from
 * the entry's closure included — never expanding a file of `known`.
 */
const fullClosureOf = async (
  reader: IslandChunkReader,
  start: string,
  known: ReadonlySet<string>,
  shared: SharedLoaders
): Promise<ReadonlySet<string>> => {
  const seen = new Set<string>()
  const visit = async (path: string): Promise<void> => {
    if (seen.has(path) || known.has(path)) return
    seen.add(path)
    const statics = await collectStaticClosure(reader, path)
    const fresh = [...statics].filter((file) => file !== path && !known.has(file))
    const text = await reader.read(path).catch(() => '')
    const lazy = dynamicSpecifiersOf(text).map((specifier) => resolveSibling(path, specifier))
    await Promise.all([...fresh, ...lazy, ...borrowedChunksOf(path, text, shared)].map(visit))
  }
  await visit(start)
  return seen
}

/**
 * Every island file the pages reach, relative to `/assets/islands/`, or
 * `undefined` when a mounted type cannot be traced to its chunk — the caller
 * then writes the whole bundle, so no page ever loses a file.
 */
export const islandReachOf = async (
  reader: IslandChunkReader,
  pages: readonly IslandPageReach[]
): Promise<ReadonlySet<string> | undefined> => {
  const named = [...new Set(pages.flatMap((page) => [...page.files]))]
  const types = [...new Set(pages.flatMap((page) => [...page.types]))]
  const closures = await Promise.all(named.map((file) => collectStaticClosure(reader, file)))
  const entryClosure = new Set(closures.flatMap((closure) => [...closure]))
  if (types.length === 0) return entryClosure
  const scanned = await Promise.all(
    [...entryClosure].map(async (path) => {
      const text = await reader.read(path).catch(() => '')
      return { path, text, loaders: loadersOf(text) }
    })
  )
  const chunks = types.map((type) => chunksOfType(type, scanned))
  if (chunks.some((chunk) => chunk === undefined)) return undefined
  const shared: SharedLoaders = new Map(
    scanned.map((file) => [file.path, exportedLoadersOf(file)] as const)
  )
  const reached = await Promise.all(
    [...new Set(chunks.flatMap((chunk) => chunk ?? []))].map((chunk) =>
      fullClosureOf(reader, chunk, entryClosure, shared)
    )
  )
  return new Set([...entryClosure, ...reached.flatMap((set) => [...set])])
}
