/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * THE FOUR POINT LOOKUPS — one config option, one environment variable, one
 * CLI verb, one operator-console page.
 *
 * A reader holding a name out of an example does not want an article; they want
 * the one paragraph that names the thing they typed. These four answer that,
 * and each of them REFUSES by name rather than falling back to the table of
 * contents — a reader who typed something that does not exist needs to learn
 * what does, not to be left concluding their key was undocumented.
 *
 * ─── THE OPTION ANSWER IS THE SAME ROW THE ARTICLE PRINTS ──────────────────
 *
 * `config <path>` resolves through `schemaOptionAt`, which produces the row by
 * running the ordinary option walk over the option's parent. So the kind, the
 * closed-union members, the default and the prose are byte-identical to the
 * table on the page documenting it. A second reader written for one key would
 * eventually disagree with the table, and one binary describing one option two
 * ways is the failure the whole expansion engine exists to prevent.
 *
 * ─── ENVIRONMENT VARIABLES ARE NEVER GENERATED ─────────────────────────────
 *
 * There is no schema to walk: the variables are read all over
 * `src/domain/models/process-env/`, and a directory walk drops real ones
 * silently ([internal ref] cites `eco-levers.ts`). So the answer is assembled from the
 * hand-written prose that documents them — the lines of the manual that NAME
 * the variable, verbatim, table rows included, plus the `.env.example` line the
 * scaffold writes.
 */

import { schemaOptionAt } from '@/domain/models/app/design/schema-option-tree'
import type { SchemaOption } from '@/domain/models/app/design/schema-option-tree'
import type { SchemaNode } from '@/domain/models/app/design/type-introspection'

/** One fragment's text, addressed as the manual addresses it. */
export interface DocsCorpusEntry {
  /** `app-schema/llms-txt`. */
  readonly address: string
  readonly title: string
  readonly body: string
  /** The schemas the article's manifest carries, for option attribution. */
  readonly documents: readonly unknown[]
}

/** Where a name was found, and the lines that mention it. */
export interface DocsMention {
  readonly address: string
  readonly title: string
  readonly lines: readonly string[]
}

// =============================================================================
// config <path>
// =============================================================================

/** What `sovrium docs config <path>` answers with. */
export interface ConfigOptionAnswer {
  readonly path: string
  readonly option: SchemaOption
  /** The article whose schema owns it, when one claims it. */
  readonly owner?: string
}

/**
 * The article whose manifest carries a schema the descent passed through.
 *
 * Matched by NODE IDENTITY, walking the ancestry from the leaf upwards so the
 * narrowest claim wins: `llms.full` is owned by the article documenting
 * `LlmsSchema`, not by the one documenting `AppSchema` — both are on the path,
 * and the root is on every path there is.
 */
const owningArticle = (
  corpus: readonly DocsCorpusEntry[],
  visited: readonly SchemaNode[],
  astOfValue: (value: unknown) => SchemaNode | undefined
): string | undefined =>
  visited
    .toReversed()
    .reduce<string | undefined>(
      (found, node) =>
        found ??
        corpus.find((entry) => entry.documents.some((document) => astOfValue(document) === node))
          ?.address,
      undefined
    )

/**
 * Resolve one config path against the app schema.
 *
 * @param root - `astOf(AppSchema)`.
 * @param path - A dotted key path, `[]` marking an array descent.
 * @param corpus - Every article, for naming the one that documents the option.
 * @param astOfValue - `astOf`, injected so this module stays free of the
 *   introspection module's import graph at the one place it needs a value.
 * @returns The option and its owning article, or `undefined` — a refusal.
 */
export const lookupConfigOption = (
  root: SchemaNode,
  path: string,
  corpus: readonly DocsCorpusEntry[],
  astOfValue: (value: unknown) => SchemaNode | undefined
): ConfigOptionAnswer | undefined => {
  const located = schemaOptionAt(root, path)
  if (located === undefined) return undefined
  const owner = owningArticle(corpus, located.visited, astOfValue)
  return { path, option: located.option, ...(owner === undefined ? {} : { owner }) }
}

/** The answer as the markdown the command prints. */
export const renderConfigOption = (answer: ConfigOptionAnswer): string => {
  const { option } = answer
  return [
    `# \`${answer.path}\``,
    '',
    ...(option.description === undefined ? [] : [`> ${option.description}`, '']),
    `- **Kind** — ${option.kind}${option.truncated === true ? ' (walk truncated here)' : ''}`,
    ...(option.values === undefined
      ? []
      : [`- **Values** — ${option.values.map((value) => `\`${value}\``).join(', ')}`]),
    ...(option.defaultValue === undefined ? [] : [`- **Default** — \`${option.defaultValue}\``]),
    ...(option.defaultNote === undefined ? [] : [`- **Default** — ${option.defaultNote}`]),
    ...(option.howTo === undefined ? [] : ['', `**How to use it.** ${option.howTo}`]),
    ...(answer.owner === undefined ? [] : ['', `Documented in \`sovrium docs ${answer.owner}\`.`]),
    '',
  ].join('\n')
}

// =============================================================================
// env <NAME>
// =============================================================================

/** An environment-variable name as the manual and the template spell them. */
const ENV_NAME = /^[A-Z][A-Z0-9_]*$/

/** Whether `line` names `variable` as a WORD, not as a prefix of a longer one. */
const namesVariable = (line: string, variable: string): boolean =>
  new RegExp(`(^|[^A-Z0-9_])${variable}([^A-Z0-9_]|$)`).test(line)

/** Every line of every fragment that names the variable, grouped by article. */
export const lookupEnvVariable = (
  corpus: readonly DocsCorpusEntry[],
  variable: string
): readonly DocsMention[] =>
  ENV_NAME.test(variable)
    ? corpus.flatMap((entry) => {
        const lines = entry.body
          .split('\n')
          .filter((line) => namesVariable(line, variable))
          .map((line) => line.trimEnd())
        return lines.length === 0 ? [] : [{ address: entry.address, title: entry.title, lines }]
      })
    : []

/**
 * Render the variable's documentation: the scaffolded `.env.example` line
 * first, then every place the manual mentions it.
 *
 * The template line leads because it is the one thing a reader can paste, and
 * it states the shape of the value where the prose states its meaning.
 */
export const renderEnvVariable = (input: {
  readonly variable: string
  readonly templateLines: readonly string[]
  readonly mentions: readonly DocsMention[]
}): string =>
  [
    `# \`${input.variable}\``,
    '',
    ...(input.templateLines.length === 0
      ? []
      : ['## In `.env.example`', '', '```bash', ...input.templateLines, '```', '']),
    ...input.mentions.flatMap((mention) => [
      `## ${mention.title} — \`${mention.address}\``,
      '',
      ...mention.lines,
      '',
    ]),
    `Read the whole article with \`sovrium docs ${input.mentions[0]?.address ?? 'cli-api/env-vars'}\`.`,
    '',
  ].join('\n')

/** The `.env.example` lines that name the variable, comment markers kept. */
export const envTemplateLines = (template: string, variable: string): readonly string[] =>
  template
    .split('\n')
    .filter((line) => namesVariable(line, variable))
    .map((line) => line.trimEnd())

// =============================================================================
// cli <verb>
// =============================================================================

/** Whether a body invokes `sovrium <verb>` as a whole word. */
const namesCommand = (body: string, verb: string): boolean =>
  new RegExp(`\\bsovrium ${verb}(?![a-z0-9-])`).test(body)

/**
 * The article whose fragment NAMES `sovrium <verb>`.
 *
 * Coverage of the CLI is of the vocabulary rather than of a file per verb —
 * nine fragments for nineteen dispatch keys, because `stop`, `restart` and
 * `reload` share one lock file and are unreadable apart. So the question this
 * asks is the same one `check-doc-coverage.ts` asks: does some fragment name
 * this command?
 *
 * A CLI-section article wins over any other, because a verb is quoted all over
 * the manual — `sovrium start` appears in most get-started prose — and the
 * article that DOCUMENTS the command is the one filed under the CLI section.
 * Without the preference the answer would depend on section order.
 */
export const findCliArticle = (
  corpus: readonly DocsCorpusEntry[],
  verb: string
): DocsCorpusEntry | undefined => {
  const naming = corpus.filter((entry) => namesCommand(entry.body, verb))
  return naming.find((entry) => entry.address.startsWith('cli-api/')) ?? naming[0]
}

/**
 * Render a verb: the curated help text, then the authored prose.
 *
 * Help first because it is the authoritative option list — the flags live in
 * the allowlist in `src/cli/runtime/dispatch.ts` and their text in the string
 * table in `src/cli/runtime/command-help.ts`, neither of which is a schema the
 * option walk could address. The prose says what the command is FOR.
 */
export const renderCliVerb = (input: {
  readonly verb: string
  readonly help?: string
  readonly article?: string
}): string =>
  [
    `# \`sovrium ${input.verb}\``,
    '',
    ...(input.help === undefined ? [] : ['```', input.help, '```', '']),
    ...(input.article === undefined ? [] : [input.article]),
  ]
    .join('\n')
    .trimEnd()
    .concat('\n')

// =============================================================================
// admin <page>
// =============================================================================

/** One row of a console route inventory, with the article that carries it. */
export interface AdminRouteEntry {
  /** The route as the router matches it — `/_admin/tables`. */
  readonly route: string
  /** The row's second cell: what that page is, in one line. */
  readonly summary: string
  /** `admin/admin-dashboard` — the address that prints the whole inventory. */
  readonly article: string
}

/**
 * One row of a console route table: a `/_admin…` code span, then its summary.
 *
 * `{param}` is normalised to `:param` below for the same reason
 * `docs-structure.test.ts` does it: an article may address a route the way a
 * reader types it, and the router matches it the other way. Printing the
 * spelling the router does not match is the exact "now guess the other one"
 * failure this lookup exists to remove.
 */
const ADMIN_ROUTE_ROW = /^\|\s*`(\/_admin[^`]*)`\s*\|\s*(.+?)\s*\|\s*$/

/**
 * Every console route the manual tabulates, read from the fragments' own tables.
 *
 * ─── WHY THE TABLE AND NOT THE PRESET ──────────────────────────────────────
 *
 * The routes are data — `resolveAdminPresetApp().pages[].path` — and this could
 * read them there. It does not, because the two articles that document the
 * console (`admin/admin-dashboard`, `admin/design-system-console`) already
 * carry the inventory by hand, and `src/docs/docs-structure.test.ts` holds
 * those rows EQUAL to the preset's paths in both directions. So a row is a
 * served route and a served route is a row: the table is a faithful index, and
 * reading it keeps `sovrium docs` — which is offline, lazy, and must not touch
 * the boot graph — free of decoding the whole admin preset to answer a
 * documentation question.
 *
 * ─── WHY THE ROW SHAPE RATHER THAN THE SECTION SLUG ────────────────────────
 *
 * The two fragments live under the `admin` section, and filtering the corpus by
 * that slug would be the obvious selector. It is the more fragile one: a
 * renamed section would leave this silently matching nothing, and a lookup that
 * refuses every query reads as a console with no pages rather than as a bug.
 * The row shape is already exact — measured across every `*.docs.md` in the
 * tree, these two fragments are the only ones carrying it — so narrowing first
 * buys nothing.
 *
 * A route may legitimately appear TWICE: `/_admin/design-system` is a row in
 * the overview (pointing at the section) and the first row of the section's own
 * article. Both are kept, because each names a different article and a reader
 * asking about that surface wants both.
 */
export const adminRouteInventory = (
  corpus: readonly DocsCorpusEntry[]
): readonly AdminRouteEntry[] =>
  corpus.flatMap((entry) =>
    entry.body.split('\n').flatMap((line) => {
      const match = ADMIN_ROUTE_ROW.exec(line)
      if (match === null) return []
      const route = (match[1] ?? '').replaceAll(/\{(\w+)\}/g, ':$1')
      return route.endsWith('/') || route.endsWith('/**')
        ? []
        : [{ route, summary: match[2] ?? '', article: entry.address }]
    })
  )

/**
 * How a reader spells a console page, reduced to what they and the router share.
 *
 * `records`, `/records`, `/tables` and `/_admin/tables` are four spellings of
 * two questions, and a reader holds whichever one the sidebar, the address bar
 * or a colleague gave them. Stripping a leading `/_admin` and then a leading
 * `/` collapses the address-bar spellings onto the sidebar one; lowercasing
 * collapses the rest.
 */
const consolePageKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/^\/_admin/, '')
    .replace(/^\//, '')

/**
 * The rows matching a page, by route or by what the row says the page is.
 *
 * Matching the SUMMARY as well as the route is what answers `records` with
 * `/_admin/tables`: the sidebar calls that page Records and the router calls it
 * `/tables`, and a reader holding one should not have to guess the other.
 *
 * The empty key is the console ROOT rather than a wildcard. `sovrium docs admin
 * /_admin` normalises to `''`, which is a substring of every route there is, so
 * a plain `includes` would answer it with the entire inventory — a filter that
 * has silently stopped filtering.
 */
export const lookupAdminPage = (
  inventory: readonly AdminRouteEntry[],
  page: string
): readonly AdminRouteEntry[] => {
  const query = consolePageKey(page)
  return query === ''
    ? inventory.filter((entry) => consolePageKey(entry.route) === '')
    : inventory.filter(
        (entry) =>
          consolePageKey(entry.route).includes(query) || entry.summary.toLowerCase().includes(query)
      )
}

/**
 * Render the matches: each route, what it is, and where it is documented.
 *
 * The article address is printed as the command that opens it rather than as a
 * bare slug, so the next step is a line to run instead of a name to reassemble
 * — the same shape `renderConfigOption` and `renderEnvVariable` end on.
 */
export const renderAdminPage = (input: {
  readonly page: string
  readonly routes: readonly AdminRouteEntry[]
}): string =>
  [
    `# Console pages matching \`${input.page}\``,
    '',
    ...input.routes.flatMap((entry) => [
      `## \`${entry.route}\``,
      '',
      entry.summary,
      '',
      `Documented in \`sovrium docs ${entry.article}\`.`,
      '',
    ]),
  ]
    .join('\n')
    .trimEnd()
    .concat('\n')
