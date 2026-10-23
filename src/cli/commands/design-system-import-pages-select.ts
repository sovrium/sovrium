/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which drawings `sovrium design-system import --pages` merges: those of the
 * pages the config declares, `--page` narrowing them, and — with
 * `--new-pages` — those of the pages it does not, each merged into a new,
 * empty page entry (`page-merge-new-page-service.ts`). Without the flag a
 * drawing of an undeclared page is skipped and named.
 */

import {
  newPageEntryOf,
  type NewPageEntry,
} from '@/domain/models/app/pages/page-merge-new-page-service'
import { refuse } from './app-prelude'
import type { MergedPage } from './design-system-import-pages-apply'
import type { SkippedDrawing } from './design-system-import-pages-readers'
import type { App } from '@/domain/models/app'
import type { DrawnPage } from '@/domain/models/app/pages/page-drawing'
import type { PageMergeInput } from '@/domain/models/app/pages/page-merge'
import type { RuleReferences } from '@/domain/models/app/pages/page-merge-rules-service'

/** What one tool's drawings came to: the pages read, and the drawings set aside. */
export interface ReadDrawings {
  readonly pages: readonly DrawnPage[]
  readonly skipped: readonly SkippedDrawing[]
}

/** The drawings selected: of declared pages, of new pages, and those set aside. */
export interface SelectedDrawings extends ReadDrawings {
  /** With `--new-pages`, the drawings of pages the config does not declare. */
  readonly created: readonly DrawnPage[]
}

/**
 * The drawings the request asks for, and those set aside: a drawing of a page
 * the config does not declare is skipped and named, unless `newPages` makes
 * it a new page; `--page` narrows them, and names only pages drawn.
 *
 * @param read - every drawing read.
 * @param app - the decoded config.
 * @param request - the `--page` names, and whether `--new-pages` was given.
 */
export const selectDrawings = (
  read: ReadDrawings,
  app: App,
  request: { readonly names: readonly string[]; readonly newPages: boolean }
): SelectedDrawings => {
  const { names } = request
  const declared = new Set((app.pages ?? []).map((page) => page.name))
  const foreign = read.pages.filter((drawing) => !declared.has(drawing.page))
  const drawings = read.pages.filter((drawing) => declared.has(drawing.page))
  const created = request.newPages ? foreign : []
  const skipped = [
    ...read.skipped,
    ...(request.newPages ? [] : foreign).map((drawing) => ({
      drawing: drawing.drawing ?? drawing.page,
      reason: `It draws the page ${drawing.page}, which this config does not declare; declare the page, run again with --new-pages, or import into the config the drawing was exported from.`,
    })),
  ]
  const held = [...drawings, ...created]
  const missing = names.filter((name) => !held.some((drawing) => drawing.page === name))
  if (missing.length > 0) {
    return refuse(
      `Error: --page ${missing.join(', ')} names no page this drawing holds.\n\n` +
        `  It holds: ${held.map((drawing) => drawing.page).join(', ') || 'no page'}.`
    )
  }
  const wanted = (drawing: DrawnPage): boolean => names.length === 0 || names.includes(drawing.page)
  const order = (app.pages ?? []).map((page) => page.name)
  return {
    pages: drawings
      .filter(wanted)
      .toSorted((a, b) => order.indexOf(a.page) - order.indexOf(b.page)),
    created: created.filter(wanted),
    skipped: names.length === 0 ? skipped : [],
  }
}

/** What a page is merged against, but the page, its tree, its map, the drawing and its baseline. */
export type MergeScale = Omit<PageMergeInput, 'page' | 'tree' | 'nodeMap' | 'drawn' | 'baseline'>

/**
 * Merge each drawing of a new page into an empty entry: every kit node drawn
 * on it is an addition. A path a declared page takes, or a model the config
 * does not declare, refuses the whole import before anything is written.
 *
 * @param created - the drawings of the new pages.
 * @param rawPages - the config's page entries, as it writes them.
 * @param scale - what every page is merged against.
 */
export const mergeNewPages = async (
  created: readonly DrawnPage[],
  rawPages: readonly Readonly<Record<string, unknown>>[],
  scale: MergeScale
): Promise<readonly MergedPage[]> => {
  if (created.length === 0) return []
  const { planPageMerge } = await import('@/domain/models/app/pages/page-merge')
  // Each new page is judged against the declared pages AND the new pages before it.
  const entries = created.reduce<readonly (readonly [DrawnPage, NewPageEntry])[]>((acc, drawn) => {
    const fresh = newPageEntryOf(drawn, [...rawPages, ...acc.map(([, made]) => made.entry)])
    return 'refusal' in fresh
      ? refuse(`Error: ${fresh.refusal}\n\n  Nothing was written.`)
      : [...acc, [drawn, fresh] as const]
  }, [])
  return entries.map(([drawn, fresh]) => {
    const plan = planPageMerge({
      ...scale,
      page: fresh.entry,
      tree: [],
      nodeMap: { name: drawn.page, path: fresh.created.path, nodes: [] },
      drawn,
      baseline: { page: drawn.page, nodes: [], stamp: [] },
    })
    return {
      name: drawn.page,
      drawing: drawn.drawing,
      plan: {
        ...plan,
        patch: plan.patch ?? fresh.entry,
        report: { ...plan.report, created: fresh.created },
      },
    }
  })
}

type Raw = Readonly<Record<string, unknown>>

/** Each template's definition in the config, by name, which a placement's inside is read against. */
export const templatesOf = (parsed: unknown): ReadonlyMap<string, Raw> => {
  const { components } = parsed as Raw
  return new Map(
    (Array.isArray(components) ? (components as readonly Raw[]) : []).flatMap((component) =>
      typeof component['name'] === 'string' ? [[component['name'], component] as const] : []
    )
  )
}

/** What the config declares that a rule a drawing carries may name. */
export const referencesOf = (app: App): RuleReferences => ({
  tables: new Map(
    (app.tables ?? []).map(
      (table) => [table.name, new Set(table.fields.map((field) => field.name))] as const
    )
  ),
  forms: new Set((app.forms ?? []).map((form) => form.name)),
  paths: new Set((app.pages ?? []).map((page) => page.path)),
})
