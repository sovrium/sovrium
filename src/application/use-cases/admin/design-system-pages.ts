/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The bundle WITH the app's pages ([internal ref] A13): the bundle of
 * `design-system-bundle.ts`, plus a `pages/` tree a design tool opens.
 *
 * Per page, `pages/<name>.page.html` is the page as Sovrium's own renderer
 * draws it, every tree node stamped with its `data-sovrium-id`, and
 * `pages/<name>.tree.json` is its design tree; once, `pages/node-map.json` is
 * everything a design tool must never hold, and `pages/pages.css` the
 * stylesheet the drawings are painted with. A TypeScript config also gets
 * `pages/page-sidecars.json`, naming where each page's sidecar goes. The same
 * drawings are handed to the design tools' page adapters: the Claude Design
 * canvas under `adapters/claude-design/canvas/`, the Figma page documents, and
 * the Penpot file `adapters/penpot/<app>.penpot`.
 *
 * ─── IT ONLY ADDS ──────────────────────────────────────────────────────────
 *
 * The pages are added to the very bundle every other surface hands over, and
 * nothing else in it changes: every file but the manifest is the same bytes
 * with or without the pages. The kit keeps its own stylesheet; the pages get
 * theirs, compiled from the pages they draw.
 *
 * ─── DRAWN FROM CONFIG, NEVER FROM AN INSTANCE ─────────────────────────────
 *
 * Each page is drawn as a design-system specimen: every reader answers a sample
 * synthesised from config, none reaches the database, and a bound table is
 * drawn from the synthetic seed (`design-system-page-projection.ts`). Two
 * exports of one config are byte-identical.
 */

import { Data, Deferred, Effect, Exit, type Schema } from 'effect'
import { CSSCompiler } from '@/application/ports/services/css-compiler'
import { PageRenderer } from '@/application/ports/services/page-renderer'
import { figmaPageDocumentSchema } from '@/domain/models/api/admin/design-system/adapter-figma-pages'
import { pageDesignTreeSchema } from '@/domain/models/api/admin/design-system/page-design-tree'
import {
  PAGE_NODE_MAP_FORMAT,
  pageNodeMapSchema,
} from '@/domain/models/api/admin/design-system/page-node-map'
import {
  PAGE_SIDECARS_FORMAT,
  type PageSidecarsManifest,
} from '@/domain/models/api/admin/design-system/page-sidecars-manifest'
import { decodeSafe } from '@/domain/models/api/combinators/decode'
import { figmaPagePathOf } from '@/domain/models/app/design/adapters/pages/figma-pages-export'
import { PENPOT_DIR } from '@/domain/models/app/design/adapters/pages/penpot-pages-format'
import { resolveExportStamps } from '@/domain/models/app/pages/export-node-stamp-service'
import {
  buildDesignSystemBundle,
  DesignSystemBundleError,
  manifestOf,
  serialise,
  textEntry,
  type DesignSystemBundle,
  type DesignSystemBundleEntry,
  type DesignSystemBundleFailure,
} from './design-system-bundle'
import { kitPageAppOf } from './design-system-kit'
import { kitDocument, kitStylesheetOf, renderedSpecimenOf } from './design-system-kit-document'
import { canvasEntriesOf } from './design-system-page-canvas'
import { figmaPageDocumentsOf } from './design-system-page-figma'
import { penpotEntryOf } from './design-system-page-penpot'
import { projectPageForExport, type ProjectedPage } from './design-system-page-projection'
import { sampleRouteValuesOf } from './design-system-page-seed'
import type { DesignKitAssets } from '@/application/ports/services/design-kit-assets'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'

/** Which pages to export, and where a TypeScript config's sidecars go. */
export interface PageExportSelection {
  /** The page names to export, in any order; every page when absent. */
  readonly names?: readonly string[] | undefined
  /** A TypeScript config's sidecar entries, one per exported page; none for YAML or JSON. */
  readonly sidecars?: PageSidecarsManifest['pages'] | undefined
}

/** A page the renderer could not draw offline; nothing is handed over. */
export class DesignSystemPageDrawError extends Data.TaggedError('DesignSystemPageDrawError')<{
  readonly page: string
  readonly cause: unknown
}> {}

/**
 * The failure of a page the renderer answered with something other than a
 * document: no page at all, a redirect, a refusal. The cause always says
 * which, and at what address, so a refused export names its reason.
 */
export const pageDrawRefusal = (page: string, path: string, answer: unknown) =>
  new DesignSystemPageDrawError({
    page,
    cause:
      answer === undefined || answer === null
        ? { reason: `the renderer answered no page at ${path}`, path }
        : { reason: `the renderer answered ${path} with no document`, path, answer },
  })

/** Every failure building the bundle with its pages can surface. */
export type DesignSystemPagesFailure = DesignSystemBundleFailure | DesignSystemPageDrawError

const PAGES_STYLESHEET = 'pages/pages.css'

/** The adapter the Penpot file is listed under in the manifest. */
const PENPOT_ADAPTER_NAME = 'penpot'

/** The names among `names` that no page of the app carries, in the order given. */
export const undeclaredPageNames = (app: App, names: readonly string[]): readonly string[] =>
  names.filter((name) => !(app.pages ?? []).some((page) => page.name === name))

/** The pages to export, in config order. */
const selectedPages = (app: App, names: readonly string[] | undefined): readonly Page[] =>
  (app.pages ?? []).filter((page) => names === undefined || names.includes(page.name))

/**
 * The sample address a page is drawn at, each route parameter at its sample
 * value ({@link sampleRouteValuesOf}): a parameter the page binds a table to
 * names a declared table. The renderer draws a specimen at the address it is
 * handed without asking whether a visitor could reach it, so a routed page
 * whose app declares no table (or whose `params` allow-list is read from an
 * instance) is still drawn.
 */
const drawPathOf = (app: App, page: Page): string => {
  const values = sampleRouteValuesOf(app, page)
  return page.path.replaceAll(/:([A-Za-z_]\w*)/g, (_segment, name: string) => values[name] ?? '1')
}

/**
 * The sample query a page is drawn with: an invitation page reads its token
 * from the address, so it is handed the sample one, and draws the invitation
 * the specimen readers answer (its accept form included) rather than a dead link.
 */
const drawQueryOf = (page: Page): Readonly<Record<string, string>> => {
  const { invitation } = page as { readonly invitation?: { readonly param?: string } }
  return invitation === undefined ? {} : { [invitation.param ?? 'token']: 'specimen' }
}

/** Draw one projected page as a static document linking the pages stylesheet. */
const drawPage = (pageApp: App, page: Page, projected: ProjectedPage) =>
  Effect.gen(function* () {
    const renderer = yield* PageRenderer
    const path = drawPathOf(pageApp, page)
    const requestQuery = drawQueryOf(page)
    const rendered = yield* Effect.tryPromise({
      try: async () => renderer.renderPage(pageApp, path, { specimen: true, requestQuery }),
      catch: (cause) => new DesignSystemPageDrawError({ page: page.name, cause }),
    })
    if (typeof rendered !== 'string') return yield* pageDrawRefusal(page.name, path, rendered)
    const title = `${page.name} — ${pageApp.name} pages`
    const body = resolveExportStamps(renderedSpecimenOf(rendered))
    const entry = textEntry(
      `pages/${projected.tree.page}.page.html`,
      'page',
      kitDocument(title, `<main>\n${body}\n</main>`, 'pages.css')
    )
    return { entry, body }
  })

/** A projection that fails its own contract hands nothing over. */
const validated = <S extends Schema.Top, A>(schema: S, value: A) => {
  const decoded = decodeSafe(schema)(value)
  return decoded.success
    ? Effect.succeed(value)
    : Effect.fail(new DesignSystemBundleError({ cause: decoded.error }))
}

/** The Figma page documents of the projected pages, each held to its contract. */
const figmaEntriesOf = (
  app: App,
  bundle: DesignSystemBundle,
  projected: readonly ProjectedPage[]
) =>
  Effect.gen(function* () {
    const documents = yield* Effect.forEach(
      figmaPageDocumentsOf(app, bundle, projected),
      (document) => validated(figmaPageDocumentSchema, document)
    )
    return documents.map((document) =>
      textEntry(figmaPagePathOf(document.page), 'adapter', serialise(document))
    )
  })

/**
 * The `pages/` files of one app (drawings, trees, the node map, the stylesheet,
 * the sidecars) and the Claude Design canvas drawn from them.
 */
const pageEntriesOf = (app: App, bundle: DesignSystemBundle, selection: PageExportSelection) =>
  Effect.gen(function* () {
    const pages = selectedPages(app, selection.names)
    const projected = pages.map((page) => projectPageForExport(app, page))
    const pageApp = kitPageAppOf(
      app,
      projected.map((projection) => projection.drawn)
    )
    const drawings = yield* Effect.forEach(
      pages,
      (page, index) => drawPage(pageApp, page, projected[index] as ProjectedPage),
      { concurrency: 4 }
    )
    const trees = yield* Effect.forEach(projected, (projection) =>
      validated(pageDesignTreeSchema, projection.tree)
    )
    const nodeMap = yield* validated(pageNodeMapSchema, {
      format: PAGE_NODE_MAP_FORMAT,
      version: 1 as const,
      pages: projected.map((projection) => projection.map),
    })
    const figma = yield* figmaEntriesOf(app, bundle, projected)
    const { css } = yield* (yield* CSSCompiler).compile(pageApp)
    const stylesheet = kitStylesheetOf(css)
    const sidecars: PageSidecarsManifest | undefined =
      selection.sidecars === undefined
        ? undefined
        : { format: PAGE_SIDECARS_FORMAT, version: 1, pages: selection.sidecars }
    const canvas = canvasEntriesOf(
      app,
      bundle,
      drawings.map((drawing, index) => ({
        projected: projected[index] as ProjectedPage,
        body: drawing.body,
      })),
      stylesheet
    )
    return [
      ...drawings.map((drawing) => drawing.entry),
      ...trees.map((tree) => textEntry(`pages/${tree.page}.tree.json`, 'page', serialise(tree))),
      textEntry('pages/node-map.json', 'page', serialise(nodeMap)),
      textEntry(PAGES_STYLESHEET, 'page', stylesheet),
      ...figma,
      ...(sidecars === undefined
        ? []
        : [textEntry('pages/page-sidecars.json', 'page', serialise(sidecars))]),
      ...canvas,
      penpotEntryOf(app, projected),
    ] satisfies readonly DesignSystemBundleEntry[]
  })

const encoder = new TextEncoder()

/** The manifest's adapter list, naming `penpot` once the pages drew a Penpot file. */
const withPenpotAdapter = (
  manifest: DesignSystemBundle['manifest'],
  files: readonly DesignSystemBundleEntry[]
): DesignSystemBundle['manifest'] =>
  files.some((file) => file.path.startsWith(`${PENPOT_DIR}/`))
    ? { ...manifest, adapters: [...manifest.adapters, PENPOT_ADAPTER_NAME].toSorted() }
    : manifest

/** The bundle with more files: every file sorted by path again, and a new manifest. */
const withEntries = (
  app: App,
  bundle: DesignSystemBundle,
  entries: readonly DesignSystemBundleEntry[]
): DesignSystemBundle => {
  const files = [...bundle.files, ...entries].toSorted((left, right) =>
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0
  )
  const manifest = withPenpotAdapter(manifestOf(app, files), files)
  return { manifest, manifestBytes: encoder.encode(serialise(manifest)), files }
}

/** Every page's bundle, built once per config object, as the bundle itself is. */
const allPagesMemo = new WeakMap<
  App,
  Deferred.Deferred<DesignSystemBundle, DesignSystemPagesFailure>
>()

const assemble = (app: App, selection: PageExportSelection) =>
  Effect.gen(function* () {
    const bundle = yield* buildDesignSystemBundle(app)
    return withEntries(app, bundle, yield* pageEntriesOf(app, bundle, selection))
  })

/** Every page, memoised per config object; a failed build is forgotten. */
const memoisedAllPages = (app: App) =>
  Effect.suspend(() => {
    const inFlight = allPagesMemo.get(app)
    if (inFlight !== undefined) return Deferred.await(inFlight)
    const build = Deferred.makeUnsafe<DesignSystemBundle, DesignSystemPagesFailure>()
    // eslint-disable-next-line functional/no-expression-statements -- the memo IS the mutation
    allPagesMemo.set(app, build)
    return assemble(app, {}).pipe(
      Effect.onExit((exit) =>
        Effect.andThen(
          Exit.isSuccess(exit)
            ? Effect.void
            : Effect.sync(() => {
                // eslint-disable-next-line functional/no-expression-statements -- forget a failed build
                allPagesMemo.delete(app)
              }),
          Deferred.done(build, exit)
        )
      )
    )
  })

/**
 * The bundle of one app with its pages — every page, or the ones `selection`
 * names, and the sidecar manifest when the caller hands its entries.
 */
export const buildDesignSystemBundleWithPages = (
  app: App,
  selection: PageExportSelection = {}
): Effect.Effect<
  DesignSystemBundle,
  DesignSystemPagesFailure,
  PageRenderer | CSSCompiler | DesignKitAssets
> =>
  (selection.names === undefined && selection.sidecars === undefined
    ? memoisedAllPages(app)
    : assemble(app, selection)
  ).pipe(Effect.withSpan('design-system.bundle-pages'))

/** The sentence naming the pages a config declares, for a refusal. */
export const declaredPagesSentence = (app: App): string => {
  const names = (app.pages ?? []).map((page) => page.name)
  return names.length === 0
    ? 'This config declares no page.'
    : `The pages this config declares: ${names.join(', ')}.`
}
