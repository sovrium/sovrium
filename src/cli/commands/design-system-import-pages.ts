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
import { parseJson } from '@/domain/models/app/design/adapters/import/canonical-tokens-service'
import {
  CANVAS_TOKENS_FILE,
  paintTokensOf,
} from '@/domain/models/app/design/adapters/pages/claude-design-canvas-tokens'
import { DEFAULT_SCALE_VALUES } from '@/domain/models/app/design/default-design.generated'
import { ENGINE_COMPONENT_TYPES } from '@/domain/models/app/pages/components/component-types/component-type-union'
import { boardVerdictOf } from '@/domain/models/app/pages/page-import-verdict-service'
import {
  defaultSpacingStepsOf,
  spacingScaleOf,
} from '@/domain/models/app/pages/page-merge-layout-service'
import { getFlagValue, getFlagValues } from '../runtime/flag-vocabulary'
import { refuse } from './app-prelude'
import { loadValidConfig, resolveConfig } from './design-system-import-config'
import { writeMergedPages, type MergedPage } from './design-system-import-pages-apply'
import { planTypeScriptLiterals, writeLiterals } from './design-system-import-pages-literals'
import { PAGE_READERS } from './design-system-import-pages-readers'
import {
  mergeNewPages,
  referencesOf,
  selectDrawings,
  templatesOf,
  type MergeScale,
  type ReadDrawings,
} from './design-system-import-pages-select'
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
import { readCanvasTokens, type UneditedTokens } from './design-system-import-pages-tokens'
import { rootFormatOf } from './library-add-config'
import { lazyImportIndex } from './utils'
import type { PageImportReport } from '@/domain/models/api/admin/design-system/page-import-report'
import type { App } from '@/domain/models/app'
import type { DrawnPage } from '@/domain/models/app/pages/page-drawing'
import type { PageMergePlan } from '@/domain/models/app/pages/page-merge'
import type { PaintTokens } from '@/domain/models/app/pages/page-merge-paint-service'
import type { TranslationScope } from '@/domain/models/app/pages/page-merge-translation-service'

const decoder = new TextDecoder()

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

/** What an unedited export of the config holds: each page's drawing, and its tokens. */
interface Baselines {
  readonly pages: ReadonlyMap<string, DrawnPage>
  readonly paint: PaintTokens
  /** The unedited export's canvas token file, which `--tokens` reads the canvas's against. */
  readonly tokens: UneditedTokens
}

/** The same tool's drawings of an unedited export of the config, built in memory. */
const baselinesOf = async (
  app: App,
  configPath: string,
  format: PageFormat,
  names: readonly string[]
): Promise<Baselines> => {
  const { buildDesignSystemBundle } = await lazyImportIndex()
  const { assetProjectDir } = await import('@/infrastructure/assets/private-assets')
  const bundle = await buildDesignSystemBundle(app, {
    publicDir: join(assetProjectDir(configPath), 'public'),
    pages: { names },
  })
  const view = bundleView(bundle.files)
  const files = await bundleFilesOf(view, format)
  const { pages } = await readDrawings({ format, view, files, path: 'the unedited export' }, app)
  const tokens = bundle.files.find((file) => CANVAS_TOKENS_FILE.test(file.path))
  const document = parseJson(tokens === undefined ? '' : decoder.decode(tokens.bytes))
  return {
    pages: new Map(pages.map((page) => [page.page, page] as const)),
    paint: paintTokensOf(document),
    tokens: { path: (tokens?.path ?? '').replace(/^.*?(ds\/)/, '$1'), document },
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
  const { planPageMerge } = await import('@/domain/models/app/pages/page-merge')
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
  const declared = selected.drawings.map((drawn) => {
    const page = (app.pages ?? []).find((candidate) => candidate.name === drawn.page)
    const raw = rawPages.find((candidate) => candidate['name'] === drawn.page)
    const baseline = baselines.pages.get(drawn.page)
    if (page === undefined || raw === undefined || baseline === undefined) {
      return refuse(`Error: The page ${drawn.page} could not be read back from the config.`)
    }
    const projected = projectPageForExport(app, page)
    const plan: PageMergePlan = planPageMerge({
      ...scale,
      page: raw,
      tree: projected.tree.nodes,
      nodeMap: projected.map,
      drawn,
      baseline,
    })
    return { name: drawn.page, drawing: drawn.drawing, plan }
  })
  return [...declared, ...(await mergeNewPages(selected.created, rawPages, scale))]
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
  merged: readonly MergedPage[],
  plans: {
    readonly literal: Awaited<ReturnType<typeof planTypeScriptLiterals>> | undefined
    readonly tokens: Awaited<ReturnType<typeof readCanvasTokens>> | undefined
  }
): Promise<NonNullable<PageImportReport['written']>> =>
  plans.literal === undefined
    ? writeMergedPages(target.configPath, target.source, target.loaded, {
        merged,
        ...(plans.tokens === undefined ? {} : { colours: plans.tokens.writes }),
      })
    : writeLiterals(target.configPath, target.loaded, plans.literal.edits)

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
  const selected = selectDrawings(await readDrawings(located, app), app, {
    names: request.pages,
    newPages: request.newPages,
  })
  const { pages: drawings } = selected
  const baselines = await baselinesOf(
    app,
    configPath,
    located.format,
    drawings.map((drawing) => drawing.page)
  )
  const mergedPages = await mergeAll(
    app,
    { parsed: loaded.parsed, configPath },
    { drawings, created: selected.created },
    baselines
  )
  // A TypeScript config is rewritten literal by literal, unless --sidecar asks for sidecars.
  const literal =
    rootFormatOf(configPath) === 'typescript' && !request.sidecar
      ? await planTypeScriptLiterals(configPath, loaded.parsed, mergedPages)
      : undefined
  const merged = literal?.merged ?? mergedPages
  const tokens = request.tokens
    ? await readCanvasTokens(located, baselines.tokens, { configPath, write: request.write })
    : undefined
  const written = request.write
    ? await writeOutcome({ configPath, source: located.path, loaded }, merged, {
        literal,
        tokens,
      })
    : undefined
  const report = reportOf(located, { merged, skipped: selected.skipped }, { tokens, written })
  process.stdout.write(
    request.json
      ? `${JSON.stringify(report, undefined, 2)}\n`
      : renderPagesReport(report, merged, !request.write)
  )
}
