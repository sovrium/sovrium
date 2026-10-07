/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The prose report `validate`, `start` and `build` print for a refused config.
 *
 * One renderer for the three commands, because "one validation, three commands"
 * is the published promise: the lines between a command's own headline and its
 * closing pointer must be identical whichever command refused.
 *
 * SHAPE.
 *
 *   3 problems
 *
 *   app.yaml
 *     Expected Auth Strategy, got {...}
 *       at auth.strategies[0]
 *       Accepted variants: ...
 *
 *   pages/home.yaml
 *     Unknown property 'elemnt' on component type 'text'
 *       at pages[0].components[0]
 *       Did you mean 'element'?
 *
 * - A count line heads the list, so a reader knows how much is coming.
 * - One heading per file, named by its path from the root config's directory —
 *   not its bare name, which two partials in two folders may share. The root
 *   comes first, then each partial in the order its first problem appears.
 * - Within a file, problems keep the order they arrive in, which the decoder
 *   side has already made document order.
 * - At most {@link REPORT_CEILING} problems are printed; the rest are counted on
 *   one closing line. The ceiling is for a person scrolling a terminal; the
 *   `--json` channel carries every finding, because its reader is a program.
 */

import { attributeSourcePath, formatDecodeReport } from './app-excess-property-report'
import type { DecodeFinding } from './app-excess-property-report'

/** The most problems the prose report lists before it summarises the rest. @public */
export const REPORT_CEILING = 50

/**
 * How the report names files. @public
 *
 * `root` is the root config's label (`app.yaml`), absent for a config that was
 * not read from a file. `label` turns a partial's recorded path into the path
 * an author types — relative to the root config's directory.
 */
export interface ReportFiles {
  readonly root: string | undefined
  readonly refSources: ReadonlyMap<string, string>
  readonly label: (sourcePath: string) => string
}

/** `problem` or `problems`. Pure. */
const problemNoun = (count: number): string => (count === 1 ? 'problem' : 'problems')

/** `1 problem`, `3 problems`. Pure. */
export const problemCountLine = (count: number): string => `${count} ${problemNoun(count)}`

/** The line that counts what the ceiling left out, or nothing. Pure. */
const remainderLines = (total: number): readonly string[] =>
  total > REPORT_CEILING
    ? ['', `and ${total - REPORT_CEILING} more ${problemNoun(total - REPORT_CEILING)}`]
    : []

interface ProblemGroup {
  readonly heading: string | undefined
  readonly findings: readonly DecodeFinding[]
}

/** Findings grouped by the file they live in, root first. Pure. */
const groupByFile = (
  findings: readonly DecodeFinding[],
  files: ReportFiles
): readonly ProblemGroup[] => {
  const keyed = findings.map((finding) => ({
    finding,
    source: attributeSourcePath(finding.path, files.refSources),
  }))
  const order = [
    ...new Set([
      ...(keyed.some(({ source }) => source === undefined) ? [undefined] : []),
      ...keyed.map(({ source }) => source).filter((source) => source !== undefined),
    ]),
  ]
  return order.map((source) => ({
    heading: source === undefined ? files.root : files.label(source),
    findings: keyed.filter((entry) => entry.source === source).map(({ finding }) => finding),
  }))
}

/**
 * Render decode problems as the report body. Pure.
 *
 * A heading is printed whenever the file can be named; a config that came from
 * no file (an inline schema) has nothing to name, and its problems are listed
 * bare.
 */
export const formatProblemReport = (
  findings: readonly DecodeFinding[],
  files: ReportFiles
): readonly string[] => {
  const shown = findings.slice(0, REPORT_CEILING)
  const groups = groupByFile(shown, files)
  const body = groups.flatMap((group, index) => [
    ...(index > 0 ? [''] : []),
    ...(group.heading === undefined ? [] : [group.heading]),
    // No `(file)` suffix on the `at` line: the heading above already names it.
    ...formatDecodeReport(group.findings, new Map()),
  ])
  return [problemCountLine(findings.length), '', ...body, ...remainderLines(findings.length)]
}

/**
 * Render refusals that carry no position — a cross-field rule, a sweep, a
 * message the walker could not structure — in the same shape: a count line,
 * then each one. Multi-line messages keep their own lines. Pure.
 */
export const formatMessageReport = (messages: readonly string[]): readonly string[] => [
  problemCountLine(messages.length),
  '',
  ...messages.slice(0, REPORT_CEILING).map((message) => `  ${message}`),
  ...remainderLines(messages.length),
]
