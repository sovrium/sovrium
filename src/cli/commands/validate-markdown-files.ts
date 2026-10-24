/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isAbsolute, resolve } from 'node:path'
import {
  markdownFileDeclarations,
  missingMarkdownFileWarning,
} from '@/domain/models/app/pages/markdown-source-file-service'
import type { MarkdownFileDeclaration } from '@/domain/models/app/pages/markdown-source-file-service'

/**
 * The warnings for every page whose `markdown.file` names a file that is not
 * there, resolved from `projectDir` as the server resolves it.
 *
 * A warning and never a refusal: the server serves such a page without its
 * body rather than failing, so the config still validates and still bundles.
 * A `contentDir` is not checked — a directory with nothing in it yet is a
 * collection waiting for its first article, which is not a mistake.
 */
export const missingMarkdownFileWarnings = async (
  pages: Parameters<typeof markdownFileDeclarations>[0],
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
  return declarations
    .filter((_, index) => present[index] !== true)
    .map((declaration) => missingMarkdownFileWarning(declaration))
}
