/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The text report of `sovrium design-system import --pages`: per page, what
 * the drawing changed and what it kept, then what was written. `--json` prints
 * the same report as a document instead.
 */

import { displayPath } from './design-system-import-pages-source'
import type { MergedPage } from './design-system-import-pages-apply'
import type { PageImportReport } from '@/domain/models/api/admin/design-system/page-import-report'

type ReportPage = PageImportReport['pages'][number]

const quoted = (value: string | undefined): string =>
  value === undefined ? '(none)' : JSON.stringify(value)

/**
 * The refusal of a board of a declared page that carries no export stamp and
 * whose nodes were added, removed or reordered: they cannot be matched to the
 * page's, so the edit is redrawn on a fresh export's board, which carries them.
 * A board holding more nodes than its page may be unedited: `--new-pages`
 * created the page from it and left out the nodes it refused, so that cause is
 * named beside an edit.
 */
export const reshapedUnstampedBoardRefusal = (drawn: {
  readonly page: string
  readonly drawing?: string | undefined
  readonly holdsMoreNodes?: boolean | undefined
}): string => {
  const board = `Error: The board ${drawn.drawing ?? drawn.page} draws the page ${drawn.page} without the stamps an export gives its nodes`
  const cause =
    drawn.holdsMoreNodes === true
      ? ", and it holds more nodes than the page: nodes were added to it since, or, if `--new-pages` created the page from this board, some of its nodes were refused then and left out of the page. Either way they cannot be matched to the page's."
      : ", and nodes were added to it, removed from it or replaced by another kind since, so they cannot be matched to the page's."
  return `${board}${cause} Export the page again with \`sovrium design-system --format bundle --pages\` and redraw the edit on its new board, which carries the stamps.\n\n  Nothing was written.`
}

/** One translated edit: written to the default language, or kept with why. */
const translationLine = (change: ReportPage['translations'][number]): string => {
  const texts = `${quoted(change.before)} -> ${quoted(change.after)}`
  const pending =
    (change.needsTranslation ?? []).length === 0
      ? ''
      : `; needs translation: ${(change.needsTranslation ?? []).join(', ')}`
  return change.written === undefined
    ? `  kept, translated copy ${change.key} at ${change.node}: ${texts} (not written: ${change.reason ?? 'no reason given'}${pending})`
    : `  ~ ${change.node} ${change.key} [${change.written}]: ${texts}${pending}`
}

/** Every line one page's report holds, or one line saying it holds nothing. */
const pageLines = (page: ReportPage): readonly string[] => {
  const lines = [
    ...(page.created === undefined
      ? []
      : [
          `  new page at ${page.created.path}` +
            (page.created.like === undefined ? '' : `, with the access of ${page.created.like}`),
        ]),
    ...page.moved.map((move) => `  moved ${move.node} to ${move.to}`),
    ...page.added.map((addition) => `  + ${addition.type} added at ${addition.node}, unbound`),
    ...page.removed.map((node) => `  - ${node} removed`),
    ...page.changes.map(
      (change) =>
        `  ~ ${change.node} ${change.property}: ${quoted(change.before)} -> ${quoted(change.after)}`
    ),
    ...page.offScale.map(
      (entry) =>
        `  kept, off the scale: ${entry.node} ${entry.property} ${entry.value}` +
        (entry.nearestToken === undefined ? '' : ` (nearest token: ${entry.nearestToken})`)
    ),
    ...page.refused.map(
      (refusal) => `  refused ${refusal.code} at ${refusal.node}: ${refusal.reason}`
    ),
    ...page.translations.map(translationLine),
    ...page.ignored.map((entry) => `  not read: ${entry.node}: ${entry.reason}`),
    ...(page.conflicts ?? []).map(
      (conflict) =>
        `  set twice: ${conflict.node} ${conflict.property}: kept ${conflict.kept} (${conflict.value}) over ${conflict.overridden.join(', ')}`
    ),
  ]
  return lines.length === 0 ? ['  No change: the config already draws this page.'] : lines
}

/** The colours `--tokens` read from the canvas, and whether they were written. */
const tokenLines = (tokens: PageImportReport['tokens']): readonly string[] =>
  tokens === undefined
    ? []
    : [
        '',
        'design tokens',
        ...tokens.changes.map(
          (change) =>
            `  ~ ${change.token} (${change.theme ?? 'every theme'}): ${quoted(change.before)} -> ${quoted(change.after)}`
        ),
        tokens.written
          ? '  written to design'
          : `  not written: ${tokens.reason ?? 'no reason given'}`,
      ]

/** What `--write` did, or what a dry run would do. */
const writtenLines = (report: PageImportReport, dryRun: boolean): readonly string[] => {
  const { written } = report
  if (written === undefined) {
    return dryRun ? ['Nothing written (dry run). Run again with --write to apply.'] : []
  }
  if (written.bytes === 0 && (written.sidecars ?? []).length === 0) {
    return ['Nothing to change, so nothing was written.']
  }
  if (written.literals !== undefined) {
    return [
      `Rewrote ${written.literals.length} literal${written.literals.length === 1 ? '' : 's'} in place (${written.bytes} bytes changed):`,
      ...written.literals.map(
        (edit) => `  ${edit.file}:${edit.line} ${quoted(edit.before)} -> ${quoted(edit.after)}`
      ),
    ]
  }
  if (written.sidecars === undefined) {
    return [
      `Wrote the pages into ${displayPath(written.config ?? '')} (${written.bytes} bytes changed).`,
    ]
  }
  return written.sidecars.flatMap((sidecar) => [
    `Wrote ${sidecar.page} to ${sidecar.path}. The TypeScript config was not edited.`,
    ...(sidecar.importLine === undefined
      ? []
      : sidecarImportLines(sidecar.importLine, isCreated(report, sidecar.page))),
  ])
}

/** Whether the report names a page as new: one the config held no entry for. */
const isCreated = (report: PageImportReport, page: string): boolean =>
  report.pages.some((entry) => entry.name === page && entry.created !== undefined)

/**
 * What to do with a new sidecar's import line: put the import in place of the
 * page's inline entry, or, for a new page, which has none, add it to `pages`.
 */
const sidecarImportLines = (importLine: string, created: boolean): readonly string[] => {
  const name = importLine.split(' ')[1] ?? ''
  return [
    '',
    `Add this line to the module that ${created ? 'declares the pages' : 'owns the page'}:`,
    `  ${importLine}`,
    created
      ? `and add \`${name}\` to \`pages\`.`
      : `and put \`${name}\` in place of its inline entry in \`pages\`.`,
  ]
}

/**
 * The report as text.
 *
 * @param report - the report `--json` prints.
 * @param merged - every page's merge, in report order.
 * @param dryRun - whether nothing was asked to be written.
 */
export const renderPagesReport = (
  report: PageImportReport,
  merged: readonly MergedPage[],
  dryRun: boolean
): string => {
  const { source, templates } = report
  const lines = [
    `Pages read from ${displayPath(source.path)} (${source.format}, ${source.forced ? 'named with --from' : 'detected'})`,
    ...(report.skipped ?? []).flatMap((entry) => [
      '',
      `skipped ${entry.drawing}`,
      `  not imported: ${entry.reason}`,
    ]),
    ...merged.flatMap(({ name, plan }) => ['', name, ...pageLines(plan.report)]),
    ...tokenLines(report.tokens),
    ...(templates.found === 0
      ? []
      : [
          '',
          `${templates.found} template placement${templates.found === 1 ? '' : 's'} drawn; templates are never written back from a page drawing.`,
        ]),
    '',
    ...writtenLines(report, dryRun),
  ]
  return `${lines.join('\n').trimEnd()}\n`
}
