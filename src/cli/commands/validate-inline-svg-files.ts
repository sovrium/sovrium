/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { join } from 'node:path'
import { sanitizeSvgDrawing } from '@/domain/kernel/sanitize/html-sanitization'
import {
  inlineSvgDeclarations,
  undrawnInlineSvgWarning,
} from '@/domain/models/app/pages/inline-svg-declaration-service'
import { isPublicDirOptOut, readPublicDirEnv } from './option-parsing'
import type { App } from '@/domain/models/app'

/**
 * The warnings for every drawing a page names and the server would not draw,
 * asked of the same reader and the same sanitiser the render uses. A warning and
 * never a refusal: such a node falls back to a plain image and the page answers.
 */
export const undrawnInlineSvgWarnings = async (
  app: App,
  projectDir: string
): Promise<readonly string[]> => {
  const declarations = inlineSvgDeclarations(app)
  if (declarations.length === 0) return []
  const { readPublicFileText } = await import('@/infrastructure/assets/public-file')
  const fromEnv = readPublicDirEnv()
  const publicDir = isPublicDirOptOut(fromEnv) ? undefined : (fromEnv ?? join(projectDir, 'public'))
  const drawn = await Promise.all(
    declarations.map(async ({ path }) => {
      const source = await readPublicFileText(publicDir, path)
      return source !== undefined && sanitizeSvgDrawing(source, '') !== undefined
    })
  )
  return declarations
    .filter((_, index) => drawn[index] !== true)
    .map((declaration) => undrawnInlineSvgWarning(declaration))
}
