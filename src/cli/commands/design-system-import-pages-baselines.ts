/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What `sovrium design-system import --pages` reads a drawing against: the
 * kit and the spacing scale a tool's parser reads it with, and the BASELINE,
 * the same tool's drawings of an unedited export of the config built in
 * memory, so a value the designer did not touch reads the same on both sides.
 */

import { join } from 'node:path'
import { parseJson } from '@/domain/models/app/design/adapters/import/canonical-tokens-service'
import {
  CANVAS_TOKENS_FILE,
  paintTokensOf,
} from '@/domain/models/app/design/adapters/pages/claude-design-canvas-tokens'
import { DEFAULT_SCALE_VALUES } from '@/domain/models/app/design/default-design.generated'
import { ENGINE_COMPONENT_TYPES } from '@/domain/models/app/pages/components/component-types/component-type-union'
import {
  defaultSpacingStepsOf,
  spacingScaleOf,
} from '@/domain/models/app/pages/page-merge-layout-service'
import { refuse } from './app-prelude'
import { PAGE_READERS, recordedDrawingOf } from './design-system-import-pages-readers'
import {
  bundleFilesOf,
  bundleView,
  displayPath,
  type LocatedPageSource,
} from './design-system-import-pages-source'
import { lazyImportIndex } from './utils'
import type { ReadDrawings } from './design-system-import-pages-select'
import type { UneditedTokens } from './design-system-import-pages-tokens'
import type { App } from '@/domain/models/app'
import type { DrawnPage } from '@/domain/models/app/pages/page-drawing'
import type { PaintTokens } from '@/domain/models/app/pages/page-merge-paint-service'

const decoder = new TextDecoder()

/**
 * The kit a drawing may add nodes from: every component type the kit draws.
 * Text a new node draws goes to `content` on a text node and to a lone string
 * child on any other, as a page writes a button's label.
 */
export const KIT = {
  types: new Set<string>(ENGINE_COMPONENT_TYPES),
  contentTypes: new Set(['text']),
}

/** The default scale every app renders with when its config declares no `design.spacing`. */
const DEFAULT_SPACING_STEPS = defaultSpacingStepsOf(DEFAULT_SCALE_VALUES)

/**
 * The scale a drawing's lengths are read against: the app's declared
 * `design.spacing`, else the default scale every app renders with.
 */
export const spacingOf = (app: App): Readonly<Record<string, string>> =>
  spacingScaleOf(
    app.design?.spacing as Readonly<Record<string, string>> | undefined,
    DEFAULT_SPACING_STEPS
  )

/** Read one tool's drawings through its parser, refusing what it cannot read at all. */
export const readDrawings = async (
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
export interface Baselines {
  readonly pages: ReadonlyMap<string, DrawnPage>
  readonly paint: PaintTokens
  /** The unedited export's canvas token file, which `--tokens` reads the canvas's against. */
  readonly tokens: UneditedTokens
}

/**
 * The same tool's drawings of an unedited export of the config, built in
 * memory, with the drawing inputs the canvas recorded (its seed folder, its
 * instant, its account): an untouched board then draws the same on both sides.
 */
export const baselinesOf = async (
  app: App,
  configPath: string,
  located: Pick<LocatedPageSource, 'format' | 'view' | 'files'>,
  names: readonly string[]
): Promise<Baselines> => {
  const { format } = located
  const { buildDesignSystemBundle } = await lazyImportIndex()
  const { assetProjectDir } = await import('@/infrastructure/assets/private-assets')
  const { recordedDrawRequestFor } = await import('./design-system-page-flags')
  const draw = await recordedDrawRequestFor(app, configPath, await recordedDrawingOf(located))
  const bundle = await buildDesignSystemBundle(app, {
    publicDir: join(assetProjectDir(configPath), 'public'),
    pages: { names, ...(draw === undefined ? {} : { draw }) },
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
