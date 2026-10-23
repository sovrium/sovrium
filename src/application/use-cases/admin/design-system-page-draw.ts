/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Drawing the exported pages ([internal ref] A13): each selected page rendered by
 * Sovrium's own renderer as a design-system specimen, at a sample address,
 * every tree node stamped with its `data-sovrium-id`.
 *
 * A page the renderer answers with a redirect is skipped and named; any other
 * answer that is not a document fails the export, naming the page.
 */

import { Data, Effect } from 'effect'
import { PageRenderer } from '@/application/ports/services/page-renderer'
import { RECORD_VIEW_ID } from '@/domain/models/app/design/adapters/pages/claude-design-canvas-app'
import { resolveExportStamps } from '@/domain/models/app/pages/export-node-stamp-service'
import { kitPageAppOf } from './design-system-kit'
import { renderedSpecimenOf } from './design-system-kit-document'
import { placeholderSeedOf, prototypeViewOf } from './design-system-page-app'
import { boardPlansOf, type PageBoardPlan, type PageDrawOptions } from './design-system-page-boards'
import { withRefusedForm } from './design-system-page-form-refusal'
import {
  drawnIdsOf,
  projectPageForExport,
  type ProjectedPage,
} from './design-system-page-projection'
import { boardPrototypeOf } from './design-system-page-prototype'
import type { SeedContext } from './design-system-page-seed'
import type { App } from '@/domain/models/app'
import type { BoardPrototype } from '@/domain/models/app/design/adapters/pages/claude-design-canvas-prototype'
import type { Page } from '@/domain/models/app/pages'

/** A page the renderer could not draw offline; nothing is handed over. */
export class DesignSystemPageDrawError extends Data.TaggedError('DesignSystemPageDrawError')<{
  readonly page: string
  readonly cause: unknown
}> {}

/** The address a renderer's answer redirects to, or `undefined` for any other answer. */
export const redirectOf = (answer: unknown): string | undefined => {
  const redirect = (answer as { readonly redirect?: unknown } | null | undefined)?.redirect
  return typeof redirect === 'string' ? redirect : undefined
}

/**
 * The failure of a page the renderer answered with neither a document nor a
 * redirect: no page at all, or a refusal. The cause always says
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

/**
 * The address a board is drawn at, each route parameter at its value on the
 * board: the sample value (`sampleRouteValuesOf`), where a parameter the page
 * binds a table to names a declared table, or the id of the seeded record the
 * board draws. The renderer draws a specimen at the address it is handed
 * without asking whether a visitor could reach it, so a routed page whose app
 * declares no table (or whose `params` allow-list is read from an instance) is
 * still drawn.
 */
const drawPathOf = (page: Page, values: Readonly<Record<string, string>>): string =>
  page.path.replaceAll(/:([A-Za-z_]\w*)/g, (_segment, name: string) => values[name] ?? '1')

/**
 * The sample query a page is drawn with: an invitation page reads its token
 * from the address, so it is handed the sample one, and draws the invitation
 * the specimen readers answer (its accept form included) rather than a dead link.
 */
const drawQueryOf = (page: Page): Readonly<Record<string, string>> => {
  const { invitation } = page as { readonly invitation?: { readonly param?: string } }
  return invitation === undefined ? {} : { [invitation.param ?? 'token']: 'specimen' }
}

/** One board of a page, drawn: its plan, its projection and the markup inside its `<main>`. */
export interface PageBoardDrawing {
  readonly plan: PageBoardPlan
  readonly projected: ProjectedPage
  readonly body: string
  /** The page's nodes the board draws: none when it draws the app's answer instead. */
  readonly drawnIds: ReadonlySet<string>
  /** What the board plays, on a clickable canvas. */
  readonly prototype?: BoardPrototype | undefined
}

/** An app whose pages hold `drawn` in place of the page of the same name, or beside them. */
const withPage = (pageApp: App, drawn: Page): App =>
  ({
    ...pageApp,
    pages: [...(pageApp.pages ?? []).filter((page) => page.name !== drawn.name), drawn],
  }) as App

/** The rows a board's renderer reads: the seed folder's, every table empty, or none of its own. */
const specimenSeedOf = (app: App, plan: PageBoardPlan, options: PageDrawOptions) => {
  const empty = plan.branches.data === 'empty'
  if (options.seed === undefined && plan.viewer === undefined && !empty) return {}
  const tables = empty
    ? Object.fromEntries((app.tables ?? []).map((table) => [table.name, []]))
    : (options.seed?.tables ?? {})
  return {
    specimenSeed: { tables, ...(plan.viewer === undefined ? {} : { viewer: plan.viewer }) },
  }
}

/** The address of the page a board draws in place of its own (`page=404`, `session=expired`). */
const answerPathOf = (page: Page, plan: PageBoardPlan): string | undefined => {
  if (plan.answer === 'not-found') return '/404'
  if (plan.answer === 'error') return '/500'
  if (plan.answer === 'sign-in') {
    const { access } = page as { readonly access?: { readonly redirectTo?: unknown } }
    return typeof access?.redirectTo === 'string' ? access.redirectTo : '/login'
  }
  return undefined
}

/**
 * What a board draws: its own page at its state, or — for an answer state —
 * the app's own page at that answer's address (its not-found, error or sign-in
 * page), else the renderer's.
 */
const renderTargetOf = (app: App, boardApp: App, page: Page, board: BoardToDraw) => {
  const answerPath = answerPathOf(page, board.plan)
  if (answerPath === undefined) {
    return { app: boardApp, path: drawPathOf(page, board.plan.routeValues), answer: false }
  }
  const target = (app.pages ?? []).find((candidate) => candidate.path === answerPath)
  return target === undefined
    ? { app: boardApp, path: answerPath, answer: true, missing: board.plan.answer }
    : {
        app: withPage(boardApp, projectPageForExport(app, target).drawn),
        path: target.path,
        answer: true,
      }
}

/** Render an answer the app holds no page for: the renderer's own not-found or error page. */
const renderAnswer = (renderer: PageRenderer['Service'], app: App, answer: string) =>
  answer === 'error' ? renderer.renderError(app) : renderer.renderNotFound(app)

/** One board to draw: its plan and its page projected at its state. */
interface BoardToDraw {
  readonly plan: PageBoardPlan
  readonly projected: ProjectedPage
}

/** Draw one board: the markup inside its `<main>`, every tree node stamped, or its redirect. */
/** What a board's grids are read against: the rows, the account and the address it is drawn at. */
const prototypeContextOf = (app: App, plan: PageBoardPlan, options: PageDrawOptions) => ({
  tables: (app.tables ?? []) as SeedContext['tables'],
  routeValues: plan.routeValues,
  seed: options.seed,
  viewer: plan.viewer,
  empty: plan.branches.data === 'empty',
})

/** What every board of an export is drawn against: the app, the export's page app, its options. */
interface DrawContext {
  readonly app: App
  readonly pageApp: App
  readonly options: PageDrawOptions
}

const drawBoard = (context: DrawContext, boardApp: App, page: Page, board: BoardToDraw) =>
  Effect.gen(function* () {
    const { app, options } = context
    const renderer = yield* PageRenderer
    const target = renderTargetOf(app, boardApp, page, board)
    const requestQuery = { ...drawQueryOf(page), ...board.plan.query }
    const rendered = yield* Effect.tryPromise({
      try: async () =>
        target.missing === undefined
          ? renderer.renderPage(target.app, target.path, {
              specimen: true,
              requestQuery,
              ...(options.now === undefined ? {} : { drawnAt: options.now }),
              ...specimenSeedOf(app, board.plan, options),
            })
          : renderAnswer(renderer, target.app, target.missing),
      catch: (cause) => new DesignSystemPageDrawError({ page: page.name, cause }),
    })
    if (typeof rendered !== 'string') {
      const redirect = redirectOf(rendered)
      if (redirect === undefined) return yield* pageDrawRefusal(page.name, target.path, rendered)
      return { redirect } as const
    }
    const body = resolveExportStamps(renderedSpecimenOf(rendered))
    const drawing: PageBoardDrawing = {
      ...board,
      body: withRefusedForm(body, board.plan.refusedForm),
      drawnIds: target.answer ? new Set<string>() : drawnIdsOf(board.projected),
      ...(options.prototype === undefined || target.answer
        ? {}
        : { prototype: boardPrototypeOf(app, page, prototypeContextOf(app, board.plan, options)) }),
    }
    return drawing
  })

/**
 * A page as a view of the Prototype board (`--prototype=app`): its default
 * board, or — for a routed record page — the page drawn at a placeholder
 * record, each field a placeholder the board's store fills in.
 */
const drawAppView = (context: DrawContext, page: Page, main: PageBoardDrawing) =>
  Effect.gen(function* () {
    const view = prototypeViewOf(page)
    const fallback = { view, body: main.body, prototype: main.prototype }
    if (view.table === undefined || view.param === undefined) return fallback
    const { seed, record } = placeholderSeedOf(context.app, context.options.seed, view.table)
    const plan: PageBoardPlan = {
      ...main.plan,
      routeValues: { ...main.plan.routeValues, [view.param]: RECORD_VIEW_ID },
      branches: { ...main.plan.branches, record },
    }
    const projected = projectPageForExport(context.app, page, {
      seed,
      viewer: plan.viewer,
      routeValues: plan.routeValues,
      branches: plan.branches,
    })
    const drawn = yield* drawBoard(
      { ...context, options: { ...context.options, seed } },
      withPage(context.pageApp, projected.drawn),
      page,
      { plan, projected }
    )
    return 'redirect' in drawn ? fallback : { view, body: drawn.body, prototype: drawn.prototype }
  })

/** Draw every board of one page, its default board first; a redirecting page has none. */
const drawPage = (context: DrawContext, page: Page, boards: readonly BoardToDraw[]) =>
  Effect.gen(function* () {
    const { pageApp } = context
    const outcomes = yield* Effect.forEach(boards, (board, at) =>
      drawBoard(context, at === 0 ? pageApp : withPage(pageApp, board.projected.drawn), page, board)
    )
    const redirect = outcomes.flatMap((outcome) =>
      'redirect' in outcome ? [outcome.redirect] : []
    )
    const drawn = outcomes.flatMap((outcome) => ('redirect' in outcome ? [] : [outcome]))
    const [main] = drawn
    if (main === undefined || 'redirect' in (outcomes[0] ?? {})) {
      return { page: page.name, redirect: redirect[0] ?? page.path } as const
    }
    const title = `${page.name} — ${pageApp.name} pages`
    const appView =
      context.options.prototype === 'app' ? yield* drawAppView(context, page, main) : undefined
    return {
      page: main.projected.tree.page,
      title,
      body: main.body,
      projected: main.projected,
      boards: drawn,
      ...(appView === undefined ? {} : { appView }),
    }
  })

export type PageDrawing = Exclude<Effect.Success<ReturnType<typeof drawPage>>, { redirect: string }>

/**
 * Draw every selected page, each on every board it gets (`design-system-page-boards.ts`).
 * A page that answers the sample admin with a redirect (the `auth.landingPath`
 * page sends a session on to its role's landing) has nothing to draw: it is
 * skipped, and named with its target.
 */
export const drawPagesOf = (app: App, pages: readonly Page[], options: PageDrawOptions = {}) =>
  Effect.gen(function* () {
    const boards = pages.map((page) =>
      boardPlansOf(app, page, options).map((plan) => ({
        plan,
        projected: projectPageForExport(app, page, {
          seed: options.seed,
          viewer: plan.viewer,
          routeValues: plan.routeValues,
          branches: plan.branches,
          empty: plan.branches.data === 'empty',
        }),
      }))
    )
    const pageApp = kitPageAppOf(
      app,
      boards.map((board) => (board[0] as (typeof board)[number]).projected.drawn)
    )
    const outcomes = yield* Effect.forEach(
      pages,
      (page, index) => drawPage({ app, pageApp, options }, page, boards[index] ?? []),
      { concurrency: 4 }
    )
    const drawings = outcomes.filter((outcome): outcome is PageDrawing => !('redirect' in outcome))
    const notices = outcomes.flatMap((outcome) =>
      'redirect' in outcome
        ? [
            `Note: page ${outcome.page} answers the sample admin with a redirect to ` +
              `${outcome.redirect}, so it has nothing to draw and is skipped.`,
          ]
        : []
    )
    return { pageApp, drawings, notices }
  }).pipe(
    Effect.withSpan('design-system.draw-pages', { attributes: { 'design.pages': pages.length } })
  )
