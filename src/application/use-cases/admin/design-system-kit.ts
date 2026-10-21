/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The rendered component kit of the portable design-system bundle: one static
 * page per catalogued type, drawing each of its variants in light and in dark
 * with the app's own theme, plus the gallery and the kit's manifest.
 *
 * ─── THE REAL RENDERER, OVER THE CATALOGUE'S OWN SPECIMENS ─────────────────
 *
 * Each page is the catalogue specimen the console draws (`catalog-specimens/`),
 * rendered by the same page renderer an ordinary page of the app goes through,
 * under a specimen app that carries the operator's `design` and nothing else.
 * Like the console's component frame (`design-system-component-frame.ts`) the
 * app is assembled FIELD BY FIELD: `tables`, `env`, `auth` and the operator's
 * pages stay behind, so the kit holds no record and no secret by construction,
 * and a data-bound specimen draws its empty state.
 *
 * A page keeps only the specimen — what the rendered page's `<main>` holds —
 * so the page chrome (the skip link, the new-tab notice) never reaches a
 * component card, and its sample media point at the bundle's `assets/`.
 *
 * ─── THE GUIDANCE IS THE MANUAL'S ──────────────────────────────────────────
 *
 * Each entry's dos and don'ts are sentences of the component manual the binary
 * ships, lifted whole (`kit-guidance-service.ts`); a type the manual states no
 * rule for has empty guidance rather than a generic one.
 *
 * ─── EVERY CATALOGUED TYPE IS LISTED, AND SOME ARE NOT DRAWN ───────────────
 *
 * A type the catalogue refuses to draw — a live write control, a type that
 * needs records of the operator's — is listed with the catalogue's own sentence
 * and gets no page. So is a type whose page could not be rendered offline,
 * with a sentence naming it, rather than being dropped from the list.
 */

import { Data, Effect } from 'effect'
import { CSSCompiler } from '@/application/ports/services/css-compiler'
import { DesignKitAssets } from '@/application/ports/services/design-kit-assets'
import { PageRenderer } from '@/application/ports/services/page-renderer'
import { projectCatalogue } from '@/application/use-cases/admin/design-system-catalogue-export'
import {
  OPEN_OVERLAY_SPECIMEN_BY_TYPE,
  SPECIMEN_BY_TYPE,
  catalogSpecimenInAxes,
} from '@/domain/models/app/design/catalog-specimens'
import {
  kitGuidanceFromManual,
  NO_KIT_GUIDANCE,
  type KitTypeGuidance,
} from '@/domain/models/app/design/kit-guidance-service'
import { introspectType } from '@/domain/models/app/design/type-introspection'
import {
  CATALOG_CATEGORY_TITLES,
  purposeOfComponentType,
} from '@/domain/models/app/pages/components/component-types/catalog'
import { SPECIMEN_INSTANT } from '@/domain/models/app/pages/specimen-sample-service'
import {
  escapeHtml,
  kitDocument,
  kitStylesheetOf,
  renderedSpecimenOf,
  sampleMediaNamesOf,
  slotsOf,
  withSampleMediaAt,
} from './design-system-kit-document'
import type { CSSCompilationError } from '@/application/ports/services/css-compiler'
import type { DesignKitAssetReadError } from '@/application/ports/services/design-kit-assets'
import type {
  ComponentKitEntry,
  ComponentKitManifest,
} from '@/domain/models/api/admin/design-system'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'
import type { CatalogComponentCategory } from '@/domain/models/app/pages/components/component-types/catalog'

/** One text file of the kit, by its bundle-relative path. */
export interface KitFile {
  readonly path: string
  readonly text: string
}

/**
 * The kit: its manifest, every file it writes under `components/`, and the
 * pieces a provider adapter reuses — each drawn type's rendered markup and the
 * one stylesheet that markup is drawn with.
 */
export interface DesignSystemKit {
  readonly manifest: ComponentKitManifest
  readonly files: ReadonlyArray<KitFile>
  /**
   * The specimen each drawn type's page draws, by type: the component alone,
   * with its sample media still at the server's `/assets/design-system/` route
   * for the caller to point at its own copies (`withSampleMediaAt`).
   */
  readonly previews: Readonly<Record<string, string>>
  /** The text of `components/kit.css`. */
  readonly stylesheet: string
  /** The sample media files the specimens draw, by basename. */
  readonly sampleMedia: readonly string[]
}

/** Where the bundle keeps the sample media, relative to `components/`. */
const KIT_SAMPLE_MEDIA_DIRECTORY = '../assets/'

const KIT_INDEX = 'components/index.html'
const KIT_STYLESHEET = 'components/kit.css'
const KIT_MANIFEST = 'components/manifest.json'

/** One catalogued type with what the kit needs to decide whether to draw it. */
interface KitCandidate {
  readonly type: string
  readonly category: CatalogComponentCategory
  readonly variants: readonly string[]
  /** The catalogue's reason for not drawing it, when it has one. */
  readonly refusal: string | undefined
  /** One drawn cell per variant (or one plain cell), when the type draws. */
  readonly cells: ReadonlyArray<{ readonly label: string; readonly component: Component }>
}

const candidateOf = (entry: ReturnType<typeof projectCatalogue>[number]): KitCandidate => {
  const variants = entry.variants ?? []
  const base = SPECIMEN_BY_TYPE.get(entry.type)?.component
  const introspection = introspectType(entry.type)
  // An overlay the console refuses live (it would cover the page) is drawn OPEN in its frame.
  const open = OPEN_OVERLAY_SPECIMEN_BY_TYPE.get(entry.type)
  const cells =
    open !== undefined
      ? [{ label: 'open', component: open }]
      : base === undefined || entry.excludedReason !== undefined
        ? []
        : variants.length === 0
          ? [{ label: 'default', component: base }]
          : variants.map((variant) => ({
              label: variant,
              component: catalogSpecimenInAxes(entry.type, { variant }, introspection) ?? base,
            }))
  return {
    type: entry.type,
    category: entry.category as CatalogComponentCategory,
    variants,
    refusal:
      open !== undefined
        ? undefined
        : (entry.excludedReason ??
          (cells.length === 0 ? `${entry.type} has no specimen the kit can draw.` : undefined)),
    cells,
  }
}

/** One specimen the renderer could not draw offline. */
class KitPageRenderError extends Data.TaggedError('KitPageRenderError')<{
  readonly type: string
  readonly cause: unknown
}> {}

/** The path a type's kit page is rendered at, inside the specimen app. */
const kitRoute = (type: string): string => `/design-system-kit/${type}`

const label = (text: string, element: 'h2' | 'p', className: string): unknown => ({
  type: 'text',
  element,
  props: { className },
  content: text,
})

/** One colour mode of a type's page: a heading, then every variant labelled. */
const modeSection = (candidate: KitCandidate, mode: 'light' | 'dark'): unknown => ({
  type: 'container',
  props: {
    className: `${mode === 'dark' ? 'dark ' : ''}bg-background text-foreground flex flex-col gap-6 p-6`,
  },
  children: [
    label(`${candidate.type} — ${mode}`, 'h2', 'text-lg font-semibold'),
    ...candidate.cells.map((cell) => ({
      type: 'container',
      props: { className: 'flex flex-col gap-2' },
      children: [label(cell.label, 'p', 'text-xs text-muted-foreground'), cell.component],
    })),
  ],
})

const kitPage = (candidate: KitCandidate): Page =>
  ({
    id: `design-system-kit-${candidate.type}`,
    name: `design-system-kit-${candidate.type}`,
    path: kitRoute(candidate.type),
    meta: { title: candidate.type, lang: 'en-US', robots: 'noindex, nofollow' },
    components: [modeSection(candidate, 'light'), modeSection(candidate, 'dark')],
  }) as Page

/**
 * The specimen app: the operator's name and `design`, the kit pages, and
 * nothing else — see the module docblock.
 */
const kitAppOf = (app: App, pages: readonly Page[]): App =>
  ({
    name: app.name,
    ...(app.design === undefined ? {} : { design: app.design }),
    badge: false,
    palette: { enabled: false },
    pages,
  }) as App

/**
 * The app a page export draws its pages in: the specimen app above, plus the
 * four keys a page cannot be drawn without — its `languages` (the `$t:` copy),
 * its `components` (the templates a page places), its `tables` (the field
 * definitions the synthetic seed is made from) and its `auth` (the roles and
 * groups a page's `access` rule and a node's `visibility` are judged against,
 * and the sign-in methods a sign-in page draws). `auth` is configuration, never
 * a session: the renderer draws a specimen as the synthetic sample admin, so a
 * page closed to admins is drawn as an admin meets it. Still no `env` and no
 * other page: an export draws the pages it was asked for, from config alone.
 */
export const kitPageAppOf = (app: App, pages: readonly Page[]): App =>
  ({
    ...kitAppOf(app, pages),
    ...(app.languages === undefined ? {} : { languages: app.languages }),
    ...(app.components === undefined ? {} : { components: app.components }),
    ...(app.tables === undefined ? {} : { tables: app.tables }),
    ...(app.auth === undefined ? {} : { auth: app.auth }),
  }) as App

/** Render one type's page, or `undefined` when the renderer could not draw it. */
const renderKitPage = (kitApp: App, type: string) =>
  Effect.gen(function* () {
    const renderer = yield* PageRenderer
    // A specimen the renderer cannot draw offline is listed without a page
    // (see `entryOf`), never a failure of the whole kit.
    const rendered = yield* Effect.tryPromise({
      try: async () => renderer.renderPage(kitApp, kitRoute(type), { drawnAt: SPECIMEN_INSTANT }),
      catch: (cause) => new KitPageRenderError({ type, cause }),
    }).pipe(
      Effect.tapCause((cause) =>
        Effect.logWarning(`[design-system] the kit could not draw ${type}`, cause)
      ),
      // Swallowed on purpose: one undrawable specimen must not cost the whole
      // bundle; `entryOf` lists the type with a reason instead of a page.
      Effect.orElseSucceed(() => undefined)
    )
    return typeof rendered === 'string' ? renderedSpecimenOf(rendered) : undefined
  })

const entryOf = (
  candidate: KitCandidate,
  body: string | undefined,
  guidance: KitTypeGuidance
): ComponentKitEntry => {
  const common = {
    type: candidate.type,
    category: candidate.category,
    purpose: purposeOfComponentType(candidate.type) ?? '',
    slots: body === undefined ? [] : slotsOf(body),
    variants: [...candidate.variants],
    guidance: {
      ...(guidance.usage === undefined ? {} : { usage: guidance.usage }),
      do: [...guidance.do],
      dont: [...guidance.dont],
    },
  }
  if (body !== undefined) {
    return { ...common, renders: true, page: `components/${candidate.type}.html` }
  }
  return {
    ...common,
    renders: false,
    reason:
      candidate.refusal ??
      `The kit could not draw ${candidate.type} offline, so it is listed without a page.`,
  }
}

/** The gallery: every drawn type linked, every undrawn one named with its reason. */
const galleryOf = (appName: string, entries: readonly ComponentKitEntry[]): string => {
  const categories = [...new Set(entries.map((entry) => entry.category))]
  const sections = categories.flatMap((category) => [
    `<h2>${escapeHtml(CATALOG_CATEGORY_TITLES[category as CatalogComponentCategory] ?? category)}</h2>`,
    '<ul>',
    ...entries
      .filter((entry) => entry.category === category)
      .map((entry) =>
        entry.renders
          ? `<li><a href="${entry.type}.html">${escapeHtml(entry.type)}</a> — ${escapeHtml(entry.purpose)}</li>`
          : `<li>${escapeHtml(entry.type)} — not drawn: ${escapeHtml(entry.reason)}</li>`
      ),
    '</ul>',
  ])
  return kitDocument(
    `${appName} component kit`,
    [
      `<main class="flex flex-col gap-4 p-6"><h1>${escapeHtml(appName)} component kit</h1>`,
      ...sections,
      '</main>',
    ].join('\n')
  )
}

/** The rendered body of every type the renderer drew, by type. */
const drawnBodies = (
  bodies: ReadonlyMap<string, string | undefined>
): Readonly<Record<string, string>> =>
  Object.fromEntries(
    [...bodies].flatMap(([type, body]) => (body === undefined ? [] : [[type, body]]))
  )

/** Each drawn type's static page, its specimen pointed at the bundle's sample media. */
const kitPagesOf = (
  appName: string,
  entries: readonly ComponentKitEntry[],
  bodies: ReadonlyMap<string, string | undefined>
): readonly KitFile[] =>
  entries.flatMap((entry) => {
    const body = bodies.get(entry.type)
    return entry.renders && body !== undefined
      ? [
          {
            path: entry.page,
            text: kitDocument(
              `${entry.type} — ${appName} component kit`,
              `<main>\n${withSampleMediaAt(body, KIT_SAMPLE_MEDIA_DIRECTORY)}\n</main>`
            ),
          },
        ]
      : []
  })

/** Draw every drawable candidate's page, by type; an undrawable one maps to `undefined`. */
const drawCandidates = (kitApp: App, drawable: readonly KitCandidate[]) =>
  Effect.map(
    Effect.forEach(
      drawable,
      (candidate) =>
        Effect.map(
          renderKitPage(kitApp, candidate.type),
          (body) => [candidate.type, body] as const
        ),
      { concurrency: 8 }
    ),
    (pairs) => new Map(pairs)
  )

/**
 * Build the component kit for one app.
 *
 * Requires the page renderer, the stylesheet compiler and the component
 * manual; reads no table, no env and no file of the operator's. Each type's
 * guidance is lifted from that manual (`kit-guidance-service.ts`).
 */
export const buildDesignSystemKit = (
  app: App
): Effect.Effect<
  DesignSystemKit,
  CSSCompilationError | DesignKitAssetReadError,
  PageRenderer | CSSCompiler | DesignKitAssets
> =>
  Effect.gen(function* () {
    const candidates = projectCatalogue().map(candidateOf)
    const drawable = candidates.filter((candidate) => candidate.refusal === undefined)
    const kitApp = kitAppOf(app, drawable.map(kitPage))
    const bodies = yield* drawCandidates(kitApp, drawable)
    const { css } = yield* (yield* CSSCompiler).compile(kitApp)
    const guidance = kitGuidanceFromManual(
      yield* (yield* DesignKitAssets).componentManual,
      new Set(candidates.map((candidate) => candidate.type))
    )
    const entries = candidates.map((candidate) =>
      entryOf(
        candidate,
        bodies.get(candidate.type),
        guidance.get(candidate.type) ?? NO_KIT_GUIDANCE
      )
    )
    const manifest: ComponentKitManifest = {
      index: KIT_INDEX,
      stylesheet: KIT_STYLESHEET,
      types: entries,
    }
    const stylesheet = kitStylesheetOf(css)
    return {
      manifest,
      previews: drawnBodies(bodies),
      stylesheet,
      sampleMedia: [
        ...new Set([...bodies.values()].flatMap((body) => sampleMediaNamesOf(body ?? ''))),
      ],
      files: [
        { path: KIT_MANIFEST, text: `${JSON.stringify(manifest, undefined, 2)}\n` },
        { path: KIT_STYLESHEET, text: stylesheet },
        { path: KIT_INDEX, text: galleryOf(app.name, entries) },
        ...kitPagesOf(app.name, entries, bodies),
      ],
    }
  }).pipe(Effect.withSpan('design-system.kit'))
