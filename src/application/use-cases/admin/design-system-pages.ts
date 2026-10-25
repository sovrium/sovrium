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

import { Deferred, Effect, Exit, type Schema } from 'effect'
import { CSSCompiler } from '@/application/ports/services/css-compiler'
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
import { canvasBoardFilesOf } from '@/domain/models/app/design/adapters/pages/claude-design-canvas-export'
import { figmaPagePathOf } from '@/domain/models/app/design/adapters/pages/figma-pages-export'
import { PENPOT_DIR } from '@/domain/models/app/design/adapters/pages/penpot-pages-format'
import { PAGE_ROUND_TRIP_TABLES } from '@/domain/models/app/pages/page-round-trip-guide-service'
import { collectBrandFonts, withBrandFaces } from './design-system-brand-fonts'
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
import { kitDocument, kitStylesheetOf } from './design-system-kit-document'
import { seedAsAccountOf } from './design-system-page-account-seed'
import { prototypeStoreOf, unsimulatedNoticesOf } from './design-system-page-app'
import { pageSectionOf, type PageDrawOptions } from './design-system-page-boards'
import { canvasEntriesOf, drawnWithOf } from './design-system-page-canvas'
import {
  drawPagesOf,
  type DesignSystemPageDrawError,
  type PageDrawing,
} from './design-system-page-draw'
import { figmaPageDocumentsOf } from './design-system-page-figma'
import {
  collectPageImages,
  pageImageEntries,
  penpotImageEntries,
  withImagesAt,
  type PageImages,
} from './design-system-page-images'
import { penpotEntryOf } from './design-system-page-penpot'
import { seedRowCapNoticesOf } from './design-system-page-seed'
import { appRolesOf } from './design-system-page-states'
import type { ProjectedPage } from './design-system-page-projection'
import type { DesignKitAssets } from '@/application/ports/services/design-kit-assets'
import type { PageRenderer } from '@/application/ports/services/page-renderer'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'

/** Which pages to export, where a TypeScript config's sidecars go, and how they are drawn. */
export interface PageExportSelection {
  /** The page names to export, in any order; every page when absent. */
  readonly names?: readonly string[] | undefined
  /** A TypeScript config's sidecar entries, one per exported page; none for YAML or JSON. */
  readonly sidecars?: PageSidecarsManifest['pages'] | undefined
  /** The seed folder, the clock and the boards to draw beyond the defaults. */
  readonly draw?: PageDrawOptions | undefined
}

export { DesignSystemPageDrawError, pageDrawRefusal, redirectOf } from './design-system-page-draw'

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

/** A drawing as its static document, its images pointed at their copies beside it. */
const drawingEntryOf = (
  drawing: { readonly page: string; readonly title: string; readonly body: string },
  images: PageImages
): DesignSystemBundleEntry =>
  textEntry(
    `pages/${drawing.page}.page.html`,
    'page',
    kitDocument(
      drawing.title,
      `<main>\n${withImagesAt(drawing.body, images, 'assets/')}\n</main>`,
      'pages.css'
    )
  )

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

/** A TypeScript config's sidecar manifest; none for YAML or JSON. */
const sidecarEntriesOf = (selection: PageExportSelection): readonly DesignSystemBundleEntry[] =>
  selection.sidecars === undefined
    ? []
    : [
        textEntry(
          'pages/page-sidecars.json',
          'page',
          serialise({
            format: PAGE_SIDECARS_FORMAT,
            version: 1,
            pages: selection.sidecars,
          } satisfies PageSidecarsManifest)
        ),
      ]

/** Each page's design tree and the node map, each held to its contract. */
const mapEntriesOf = (projected: readonly ProjectedPage[]) =>
  Effect.gen(function* () {
    const trees = yield* Effect.forEach(projected, (projection) =>
      validated(pageDesignTreeSchema, projection.tree)
    )
    const nodeMap = yield* validated(pageNodeMapSchema, {
      format: PAGE_NODE_MAP_FORMAT,
      version: 1 as const,
      pages: projected.map((projection) => projection.map),
      roundTrip: PAGE_ROUND_TRIP_TABLES,
    })
    return [
      ...trees.map((tree) => textEntry(`pages/${tree.page}.tree.json`, 'page', serialise(tree))),
      textEntry('pages/node-map.json', 'page', serialise(nodeMap)),
    ]
  })

/**
 * Each page's projection, its node map entry listing every board it is drawn
 * on with the state each is drawn at.
 */
const withBoardsOf = (drawings: readonly PageDrawing[]): readonly ProjectedPage[] => {
  const files = canvasBoardFilesOf(
    drawings.map((drawing) => ({
      page: drawing.page,
      states: drawing.boards.map((board) => board.plan.label),
    }))
  )
  return drawings.map((drawing, at) => ({
    ...drawing.projected,
    map: {
      ...drawing.projected.map,
      boards: drawing.boards.map((board, index) => ({
        file: files[at]?.[index] ?? '',
        state: board.plan.state,
      })),
    },
  }))
}

/** Each drawn page as the canvas draws it: its boards, its section, what each plays. */
const canvasPagesOf = (app: App, drawings: readonly PageDrawing[], images: PageImages) =>
  drawings.map((drawing) => ({
    projected: drawing.projected,
    body: withImagesAt(drawing.body, images, '../assets/'),
    title: drawing.boards[0]?.plan.title,
    section: pageSectionOf(app, drawing.page),
    drawnIds: drawing.boards[0]?.drawnIds,
    prototype: drawing.boards[0]?.prototype,
    record: drawing.boards[0]?.plan.state['record'],
    boards: drawing.boards.slice(1).map((board) => ({
      state: board.plan.label ?? '',
      title: board.plan.title,
      body: withImagesAt(board.body, images, '../assets/'),
      width: board.plan.width,
      theme: board.plan.theme,
      drawnIds: board.drawnIds,
      prototype: board.prototype,
    })),
  }))

/** The Prototype board's views and store, on a stateful prototype (`--prototype=app`). */
const appCanvasOf = (
  app: App,
  drawings: readonly PageDrawing[],
  selection: PageExportSelection,
  images: PageImages
) => {
  if (selection.draw?.prototype !== 'app') return undefined
  const pages = selectedPages(app, selection.names)
  return {
    views: drawings.flatMap((drawing) =>
      drawing.appView === undefined
        ? []
        : [{ ...drawing.appView, body: withImagesAt(drawing.appView.body, images, '../assets/') }]
    ),
    // Drawn as a seeded account (`--as`), the store holds that account's view and plays its role only.
    store: prototypeStoreOf(
      app,
      pages.filter((page) => drawings.some((drawing) => drawing.page === page.name)),
      { ...selection.draw, seed: seedAsAccountOf(app, selection.draw.seed, selection.draw.as) }
    ),
    roles: selection.draw.as === undefined ? appRolesOf(app) : [selection.draw.as.role],
  }
}

/**
 * The `pages/` files of one app (drawings, trees, the node map, the stylesheet,
 * the sidecars) and the Claude Design canvas drawn from them.
 */
const pageEntriesOf = (app: App, bundle: DesignSystemBundle, selection: PageExportSelection) =>
  Effect.gen(function* () {
    const { pageApp, drawings, notices } = yield* drawPagesOf(
      app,
      selectedPages(app, selection.names),
      selection.draw
    )
    const projected = drawings.map((drawing) => drawing.projected)
    const maps = yield* mapEntriesOf(withBoardsOf(drawings))
    const figma = yield* figmaEntriesOf(app, bundle, projected)
    const { css } = yield* (yield* CSSCompiler).compile(pageApp)
    const stylesheet = withBrandFaces(kitStylesheetOf(css), yield* collectBrandFonts(app))
    const images = yield* collectPageImages(drawings)
    const canvas = yield* canvasEntriesOf(app, bundle, canvasPagesOf(app, drawings, images), {
      stylesheet,
      assets: pageImageEntries(images),
      prototype: selection.draw?.prototype !== undefined,
      app: appCanvasOf(app, drawings, selection, images),
      recordTexts: selection.draw !== undefined,
      drawnWith: drawnWithOf(selection.draw),
    })
    const entries = [
      ...drawings.map((drawing) => drawingEntryOf(drawing, images)),
      ...pageImageEntries(images),
      ...maps,
      textEntry(PAGES_STYLESHEET, 'page', stylesheet),
      ...figma,
      ...sidecarEntriesOf(selection),
      ...canvas.files,
      penpotEntryOf(app, projected, penpotImageEntries(images)),
    ] satisfies readonly DesignSystemBundleEntry[]
    const unsimulated =
      selection.draw?.prototype === 'app'
        ? unsimulatedNoticesOf(app, selectedPages(app, selection.names))
        : []
    const capped = seedRowCapNoticesOf(selection.draw?.seed)
    return {
      entries,
      notices: [...notices, ...images.notices, ...canvas.notices, ...unsimulated, ...capped],
    }
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
  added: {
    readonly entries: readonly DesignSystemBundleEntry[]
    readonly notices: readonly string[]
  }
): DesignSystemBundle => {
  const files = [...bundle.files, ...added.entries].toSorted((left, right) =>
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0
  )
  const manifest = withPenpotAdapter(manifestOf(app, files), files)
  const notices = [...bundle.notices, ...added.notices]
  return { manifest, manifestBytes: encoder.encode(serialise(manifest)), files, notices }
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
  (selection.names === undefined && selection.sidecars === undefined && selection.draw === undefined
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
