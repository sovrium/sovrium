/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The user-story grammar, shared by `bun run progress` and the docs build.
 *
 * ## Why this file exists
 *
 * `[internal ref]` has parsed `## US-` headings and
 * acceptance-criteria tables since long before [internal ref], and its reading of them
 * is the product contract: a ✅ row means the spec is AUTHORED and is not
 * `test.fixme()`. The manual now renders a **Behaviour** block from exactly
 * those rows, and `scripts/build/generate-embedded-docs.ts` has to read them at
 * build time.
 *
 * It cannot import the script. `check-progress.ts` is a program: importing it
 * runs 10k lines of orchestration and writes `[internal ref]`, `README.md`
 * and `[internal ref]` as a side effect of asking it what a table says. So
 * the grammar moves HERE and both read it — the alternative being a second
 * parser, which is how a criterion comes to mean one thing in the manual and
 * another in the progress report while both are green.
 *
 * This module is DATA AND PURE FUNCTIONS. No `import.meta.main`, no I/O beyond
 * what a caller hands it, so `[internal ref]` is its right home by the membership
 * rule in `[internal ref]`.
 *
 * ## What a ✅ does and does not prove
 *
 * Stated here because the manual publishes these strings to strangers: a ✅
 * means a `test(...)` with that spec ID exists in `[internal ref]` and is not
 * `test.fixme(...)`. `bun run progress` never runs Playwright. "Passing" is
 * what the CI E2E run asserts, and a wrong criterion still ships if its spec is
 * wrong ([internal ref] D9).
 */

/** `## US-<ID>: <title>` — group 1 the id, group 2 the title. */
export const US_HEADING_PATTERN = /^## (US-[\w-]+):\s*(.+)/

/**
 * An acceptance-criteria row: `| <SPEC-ID> | <criterion> | <status> |`.
 *
 * Three cells, and every group is load-bearing:
 *
 * - `(?!US-)` excludes Coverage Summary cross-reference rows, whose first cell
 *   is a STORY id. A real spec id is `APP-…`, `API-…`, `UI-KIT-…`, never `US-…`.
 * - the criterion and status cells match `(?:\\\||[^|])` rather than `[^|]`, so
 *   a markdown-escaped pipe inside a cell — the standard way to write a literal
 *   `|`, as in a page title `Changelog \| Sovrium` — does not terminate the cell
 *   and drop the whole row from parsing.
 *
 * Kept in lockstep with `ACCEPTANCE_CRITERIA_TABLE_ROW_PATTERN` in
 * `check-progress.ts`, which imports it from here.
 */
export const AC_TABLE_ROW_PATTERN =
  /^\|\s*`?(?!US-)([A-Z]+-[A-Z0-9-]+-(?:\d{3}|REGRESSION))`?\s*\|\s*((?:\\\||[^|])+)\s*\|\s*((?:\\\||[^|])*?)\s*\|$/gm

/**
 * Title-capture patterns for `test(...)` and `test.fixme(...)`.
 *
 * The title is captured up to its MATCHING closing delimiter, so the two other
 * quote characters may appear inside it freely. The naive form
 * `['"`]([^'"`]+)['"`]` stopped at the first inner quote of any kind and
 * silently truncated 275 titles across `[internal ref]`.
 *
 * Group 1 is the opening delimiter (backreferenced); **group 2 is the title**.
 */
export const TEST_TITLE_PATTERN = /test\s*\(\s*(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g

/** As {@link TEST_TITLE_PATTERN}, for `test.fixme(...)`. */
export const TEST_FIXME_TITLE_PATTERN = /test\.fixme\s*\(\s*(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g

/**
 * Split a markdown table row into cells, honouring `\|` as literal content.
 *
 * Splitting on a raw `|` miscounts columns when a cell embeds an escaped pipe,
 * which is how a criterion carrying a regex or a union type came to be dropped.
 */
export const splitMarkdownTableCells = (line: string): readonly string[] =>
  line.split(/(?<!\\)\|/).map((cell) => cell.replaceAll('\\|', '|'))

/** Whether an AC status cell marks the criterion as done. */
export const isCompleteStatusCell = (cell: string): boolean => /✅|^\[x\]$|^x$/i.test(cell.trim())

/** One acceptance-criterion row, as both readers understand it. */
export interface AcceptanceCriterionRow {
  readonly specId: string
  /** The Criterion cell verbatim, trimmed. This is what the manual publishes. */
  readonly criterion: string
  /** Whether the Status cell is ✅ / `[x]` / `x`. */
  readonly complete: boolean
}

/** One `## US-` section of a user-story document. */
export interface UserStorySection {
  readonly id: string
  readonly title: string
  readonly criteria: readonly AcceptanceCriterionRow[]
}

/**
 * Every `## US-` section of one document, with its acceptance-criteria rows.
 *
 * The rows are collected from the WHOLE section rather than from a fenced
 * "### Acceptance Criteria" region, because {@link AC_TABLE_ROW_PATTERN} is
 * already specific enough to identify one — three cells, first a spec id — and
 * a heading-scoped reader silently drops the rows of a document that spells the
 * heading differently. `check-progress.ts` scopes by heading for its structural
 * warnings, which is a different question: it wants to tell a MISSING table
 * from an empty one, and this reader does not.
 */
export const parseUserStorySections = (markdown: string): readonly UserStorySection[] => {
  const lines = markdown.split('\n')
  const starts = lines.flatMap((line, index) => {
    const match = US_HEADING_PATTERN.exec(line)
    return match?.[1] === undefined || match[2] === undefined
      ? []
      : [{ id: match[1], title: match[2].trim(), index }]
  })
  return starts.map((start, position) => {
    const end = starts[position + 1]?.index ?? lines.length
    return {
      id: start.id,
      title: start.title,
      criteria: parseAcceptanceCriteria(lines.slice(start.index, end).join('\n')),
    }
  })
}

/** The acceptance-criteria rows in a block of markdown. */
export const parseAcceptanceCriteria = (markdown: string): readonly AcceptanceCriterionRow[] => {
  // A `g` regex carries `lastIndex` across calls, so it is cloned per read —
  // sharing one would make the SECOND caller of this function see fewer rows
  // than the first, which is the kind of defect that reads as flakiness.
  const pattern = new RegExp(AC_TABLE_ROW_PATTERN.source, AC_TABLE_ROW_PATTERN.flags)
  return [...markdown.matchAll(pattern)].flatMap((match) => {
    const specId = match[1]
    const criterion = match[2]?.trim()
    if (specId === undefined || criterion === undefined || criterion.length === 0) return []
    return [{ specId, criterion, complete: isCompleteStatusCell(match[3] ?? '') }]
  })
}
