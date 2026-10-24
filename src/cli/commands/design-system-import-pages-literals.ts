/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium design-system import --pages` on a TypeScript config, without
 * `--sidecar`: each edited value is rewritten IN PLACE, literal by literal, in
 * the module that owns the page, so a page built from helpers keeps following
 * them and the file changes on the edited lines only.
 *
 * Only a value that is a plain string or number literal of that module can be
 * rewritten (`ts-config-literals.ts`). An edit to any other value — a helper's
 * return, an expression, an imported constant — is refused `NOT_A_LITERAL`
 * with the file and line where it is computed, and nothing is written in its
 * place: no sidecar either. An edit that changes the page's structure (a move,
 * an addition, a removal, a property the page did not set) has no literal to
 * rewrite, and is refused whole with the way to write it, `--sidecar`.
 *
 * A NEW page (`--new-pages`) is appended as an object literal to the `pages`
 * array literal of the config's own module, after its last element and in
 * its indentation, nothing else in the file changing. When the module does
 * not write `pages` as such a literal (a helper's return, a spread, an
 * imported constant), the new page is refused with the file and line where
 * `pages` is computed, and `--sidecar` named as the way to write it: there is
 * no automatic fallback.
 */

import { realpath } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { collectConfigGraphFiles } from '@/infrastructure/config'
import {
  locateConfigValue,
  rewrittenLiteral,
  type ConfigSources,
} from '@/infrastructure/config/ts-config-literals'
import { refuse } from './app-prelude'
import { plannedAppends, withAppends, type PageAppend } from './design-system-import-pages-append'
import { changedBytes } from './design-system-import-pages-write'
import { writeAtomically } from './design-system-import-write'
import { indented } from './library-add-config'
import { validateParsedConfig } from './validate'
import type { MergedPage } from './design-system-import-pages-apply'
import type { PageImportReport } from '@/domain/models/api/admin/design-system/page-import-report'

type JsonObject = Readonly<Record<string, unknown>>
type Step = string | number
type Written = NonNullable<PageImportReport['written']>

/** One value a page entry's merge changed, by its path from the entry. */
interface ScalarEdit {
  readonly path: readonly Step[]
  readonly before: string | number
  readonly after: string | number
}

/** One literal to rewrite in a module of the config. */
export interface LiteralEdit {
  readonly path: string
  readonly file: string
  readonly line: number
  readonly start: number
  readonly end: number
  readonly literal: string
  readonly before: string | number
  readonly after: string | number
  /** The edit's path from the config root, to judge the result before writing. */
  readonly at: readonly Step[]
}

/** What a TypeScript config's pages come to: the literals rewritten, and the new pages appended. */
export interface LiteralPlan {
  readonly edits: readonly LiteralEdit[]
  readonly appends: readonly PageAppend[]
}

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** The edits of every part, or `undefined` when one part's structure differs. */
const joined = (
  parts: readonly (readonly ScalarEdit[] | undefined)[]
): readonly ScalarEdit[] | undefined =>
  parts.some((part) => part === undefined) ? undefined : parts.flatMap((part) => part ?? [])

/** Whether two leaves are the same kind of scalar: two strings, or two numbers. */
const comparable = (before: unknown, after: unknown): boolean =>
  (typeof before === 'string' && typeof after === 'string') ||
  (typeof before === 'number' && typeof after === 'number')

/** Whether two objects hold the same keys. */
const sameKeys = (before: JsonObject, after: JsonObject): boolean =>
  Object.keys(before).length === Object.keys(after).length &&
  Object.keys(before).every((key) => key in after)

/** The scalar edits between two page entries, or `undefined` when their structure differs. */
const scalarEdits = (
  before: unknown,
  after: unknown,
  path: readonly Step[] = []
): readonly ScalarEdit[] | undefined => {
  if (Array.isArray(before) && Array.isArray(after)) {
    return before.length === after.length
      ? joined(before.map((item, index) => scalarEdits(item, after[index], [...path, index])))
      : undefined
  }
  if (isObject(before) && isObject(after)) {
    return sameKeys(before, after)
      ? joined(
          Object.keys(before).map((key) => scalarEdits(before[key], after[key], [...path, key]))
        )
      : undefined
  }
  if (before === after) return []
  return comparable(before, after)
    ? [{ path, before: before as string | number, after: after as string | number }]
    : undefined
}

/** The lists a page node sits in, which a node's path id runs through. */
const NODE_LISTS: ReadonlySet<string> = new Set(['components', 'children'])

/** The path id of the page node a value sits on: the deepest position in a node list. */
const nodeIdOf = (page: string, path: readonly Step[]): string => {
  const end = path.reduce<number>((deepest, step, index) => {
    const list = path[index - 1]
    const slotted = path[index - 3] === 'slots'
    return typeof step === 'number' &&
      ((typeof list === 'string' && NODE_LISTS.has(list)) || slotted)
      ? index + 1
      : deepest
  }, 0)
  return `${page}:/${path.slice(0, end).join('/')}`
}

/**
 * The config's module sources, read from disk, each by its real path: the
 * bundler names the graph's files that way, and a temporary directory is
 * often a link.
 */
const sourcesOf = async (configPath: string): Promise<ConfigSources> => {
  const root = await realpath(resolve(configPath))
  const files = await collectConfigGraphFiles(root)
  const read = await Promise.all(
    [root, ...files].map(async (file) => {
      const real = await realpath(isAbsolute(file) ? file : resolve(file))
      return [real, await Bun.file(real).text()] as const
    })
  )
  return { root, files: new Map(read) }
}

const refuseStructure = (page: string): never =>
  refuse(
    `Error: The drawing changes the structure of the page ${page} (a move, an addition, a removal, or a value it did not set), which a TypeScript config cannot take literal by literal, so nothing was written.\n\n` +
      '  Run again with --sidecar to write the whole page to its sidecar.'
  )

/** One page's edits read against the source: the literals to rewrite, and the refusals. */
const planPage = async (
  sources: ConfigSources,
  page: { readonly merged: MergedPage; readonly raw: JsonObject; readonly index: number }
) => {
  const { merged, raw, index } = page
  const edits = scalarEdits(raw, merged.plan.patch) ?? refuseStructure(merged.name)
  const sited = await Promise.all(
    edits.map(async (edit) => {
      const at = ['pages', index, ...edit.path]
      return { edit, at, site: await locateConfigValue(sources, at) }
    })
  )
  const literals = sited.flatMap(({ edit, at, site }): readonly LiteralEdit[] =>
    site?.kind === 'literal'
      ? [
          {
            ...edit,
            at,
            path: join(dirname(sources.root), site.file),
            file: site.file,
            line: site.line,
            start: site.start,
            end: site.end,
            literal: site.text,
          },
        ]
      : []
  )
  const refused = sited.flatMap(({ edit, site }) =>
    site?.kind === 'literal'
      ? []
      : [
          {
            node: nodeIdOf(merged.name, edit.path),
            code: 'NOT_A_LITERAL' as const,
            reason:
              site === undefined
                ? 'The config has no default export the import can follow, so this value was not written.'
                : `This value is computed at ${site.file}:${site.line}, not written as a literal in the module that owns the page; change it there.`,
          },
        ]
  )
  return { literals, refused }
}

/** A page's merge with its refused edits reported, and their changes no longer counted. */
const withRefusals = (
  merged: MergedPage,
  refused: PageImportReport['pages'][number]['refused']
): MergedPage => {
  const nodes = new Set(refused.map((refusal) => refusal.node))
  const { report } = merged.plan
  return {
    ...merged,
    plan: {
      ...merged.plan,
      report: {
        ...report,
        changes: report.changes.filter((change) => !nodes.has(change.node)),
        refused: [...report.refused, ...refused],
      },
    },
  }
}

/**
 * Read every page edit of a TypeScript config against its source.
 *
 * @param configPath - the TypeScript config.
 * @param parsed - the config as evaluated.
 * @param merged - every page's merge.
 */
export const planTypeScriptLiterals = async (
  configPath: string,
  parsed: unknown,
  merged: readonly MergedPage[]
): Promise<LiteralPlan & { readonly merged: readonly MergedPage[] }> => {
  const created = merged.filter((page) => page.plan.report.created !== undefined)
  const rawPages = (
    isObject(parsed) && Array.isArray(parsed['pages']) ? parsed['pages'] : []
  ) as readonly JsonObject[]
  const changed = merged.filter(
    (page) => page.plan.patch !== undefined && page.plan.report.created === undefined
  )
  if (changed.length === 0 && created.length === 0) return { merged, edits: [], appends: [] }
  const sources = await sourcesOf(configPath)
  const appends = await plannedAppends(sources, created)
  const planned = await Promise.all(
    changed.map(async (page) => {
      const index = rawPages.findIndex((raw) => raw['name'] === page.name)
      return [
        page.name,
        await planPage(sources, { merged: page, raw: rawPages[index] ?? {}, index }),
      ] as const
    })
  )
  const byName = new Map(planned)
  return {
    merged: merged.map((page) => {
      const plan = byName.get(page.name)
      return plan === undefined || plan.refused.length === 0
        ? page
        : withRefusals(page, plan.refused)
    }),
    edits: planned.flatMap(([, plan]) => plan.literals),
    appends,
  }
}

/** A root with each literal's value set at its path. */
const withValues = (root: unknown, edits: readonly LiteralEdit[]): unknown =>
  edits.reduce<unknown>((acc, edit) => setAt(acc, edit.at, edit.after), root)

const setAt = (value: unknown, path: readonly Step[], next: unknown): unknown => {
  const [step, ...rest] = path
  if (step === undefined) return next
  if (Array.isArray(value))
    return value.map((item, index) => (index === step ? setAt(item, rest, next) : item))
  return isObject(value) ? { ...value, [step]: setAt(value[step], rest, next) } : value
}

/** One range of a module to replace: the text it held when read, and what it becomes. */
interface Splice {
  readonly path: string
  readonly file: string
  readonly line: number
  readonly start: number
  readonly end: number
  readonly expected: string
  readonly replacement: string
}

/** Every range the plan replaces: each literal rewritten, each array appended to after its anchor. */
const splicesOf = (plan: LiteralPlan): readonly Splice[] => [
  ...plan.edits.map((edit) => ({
    ...edit,
    expected: edit.literal,
    replacement: rewrittenLiteral(edit.literal, edit.after),
  })),
  ...plan.appends.map((append) => ({
    path: append.path,
    file: append.file,
    line: append.line,
    start: append.insertAt - append.anchor.length,
    end: append.insertAt,
    expected: append.anchor,
    replacement: `${append.anchor}${append.text}`,
  })),
]

/** Splice one module, refusing when it changed since it was read; the bytes changed. */
const splicedFile = async (path: string, inFile: readonly Splice[]): Promise<number> => {
  // Read as the locator read it (`Bun.file().text()` drops a byte-order mark), and keep the mark.
  const raw = await Bun.file(path).bytes()
  const bom = raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf ? '\uFEFF' : ''
  const text = await Bun.file(path).text()
  const moved = inFile.find((splice) => text.slice(splice.start, splice.end) !== splice.expected)
  if (moved !== undefined) {
    return refuse(
      `Error: ${moved.file} changed while the import read it (line ${moved.line}), so nothing was written.\n\n` +
        '  Run the import again.'
    )
  }
  const next = inFile
    .toSorted((a, b) => b.start - a.start)
    .reduce(
      (acc, splice) => `${acc.slice(0, splice.start)}${splice.replacement}${acc.slice(splice.end)}`,
      text
    )
  if (next !== text) await writeAtomically(path, `${bom}${next}`)
  return changedBytes(text, next)
}

/**
 * Rewrite each literal in its module and append each new page, after judging the result.
 *
 * @param configPath - the TypeScript config.
 * @param loaded - the config as evaluated, and the include sources it read.
 * @param plan - the literals to rewrite, and the new pages to append.
 */
export const writeLiterals = async (
  configPath: string,
  loaded: { readonly parsed: unknown; readonly refSources: ReadonlyMap<string, string> },
  plan: LiteralPlan
): Promise<Written> => {
  const { edits, appends } = plan
  if (edits.length === 0 && appends.length === 0) return { bytes: 0 }
  const candidate = withAppends(withValues(loaded.parsed, edits), appends)
  const outcome = await validateParsedConfig(candidate, loaded.refSources)
  if (outcome.errors.length > 0) {
    return refuse(
      `Error: The imported pages do not validate, so nothing was written.\n\n${indented(outcome.errors)}`
    )
  }
  const byFile = Map.groupBy(splicesOf(plan), (splice) => splice.path)
  const bytes = await [...byFile].reduce<Promise<number>>(
    async (previous, [path, inFile]) => (await previous) + (await splicedFile(path, inFile)),
    Promise.resolve(0)
  )
  return {
    config: configPath,
    bytes,
    ...(edits.length === 0
      ? {}
      : {
          literals: edits.map((edit) => ({
            file: edit.file,
            line: edit.line,
            before: String(edit.before),
            after: String(edit.after),
          })),
        }),
  }
}
