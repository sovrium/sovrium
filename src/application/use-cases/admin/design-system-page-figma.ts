/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Figma page documents of the page export ([internal ref] A13): one
 * `adapters/figma/pages/<name>.figma.json` per exported page, drawn from the
 * page's projection and bound to the Figma token files the same bundle holds.
 *
 * The documents bind variables by the names `adapters/figma/light.tokens.json`
 * gives them, so they are read off that very file: a page document can never
 * name a variable the token files lack.
 */

import {
  exportFigmaPage,
  figmaBindingsOf,
  type FigmaIslandDrawing,
} from '@/domain/models/app/design/adapters/pages/figma-pages-export'
import { EXPORT_NODE_ID_KEY } from '@/domain/models/app/pages/node-identity'
import type { DesignSystemBundle } from './design-system-bundle'
import type { ProjectedPage } from './design-system-page-projection'
import type { FigmaPageDocument } from '@/domain/models/api/admin/design-system/adapter-figma-pages'
import type { App } from '@/domain/models/app'

const FIGMA_LIGHT_TOKENS = 'adapters/figma/light.tokens.json'

const decoder = new TextDecoder()

type Drawn = Readonly<Record<string, unknown>>

const isDrawn = (value: unknown): value is Drawn =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const strings = (value: unknown): readonly string[] =>
  Array.isArray(value) ? value.map((cell) => String(cell)) : []

/** What each drawn island shows, by its node id: a table's headers and seeded rows. */
const islandsOf = (nodes: readonly unknown[]): readonly (readonly [string, FigmaIslandDrawing])[] =>
  nodes.flatMap((node) => {
    if (!isDrawn(node)) return []
    const id = node[EXPORT_NODE_ID_KEY]
    const own =
      typeof id === 'string' && Array.isArray(node['tableHeaders'])
        ? [
            [
              id,
              {
                headers: strings(node['tableHeaders']),
                rows: (Array.isArray(node['tableRows']) ? node['tableRows'] : []).map(strings),
              },
            ] as const,
          ]
        : []
    return [...own, ...islandsOf(Array.isArray(node['children']) ? node['children'] : [])]
  })

/** The Figma light token file of a bundle, parsed; `{}` when the bundle has none. */
const lightTokensOf = (bundle: DesignSystemBundle): unknown => {
  const file = bundle.files.find((entry) => entry.path === FIGMA_LIGHT_TOKENS)
  return file === undefined ? {} : (JSON.parse(decoder.decode(file.bytes)) as unknown)
}

/** One Figma page document per projected page, in the order given. */
export const figmaPageDocumentsOf = (
  app: App,
  bundle: DesignSystemBundle,
  projected: readonly ProjectedPage[]
): readonly FigmaPageDocument[] => figmaPageDocumentsBoundTo(app, lightTokensOf(bundle), projected)

/**
 * One Figma page document per projected page, bound to the variables of the
 * Figma light token file given: with none, each document draws its base board
 * alone, its lengths unbound, which is what the Penpot file is drawn from.
 */
export const figmaPageDocumentsBoundTo = (
  app: App,
  lightTokens: unknown,
  projected: readonly ProjectedPage[]
): readonly FigmaPageDocument[] => {
  const bindings = figmaBindingsOf(lightTokens)
  const language = app.languages?.default
  const translations = language === undefined ? {} : (app.languages?.translations?.[language] ?? {})
  return projected.map((projection) =>
    exportFigmaPage({
      page: projection.tree.page,
      nodes: projection.tree.nodes,
      map: projection.map.nodes,
      islands: Object.fromEntries(islandsOf(projection.drawn.components ?? [])),
      templates: app.components ?? [],
      translations,
      ...bindings,
    })
  )
}
