/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium import` — the report as text, the default output. `--json` prints
 * the same report as the `sovrium.import-report` document; both come from one
 * value, so the text never says something the JSON does not.
 */

import type { ImportReport } from '@/domain/models/import/import-report'

/** The pages section, read as text: `--json` carries every node-level detail. */
const pageLines = (report: ImportReport): readonly string[] => {
  const { pages } = report
  if (pages === undefined) return []
  if (pages.status === 'pending') return ['', `Pages: ${pages.message}`]
  const counted = (count: number, what: string): readonly string[] =>
    count === 0 ? [] : [`  ${what}: ${String(count)} (listed in --json)`]
  return [
    '',
    `Pages (${String(pages.created.length)}):`,
    ...pages.created.map(
      (page) =>
        `  + ${page.name} at ${page.path} (${plural(page.nodes, 'node')}, from ${page.file})`
    ),
    ...pages.refused.map((page) => `  not written: ${page.page} — ${page.detail}`),
    ...pages.forms.map((form) => `  form on ${form.page}: ${form.form}`),
    ...counted(pages.unmapped.length, 'components with no Sovrium match'),
    ...counted(pages.unbound.length, 'bindings to reconnect'),
    ...counted(pages.offScale.length, 'layout values off the spacing scale, kept as written'),
    ...counted(pages.leftBehind.length, 'files and data the pages held, left for the data import'),
  ]
}

type Written = NonNullable<ImportReport['written']>

const plural = (count: number, word: string): string =>
  `${String(count)} ${word}${count === 1 ? '' : 's'}`

/** How a field that did not map as-is reads in the text: the JSON keeps the outcome code. */
const FIELD_OUTCOME_LABEL = { degraded: 'simplified', unmapped: 'as text' } as const

const tableLines = (report: ImportReport): readonly string[] => {
  const { tables } = report
  if (tables === undefined) return []
  const lossy = tables.fields.filter((field) => field.outcome !== 'mapped')
  return [
    '',
    `Tables (${String(tables.created.length)}):`,
    ...tables.created.map(
      (table) => `  + ${table.name} (${plural(table.fields, 'field')}, from ${table.source})`
    ),
    ...lossy.map(
      (field) =>
        `    ${field.outcome === 'mapped' ? '' : `${FIELD_OUTCOME_LABEL[field.outcome]} `}${field.table}.${field.field}: ${field.sourceType} -> ${field.type}${field.reason === undefined ? '' : ` — ${field.reason}`}`
    ),
    ...tables.views
      .filter((view) => view.outcome === 'reported')
      .map(
        (view) =>
          `    view ${view.table} / ${view.view} (${view.kind}): not converted, only a grid view becomes a table view`
      ),
    ...tables.neverImportable.map((item) => `    never importable: ${item.what} — ${item.reason}`),
  ]
}

const dataLines = (report: ImportReport): readonly string[] => {
  const { data } = report
  if (data === undefined) return []
  return [
    '',
    `Records (${String(data.tables.length)} seed file${data.tables.length === 1 ? '' : 's'}):`,
    ...data.tables.map(
      (table) =>
        `  ${table.file}: ${plural(table.records, 'record')}, keyed by ${table.identity === 'source-id' ? 'source id' : 'row position'}`
    ),
    ...(data.users === 0
      ? []
      : [`  seed/import/users.yaml: ${plural(data.users, 'account')}, no password, no invitation`]),
  ]
}

const automationLines = (report: ImportReport): readonly string[] => {
  const { automations } = report
  if (automations === undefined) return []
  return [
    '',
    `Automations (${String(automations.created.length)}, every one disabled):`,
    ...automations.created.map(
      (automation) =>
        `  + ${automation.name} (from "${automation.source}"${automation.sourceActive ? ', on in the source' : ''}): ` +
        (automation.todos === 0 ? 'ready to review' : plural(automation.todos, 'TODO'))
    ),
    ...automations.connections.map((connection) => `  connection to set up: ${connection.name}`),
    ...automations.env.map((name) => `  environment variable to set: ${name}`),
    ...automations.neverImportable.map(
      (item) => `  never importable: ${item.what} — ${item.reason}`
    ),
  ]
}

const formLines = (report: ImportReport): readonly string[] => {
  const { forms } = report
  if (forms === undefined) return []
  return [
    '',
    `Forms (${String(forms.created.length)}):`,
    ...forms.created.map(
      (form) =>
        `  + ${form.name} (from "${form.source}", writes to ${form.table}): ` +
        `${plural(form.fields, 'field')}, ${form.steps === 0 ? 'one page' : plural(form.steps, 'step')}, ${plural(form.responses, 'response')}` +
        (form.definitionInferred ? ', definition inferred from the responses' : '')
    ),
  ]
}

/** What the TypeScript config still needs: `--write` never edits one. */
const importLineBlock = (written: Written): readonly string[] =>
  written.importLines.length === 0
    ? []
    : [
        'The TypeScript config was not edited. Add these lines to it:',
        ...written.importLines.map((line) => `  ${line}`),
      ]

/** The files a `--write` changed, one line each. */
const fileLines = (written: Written): readonly string[] => [
  ...(written.config === undefined ? [] : [`Wrote ${written.config}.`]),
  ...written.sidecars.map((sidecar) => `Wrote ${sidecar}.`),
  ...importLineBlock(written),
  ...written.seedFiles.map((file) => `Wrote ${file}.`),
  ...(written.assets === 0
    ? []
    : [`Copied ${plural(written.assets, 'attachment')} into seed/import/assets/.`]),
  ...written.gitignore.map((entry) => `Added ${entry} to .gitignore.`),
]

const seedLines = (written: Written): readonly string[] => {
  if (written.applied === undefined)
    return written.seedFiles.length === 0
      ? []
      : ['Seed them with: sovrium seed --dir seed/import --mode upsert']
  return [
    'Seeded (sovrium seed --dir seed/import --mode upsert):',
    ...written.applied.map(
      (table) =>
        `  ${table.table}: ${String(table.inserted)} inserted, ${String(table.updated)} updated, ${String(table.unchanged)} unchanged`
    ),
  ]
}

const writtenLines = (report: ImportReport): readonly string[] => {
  const { written } = report
  if (written === undefined)
    return [
      '',
      report.data === undefined
        ? 'Nothing written (dry run). Run again with --write to make these changes.'
        : 'Nothing written (dry run). Run again with --write to make these changes, and add --apply to seed the records.',
    ]
  // A re-run that would write the same bytes writes nothing, so it says so rather than "Wrote".
  const files = written.unchanged
    ? ['Nothing to change: every file already holds these bytes.', ...importLineBlock(written)]
    : fileLines(written)
  return ['', ...files, ...seedLines(written)]
}

/** The report as text. */
export const renderImportReport = (report: ImportReport): string => {
  const lines = [
    `Import from ${report.source.input} (${report.source.tool}, ${report.source.forced ? 'named with --from' : 'detected'})`,
    ...tableLines(report),
    ...dataLines(report),
    ...automationLines(report),
    ...formLines(report),
    ...pageLines(report),
    ...(report.unmapped.length === 0
      ? []
      : [
          '',
          `Simplified or left out (${String(report.unmapped.length)}):`,
          ...report.unmapped.map((item) => `  ${item.source}: ${item.reason}`),
        ]),
    ...(report.todo.length === 0
      ? []
      : [
          '',
          `TODO (${String(report.todo.length)}):`,
          ...report.todo.flatMap((item) => [
            `  ${item.target}: ${item.reason}`,
            ...item.original.split('\n').map((line) => `      ${line}`),
          ]),
        ]),
    ...writtenLines(report),
  ]
  return `${lines.join('\n')}\n`
}
