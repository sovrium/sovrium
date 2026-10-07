/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data, type Effect } from 'effect'
import type { PageAccess } from '@/domain/models/app/pages/access'
import type { ContentDir } from '@/domain/models/app/pages/content-dir'
import type { ContentDirArticleBody } from '@/domain/models/app/pages/content-dir-access'

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
 * Every method is a filesystem read: the raw body behind `GET /<slug>.md`, the
 * corpus checksum that keys a `'content'` page's cache entry, every body (the
 * Markdown twins, `/llms-full.txt`, the page search) and every entry (the
 * sitemap and `/llms.txt`). Front-matter parsing, ordering and slug derivation
 * stay inside the implementation, where the directory walk lives.
 */
/**
 * A single markdown file resolved from a `contentDir` page.
 */
export interface ContentDirEntry {
  /** URL slug derived from the file per `slugFrom` (e.g. `getting-started`). */
  readonly slug: string
  /** Frontmatter `title`, or the slug when no title is declared. */
  readonly title: string
  /** Frontmatter `section`/`category` group, when present. */
  readonly section: string | undefined
  /**
   * Group key resolved from `contentDir.nav.groupBy` (falling back to
   * `section`/`category`), when present. Drives the H2 sections in `/llms.txt`.
   */
  readonly group: string | undefined
  /** Frontmatter `description`, when present. */
  readonly description: string | undefined
  /** Resolved page URL (route prefix + slug, e.g. `/docs/getting-started`). */
  readonly path: string
  /** The source file's modification time — the sitemap's `<lastmod>`. */
  readonly modifiedAt?: Date
  /**
   * The article's own `access`, from its front matter. Absent means
   * the article follows its page alone; a public artefact skips any other.
   */
  readonly access?: PageAccess
}

/**
 * A markdown file's resolved metadata paired with its full markdown body
 * (frontmatter stripped). Consumed by the `/llms-full.txt` generator,
 * the page search and the Markdown twins.
 */
export interface ContentDirBody {
  /** The entry metadata (slug, title, group, path, …). */
  readonly entry: ContentDirEntry
  /** The markdown body with the YAML frontmatter block removed. */
  readonly body: string
}

export class ContentDirReader extends Context.Service<
  ContentDirReader,
  {
    /**
     * The raw markdown body of the file this `contentDir` derives `slug` from,
     * or `undefined` when no file in the directory derives it.
     *
     * FRONT MATTER IS STRIPPED; the body is what remains. The export surface
     * serves the prose a reader asked for, not the page's internal metadata —
     * except the article's own `access`, returned beside the body so
     * the route can ask the router's question of it for the caller.
     *
     * A miss and an empty directory are the same answer, which is what lets the
     * route answer 404 without distinguishing "this slug is wrong" from "the
     * directory is not there" — the second would tell an anonymous caller
     * something about the deployment's filesystem.
     */
    readonly readBodyForSlug: (
      contentDir: Readonly<ContentDir>,
      slug: string
    ) => Effect.Effect<ContentDirArticleBody | undefined, ContentDirReadError>

    /**
     * A checksum over the CURRENT on-disk state of this `contentDir`.
     *
     * The second key dimension of a `'content'` page's cache entry
     * Such a page is corpus-invariant rather than
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

    /**
     * Every included article of this `contentDir` with its body (front matter
     * stripped), in `contentDir.sort` order, its URL resolved against
     * `pagePath`. Empty when the directory is missing or empty.
     */
    readonly readBodies: (
      contentDir: Readonly<ContentDir>,
      pagePath: string
    ) => Effect.Effect<readonly ContentDirBody[], ContentDirReadError>

    /**
     * Every included article of this `contentDir` as metadata only (no body),
     * in `contentDir.sort` order, its URL resolved against `pagePath`. Empty
     * when the directory is missing or empty.
     *
     * The read behind `/sitemap.xml` and `/llms.txt`: both list the articles
     * and neither needs their prose, so they ask for the entries rather than
     * paying for every body.
     */
    readonly enumerate: (
      contentDir: Readonly<ContentDir>,
      pagePath: string
    ) => Effect.Effect<readonly ContentDirEntry[], ContentDirReadError>
  }
>()('ContentDirReader') {}
