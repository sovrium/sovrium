/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What `sovrium init --template <slug>` takes from an embedded template tree,
 * and the wrapper files it renders beside it.
 *
 * A template directory holds config, its `seed/` and `public/`, and one
 * `template.yaml` of prose. `init` copies the config into the project and
 * renders `CLAUDE.md` and `.env.example` from the manifest; it never copies the
 * manifest, the published repository's own `README.md` and `LICENSE`, or a
 * host's deploy manifest (`scalingo.json`, `.buildpacks`, `Procfile`): a
 * project deploys with `sovrium deploy`, or by running the binary anywhere.
 */

import { join } from 'node:path'
import { printStderr } from '@/infrastructure/logging/cli-output'
import { renderTemplateClaudeMd } from './init-template-claude-md'
import { renderTemplateEnvExample } from './init-template-env'
import { collectTemplateFacts, isTemplateConfigText } from './init-template-facts'
import { decodeTemplateManifest, TEMPLATE_MANIFEST_FILE } from './init-template-manifest'
import type { TemplateCatalogFacts } from './init-template-facts'

/** Files of a template directory that describe the template and are never copied out of it. */
export const TEMPLATE_META_FILES: ReadonlySet<string> = new Set([TEMPLATE_MANIFEST_FILE])

/**
 * Root files an older template tree may still carry that a project never
 * receives: the published repository's own README and licence, which are
 * statements about that repository, and a hosting provider's deploy manifest.
 */
const NEVER_SCAFFOLDED: ReadonlySet<string> = new Set([
  'README.md',
  'LICENSE',
  'scalingo.json',
  '.buildpacks',
  'Procfile',
])

/** Whether `init` copies this template file (a path relative to the template root). */
export const isScaffoldedTemplateFile = (relPath: string): boolean =>
  !TEMPLATE_META_FILES.has(relPath) && !NEVER_SCAFFOLDED.has(relPath)

/**
 * Write the template's `CLAUDE.md` and `.env.example`, rendered from its
 * `template.yaml`, unless the project already has them (`init` never
 * overwrites a file it did not just create). A template tree with no manifest
 * keeps the files it checks in, which the tree copy already wrote.
 *
 * `tree` maps each path relative to the template root to its embedded path.
 * `catalogEntry` is the template's catalogue entry, handed to the facts exactly
 * as the mirror publisher hands it, so a project and the published repository
 * render the same `.env.example`. Returns the relative paths written.
 */
export const writeRenderedTemplateWrappers = async (
  slug: string,
  tree: Readonly<Record<string, string>>,
  targetDir: string,
  catalogEntry?: TemplateCatalogFacts
): Promise<readonly string[]> => {
  const manifestPath = tree[TEMPLATE_MANIFEST_FILE]
  if (manifestPath === undefined) return []
  const decoded = decodeTemplateManifest(await Bun.file(manifestPath).text())
  if (decoded._tag === 'Failure') {
    // An embedded template whose manifest does not decode is a build defect,
    // not a user error; the binary cannot scaffold this template at all.
    printStderr(
      `Error: template ${slug} ships an unreadable ${TEMPLATE_MANIFEST_FILE}: ${decoded.failure.message}`
    )
    process.exit(1)
  }
  const texts = await Promise.all(
    Object.entries(tree).map(
      async ([relPath, embedded]) =>
        [relPath, isTemplateConfigText(relPath) ? await Bun.file(embedded).text() : ''] as const
    )
  )
  const facts = collectTemplateFacts(slug, Object.fromEntries(texts), catalogEntry)
  const rendered: ReadonlyArray<readonly [string, string]> = [
    ['CLAUDE.md', renderTemplateClaudeMd(decoded.success, facts)],
    ['.env.example', renderTemplateEnvExample(decoded.success, facts)],
  ]
  const written = await Promise.all(
    rendered.map(async ([relPath, content]) => {
      const destination = join(targetDir, relPath)
      if (await Bun.file(destination).exists()) return undefined
      await Bun.write(destination, content)
      return relPath
    })
  )
  return written.filter((relPath): relPath is string => relPath !== undefined)
}
