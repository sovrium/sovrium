/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium design-system import --pages --new-pages` on a TypeScript config:
 * each new page is appended as an object literal to the `pages` array literal
 * of the config's own module, after its last element and in its indentation.
 * When the module does not write `pages` as such a literal, the import is
 * refused naming the file and line where `pages` is computed, with
 * `--sidecar` as the way out — never an automatic fallback.
 */

import { dirname, join } from 'node:path'
import { locateConfigArray } from '@/infrastructure/config/ts-config-arrays'
import { refuse } from './app-prelude'
import type { MergedPage } from './design-system-import-pages-apply'
import type { ConfigSources } from '@/infrastructure/config/ts-config-literals'

type JsonObject = Readonly<Record<string, unknown>>

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** The new page entries to append to the `pages` array literal of the config's module. */
export interface PageAppend {
  readonly path: string
  readonly file: string
  readonly line: number
  readonly insertAt: number
  /** The text just before {@link insertAt} when it was read. */
  readonly anchor: string
  /** The text inserted: the entries as object literals, in the file's indentation. */
  readonly text: string
  /** The entries appended, to judge the result before writing. */
  readonly entries: readonly JsonObject[]
}

/**
 * A JSON value as the text of a JavaScript expression that evaluates to it.
 * JSON is that already, but for one key: a literal `"__proto__": …` sets the
 * object's prototype where JSON names an own property, so it is written as a
 * computed key, and the module evaluates to the value the import validated.
 * Every other key and value is JSON-quoted, so no quote, backtick or `${` a
 * board carries can end a string and run in the user's config.
 */
const expressionOf = (value: unknown): string =>
  JSON.stringify(value, undefined, 2).replaceAll(/^( *)"__proto__":/gm, '$1["__proto__"]:')

/** New page entries as object literals, each line in the array's indentation and line ending. */
const appendedText = (
  entries: readonly JsonObject[],
  site: { readonly indent: string; readonly empty: boolean; readonly newline: string }
): string => {
  const { newline: eol } = site
  const inner = site.empty ? `${site.indent}  ` : site.indent
  const literals = entries.map((entry) => expressionOf(entry).replaceAll('\n', `${eol}${inner}`))
  return site.empty
    ? `${eol}${inner}${literals.join(`,${eol}${inner}`)}${eol}${site.indent}`
    : literals.map((literal) => `,${eol}${inner}${literal}`).join('')
}

/**
 * The new pages as one append to the `pages` array literal of the config's
 * module, or the whole import refused naming where `pages` is computed.
 */
export const plannedAppends = async (
  sources: ConfigSources,
  created: readonly MergedPage[]
): Promise<readonly PageAppend[]> => {
  if (created.length === 0) return []
  const site = await locateConfigArray(sources, ['pages'])
  if (site?.kind !== 'array') {
    const where =
      site === undefined
        ? 'the config has no default export the import can follow'
        : `the config computes its pages at ${site.file}:${site.line} rather than writing them as an array literal of its own module`
    return refuse(
      `Error: The page ${created.map((page) => page.name).join(', ')} is new, and ${where}, so nothing was written.\n\n` +
        '  Add the page to pages there by hand, or run again with --sidecar to write the new page to its sidecar.'
    )
  }
  const entries = created.map((page) => page.plan.patch ?? {})
  return [
    {
      path: join(dirname(sources.root), site.file),
      file: site.file,
      line: site.line,
      insertAt: site.insertAt,
      anchor: site.anchor,
      text: appendedText(entries, site),
      entries,
    },
  ]
}

/** A root with each new page appended to its pages. */
export const withAppends = (root: unknown, appends: readonly PageAppend[]): unknown =>
  appends.length === 0 || !isObject(root)
    ? root
    : {
        ...root,
        pages: [
          ...(Array.isArray(root['pages']) ? (root['pages'] as readonly unknown[]) : []),
          ...appends.flatMap((append) => append.entries),
        ],
      }
