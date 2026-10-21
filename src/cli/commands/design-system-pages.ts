/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `--pages [--page <name>…]` on `sovrium design-system --format bundle`: which
 * pages to draw into the bundle, and — for a TypeScript config — where each
 * page's sidecar goes.
 *
 * A page name the config does not declare is refused before anything is built
 * or written, naming the pages there are: an export that silently skipped a
 * mistyped page would hand the designer a bundle without the screen they were
 * asked to rework.
 *
 * A page import never edits a TypeScript file; it writes `<name>.page.json`
 * beside the config, which the config imports. The export names that path per
 * page, and whether the file is there already. A YAML or JSON config is patched
 * in place and gets no sidecar manifest.
 */

import { existsSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import {
  declaredPagesSentence,
  undeclaredPageNames,
  type PageExportSelection,
} from '@/application/use-cases/admin/design-system-pages'
import { printStderr } from '@/infrastructure/logging/cli-output'
import type { App } from '@/domain/models/app'

/** The config extensions a page import writes a sidecar for. */
const TYPESCRIPT_EXTENSIONS: ReadonlySet<string> = new Set(['.ts', '.mts', '.tsx'])

/**
 * The page selection of a `--pages` export, refusing an undeclared page name
 * and exiting 1.
 *
 * @param app - the decoded config.
 * @param configPath - the config file, whose extension decides the sidecars.
 * @param names - every `--page` value; none exports every page.
 */
export const pageSelectionFor = async (
  app: App,
  configPath: string,
  names: readonly string[]
): Promise<PageExportSelection> => {
  const unknown = undeclaredPageNames(app, names)
  if (unknown.length > 0) {
    printStderr(
      `Error: --page ${unknown.join(', ')} names no page of this config.\n\n` +
        `  ${declaredPagesSentence(app)}\n\n` +
        '  Nothing was written.'
    )
    process.exit(1)
  }
  const selected = (app.pages ?? []).filter(
    (page) => names.length === 0 || names.includes(page.name)
  )
  if (!TYPESCRIPT_EXTENSIONS.has(extname(configPath))) {
    return names.length === 0 ? {} : { names }
  }
  const configDir = dirname(configPath)
  return {
    ...(names.length === 0 ? {} : { names }),
    sidecars: selected.map((page) => {
      const sidecar = `${page.name}.page.json`
      return { page: page.name, sidecar, exists: existsSync(join(configDir, sidecar)) }
    }),
  }
}
