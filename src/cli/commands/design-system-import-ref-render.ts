/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Rendering one file of a config assembled from `$ref` includes with its new
 * raw tree, changing as few bytes as the change needs.
 *
 *  - **A JSON file** is laid out again with the indentation it uses, its keys
 *    in their order, as a JSON config is.
 *  - **A YAML file** has an edit of values made on the lines holding them, each
 *    in its own quoting (`design-system-import-pages-yaml.ts`). A change of
 *    structure re-renders only the top-level keys it reaches, every other line
 *    kept, the file's leading comments included; in the config itself the
 *    `pages:` block is patched entry by entry, as an inline config is. A YAML
 *    file written in flow style is laid out as JSON, its leading comments kept.
 *
 * The new tree keeps each `{ $ref }` node as written, so no render inlines an
 * include. A render is read back before it is returned: one that does not
 * parse to the new tree answers `undefined`, which the caller refuses.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { sameTree } from '@/domain/kernel/config-parsing/ref-tree-compare'
import { patchYamlPages } from './design-system-import-pages-write'
import { isScalarEdit, patchYamlDocumentInPlace } from './design-system-import-pages-yaml'
import { renderYamlFragment } from './library-wire'
import type { RefFile } from './design-system-import-ref-owners'

type JsonObject = Readonly<Record<string, unknown>>

const lineEndingOf = (text: string): '\r\n' | '\n' => (text.includes('\r\n') ? '\r\n' : '\n')

/** A JSON text holding a new value, laid out as the text was. */
const relaidJson = (text: string, next: unknown): string => {
  const indent = /\n( +|\t)"/.exec(text)?.[1] ?? '  '
  const eol = lineEndingOf(text)
  const body = JSON.stringify(next, undefined, indent)
  return `${eol === '\n' ? body : body.replaceAll('\n', eol)}${text.endsWith('\n') ? eol : ''}`
}

/** The comment and blank lines a YAML file opens with, and the document after them. */
const splitHead = (lines: readonly string[]) => {
  const first = lines.findIndex((line) => line.trim() !== '' && !line.trimStart().startsWith('#'))
  return first === -1
    ? { head: lines, body: [] as readonly string[] }
    : { head: lines.slice(0, first), body: lines.slice(first) }
}

const escapeRegExp = (text: string): string => text.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The line range of a top-level key's block, its trailing comments left to what follows. */
const blockOf = (lines: readonly string[], key: string) => {
  const header = new RegExp(`^${escapeRegExp(key)}\\s*:`)
  const start = lines.findIndex((line) => header.test(line))
  if (start === -1) return undefined
  const next = lines.findIndex((line, index) => index > start && /^[^\s#]/.test(line))
  const limit = next === -1 ? lines.length : next
  const last = lines
    .slice(start + 1, limit)
    .findLastIndex((line) => line.trim() !== '' && !line.trimStart().startsWith('#'))
  return { start, end: last === -1 ? start + 1 : start + 2 + last }
}

const renderedBlock = (key: string, value: unknown): readonly string[] =>
  renderYamlFragment([], { [key]: value })
    .trimEnd()
    .split('\n')

/** Each page entry of the config's new `pages` that differs from the old one, by name. */
const pagePatches = (old: unknown, next: unknown) => {
  const before = Array.isArray(old) ? old : []
  return (Array.isArray(next) ? next : []).flatMap((entry: unknown) => {
    if (!isRecord(entry) || typeof entry['name'] !== 'string') return []
    const was = before.find((page: unknown) => isRecord(page) && page['name'] === entry['name'])
    return sameTree(was, entry) ? [] : [{ name: entry['name'], entry }]
  })
}

/** A YAML mapping's lines with each structurally changed top-level key re-rendered. */
const withBlocks = (
  lines: readonly string[],
  change: { readonly old: JsonObject; readonly next: JsonObject; readonly isConfig: boolean }
): readonly string[] | undefined => {
  const { old, next, isConfig } = change
  const keys = [...new Set([...Object.keys(old), ...Object.keys(next)])]
  const reshaped = keys.filter(
    (key) =>
      !(isConfig && key === 'pages') &&
      Object.hasOwn(old, key) &&
      (!Object.hasOwn(next, key) || !isScalarEdit(old[key], next[key]))
  )
  const replaced = reshaped.reduce<readonly string[] | undefined>((acc, key) => {
    const range = acc === undefined ? undefined : blockOf(acc, key)
    if (acc === undefined || range === undefined) return undefined
    const block = Object.hasOwn(next, key) ? renderedBlock(key, next[key]) : []
    return [...acc.slice(0, range.start), ...block, ...acc.slice(range.end)]
  }, lines)
  if (replaced === undefined) return undefined
  const added = keys.filter((key) => !Object.hasOwn(old, key))
  const trailing = replaced.at(-1) === '' ? [''] : []
  const body = trailing.length === 0 ? replaced : replaced.slice(0, -1)
  const appended = [...body, ...added.flatMap((key) => renderedBlock(key, next[key])), ...trailing]
  if (!isConfig || sameTree(old['pages'], next['pages'])) return appended
  const patches = pagePatches(old['pages'], next['pages'])
  return patchYamlPages(appended.join('\n'), patches)?.split('\n')
}

const parsesTo = (text: string, format: 'yaml' | 'json', next: unknown): boolean => {
  try {
    return sameTree(format === 'json' ? JSON.parse(text) : Bun.YAML.parse(text), next)
  } catch {
    // A render that does not parse is no render.
    return false
  }
}

/** A YAML file's text with its new tree, before it is read back. */
const renderYaml = (file: RefFile, next: unknown, isConfig: boolean): string | undefined => {
  const eol = lineEndingOf(file.text)
  const lines = file.text.split(eol)
  const { head, body } = splitHead(lines)
  if (/^[{[]/.test(body[0]?.trimStart() ?? '')) {
    return [...head, relaidJson(body.join(eol), next)].join(eol)
  }
  const inPlace = patchYamlDocumentInPlace(lines, file.tree, next)
  if (inPlace !== undefined) return inPlace.join(eol)
  if (!isRecord(file.tree) || !isRecord(next)) {
    return [...head, ...renderYamlFragment([], next).split('\n')].join(eol)
  }
  const blocks = withBlocks(lines, { old: file.tree, next, isConfig })
  if (blocks === undefined) return undefined
  const middle = Bun.YAML.parse(blocks.join('\n')) as unknown
  return (patchYamlDocumentInPlace(blocks, middle, next) ?? undefined)?.join(eol)
}

/**
 * One file's text holding its new raw tree, or `undefined` when it cannot be
 * written without re-laying out what the change does not reach.
 *
 * @param file - the file as read.
 * @param next - its new raw tree, every include kept as written.
 * @param isConfig - whether the file is the config itself, whose pages are patched entry by entry.
 */
export const renderRefFile = (
  file: RefFile,
  next: unknown,
  isConfig: boolean
): string | undefined => {
  if (sameTree(file.tree, next)) return file.text
  const text =
    file.format === 'json' ? relaidJson(file.text, next) : renderYaml(file, next, isConfig)
  return text !== undefined && parsesTo(text, file.format, next) ? text : undefined
}
