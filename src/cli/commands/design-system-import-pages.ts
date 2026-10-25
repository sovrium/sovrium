/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium design-system import <path> --pages [--page <name>…]
 * [--from claude-design|figma|penpot] [--config <file>] [--dry-run | --write] [--json]`
 *
 * The page half of the import: it reads what Claude Design, Figma or Penpot
 * made of the bundle's pages, merges each page back into the config through
 * the one pure merge (`page-merge.ts`), and prints the change — or, with
 * `--write`, writes the page entries. No flag is a dry run.
 *
 * ─── IT TRUSTS THE CONFIG, NOT THE BUNDLE ──────────────────────────────────
 *
 * Only the drawing is read from the source. The design tree and the node map
 * are recomputed from the config on disk, and so is the BASELINE: the export
 * of that config is built again in memory and the same tool's file read back
 * by the same parser, so a value the designer did not touch reads the same on
 * both sides. A null round trip therefore writes zero bytes, whatever the tool.
 *
 * ─── THE BOUNDS IT KEEPS ───────────────────────────────────────────────────
 *
 * Those of the token import: a local path only, no network, no server, no
 * database, no AI; the same input gives the same output; the whole resulting
 * config is judged as `sovrium validate` judges it before a byte is written,
 * and a dry run judges it the same way; a TypeScript config is never edited;
 * templates are never imported.
 */

import { boardVerdictOf } from '@/domain/models/app/pages/page-import-verdict-service'
import { getFlagValue, getFlagValues } from '../runtime/flag-vocabulary'
import { refuse } from './app-prelude'
import { loadValidConfig, resolveConfig } from './design-system-import-config'
import {
  judgeMergedPages,
  writeMergedPages,
  type MergedPage,
} from './design-system-import-pages-apply'
import {
  baselinesOf,
  KIT,
  readDrawings,
  spacingOf,
  type Baselines,
} from './design-system-import-pages-baselines'
import { planTypeScriptLiterals, writeLiterals } from './design-system-import-pages-literals'
import { assembledConfig, withFiles, writePagesThroughRefs } from './design-system-import-pages-ref'
import {
  mergeNewPages,
  referencesOf,
  selectDrawings,
  templatesOf,
  type MergeScale,
  type ReadDrawings,
} from './design-system-import-pages-select'
import {
  locatePageSource,
  PAGE_FORMATS,
  type LocatedPageSource,
  type PageFormat,
} from './design-system-import-pages-source'
import { renderPagesReport, reshapedUnstampedBoardRefusal } from './design-system-import-pages-text'
import { readCanvasTokens } from './design-system-import-pages-tokens'
import { rootFormatOf } from './library-add-config'
import type { PageImportReport } from '@/domain/models/api/admin/design-system/page-import-report'
import type { App } from '@/domain/models/app'
import type { DrawnPage } from '@/domain/models/app/pages/page-drawing'
import type { PageMergePlan } from '@/domain/models/app/pages/page-merge'
import type { TranslationScope } from '@/domain/models/app/pages/page-merge-translation-service'

/** The request, as read from argv. */
interface PagesRequest {
  readonly source: string
  readonly config: string | undefined
  readonly from: PageFormat | undefined
  readonly pages: readonly string[]
  readonly write: boolean
  readonly json: boolean
  /** `--tokens`: read the canvas's token file too. */
  readonly tokens: boolean
  /** `--new-pages`: import a drawing of an undeclared page as a new page. */
  readonly newPages: boolean
  /** `--sidecar`: write a TypeScript config's changed pages to sidecars, not in place. */
  readonly sidecar: boolean
}

const USAGE =
  'Usage:\n  sovrium design-system import <file|folder> --pages --config <app.yaml|app.json|app.ts> ' +
  '[--from claude-design|figma|penpot] [--page <name>] [--new-pages] [--tokens] [--sidecar] [--dry-run | --write] [--json]'

const readFrom = (raw: string | undefined): PageFormat | undefined => {
  if (raw === undefined) return undefined
  const format = PAGE_FORMATS.find((candidate) => candidate === raw.trim().toLowerCase())
  return (
    format ??
    refuse(
      `Error: Unsupported --from "${raw}" with --pages.\n\n  Accepted page formats: ${PAGE_FORMATS.join(', ')}.`
    )
  )
}

const readRequest = (argv: readonly string[], positional: readonly string[]): PagesRequest => {
  const source = positional[1]
  if (source === undefined) return refuse(`Error: No page drawing given.\n\n${USAGE}`)
  const write = argv.includes('--write')
  if (write && argv.includes('--dry-run')) {
    return refuse('Error: --write and --dry-run contradict each other. Choose one.')
  }
  return {
    source,
    config: getFlagValue(argv, '--config'),
    from: readFrom(getFlagValue(argv, '--from')),
    pages: getFlagValues(argv, '--page'),
    write,
    json: argv.includes('--json'),
    tokens: argv.includes('--tokens'),
    newPages: argv.includes('--new-pages'),
    sidecar: argv.includes('--sidecar'),
  }
}

/**
 * The languages a translated edit is written to: the default language's
 * entries of a YAML or JSON config. A TypeScript config's are code, which the
 * import never edits.
 */
const languagesOf = (app: App, configPath: string): TranslationScope | undefined => {
  const { languages } = app
  if (languages === undefined) return undefined
  return {
    defaultLanguage: languages.default,
    translations: (languages.translations ?? {}) as TranslationScope['translations'],
    ...(rootFormatOf(configPath) === 'typescript'
      ? {
          unwritable:
            "A TypeScript config's translations are code, which the import never edits, so nothing was written.",
        }
      : {}),
  }
}

/** A drawn or projected node: all the node count reads of it. */
interface CountedNode {
  readonly children: readonly CountedNode[]
}

/** How many nodes a tree holds, its nested children included. */
const nodeCount = (nodes: readonly CountedNode[]): number =>
  nodes.reduce((sum, node) => sum + 1 + nodeCount(node.children), 0)

/** Merge every selected drawing into its page entry. */
const mergeAll = async (
  app: App,
  loaded: { readonly parsed: unknown; readonly configPath: string },
  selected: { readonly drawings: readonly DrawnPage[]; readonly created: readonly DrawnPage[] },
  baselines: Baselines
): Promise<readonly MergedPage[]> => {
  const { parsed, configPath } = loaded
  const { projectPageForExport } =
    await import('@/application/use-cases/admin/design-system-page-projection')
  const { isReshapedUnstampedDrawing, planPageMerge } =
    await import('@/domain/models/app/pages/page-merge')
  const rawPages = ((parsed as Readonly<Record<string, unknown>>)['pages'] ??
    []) as readonly Readonly<Record<string, unknown>>[]
  const scale: MergeScale = {
    spacing: spacingOf(app),
    kit: KIT,
    languages: languagesOf(app, configPath),
    templates: templatesOf(parsed),
    paint: baselines.paint,
    references: referencesOf(app),
  }
  // The new pages first: a board refused for its path is named before a declared page's board.
  const created = await mergeNewPages(selected.created, rawPages, scale)
  const declared = selected.drawings.map((drawn) => {
    const page = (app.pages ?? []).find((candidate) => candidate.name === drawn.page)
    const raw = rawPages.find((candidate) => candidate['name'] === drawn.page)
    const baseline = baselines.pages.get(drawn.page)
    if (page === undefined || raw === undefined || baseline === undefined) {
      return refuse(`Error: The page ${drawn.page} could not be read back from the config.`)
    }
    const projected = projectPageForExport(app, page)
    const drawing = { page: raw, tree: projected.tree.nodes, nodeMap: projected.map, drawn }
    if (isReshapedUnstampedDrawing(drawing)) {
      const holdsMoreNodes = nodeCount(drawn.nodes) > nodeCount(projected.tree.nodes)
      return refuse(reshapedUnstampedBoardRefusal({ ...drawn, holdsMoreNodes }))
    }
    const plan: PageMergePlan = planPageMerge({ ...scale, ...drawing, baseline })
    return { name: drawn.page, drawing: drawn.drawing, plan }
  })
  return [...declared, ...created]
}

/** The config as the app it declares, or a refusal naming why it does not validate. */
const decodedApp = async (loaded: Awaited<ReturnType<typeof loadValidConfig>>): Promise<App> => {
  const { decodeAppConfigObject } = await import('@/application/use-cases/config/decode-app-config')
  const decoded = decodeAppConfigObject(loaded.parsed, { refSources: loaded.refSources })
  return decoded.valid
    ? decoded.app
    : refuse(`Error: The config does not validate.\n\n  ${decoded.errors.join('\n  ')}`)
}

/** Write the merged pages: literal by literal for a TypeScript config, else into the config. */
const writeOutcome = async (
  target: {
    readonly configPath: string
    readonly source: string
    readonly loaded: Awaited<ReturnType<typeof loadValidConfig>>
  },
  change: { readonly merged: readonly MergedPage[]; readonly judges: readonly MergedPage[] },
  plans: {
    readonly literal: Awaited<ReturnType<typeof planTypeScriptLiterals>> | undefined
    readonly tokens: Awaited<ReturnType<typeof readCanvasTokens>> | undefined
  }
): Promise<NonNullable<PageImportReport['written']>> => {
  if (plans.literal !== undefined)
    return writeLiterals(target.configPath, target.loaded, plans.literal)
  const pages = {
    merged: change.merged,
    ...(plans.tokens === undefined ? {} : { colours: plans.tokens.writes }),
  }
  // A config assembled from includes is written through them; an inline one in place.
  const through = await writePagesThroughRefs(
    target.configPath,
    target.loaded.parsed,
    { ...pages, judges: change.judges },
    false
  )
  return through ?? writeMergedPages(target.configPath, target.source, target.loaded, pages)
}

/**
 * With `--page`, the drawings of the declared pages it leaves out, when the
 * config is assembled from includes: a file several pages include is judged
 * on every board that draws it.
 */
const leftOutDrawings = async (
  read: ReadDrawings,
  app: App,
  target: { readonly configPath: string; readonly names: readonly string[] }
): Promise<readonly DrawnPage[]> => {
  if (target.names.length === 0 || (await assembledConfig(target.configPath)) === undefined) {
    return []
  }
  const every = selectDrawings({ ...read, skipped: [] }, app, { names: [], newPages: false })
  return every.pages.filter((drawing) => !target.names.includes(drawing.page))
}

/** The report `--json` prints, and the text report renders. */
const reportOf = (
  located: Pick<LocatedPageSource, 'path' | 'format' | 'forced'>,
  read: { readonly merged: readonly MergedPage[]; readonly skipped: ReadDrawings['skipped'] },
  outcome: {
    readonly tokens: { readonly report: NonNullable<PageImportReport['tokens']> } | undefined
    readonly written: PageImportReport['written']
  }
): PageImportReport => ({
  format: 'sovrium.design-system.page-import-report',
  version: 1,
  source: { path: located.path, format: located.format, forced: located.forced },
  pages: read.merged.map(({ plan }) => plan.report),
  ...(read.skipped.length === 0 ? {} : { skipped: read.skipped }),
  boards: read.merged.map((page) => boardVerdictOf(page.drawing ?? page.name, page.plan.report)),
  templates: {
    imported: false,
    found: read.merged.reduce((sum, { plan }) => sum + plan.templatesFound, 0),
  },
  ...(outcome.tokens === undefined ? {} : { tokens: outcome.tokens.report }),
  ...(outcome.written === undefined ? {} : { written: outcome.written }),
})

/**
 * Read the drawings and merge those the request selects, with the boards
 * `--page` left out merged beside them for judging shared files only.
 */
const mergeRequested = async (
  request: PagesRequest,
  located: LocatedPageSource,
  target: { readonly configPath: string; readonly parsed: unknown; readonly app: App }
) => {
  const { configPath, app } = target
  const read = await readDrawings(located, app)
  const selected = selectDrawings(read, app, { names: request.pages, newPages: request.newPages })
  const leftOut = await leftOutDrawings(read, app, { configPath, names: request.pages })
  const baselines = await baselinesOf(
    app,
    configPath,
    located,
    [...selected.pages, ...leftOut].map((drawing) => drawing.page)
  )
  const scope = { parsed: target.parsed, configPath }
  const created = { drawings: selected.pages, created: selected.created }
  const mergedPages = await mergeAll(app, scope, created, baselines)
  const judges = await mergeAll(app, scope, { drawings: leftOut, created: [] }, baselines)
  return { selected, mergedPages, judges, baselines }
}

/**
 * Write the merged pages, or on a dry run judge them as the write would,
 * refusing in the same words; `undefined` when nothing was written.
 */
const writeOrJudge = async (
  write: boolean,
  target: Parameters<typeof writeOutcome>[0],
  change: Parameters<typeof writeOutcome>[1],
  plans: Parameters<typeof writeOutcome>[2]
): Promise<PageImportReport['written']> => {
  if (write) return writeOutcome(target, change, plans)
  const { configPath, loaded } = target
  if ((await writePagesThroughRefs(configPath, loaded.parsed, change, true)) === undefined) {
    await judgeMergedPages(loaded, change.merged)
  }
  return undefined
}

/** Print the report: as a document with `--json`, as text otherwise. */
const printReport = (
  request: PagesRequest,
  report: PageImportReport,
  filed: Awaited<ReturnType<typeof withFiles>>
): void => {
  process.stdout.write(
    request.json
      ? `${JSON.stringify(report, undefined, 2)}\n`
      : renderPagesReport(report, filed.merged, {
          dryRun: !request.write,
          pageFiles: filed.pageFiles,
        })
  )
}

/**
 * Handle `sovrium design-system import --pages`.
 *
 * @param argv - the raw arguments after the binary name.
 * @param positional - the positional arguments after `design-system` (`import`, the path).
 */
export const handleDesignSystemPagesImportCommand = async (
  argv: readonly string[],
  positional: readonly string[]
): Promise<void> => {
  const request = readRequest(argv, positional)
  const located = await locatePageSource(request.source, request.from)
  const configPath = await resolveConfig(request.config)
  const loaded = await loadValidConfig(configPath)
  const app = await decodedApp(loaded)
  const { selected, mergedPages, judges, baselines } = await mergeRequested(request, located, {
    configPath,
    parsed: loaded.parsed,
    app,
  })
  // A TypeScript config is rewritten literal by literal, unless --sidecar asks for sidecars.
  const literal =
    rootFormatOf(configPath) === 'typescript' && !request.sidecar
      ? await planTypeScriptLiterals(configPath, loaded.parsed, mergedPages)
      : undefined
  const merged = literal?.merged ?? mergedPages
  const tokens = request.tokens
    ? await readCanvasTokens(located, baselines.tokens, { configPath, write: request.write })
    : undefined
  const written = await writeOrJudge(
    request.write,
    { configPath, source: located.path, loaded },
    { merged, judges },
    { literal, tokens }
  )
  const filed = await withFiles(configPath, loaded.parsed, { merged, tokens: tokens?.report })
  printReport(
    request,
    reportOf(
      located,
      { merged: filed.merged, skipped: selected.skipped },
      {
        tokens: filed.tokens === undefined ? undefined : { report: filed.tokens },
        written,
      }
    ),
    filed
  )
}
