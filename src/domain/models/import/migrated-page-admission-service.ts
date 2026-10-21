/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which migrated pages a config can take, and which it refuses ([internal ref] A14,
 * pages part, bounds 2 and 6).
 *
 * The page converter reads the export and nothing else, so it cannot know the
 * config a page lands in, nor which forms the same run emits. The import does,
 * and decides here. A migrated page is refused when the config already holds
 * a page of that `name` or at that `path` — a migration never merges onto or
 * overwrites a page — or when a `formRef` anywhere in it names a form the
 * migrated app does not hold (its form was not imported, under `--only pages`).
 *
 * A refused page is left out of the app and listed in the section's
 * `refused`; it is no longer `created`. A dry run prints that and succeeds;
 * `--write` stops on it, naming the page.
 */

import type { MigratedPagesReport } from '@/domain/models/app/design/adapters/pages/migrate/migrated-pages-report'

type Json = Readonly<Record<string, unknown>>
type Refused = MigratedPagesReport['refused'][number]

/** What the config already holds, and the forms the migrated app holds. */
export interface PageAdmissionContext {
  readonly existingPages: readonly Json[]
  readonly formNames: ReadonlySet<string>
}

/** The pages the config takes, and the findings for the others. */
export interface PageAdmission {
  readonly admitted: readonly Json[]
  readonly refused: readonly Refused[]
}

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Every `formRef` in a page, at any depth. The walk is generic on purpose: it
 * reads every object and array, so no node kind that nests children escapes it.
 */
export const formRefsOf = (value: unknown): readonly string[] => {
  if (Array.isArray(value)) return value.flatMap(formRefsOf)
  if (!isObject(value)) return []
  const own = typeof value['formRef'] === 'string' ? [value['formRef']] : []
  return [...own, ...Object.values(value).flatMap(formRefsOf)]
}

/**
 * Every `formRef` that names a renamed form, rewritten to its new name, at any
 * depth: the forms mapper may rename an extracted form (`--prefix`, its length
 * cap), and the side that renames rewrites the references. Pages keep their
 * own names; only the reference moves.
 */
export const renameFormRefs = (value: unknown, renames: ReadonlyMap<string, string>): unknown => {
  if (Array.isArray(value)) return value.map((item) => renameFormRefs(item, renames))
  if (!isObject(value)) return value
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      key === 'formRef' && typeof item === 'string'
        ? (renames.get(item) ?? item)
        : renameFormRefs(item, renames),
    ])
  )
}

/** The section's form pairs, under the names the forms were written with. */
export const renameReportForms = (
  report: MigratedPagesReport,
  renames: ReadonlyMap<string, string>
): MigratedPagesReport => ({
  ...report,
  forms: report.forms.map((entry) => ({ ...entry, form: renames.get(entry.form) ?? entry.form })),
})

const textOf = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

/** The finding that refuses one page, or `undefined` when the config takes it. */
const refusalOf = (
  page: Json,
  context: PageAdmissionContext,
  names: ReadonlySet<string | undefined>,
  paths: ReadonlySet<string | undefined>
): Refused | undefined => {
  const name = textOf(page['name']) ?? ''
  const path = textOf(page['path'])
  if (names.has(name)) {
    return {
      page: name,
      reason: 'page-name-collision',
      detail: `The config already has a page named "${name}"; a migrated page never replaces one.`,
    }
  }
  if (path !== undefined && paths.has(path)) {
    return {
      page: name,
      reason: 'page-path-collision',
      detail: `The config already has a page at "${path}"; a migrated page never replaces one.`,
    }
  }
  const dangling = formRefsOf(page).find((ref) => !context.formNames.has(ref))
  return dangling === undefined
    ? undefined
    : {
        page: name,
        reason: 'dangling-form-reference',
        detail: `Its form node names the form "${dangling}", which the migrated app does not hold: import the forms with the pages.`,
      }
}

/** Split the migrated pages into the ones the config takes and the ones it refuses. */
export const admitMigratedPages = (
  pages: readonly unknown[],
  context: PageAdmissionContext
): PageAdmission => {
  const names = new Set(context.existingPages.map((page) => textOf(page['name'])))
  const paths = new Set(context.existingPages.map((page) => textOf(page['path'])))
  return pages.filter(isObject).reduce<PageAdmission>(
    (state, page) => {
      const refusal = refusalOf(page, context, names, paths)
      return refusal === undefined
        ? { ...state, admitted: [...state.admitted, page] }
        : { ...state, refused: [...state.refused, refusal] }
    },
    { admitted: [], refused: [] }
  )
}

/** The converter's section with the import's refusals in it: a refused page is not created. */
export const withAdmission = (
  report: MigratedPagesReport,
  admission: PageAdmission
): MigratedPagesReport => {
  const refused = new Set(admission.refused.map((finding) => finding.page))
  return {
    ...report,
    created: report.created.filter((page) => !refused.has(page.name)),
    refused: [...report.refused, ...admission.refused],
    structure: report.structure.filter((page) => !refused.has(page.page)),
  }
}
