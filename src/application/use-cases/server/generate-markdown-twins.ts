/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Markdown-twin half of `sovrium build`.
 *
 * The live server answers `<article-url>.md` for every content-directory
 * article (`markdown-export-routes.ts`); a static host has no route, so the
 * build writes each twin as a file at that same address, beside the article's
 * HTML. The body is the one the route serves — the file with its frontmatter
 * removed — and the set of articles is the one the route would answer: public
 * pages only, `contentDir.filter` applied.
 */

import { Effect } from 'effect'
import { StaticGenerationError } from '@/application/errors/static-generation-error'
import { isPublicPage } from '@/domain/models/app/pages/is-public'
import { logDebug } from '@/infrastructure/logging'
import { readContentDirBodies } from '@/infrastructure/markdown/content-dir-enumerator'
import type { FileSystemLike } from './generate-static-helpers'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'

/** One twin to write: its address relative to the output root, and its body. */
interface MarkdownTwin {
  readonly relativePath: string
  readonly body: string
}

/**
 * The twins of one content-directory page. An entry whose path still carries a
 * route parameter (a `:lang` template) has no single address and is skipped.
 */
const collectPageTwins = async (page: Page): Promise<readonly MarkdownTwin[]> => {
  if (page.contentDir === undefined || !isPublicPage(page)) return []
  const bodies = await readContentDirBodies(page.contentDir, page.path)
  return bodies
    .filter(({ entry }) => !entry.path.includes(':'))
    .map(({ entry, body }) => ({
      relativePath: `${entry.path.replace(/^\/+/, '').replace(/\/+$/, '')}.md`,
      body,
    }))
}

/** Write one twin, creating its directory first. */
const writeTwin = (twin: MarkdownTwin, outputDir: string, fs: FileSystemLike) =>
  Effect.tryPromise({
    try: () => {
      const target = `${outputDir}/${twin.relativePath}`
      return fs
        .mkdir(target.slice(0, target.lastIndexOf('/')), { recursive: true })
        .then(() => fs.writeFile(target, twin.body, 'utf-8'))
        .then(() => twin.relativePath)
    },
    catch: (error) =>
      new StaticGenerationError({ message: `Failed to write ${twin.relativePath}`, cause: error }),
  })

/** Read every page's twins, then write them. */
const writeAllTwins = (pages: readonly Page[], outputDir: string, fs: FileSystemLike) =>
  Effect.gen(function* () {
    logDebug('Generating Markdown twins...')
    const perPage = yield* Effect.forEach(
      pages,
      (page) =>
        Effect.tryPromise({
          try: () => collectPageTwins(page),
          catch: (error) =>
            new StaticGenerationError({ message: `Failed to read ${page.path}`, cause: error }),
        }),
      { concurrency: 1 }
    )
    return yield* Effect.forEach(perPage.flat(), (twin) => writeTwin(twin, outputDir, fs))
  })

/**
 * Write the `.md` twin of every public content-directory article, and answer
 * the names written relative to the output root.
 */
export function generateMarkdownTwinFiles(app: App, outputDir: string, fs: FileSystemLike) {
  const pages = (app.pages ?? []).filter((page) => page.contentDir !== undefined)
  return Effect.suspend(() =>
    pages.length === 0
      ? Effect.succeed([] as readonly string[])
      : writeAllTwins(pages, outputDir, fs)
  ).pipe(Effect.withSpan('server.generate-markdown-twins'))
}
