/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * TypeScript Config Arrays - Infrastructure Layer
 *
 * Where an ARRAY of a `.ts` config is written, so that a new entry can be
 * appended to it in place: `sovrium design-system import --pages --new-pages`
 * appends a new page to the `pages` array literal of the config's own module.
 * The walk is the one `ts-config-literals.ts` follows for a value. Nothing
 * here evaluates the config or writes a file.
 */

import { dirname, relative } from 'node:path'
import {
  defaultExportOf,
  lineOf,
  parserOf,
  stepInto,
  unwrapped,
  walk,
  type At,
  type ConfigSources,
  type Step,
} from './ts-config-literals'
import type ts from 'typescript'

/** Where an array of a `.ts` config is written, when it is a literal an entry can be appended to. */
export type ConfigArraySite =
  | {
      /**
       * An array literal of the root module: a new element goes at `insertAt`,
       * after the last one (or inside `[`), where `anchor` ends, indented as
       * the last element's line (or the bracket's).
       */
      readonly kind: 'array'
      readonly file: string
      readonly line: number
      readonly insertAt: number
      readonly anchor: string
      readonly indent: string
      readonly empty: boolean
      /** The line ending the module is written with, so a CRLF file stays CRLF. */
      readonly newline: '\r\n' | '\n'
    }
  | { readonly kind: 'computed'; readonly file: string; readonly line: number }

/** The leading whitespace of the line a position sits on. */
const indentAt = (text: string, position: number): string =>
  /^[ \t]*/.exec(text.slice(text.lastIndexOf('\n', position - 1) + 1))?.[0] ?? ''

/** An array literal's site, where a new element would be appended. */
const arraySiteOf = (
  file: ts.SourceFile,
  node: ts.ArrayLiteralExpression,
  at: { readonly file: string; readonly line: number }
): ConfigArraySite => {
  const text = file.getFullText()
  const newline = text.includes('\r\n') ? '\r\n' : '\n'
  const last = node.elements.at(-1)
  if (last === undefined) {
    const insertAt = node.getStart(file) + 1
    return {
      kind: 'array',
      ...at,
      insertAt,
      anchor: '[',
      indent: indentAt(text, insertAt),
      empty: true,
      newline,
    }
  }
  return {
    kind: 'array',
    ...at,
    insertAt: last.getEnd(),
    anchor: last.getText(file),
    indent: indentAt(text, last.getStart(file)),
    empty: false,
    newline,
  }
}

/**
 * Where an array of a `.ts` config is written: an array literal of the root
 * module, holding no spread and written outside any function, reached from its
 * default export through object literals (a name of that module may stand for
 * one), is one an entry can be appended to. Any other expression — a helper's
 * return, a spread, an imported constant — is computed, and named by file and
 * line.
 *
 * @param sources - the config's module sources; the root holds `export default`.
 * @param path - the array's path from the config root (`['pages']`).
 * @returns the array's site, the site where it is computed, or `undefined` when
 *   the root has no default export to follow.
 */
export const locateConfigArray = async (
  sources: ConfigSources,
  path: readonly Step[]
): Promise<ConfigArraySite | undefined> => {
  const compiler = (await import('typescript')).default
  const parse = parserOf(compiler, sources)
  const root = parse(sources.root)
  const exported = root === undefined ? undefined : defaultExportOf(compiler, root)
  const last = path.at(-1)
  if (root === undefined || exported === undefined || last === undefined) return undefined
  const context = { sources, parse }
  const parent = walk(
    compiler,
    context,
    { node: exported, file: root, hopped: false },
    path.slice(0, -1)
  )
  const stepped = parent.complete ? stepInto(compiler, parent.at, last) : undefined
  return siteOfStep(compiler, { root, at: parent.at, stepped, base: dirname(sources.root) })
}

/**
 * Whether a node is written inside a function: a helper's return, made anew on
 * every call, which an append would change for every caller.
 */
const insideFunction = (compiler: typeof ts, node: ts.Node): boolean =>
  node.parent !== undefined &&
  (compiler.isFunctionLike(node.parent) || insideFunction(compiler, node.parent))

/** The site one step reached: an appendable array literal of the root, else where it is computed. */
const siteOfStep = (
  compiler: typeof ts,
  reached: {
    readonly root: ts.SourceFile
    readonly at: At
    readonly stepped: ts.Node | undefined
    readonly base: string
  }
): ConfigArraySite => {
  const { file } = reached.at
  const node = unwrapped(compiler, reached.stepped ?? reached.at.node)
  const at = { file: relative(reached.base, file.fileName), line: lineOf(file, node) }
  return reached.stepped !== undefined &&
    file === reached.root &&
    compiler.isArrayLiteralExpression(node) &&
    !node.elements.some(compiler.isSpreadElement) &&
    !insideFunction(compiler, node)
    ? arraySiteOf(file, node, at)
    : { kind: 'computed', ...at }
}
