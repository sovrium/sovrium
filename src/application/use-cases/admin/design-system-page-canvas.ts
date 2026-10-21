/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The bundle's Claude Design canvas: the exported pages handed to the canvas
 * adapter (`claude-design-canvas-export.ts`), and the design system's fonts
 * copied beside the tokens the canvas installs.
 *
 * Only the `--pages` export calls it, so a bundle without pages carries no
 * canvas and is byte-identical to one built before the page export existed.
 */

import {
  canvasFontPath,
  claudeDesignCanvasFiles,
} from '@/domain/models/app/design/adapters/pages/claude-design-canvas-export'
import {
  textEntry,
  type DesignSystemBundle,
  type DesignSystemBundleEntry,
} from './design-system-bundle'
import type { ProjectedPage } from './design-system-page-projection'
import type { PageExportStamp } from '@/domain/models/api/admin/design-system/page-design-tree'
import type { App } from '@/domain/models/app'

/** The Claude Design project's tokens, which the canvas installs as its design system. */
const PROJECT_TOKENS = 'adapters/claude-design/project/tokens.json'

/** One drawn page: its projection and the markup the renderer drew inside `<main>`. */
export interface DrawnPage {
  readonly projected: ProjectedPage
  readonly body: string
}

/** A page's export stamp: every node its node map lists, with key and content hash. */
const stampOf = (projected: ProjectedPage): PageExportStamp =>
  projected.map.nodes.map((node) => ({
    id: node.id,
    ...(node.key === undefined ? {} : { key: node.key }),
    contentHash: node.contentHash,
  }))

const decoder = new TextDecoder()

/**
 * The canvas files of a pages export, read from the bundle they join.
 *
 * @param app - the validated config.
 * @param bundle - the bundle without its pages.
 * @param pages - each exported page, in config order.
 * @param stylesheet - the pages stylesheet, as `pages/pages.css` carries it.
 */
export const canvasEntriesOf = (
  app: App,
  bundle: DesignSystemBundle,
  pages: readonly DrawnPage[],
  stylesheet: string
): readonly DesignSystemBundleEntry[] => {
  const tokens = bundle.files.find((file) => file.path === PROJECT_TOKENS)
  const fonts = bundle.files.filter(
    (file) => file.role === 'font' && file.path.startsWith('fonts/')
  )
  const files = claudeDesignCanvasFiles({
    appName: app.name,
    routes: (app.pages ?? []).map((page) => ({ name: page.name, path: page.path })),
    pages: pages.map((page) => ({
      tree: page.projected.tree,
      exported: stampOf(page.projected),
      body: page.body,
    })),
    tokens: tokens === undefined ? '{}\n' : decoder.decode(tokens.bytes),
    stylesheet,
  })
  return [
    ...files.map((file) => textEntry(file.path, 'adapter', file.content)),
    ...fonts.map((font) => ({
      ...font,
      path: canvasFontPath(app.name, font.path.slice('fonts/'.length)),
      role: 'adapter' as const,
    })),
  ]
}
