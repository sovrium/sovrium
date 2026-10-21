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
 * config is judged as `sovrium validate` judges it before a byte is written;
 * a TypeScript config is never edited; templates are never imported.
 */

import { join } from 'node:path'
import { DEFAULT_SCALE_VALUES } from '@/domain/models/app/design/default-design.generated'
import { ENGINE_COMPONENT_TYPES } from '@/domain/models/app/pages/components/component-types/component-type-union'
import {
  defaultSpacingStepsOf,
  spacingScaleOf,
} from '@/domain/models/app/pages/page-merge-layout-service'
import { getFlagValue, getFlagValues } from '../runtime/flag-vocabulary'
import { refuse } from './app-prelude'
import { loadValidConfig, resolveConfig } from './design-system-import-config'
import { writeMergedPages, type MergedPage } from './design-system-import-pages-apply'
import { PAGE_READERS, type SkippedDrawing } from './design-system-import-pages-readers'
import {
  bundleFilesOf,
  bundleView,
  displayPath,
  locatePageSource,
  PAGE_FORMATS,
  type LocatedPageSource,
  type PageFormat,
} from './design-system-import-pages-source'
import { renderPagesReport } from './design-system-import-pages-text'
import { rootFormatOf } from './library-add-config'
import { lazyImportIndex } from './utils'
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
}

const USAGE =
  'Usage:\n  sovrium design-system import <file|folder> --pages --config <app.yaml|app.json|app.ts> ' +
  '[--from claude-design|figma|penpot] [--page <name>] [--dry-run | --write] [--json]'

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
  }
}

/**
 * The kit a drawing may add nodes from: every component type the kit draws.
 * Text a new node draws goes to `content` on a text node and to a lone string
 * child on any other, as a page writes a button's label.
 */
const KIT = {
  types: new Set<string>(ENGINE_COMPONENT_TYPES),
  contentTypes: new Set(['text']),
}

/** The default scale every app renders with when its config declares no `design.spacing`. */
const DEFAULT_SPACING_STEPS = defaultSpacingStepsOf(DEFAULT_SCALE_VALUES)

/**
 * The scale a drawing's lengths are read against: the app's declared
 * `design.spacing`, else the default scale every app renders with.
 */
const spacingOf = (app: App): Readonly<Record<string, string>> =>
  spacingScaleOf(
    app.design?.spacing as Readonly<Record<string, string>> | undefined,
    DEFAULT_SPACING_STEPS
  )

/** What one tool's drawings came to: the pages read, and the drawings set aside. */
interface ReadDrawings {
  readonly pages: readonly DrawnPage[]
  readonly skipped: readonly SkippedDrawing[]
}

/** Read one tool's drawings through its parser, refusing what it cannot read at all. */
const readDrawings = async (
  located: Pick<LocatedPageSource, 'format' | 'view' | 'files' | 'path'>,
  app: App
): Promise<ReadDrawings> => {
  const reader = PAGE_READERS[located.format]
  if (reader === undefined) {
    return refuse(`Error: This version cannot read ${located.format} page drawings yet.`)
  }
  const result = await reader(located.view, located.files, {
    spacing: spacingOf(app),
    kitTypes: KIT.types,
  })
  return 'error' in result
    ? refuse(
        `Error: "${displayPath(located.path)}" cannot be read as ${located.format}. ${result.error}`
      )
    : { pages: result.pages, skipped: result.skipped ?? [] }
}

/**
 * The drawings the request asks for, and those set aside: a drawing of a page
 * the config does not declare is skipped and named, and the others are read;
 * `--page` narrows them, and names only pages drawn.
 */
const selectDrawings = (read: ReadDrawings, app: App, names: readonly string[]): ReadDrawings => {
  const declared = new Set((app.pages ?? []).map((page) => page.name))
  const foreign = read.pages.filter((drawing) => !declared.has(drawing.page))
  const drawings = read.pages.filter((drawing) => declared.has(drawing.page))
  const skipped = [
    ...read.skipped,
    ...foreign.map((drawing) => ({
      drawing: drawing.drawing ?? drawing.page,
      reason: `It draws the page ${drawing.page}, which this config does not declare; declare the page, or import into the config the drawing was exported from.`,
    })),
  ]
  const missing = names.filter((name) => !drawings.some((drawing) => drawing.page === name))
  if (missing.length > 0) {
    return refuse(
      `Error: --page ${missing.join(', ')} names no page this drawing holds.\n\n` +
        `  It holds: ${drawings.map((drawing) => drawing.page).join(', ') || 'no page'}.`
    )
  }
  const selected = drawings.filter((drawing) => names.length === 0 || names.includes(drawing.page))
  const order = (app.pages ?? []).map((page) => page.name)
  return {
    pages: selected.toSorted((a, b) => order.indexOf(a.page) - order.indexOf(b.page)),
    skipped: names.length === 0 ? skipped : [],
  }
}

/** The same tool's drawings of an unedited export of the config, built in memory. */
const baselinesOf = async (
  app: App,
  configPath: string,
  format: PageFormat,
  names: readonly string[]
): Promise<ReadonlyMap<string, DrawnPage>> => {
  const { buildDesignSystemBundle } = await lazyImportIndex()
  const { assetProjectDir } = await import('@/infrastructure/assets/private-assets')
  const bundle = await buildDesignSystemBundle(app, {
    publicDir: join(assetProjectDir(configPath), 'public'),
    pages: { names },
  })
  const view = bundleView(bundle.files)
  const files = await bundleFilesOf(view, format)
  const { pages } = await readDrawings({ format, view, files, path: 'the unedited export' }, app)
  return new Map(pages.map((page) => [page.page, page] as const))
}

type Raw = Readonly<Record<string, unknown>>

/** Each template's definition in the config, by name, which a placement's inside is read against. */
const templatesOf = (parsed: unknown): ReadonlyMap<string, Raw> => {
  const { components } = parsed as Raw
  return new Map(
    (Array.isArray(components) ? (components as readonly Raw[]) : []).flatMap((component) =>
      typeof component['name'] === 'string' ? [[component['name'], component] as const] : []
    )
  )
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

/** Merge every selected drawing into its page entry. */
const mergeAll = async (
  app: App,
  loaded: { readonly parsed: unknown; readonly configPath: string },
  drawings: readonly DrawnPage[],
  baselines: ReadonlyMap<string, DrawnPage>
): Promise<readonly MergedPage[]> => {
  const { parsed, configPath } = loaded
  const { projectPageForExport } =
    await import('@/application/use-cases/admin/design-system-page-projection')
  const { planPageMerge } = await import('@/domain/models/app/pages/page-merge')
  const rawPages = ((parsed as Readonly<Record<string, unknown>>)['pages'] ??
    []) as readonly Readonly<Record<string, unknown>>[]
  return drawings.map((drawn) => {
    const page = (app.pages ?? []).find((candidate) => candidate.name === drawn.page)
    const raw = rawPages.find((candidate) => candidate['name'] === drawn.page)
    const baseline = baselines.get(drawn.page)
    if (page === undefined || raw === undefined || baseline === undefined) {
      return refuse(`Error: The page ${drawn.page} could not be read back from the config.`)
    }
    const projected = projectPageForExport(app, page)
    const plan: PageMergePlan = planPageMerge({
      page: raw,
      tree: projected.tree.nodes,
      nodeMap: projected.map,
      drawn,
      baseline,
      spacing: spacingOf(app),
      kit: KIT,
      languages: languagesOf(app, configPath),
      templates: templatesOf(parsed),
    })
    return { name: drawn.page, plan }
  })
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
  const { decodeAppConfigObject } = await import('@/application/use-cases/config/decode-app-config')
  const decoded = decodeAppConfigObject(loaded.parsed, { refSources: loaded.refSources })
  if (!decoded.valid)
    return refuse(`Error: The config does not validate.\n\n  ${decoded.errors.join('\n  ')}`)
  const { app } = decoded
  const selected = selectDrawings(await readDrawings(located, app), app, request.pages)
  const { pages: drawings } = selected
  const baselines = await baselinesOf(
    app,
    configPath,
    located.format,
    drawings.map((drawing) => drawing.page)
  )
  const merged = await mergeAll(app, { parsed: loaded.parsed, configPath }, drawings, baselines)
  const written = request.write
    ? await writeMergedPages(configPath, located.path, loaded, merged)
    : undefined
  const report: PageImportReport = {
    format: 'sovrium.design-system.page-import-report',
    version: 1,
    source: { path: located.path, format: located.format, forced: located.forced },
    pages: merged.map(({ plan }) => plan.report),
    ...(selected.skipped.length === 0 ? {} : { skipped: selected.skipped }),
    templates: {
      imported: false,
      found: merged.reduce((sum, { plan }) => sum + plan.templatesFound, 0),
    },
    ...(written === undefined ? {} : { written }),
  }
  process.stdout.write(
    request.json
      ? `${JSON.stringify(report, undefined, 2)}\n`
      : renderPagesReport(report, merged, !request.write)
  )
}
