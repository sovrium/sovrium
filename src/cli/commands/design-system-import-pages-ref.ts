/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium design-system import --pages` into a config assembled from `$ref`
 * partials: the pages, translations and colours of one run written through
 * the includes (`design-system-import-ref-write.ts`), and every change of the
 * report named by the file that holds it and its place in that file.
 *
 * A file several pages include is judged on every board of the source that
 * draws it: the pages the run merges, and with `--page`, the boards it left
 * out, merged for that judgement only. A page no board draws never decides.
 */

import { type Pointer } from '@/domain/kernel/config-parsing/ref-tree-compare'
import { rewriteGraph } from '@/domain/kernel/config-parsing/ref-write-back'
import { designColourKeyOf } from '@/domain/models/app/design/adapters/pages/claude-design-canvas-tokens'
import {
  translationWritesOf,
  withPatches,
  withTranslations,
  type MergedPage,
} from './design-system-import-pages-apply'
import { withColours, type ColourWrite } from './design-system-import-pages-tokens'
import {
  fileOf,
  isAssembled,
  positionOf,
  readConfigFiles,
  type ConfigFiles,
} from './design-system-import-ref-owners'
import { writeThrough, type WrittenThrough } from './design-system-import-ref-write'
import { rootFormatOf } from './library-add-config'
import type { PageImportReport } from '@/domain/models/api/admin/design-system/page-import-report'

type JsonObject = Readonly<Record<string, unknown>>

/** The config's files when it is a YAML or JSON config assembled from includes, else `undefined`. */
export const assembledConfig = async (configPath: string): Promise<ConfigFiles | undefined> => {
  if (rootFormatOf(configPath) === 'typescript') return undefined
  const config = await readConfigFiles(configPath)
  return isAssembled(config) ? config : undefined
}

const pagesOf = (root: unknown): readonly JsonObject[] => {
  const pages = (root as JsonObject | undefined)?.['pages']
  return Array.isArray(pages) ? (pages as readonly JsonObject[]) : []
}

const patchesOf = (merged: readonly MergedPage[]) =>
  merged.flatMap(({ name, plan }) =>
    plan.patch === undefined ? [] : [{ name, entry: plan.patch }]
  )

/** The name of the page a position lies on, or `undefined` outside `pages`. */
const pageAt = (parsed: unknown, position: Pointer): string | undefined => {
  const [key, index] = position
  if (key !== 'pages' || typeof index !== 'number') return undefined
  const name = pagesOf(parsed)[index]?.['name']
  return typeof name === 'string' ? name : undefined
}

/** The resolved config a run's pages, translations and colours make. */
const resolvedWith = (
  parsed: unknown,
  merged: readonly MergedPage[],
  colours: readonly ColourWrite[]
): JsonObject =>
  withColours(
    withTranslations(withPatches(parsed, patchesOf(merged)), translationWritesOf(merged)),
    colours
  )

/** What one page run writes through the includes. */
export interface PagesChange {
  readonly merged: readonly MergedPage[]
  readonly colours?: readonly ColourWrite[] | undefined
  /** With `--page`, the merges of the boards left out, judged for shared files only. */
  readonly judges?: readonly MergedPage[] | undefined
}

/**
 * Write a page run through the config's includes, or, on a dry run, decide
 * every refusal the write would make; `undefined` when the config is not
 * assembled from includes, which the inline writer then takes.
 *
 * @param configPath - the config.
 * @param parsed - the config as loaded, its includes resolved.
 * @param change - the merges, the colours, and the boards judged beside them.
 * @param dryRun - decide, write nothing.
 */
export const writePagesThroughRefs = async (
  configPath: string,
  parsed: unknown,
  change: PagesChange,
  dryRun: boolean
): Promise<WrittenThrough | undefined> => {
  const config = await assembledConfig(configPath)
  if (config === undefined) return undefined
  const { merged, colours = [], judges = [] } = change
  const merging = new Set(merged.map((page) => page.name))
  const judging = new Set(judges.map((page) => page.name))
  const extraVisits =
    judges.length === 0
      ? []
      : rewriteGraph(
          config.graph,
          parsed,
          resolvedWith(parsed, [...merged, ...judges], [])
        ).visits.filter((visit) => judging.has(pageAt(parsed, visit.position) ?? ''))
  return writeThrough(
    {
      config,
      old: parsed,
      next: resolvedWith(parsed, merged, colours),
      counts: (position) => {
        const page = pageAt(parsed, position)
        return page === undefined || merging.has(page)
      },
      extraVisits,
      placeOf: (position) => pageAt(parsed, position) ?? 'the config',
      invalid: 'Error: The imported pages do not validate, so nothing was written.',
    },
    dryRun
  )
}

/** A node id's position in its page entry: `menu:/components/0` → `['components', 0]`. */
const nodePosition = (node: string): Pointer | undefined => {
  const at = node.indexOf(':/')
  if (at === -1) return undefined
  return node
    .slice(at + 2)
    .split('/')
    .map((step) => (/^\d+$/.test(step) ? Number(step) : step))
}

/** A property's steps below its node: `children.0` → `['children', 0]`. */
const propertySteps = (property: string): Pointer =>
  property.split('.').map((step) => (/^\d+$/.test(step) ? Number(step) : step))

/** One page's report, each change and translation named by the file holding it. */
const pageReportWithFiles = (
  config: ConfigFiles,
  index: number,
  report: PageImportReport['pages'][number]
): PageImportReport['pages'][number] => ({
  ...report,
  changes: report.changes.map((change) => {
    const node = nodePosition(change.node)
    return node === undefined
      ? change
      : {
          ...change,
          ...positionOf(config, ['pages', index, ...node, ...propertySteps(change.property)]),
        }
  }),
  translations: report.translations.map((translation) =>
    translation.written === undefined
      ? translation
      : {
          ...translation,
          ...positionOf(config, [
            'languages',
            'translations',
            translation.written,
            translation.key.replace(/^\$t:/, ''),
          ]),
        }
  ),
})

/** What a page run reports, named by file. */
export interface FiledReports {
  readonly merged: readonly MergedPage[]
  readonly tokens?: NonNullable<PageImportReport['tokens']> | undefined
  /** Each page's own file, when it is not the config. */
  readonly pageFiles: ReadonlyMap<string, string>
}

/**
 * Name every page change, translation change and token change by the file
 * that holds it and its JSON Pointer there, when the config is assembled from
 * includes; leave the report as it is otherwise.
 *
 * @param configPath - the config.
 * @param parsed - the config as loaded, its includes resolved.
 * @param report - the merges, and the token report of `--tokens`.
 */
export const withFiles = async (
  configPath: string,
  parsed: unknown,
  report: { readonly merged: readonly MergedPage[]; readonly tokens?: PageImportReport['tokens'] }
): Promise<FiledReports> => {
  const config = await assembledConfig(configPath)
  if (config === undefined) return { ...report, pageFiles: new Map() }
  const indexOf = (name: string) => pagesOf(parsed).findIndex((page) => page['name'] === name)
  const merged = report.merged.map((page) => {
    const index = indexOf(page.name)
    return index === -1
      ? page
      : {
          ...page,
          plan: { ...page.plan, report: pageReportWithFiles(config, index, page.plan.report) },
        }
  })
  const configName = fileOf(config, [])
  const pageFiles = new Map(
    report.merged.flatMap((page) => {
      const index = indexOf(page.name)
      const file = index === -1 ? configName : fileOf(config, ['pages', index])
      return file === configName ? [] : [[page.name, file] as const]
    })
  )
  const { tokens } = report
  return {
    merged,
    pageFiles,
    ...(tokens === undefined
      ? {}
      : {
          tokens: {
            ...tokens,
            changes: tokens.changes.map((change) => {
              const key = designColourKeyOf(change.theme ?? '')
              return key === undefined
                ? change
                : { ...change, ...positionOf(config, ['design', key, change.token]) }
            }),
          },
        }),
  }
}
