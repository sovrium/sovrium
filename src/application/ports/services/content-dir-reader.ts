/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data, type Effect } from 'effect'
import type { ContentDir } from '@/domain/models/app/pages/content-dir'

/** Failure reading the on-disk content directory a page is backed by. */
export class ContentDirReadError extends Data.TaggedError('ContentDirReadError')<{
  readonly cause: unknown
}> {}

/**
 * Read port over a `contentDir`-backed page's source files.
 *
 * ### Why this is a port and the markdown RENDERER is not
 *
 * Both live in `infrastructure/markdown/`, and only one of them is behaviour.
 * `renderMarkdownToHtml` is a pure syntactic transform — markdown-it in, HTML
 * out, no DI and no I/O — and the `presentation-rendering` layer already
 * reaches it directly for exactly that reason. This one calls `stat` on the
 * filesystem. An area-level allowance cannot tell the two apart, so opening
 * `infrastructure-markdown` to the HTTP surface to get the formatter would have
 * opened the file read with it.
 *
 * TWO methods, because two things cross the boundary and both are filesystem
 * reads: the raw body behind `GET /<slug>.md`, and the corpus checksum that
 * keys a `'content'` page's cache entry. Enumeration, front-matter parsing,
 * ordering and slug derivation stay inside the implementation, where the
 * directory walk lives.
 */
export class ContentDirReader extends Context.Service<
  ContentDirReader,
  {
    /**
     * The raw markdown body of the file this `contentDir` derives `slug` from,
     * or `undefined` when no file in the directory derives it.
     *
     * FRONT MATTER IS STRIPPED; the body is what remains. The export surface
     * serves the prose a reader asked for, not the page's internal metadata.
     *
     * A miss and an empty directory are the same answer, which is what lets the
     * route answer 404 without distinguishing "this slug is wrong" from "the
     * directory is not there" — the second would tell an anonymous caller
     * something about the deployment's filesystem.
     */
    readonly readBodyForSlug: (
      contentDir: Readonly<ContentDir>,
      slug: string
    ) => Effect.Effect<string | undefined, ContentDirReadError>

    /**
     * A checksum over the CURRENT on-disk state of this `contentDir`.
     *
     * The second key dimension of a `'content'` page's cache entry
     *. Such a page is corpus-invariant rather than
     * request-invariant: editing, adding or removing a markdown file leaves the
     * app render-checksum untouched, so without this segment the entry would
     * survive the edit for as long as the process lives.
     *
     * The scan passes NO `include` narrowing, and that is load-bearing rather
     * than lazy: it must cover everything the render actually reads, and the
     * sidebar lister has always listed the whole directory regardless of
     * `include`. Narrowing here would leave a page whose sidebar changed but
     * whose keyed corpus did not.
     */
    readonly corpusChecksum: (
      contentDir: Readonly<ContentDir>
    ) => Effect.Effect<string, ContentDirReadError>
  }
>()('ContentDirReader') {}
