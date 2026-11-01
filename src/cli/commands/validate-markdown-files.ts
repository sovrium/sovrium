/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { stat } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import {
  contentDirDeclarations,
  markdownFileDeclarations,
  missingContentDirWarning,
  missingMarkdownFileWarning,
} from '@/domain/models/app/pages/markdown-source-file-service'
import type { MarkdownFileDeclaration } from '@/domain/models/app/pages/markdown-source-file-service'

/**
 * The warnings for every page whose `markdown.file` names a file that is not
 * there, resolved from `projectDir` as the server resolves it.
 *
 * A warning and never a refusal: the server serves such a page without its
 * body rather than failing, so the config still validates and still bundles.
 * A `contentDir` is checked by {@link missingContentDirWarnings}.
 */
export const missingMarkdownFileWarnings = async (
  pages: Parameters<typeof markdownFileDeclarations>[0] &
    Parameters<typeof contentDirDeclarations>[0],
  projectDir: string
): Promise<readonly string[]> => {
  const declarations = markdownFileDeclarations(pages)
  const present = await Promise.all(
    declarations.map((declaration: MarkdownFileDeclaration) =>
      Bun.file(
        isAbsolute(declaration.file) ? declaration.file : resolve(projectDir, declaration.file)
      )
        .exists()
        .catch(() => false)
    )
  )
  return [
    ...declarations
      .filter((_, index) => present[index] !== true)
      .map((declaration) => missingMarkdownFileWarning(declaration)),
    ...(await missingContentDirWarnings(pages, projectDir)),
  ]
}

/**
 * The warnings for every `contentDir` whose directory is not there. The server
 * answers every address of such a page with its 404, so the config is not wrong
 * (a translation may not be written yet) but the gap is worth one line. A
 * directory that exists with nothing in it is not warned about.
 */
const missingContentDirWarnings = async (
  pages: Parameters<typeof contentDirDeclarations>[0],
  projectDir: string
): Promise<readonly string[]> => {
  const declarations = contentDirDeclarations(pages)
  const present = await Promise.all(
    declarations.map((declaration) =>
      stat(
        isAbsolute(declaration.directory)
          ? declaration.directory
          : resolve(projectDir, declaration.directory)
      )
        .then((entry) => entry.isDirectory())
        .catch(() => false)
    )
  )
  return declarations
    .filter((_, index) => present[index] !== true)
    .map((declaration) => missingContentDirWarning(declaration))
}
