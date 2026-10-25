/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The two documents `sovrium templates` prints, rendered from the decoded
 * catalogue. Pure: no read, no write, no clock.
 *
 * Both keep the catalogue's key order, which is the gallery order, and never
 * sort it.
 */

import { isHeadlessEntry } from './templates-catalog'
import type { TemplateCatalog } from './templates-catalog'

/** The GitHub organisation the release publishes each template repository under. */
const TEMPLATE_REPOSITORY_ORG = 'https://github.com/sovrium'

/**
 * The public repository the release publishes for a template:
 * `https://github.com/sovrium/<slug>-template`. The `-template` suffix exists
 * only on the repository name; the slug `init --template` takes has none.
 */
export const templateRepositoryUrl = (slug: string): string =>
  `${TEMPLATE_REPOSITORY_ORG}/${slug}-template`

/** One row of the `--json` document: exactly these seven keys. */
export interface TemplatesDocumentRow {
  readonly slug: string
  readonly name: string
  readonly description: string
  readonly category: string
  readonly topics: readonly string[]
  readonly headless: boolean
  readonly repository: string
}

/** The `--json` document. `schemaVersion` moves only when a key is removed or changes meaning. */
export interface TemplatesDocument {
  readonly format: 'sovrium-templates'
  readonly schemaVersion: 1
  readonly engine: string
  readonly templates: readonly TemplatesDocumentRow[]
}

/** The `--json` document for a catalogue and the running engine version. */
export const buildTemplatesDocument = (
  catalog: TemplateCatalog,
  engine: string
): TemplatesDocument => ({
  format: 'sovrium-templates',
  schemaVersion: 1,
  engine,
  templates: Object.entries(catalog).map(([slug, entry]) => ({
    slug,
    name: entry.name,
    description: entry.description,
    category: entry.category,
    topics: entry.topics,
    headless: isHeadlessEntry(entry),
    repository: templateRepositoryUrl(slug),
  })),
})

/** The `--json` output: the document and a trailing newline, nothing else. */
export const renderTemplatesJson = (catalog: TemplateCatalog, engine: string): string =>
  `${JSON.stringify(buildTemplatesDocument(catalog, engine), null, 2)}\n`

/** The categories in the order the catalogue first names each. */
const categoriesInOrder = (catalog: TemplateCatalog): readonly string[] => [
  ...new Set(Object.values(catalog).map((entry) => entry.category)),
]

/**
 * The human list: one block per category, a heading then one line per
 * template — `slug — name: description`, `(headless)` after an API or MCP
 * template — and a closing line saying how to scaffold one.
 */
export const renderTemplatesText = (catalog: TemplateCatalog): string => {
  const entries = Object.entries(catalog)
  const blocks = categoriesInOrder(catalog).map((category) =>
    [
      category,
      ...entries
        .filter(([, entry]) => entry.category === category)
        .map(
          ([slug, entry]) =>
            `  ${slug} — ${entry.name}: ${entry.description}${isHeadlessEntry(entry) ? ' (headless)' : ''}`
        ),
    ].join('\n')
  )
  return [...blocks, 'Scaffold one: sovrium init <dir> --template <slug>'].join('\n\n') + '\n'
}
