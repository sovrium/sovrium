/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium design-system import --pages --write` — writing the page entries a
 * drawing changed, beside the token import's `design` writer
 * (`design-system-import-write.ts`), on the same terms.
 *
 *  - **A JSON config** is re-laid out with the indentation it already uses,
 *    every other key kept where it was.
 *  - **A YAML config** has only the page ENTRIES that changed rewritten, each
 *    on the lines it held inside the top-level `pages:` block, so a comment,
 *    the quoting and every other page survive; a comment above an entry is
 *    that entry's, never the one before it. Inside an entry, an edit of values
 *    only changes the lines holding those values
 *    (`design-system-import-pages-yaml.ts`); a structural change re-renders
 *    the entry. A YAML file written in flow
 *    style (one JSON document, as YAML allows) is patched as JSON, its leading
 *    comment lines kept.
 *  - **A TypeScript config is never edited.** A changed page goes to its
 *    `<name>.page.json` sidecar, laid out exactly as Prettier lays out the JSON
 *    files of this repository — short arrays on one line — so a sidecar the
 *    operator's own formatter already ran over is rewritten byte for byte when
 *    nothing changed.
 *
 * The bytes land through the token import's atomic writer, and a write that
 * changes nothing writes nothing.
 */

import { dirname, join } from 'node:path'
import { patchYamlEntryInPlace } from './design-system-import-pages-yaml'
import { writeAtomically } from './design-system-import-write'
import { renderYamlFragment } from './library-wire'
import type { Options } from 'prettier'

type JsonObject = Readonly<Record<string, unknown>>

/** One page entry to write, by its page name. */
export interface PagePatch {
  readonly name: string
  readonly entry: JsonObject
}

/** The line ending a text uses, so a patch keeps a CRLF file CRLF. */
const lineEndingOf = (text: string): '\r\n' | '\n' => (text.includes('\r\n') ? '\r\n' : '\n')

const nameOf = (entry: unknown): unknown =>
  typeof entry === 'object' && entry !== null
    ? (entry as Readonly<Record<string, unknown>>)['name']
    : undefined

/** The patches naming no page of a list: new pages, written after it. */
const newPatches = (pages: readonly unknown[], patches: readonly PagePatch[]) =>
  patches.filter((patch) => !pages.some((page) => nameOf(page) === patch.name))

/** The pages list with each patched entry in its place, and each new page after them. */
const patchedPages = (
  pages: readonly unknown[],
  patches: readonly PagePatch[]
): readonly unknown[] => [
  ...pages.map((page) => patches.find((patch) => patch.name === nameOf(page))?.entry ?? page),
  ...newPatches(pages, patches).map((patch) => patch.entry),
]

/**
 * A JSON root with its patched page entries in place, laid out as it was.
 *
 * @param text - the config file.
 * @param patches - the page entries to write, by page name.
 */
export const patchJsonPages = (text: string, patches: readonly PagePatch[]): string => {
  const root = JSON.parse(text) as JsonObject
  const pages = Array.isArray(root['pages']) ? (root['pages'] as readonly unknown[]) : []
  const indent = /\n( +|\t)"/.exec(text)?.[1] ?? '  '
  const eol = lineEndingOf(text)
  const trailing = text.endsWith('\n') ? eol : ''
  const body = JSON.stringify({ ...root, pages: patchedPages(pages, patches) }, undefined, indent)
  return `${eol === '\n' ? body : body.replaceAll('\n', eol)}${trailing}`
}

/** The comment and blank lines a YAML file opens with, and the document after them. */
const splitLeadingComments = (
  lines: readonly string[]
): { readonly head: readonly string[]; readonly body: readonly string[] } => {
  const first = lines.findIndex((line) => line.trim() !== '' && !line.trimStart().startsWith('#'))
  return first === -1
    ? { head: lines, body: [] }
    : { head: lines.slice(0, first), body: lines.slice(first) }
}

/** A flow-style YAML document (one JSON value) patched as JSON, its leading comments kept. */
const patchFlowYaml = (
  lines: readonly string[],
  eol: string,
  patches: readonly PagePatch[]
): string | undefined => {
  const { head, body } = splitLeadingComments(lines)
  const text = body.join(eol)
  if (!text.trimStart().startsWith('{')) return undefined
  try {
    JSON.parse(text)
  } catch {
    // A flow mapping YAML reads but JSON does not: not ours to re-lay out.
    return undefined
  }
  return [...head, patchJsonPages(text, patches)].join(eol)
}

/** The line ranges of each entry of a YAML root's top-level `pages:` block sequence. */
const pageItemRanges = (
  lines: readonly string[]
):
  | { readonly indent: string; readonly ranges: readonly (readonly [number, number])[] }
  | undefined => {
  const start = lines.findIndex((line) => /^pages\s*:\s*(?:#.*)?$/.test(line))
  if (start === -1) return undefined
  const next = lines.findIndex((line, index) => index > start && /^[^\s#]/.test(line))
  const limit = next === -1 ? lines.length : next
  const firstItem = lines.findIndex(
    (line, index) => index > start && index < limit && /^\s*- /.test(line)
  )
  if (firstItem === -1) return undefined
  const indent = /^(\s*)- /.exec(lines[firstItem] ?? '')?.[1] ?? ''
  const starts = lines.flatMap((line, index) =>
    index > start && index < limit && line.startsWith(`${indent}- `) ? [index] : []
  )
  // An entry ends on its own last content line: the comments and blank lines
  // after it sit ABOVE the next entry (or the next top-level key), and belong there.
  const endOf = (from: number, before: number): number =>
    lines
      .slice(0, before)
      .findLastIndex(
        (line, index) => index >= from && line.trim() !== '' && !line.trimStart().startsWith('#')
      ) + 1
  return {
    indent,
    ranges: starts.map((from, index) => [from, endOf(from, starts[index + 1] ?? limit)] as const),
  }
}

/** A page entry rendered as one item of a block sequence at an indentation. */
const renderedItem = (entry: JsonObject, indent: string): readonly string[] =>
  renderYamlFragment([], [entry])
    .trimEnd()
    .split('\n')
    .map((line) => (line === '' ? line : `${indent}${line}`))

/**
 * A YAML root with only its patched page entries rewritten, every other line
 * kept; `undefined` when the pages cannot be found item by item, which the
 * caller refuses rather than guess.
 *
 * @param text - the config file.
 * @param patches - the page entries to write, by page name.
 */
export const patchYamlPages = (text: string, patches: readonly PagePatch[]): string | undefined => {
  const eol = lineEndingOf(text)
  const lines = text.split(eol)
  const flow = patchFlowYaml(lines, eol, patches)
  if (flow !== undefined) return flow
  const items = pageItemRanges(lines)
  if (items === undefined) return undefined
  const entries = items.ranges.map(([from, to]) => {
    const parsed = Bun.YAML.parse(
      lines
        .slice(from, to)
        .map((line) => line.slice(items.indent.length))
        .join('\n')
    )
    return Array.isArray(parsed) ? (parsed[0] as unknown) : undefined
  })
  const replaced = items.ranges
    .toReversed()
    .reduce<readonly string[]>((acc, [from, to], reversedIndex) => {
      const index = items.ranges.length - 1 - reversedIndex
      const patch = patches.find((candidate) => candidate.name === nameOf(entries[index]))
      if (patch === undefined) return acc
      // An edit of values only is made on the lines that hold them; any other
      // change re-renders the entry, on the lines it held.
      const written =
        patchYamlEntryInPlace(acc.slice(from, to), entries[index], patch.entry) ??
        renderedItem(patch.entry, items.indent)
      return [...acc.slice(0, from), ...written, ...acc.slice(to)]
    }, lines)
  // A new page goes after the last entry, before what follows the block.
  const added = newPatches(entries, patches).flatMap((patch) =>
    renderedItem(patch.entry, items.indent)
  )
  const end = items.ranges.at(-1)?.[1] ?? 0
  const shift = replaced.length - lines.length
  return [...replaced.slice(0, end + shift), ...added, ...replaced.slice(end + shift)].join(eol)
}

/**
 * The formatting a page sidecar is written with: Prettier's JSON layout at
 * this repository's width, pinned here rather than resolved from the disk, so
 * an operator's stray `.prettierrc` never changes a byte of it.
 */
const SIDECAR_FORMAT: Readonly<Options> = {
  parser: 'json',
  plugins: [],
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  endOfLine: 'lf',
  bracketSpacing: true,
}

/**
 * A page entry as its `<name>.page.json` sidecar holds it: indented JSON laid
 * out by Prettier, which keeps every object open and closes an array that fits
 * on one line — the bytes the formatter of a project would leave.
 */
export const formatPageSidecar = async (entry: JsonObject): Promise<string> => {
  const prettier = await import('prettier')
  return prettier.format(JSON.stringify(entry, undefined, 2), SIDECAR_FORMAT)
}

/** How many bytes differ between two texts: the span between their common prefix and suffix. */
export const changedBytes = (before: string, after: string): number => {
  if (before === after) return 0
  const a = new TextEncoder().encode(before)
  const b = new TextEncoder().encode(after)
  const shorter = Math.min(a.length, b.length)
  const prefix = Array.from({ length: shorter }).findIndex((_, index) => a[index] !== b[index])
  const head = prefix === -1 ? shorter : prefix
  const tail = Array.from({ length: shorter - head }).findIndex(
    (_, index) => a[a.length - 1 - index] !== b[b.length - 1 - index]
  )
  const common = head + (tail === -1 ? shorter - head : tail)
  return Math.max(a.length, b.length) - common
}

/** What writing one page sidecar did. */
export interface WrittenPageSidecar {
  readonly bytes: number
  /** Whether the sidecar was there before this write. */
  readonly existed: boolean
}

/**
 * Write a page sidecar beside a TypeScript config. A file of that name that
 * holds another page is someone's, and is refused rather than overwritten.
 *
 * @param configPath - the TypeScript config.
 * @param sidecar - the sidecar path, relative to the config.
 * @param entry - the whole page entry.
 */
export const writePageSidecar = async (
  configPath: string,
  sidecar: string,
  entry: JsonObject
): Promise<WrittenPageSidecar | { readonly foreign: string }> => {
  const path = join(dirname(configPath), sidecar)
  const file = Bun.file(path)
  const previous = (await file.exists()) ? await file.text() : undefined
  if (previous !== undefined) {
    const held = (() => {
      try {
        return nameOf(JSON.parse(previous) as unknown)
      } catch {
        // Not JSON: certainly not this page's sidecar.
        return undefined
      }
    })()
    if (held !== entry['name']) return { foreign: path }
  }
  const next = await formatPageSidecar(entry)
  if (previous !== next) await writeAtomically(path, next)
  return { bytes: changedBytes(previous ?? '', next), existed: previous !== undefined }
}
