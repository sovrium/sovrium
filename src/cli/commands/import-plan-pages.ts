/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium import` — the pages of a migration ([internal ref] A14, pages part).
 *
 * The page converter is called through the `MigratedPages` port, once, before
 * anything is planned: its forms join the forms part, so the forms mapper
 * writes each one as a table-bound `forms[]` entry under the name the page's
 * `formRef` holds. The pages themselves are admitted against the config and
 * the forms the run emits (`migrated-page-admission-service`), then decoded
 * with the rest of the migrated app, once. Nothing here writes.
 */

import { Effect, Schema } from 'effect'
import {
  MigratedPages,
  PENDING_PAGES_REPORT,
  type MigratedPagesTarget,
  type MigrationSnapshot,
} from '@/application/ports/services/migrated-pages'
import {
  migratedPagesReportSchema,
  type MigratedPagesReport,
} from '@/domain/models/app/design/adapters/pages/migrate/migrated-pages-report'
import { canonicalFormOfExtracted } from '@/domain/models/import/extracted-form-service'
import { importPendingPagesSchema } from '@/domain/models/import/import-report'
import {
  admitMigratedPages,
  renameFormRefs,
  renameReportForms,
  withAdmission,
} from '@/domain/models/import/migrated-page-admission-service'
import { IMPORT_SNAPSHOT_FORMAT } from '@/domain/models/import/snapshot-manifest'
import { refuse } from './app-prelude'
import type { ImportInput } from './import-input'
import type { CanonicalForm } from '@/domain/models/import/canonical-form'
import type { ImportReport } from '@/domain/models/import/import-report'
import type { ImportSourceTool } from '@/domain/models/import/import-source'
import type { ConfigEntry } from '@/domain/models/import/table-mapper-service'

type Json = Readonly<Record<string, unknown>>

/** What the page converter gave the run: nothing (none installed), or its plan. */
export type MigratedPagesRun =
  | { readonly kind: 'pending' }
  | {
      readonly kind: 'converted'
      readonly pages: readonly unknown[]
      readonly report: MigratedPagesReport
      readonly forms: readonly CanonicalForm[]
    }

/** The run of a binary that holds no page converter. */
export const PENDING_PAGES_RUN: MigratedPagesRun = { kind: 'pending' }

/** The snapshot the converter reads: the input's own manifest, or one describing the export file. */
const snapshotOf = (input: ImportInput, tool: ImportSourceTool): MigrationSnapshot => ({
  manifest: input.manifest ?? {
    format: IMPORT_SNAPSHOT_FORMAT,
    version: 1,
    tool,
    exportKind: input.exportKind,
    fetchedAt: '1970-01-01T00:00:00.000Z',
    source: { uri: input.display, ids: [] },
    domains: ['pages'],
    attachments: { downloaded: 0, skipped: 0 },
    files: [],
    cursors: [],
  },
  raw: input.raw,
})

/** What the config holds that the page converter reads: its `design.spacing` lengths. */
export const migratedPagesTargetOf = (parsed: unknown): MigratedPagesTarget => {
  const design = (parsed as Json | undefined)?.['design']
  const spacing =
    typeof design === 'object' && design !== null ? (design as Json)['spacing'] : undefined
  if (typeof spacing !== 'object' || spacing === null || Array.isArray(spacing)) return {}
  return {
    spacing: Object.fromEntries(
      Object.entries(spacing).flatMap(([step, value]) =>
        typeof value === 'string' ? [[step, value] as const] : []
      )
    ),
  }
}

/**
 * Call the page converter the `MigratedPages` port holds, once, with what the
 * config already holds. A converter that holds no parser for this source
 * answers with the pending notice, which is reported as such; any other report
 * this binary cannot read is refused rather than printed half-understood.
 */
export const convertMigratedPages = (
  input: ImportInput,
  tool: ImportSourceTool,
  target: MigratedPagesTarget = {}
): Effect.Effect<MigratedPagesRun> =>
  Effect.gen(function* () {
    const converter = yield* MigratedPages
    if (converter.planMigratedPages === undefined) return PENDING_PAGES_RUN
    const plan = converter.planMigratedPages(snapshotOf(input, tool), target)
    if (Schema.is(importPendingPagesSchema)(plan.report)) return PENDING_PAGES_RUN
    if (!Schema.is(migratedPagesReportSchema)(plan.report)) {
      return refuse(
        'Error: The page converter returned a report this binary cannot read, so the import changed nothing.'
      )
    }
    return {
      kind: 'converted' as const,
      pages: plan.pages,
      report: plan.report,
      forms: plan.forms.map(canonicalFormOfExtracted),
    }
  }).pipe(Effect.withSpan('cli.import.convertMigratedPages'))

/** The forms the pages hold, for the forms part; none while no converter ran. */
export const pageFormsOf = (run: MigratedPagesRun | undefined): readonly CanonicalForm[] =>
  run?.kind === 'converted' ? run.forms : []

/** What the pages part adds to the config, and its report section. */
export interface PagePart {
  readonly pages: readonly ConfigEntry[]
  readonly section: ImportReport['pages']
}

const listOf = (parsed: unknown, key: string): readonly Json[] => {
  const items = (parsed as Json | undefined)?.[key]
  return Array.isArray(items)
    ? items.filter((item): item is Json => typeof item === 'object' && item !== null)
    : []
}

/**
 * The new name of each extracted form the forms mapper renamed, by the name
 * the pages reference it by: `named` gives each source form's written name by
 * its source id. Keyed on the report's forms, the `formRef` each page holds,
 * never on the form's title, which may be a readable label.
 */
export const formRenamesOf = (
  run: MigratedPagesRun | undefined,
  named: ReadonlyMap<string, string>
): ReadonlyMap<string, string> =>
  new Map(
    (run?.kind === 'converted' ? run.report.forms : []).flatMap((entry) => {
      const written = named.get(entry.sourceId)
      return written === undefined || written === entry.form ? [] : [[entry.form, written] as const]
    })
  )

/**
 * Admit the migrated pages against the config and the migrated app's forms —
 * `withForms`, the config with every other addition already in place — once
 * each `formRef` follows its form's rename.
 */
export const planPagePart = (
  run: MigratedPagesRun | undefined,
  parsed: unknown,
  withForms: unknown,
  renames: ReadonlyMap<string, string> = new Map()
): PagePart => {
  if (run === undefined) return { pages: [], section: undefined }
  if (run.kind === 'pending') return { pages: [], section: PENDING_PAGES_REPORT }
  const pages = run.pages.map((page) => renameFormRefs(page, renames))
  const report = renameReportForms(run.report, renames)
  const admission = admitMigratedPages(pages, {
    existingPages: listOf(parsed, 'pages'),
    formNames: new Set(listOf(withForms, 'forms').map((form) => String(form['name']))),
  })
  return { pages: admission.admitted, section: withAdmission(report, admission) }
}

/** Under `--write`, any refused page stops the whole write, naming the pages. */
export const refuseRefusedPages = (section: ImportReport['pages']): void => {
  if (section?.status !== 'converted' || section.refused.length === 0) return
  refuse(
    'Error: The import cannot write these pages, so it changed nothing.\n\n' +
      section.refused.map((finding) => `  ${finding.page}: ${finding.detail}`).join('\n') +
      '\n\n  Preview the run without --write to see the whole pages section.'
  )
}
