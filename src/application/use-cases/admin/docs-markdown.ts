/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * THE MANUAL'S MARKDOWN PROJECTION — schema-derived tables and behaviour blocks
 * expanded inside hand-written prose.
 *
 * Sits beside `design-system-markdown.ts` and shares its shape deliberately:
 * one H1, a blockquote summary, flat headings, high density, no chrome — the
 * llms.txt SHAPE, not its link semantics, for the same reason stated there.
 * Both are read by a model as often as by a person.
 *
 * ─── THE TABLES ARE EXPANDED, NEVER AUTHORED ───────────────────────────────
 *
 * 37.6 % of the published documentation corpus is markdown tables of schema
 * options, and every one of them was typed by hand against a schema that then
 * moved. A hand-written table cannot be wrong loudly: it renders, it looks
 * complete, and the option it omits is indistinguishable from one that does not
 * exist. So a fragment carries a DIRECTIVE where its table goes, and the table
 * is walked out of the schema at read time. A directive naming a schema that no
 * longer exists is a build error; a table describing a schema that no longer
 * exists is a lie nobody notices.
 *
 * ─── AN UNKNOWN IDENTIFIER IS A REFUSAL ────────────────────────────────────
 *
 * {@link expandDirectives} throws on a directive it cannot resolve rather than
 * expanding to an empty table or leaving the comment in place. Both fallbacks
 * publish a page that reads as finished: the first says the schema has no
 * options, the second says nothing at all where a table was promised. The
 * refusal names the identifier AND the ones that would have worked, because the
 * overwhelmingly likely cause is a rename or a typo and the reader needs the
 * list to see which.
 */

import { Data } from 'effect'
import { escapeMarkdownTableCell } from '@/domain/kernel/markdown/markdown-escaping'
import { schemaOptionTreeFor } from '@/domain/models/app/design/schema-option-tree'
import type { SchemaOption, SchemaOptionTree } from '@/domain/models/app/design/schema-option-tree'
import type { SchemaNode } from '@/domain/models/app/design/type-introspection'

/**
 * The schemas a section's fragments may name in a directive.
 *
 * A parameter rather than a module-level map: the registry is assembled in
 * `src/docs/sections/` from the schemas a section actually documents, and a
 * renderer holding its own copy would be a second place for the two to
 * disagree about what `Table` means.
 */
export type DirectiveRegistry = Readonly<Record<string, SchemaNode>>

/** One acceptance criterion of one story, as the Behaviour block prints it. */
export interface BehaviourStory {
  /** `[internal ref]` — kept for the JSON format, never printed. */
  readonly id: string
  /** The story's own heading, which becomes the H3. */
  readonly title: string
  /** One line per criterion, in the order the acceptance table lists them. */
  readonly criteria: readonly string[]
}

/** Everything one article is composed from. */
export interface DocsArticleInput {
  readonly title: string
  readonly description?: string
  /** The hand-written fragment, directives unexpanded. */
  readonly body: string
  readonly registry?: DirectiveRegistry
  readonly behaviour?: readonly BehaviourStory[]
}

/**
 * A directive naming a schema the registry does not hold.
 *
 * Tagged so a caller can tell it from a genuine programming error: the CLI
 * prints it as a bad-fragment message, while anything else is a crash.
 */
export class UnknownDocsDirectiveError extends Data.TaggedError('UnknownDocsDirectiveError')<{
  readonly identifier: string
  readonly known: readonly string[]
}> {
  override get message(): string {
    return (
      `Unknown sovrium:options identifier "${this.identifier}". ` +
      `The registry holds: ${this.known.length === 0 ? '(nothing)' : this.known.join(', ')}.`
    )
  }
}

/**
 * A directive whose schema resolves but publishes no options.
 *
 * The same failure as an unknown identifier wearing a different cause: the
 * fragment promised a table and the page ships without one. It is separate from
 * {@link UnknownDocsDirectiveError} because the fix is different — that one is a
 * typo, this one is a directive aimed one node too high.
 *
 * Measured, it is almost always an ARRAY root. `RedirectsSchema` is
 * `Schema.Array(RedirectSchema)`, and the walk addresses `Objects`, `Union` and
 * `Suspend` roots only, so a fragment naming the plural gets silence where it
 * wanted the element's four options. Hence the tag in the message: it is the one
 * fact that tells an author which schema to name instead.
 */
export class EmptyDocsDirectiveError extends Data.TaggedError('EmptyDocsDirectiveError')<{
  readonly identifier: string
  readonly rootTag: string
}> {
  override get message(): string {
    return (
      `The sovrium:options identifier "${this.identifier}" resolves to a ` +
      `${this.rootTag} node, which publishes no options. Name the schema whose ` +
      `keys the table should list — for an array, that is its element schema.`
    )
  }
}

// =============================================================================
// Option tables
// =============================================================================

const HEADERS = ['Path', 'Kind', 'Values', 'Default', 'Description'] as const

/** A value placed in a table cell, escaped through the canonical helper. */
const cell = (text: string | undefined): string => escapeMarkdownTableCell(text ?? '')

/** A markdown table with a fixed header. */
const table = (rows: readonly (readonly string[])[]): readonly string[] => [
  `| ${HEADERS.join(' | ')} |`,
  `| ${HEADERS.map(() => '---').join(' | ')} |`,
  ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`),
]

/**
 * The Default cell: what the decoder answers with, else what the schema states.
 *
 * `defaultValue` wins because it is what the running binary does; `defaultNote`
 * is prose for a default no decode can reach — a nested `withDefault`, or a
 * value derived from the record ("the table's first date field"). Measured on
 * the component catalogue, the two never both appear on one row, so the
 * precedence is a contract rather than a choice being exercised.
 */
const defaultCell = (row: SchemaOption): string => row.defaultValue ?? row.defaultNote ?? ''

/**
 * The Kind cell, carrying the depth mark where the walk was cut.
 *
 * The mark rides the kind rather than the path because the path must stay
 * copy-pasteable into a config file, and rather than the description because an
 * annotated row would then lose it to the schema's own words.
 */
const kindCell = (row: SchemaOption): string =>
  row.truncated === true ? `${row.kind} (truncated)` : row.kind

const optionRow = (row: SchemaOption): readonly string[] => [
  `\`${row.path}\``,
  kindCell(row),
  (row.values ?? []).map((value) => `\`${value}\``).join(', '),
  defaultCell(row),
  row.description ?? '',
]

/** The flat rows belonging to one top-level key, in walk order. */
const rowsUnder = (tree: SchemaOptionTree, key: string): readonly SchemaOption[] =>
  tree.items.filter(
    (row) => row.path === key || row.path.startsWith(`${key}.`) || row.path.startsWith(`${key}[`)
  )

/**
 * The per-option guidance for a block of rows, as a list AFTER its table.
 *
 * `howTo` is not a sixth column, and the reason is measured: 20 options in the
 * whole schema carry one, against 1,954 options walked. A column costs an empty
 * cell on every row of every table and — because a markdown column is as wide
 * as its widest cell — one paragraph of guidance widens a table nobody reads
 * guidance in. It cannot be a line under its own row either: a line not
 * starting with `|` ends the table.
 *
 * So it is a list under the table, which costs exactly nothing on the 99 % of
 * blocks that have none.
 */
const howToLines = (rows: readonly SchemaOption[]): readonly string[] => {
  const withGuidance = rows.filter((row) => row.howTo !== undefined)
  return withGuidance.length === 0
    ? []
    : ['', ...withGuidance.map((row) => `- \`${row.path}\` — ${row.howTo ?? ''}`)]
}

/** One `### key` block: its heading, its table, and its guidance. */
const groupBlock = (tree: SchemaOptionTree, key: string): readonly string[] => {
  const rows = rowsUnder(tree, key)
  return ['', `### \`${key}\``, '', ...table(rows.map(optionRow)), ...howToLines(rows)]
}

/**
 * Render a walked option tree as the manual's option tables.
 *
 * ─── A HEADING EXISTS TO BE SKIPPED, SO A ONE-ROW BLOCK GETS NONE ──────────
 *
 * Every top-level key that EXPANDS — a subtree, or an enumeration — gets its
 * own `### key` block, because a single 214-row table is not navigable and the
 * headings are how a reader jumps to `columns` without reading `pagination`.
 * Every key that draws exactly one row is collected into one leading table
 * instead: a heading over a single row is a heading with nothing behind it to
 * skip, and a four-option schema rendered as four headed one-row tables is the
 * worst output this function can produce.
 *
 * The cap is PRINTED when it fires. A table silently cut at N is worse than an
 * error, because it is indistinguishable from a schema that shrank — the same
 * rule the walk applies to its depth limit.
 *
 * @param tree - A tree from `schemaOptionTreeFor` or `schemaOptionTree`.
 * @returns Markdown with no leading or trailing blank line, or `''` for an
 *   empty tree — which is what a root the walk cannot address answers with, and
 *   is deliberately not an error here: refusing is the directive's job, where
 *   the identifier is still known.
 */
export function renderOptionTable(tree: SchemaOptionTree): string {
  if (tree.items.length === 0) return ''

  const leaves = tree.groups.filter((group) => rowsUnder(tree, group.key).length === 1)
  const expanded = tree.groups.filter((group) => rowsUnder(tree, group.key).length > 1)
  const leafRows = leaves.flatMap((group) => rowsUnder(tree, group.key))

  return [
    ...(leafRows.length === 0 ? [] : [...table(leafRows.map(optionRow)), ...howToLines(leafRows)]),
    ...expanded.flatMap((group) => groupBlock(tree, group.key)),
    ...(tree.capped
      ? ['', `_Cut at ${tree.items.length} options; the schema declares more._`]
      : []),
  ]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// =============================================================================
// Directives
// =============================================================================

/**
 * `<!-- sovrium:options Identifier depth=2 rowCap=50 -->`, on its own line.
 *
 * Anchored to the line because a directive is a BLOCK: it expands into tables
 * and headings, which cannot sit inside a sentence. Anchoring it also makes the
 * fence rule below decidable line by line rather than by scanning for comment
 * delimiters that a fenced example may legitimately contain.
 *
 * ─── THE CHARACTER CLASS CARRIES `:` AND `-` FOR A MEASURED REASON ─────────
 *
 * A key is not always a TypeScript identifier. The ninety catalogued component
 * types are field bags rather than exported schemas, so a fragment addresses
 * one as `type:record-field` — see `src/docs/sections/component-directives.ts`.
 * The class was `[A-Za-z0-9_$.]+` when those keys were written, and a narrower
 * class here does not fail loudly: `type:record-field` parses as the identifier
 * `type`, misses the registry, and reports THAT name, which sends the author
 * looking for the wrong mistake. So the keys were spelled `type.record_field`
 * as the closest legal form until this class admitted their real names.
 */
const DIRECTIVE = /^[ \t]*<!--[ \t]*sovrium:options[ \t]+([A-Za-z0-9_$.:-]+)([^>]*?)-->[ \t]*$/

/**
 * The `sovrium:options` identifiers a fragment names, in source order.
 *
 * Published so a caller can pair them with the schema VALUES its manifest
 * carries — the manifest holds an ordered `documents` list and the fragment
 * holds the ordered names, and nothing but that order connects the two.
 *
 * Deliberately NOT fence-aware, unlike {@link expandDirectives}. The pairing is
 * positional, so it must count exactly what the manifest's author counted, and
 * `docs-structure.test.ts` reconciles the two lists with the same plain scan. A
 * fenced directive would therefore be registered and never expanded, which
 * costs a map entry and nothing else; skipping it here would silently shift
 * every identifier after it onto the wrong schema.
 *
 * @param body - A fragment, directives unexpanded.
 * @returns Each identifier, once per directive line, in the order they appear.
 */
export const directiveIdentifiers = (body: string): readonly string[] =>
  body.split('\n').flatMap((line) => {
    const identifier = DIRECTIVE.exec(line)?.[1]
    return identifier === undefined ? [] : [identifier]
  })

/** `depth=2 rowCap=50` → `{ depth: 2, rowCap: 50 }`; an absent key stays absent. */
const parseOptions = (rest: string): { readonly depth?: number; readonly rowCap?: number } =>
  Object.fromEntries(
    [...rest.matchAll(/\b(depth|rowCap)=(\d+)\b/g)].map((match) => [match[1], Number(match[2])])
  )

/**
 * A CommonMark fence opener, and the run that would close it.
 *
 * Parsed by the real rule rather than by a boolean toggle: a fence is three or
 * more backticks or tildes with up to three leading spaces, and it is closed
 * only by a run of the SAME character at least as long. A toggle miscounts a
 * ```` ```` ```` block containing a ``` ``` ``` one, and the cost of getting it
 * wrong here is a directive inside a code sample being expanded — turning an
 * example OF the directive syntax into a table.
 */
const fenceRunOf = (line: string): string | undefined => {
  const match = /^ {0,3}(`{3,}|~{3,})/.exec(line)
  return match?.[1]
}

/** Whether `line` closes a fence opened by `open`. */
const closesFence = (line: string, open: string): boolean => {
  const run = fenceRunOf(line)
  return (
    run !== undefined &&
    run[0] === open[0] &&
    run.length >= open.length &&
    line.trim() === run.trim()
  )
}

/** The scan's position: what has been emitted, and the fence still open. */
interface ScanState {
  readonly lines: readonly string[]
  readonly fence?: string
}

const INITIAL_SCAN: ScanState = { lines: [] }

/** One line's expansion, given the registry. */
const expandLine = (line: string, registry: DirectiveRegistry): string => {
  const match = DIRECTIVE.exec(line)
  if (match === null) return line
  const identifier = match[1] ?? ''
  const node = registry[identifier]
  if (node === undefined)
    // eslint-disable-next-line functional/no-throw-statements -- an unresolvable directive is a build error, and the two alternatives (an empty table, a silently dropped comment) both publish a page that reads as finished
    throw new UnknownDocsDirectiveError({ identifier, known: Object.keys(registry).toSorted() })
  const rendered = renderOptionTable(schemaOptionTreeFor(node, parseOptions(match[2] ?? '')))
  if (rendered === '')
    // eslint-disable-next-line functional/no-throw-statements -- a directive that expands to nothing ships a page promising a table it does not have; see EmptyDocsDirectiveError
    throw new EmptyDocsDirectiveError({ identifier, rootTag: node._tag ?? 'unknown' })
  return rendered
}

/**
 * Expand every `sovrium:options` directive in a fragment.
 *
 * @param body - The hand-written markdown, directives unexpanded.
 * @param registry - The schemas this fragment's section declares.
 * @returns The same markdown with each directive line replaced by its tables.
 * @throws UnknownDocsDirectiveError when a directive names a schema the
 *   registry does not hold — never an empty table. See the module header.
 */
export function expandDirectives(body: string, registry: DirectiveRegistry): string {
  const state = body.split('\n').reduce<ScanState>((accumulator, line) => {
    const { fence } = accumulator
    const lines = [...accumulator.lines, fence === undefined ? expandLine(line, registry) : line]
    if (fence !== undefined) return closesFence(line, fence) ? { lines } : { lines, fence }
    const opener = fenceRunOf(line)
    return opener === undefined ? { lines } : { lines, fence: opener }
  }, INITIAL_SCAN)
  return state.lines.join('\n')
}

// =============================================================================
// Behaviour
// =============================================================================

/**
 * Render the acceptance criteria of an article's cited stories.
 *
 * Grouped by story rather than flattened: a criterion reads as a claim about a
 * feature, and the feature is the story. A flat list of 72 criteria — the
 * largest article's count — reads as a changelog.
 *
 * @param stories - The cited stories and their passing criteria, already
 *   filtered: a criterion whose spec is still `test.fixme()` never reaches here,
 *   because the manual may not describe behaviour no test asserts.
 * @returns The `## Behaviour` section, or `''` when there is nothing to say —
 *   an empty H2 is chrome, and this format has none.
 */
export function renderBehaviour(stories: readonly BehaviourStory[]): string {
  const populated = stories.filter((story) => story.criteria.length > 0)
  if (populated.length === 0) return ''

  return [
    '## Behaviour',
    '',
    ...populated.flatMap((story) => [
      `### ${story.title}`,
      '',
      ...story.criteria.map((criterion) => `- ${criterion}`),
      '',
    ]),
  ]
    .join('\n')
    .trimEnd()
}

/**
 * Compose one article: heading, summary, expanded prose, behaviour.
 *
 * The Behaviour block goes LAST for the reason the design-system projection
 * puts its catalogue last: it is the longest section and the least often the
 * thing a reader arrived for, and a section that pushes the prose below three
 * screens is a section in the wrong place.
 *
 * @param input - The article's own words plus what it is composed from.
 * @returns Markdown ending in a single trailing newline.
 * @throws UnknownDocsDirectiveError - via {@link expandDirectives}.
 */
export function renderArticle(input: DocsArticleInput): string {
  return [
    `# ${input.title}`,
    '',
    ...(input.description === undefined ? [] : [`> ${input.description}`, '']),
    expandDirectives(input.body, input.registry ?? {}).trim(),
    '',
    renderBehaviour(input.behaviour ?? []),
  ]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd()
    .concat('\n')
}
