/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The manual, rendered into the shape a documentation SITE reads.
 *
 * ## One code path, two callers
 *
 * `sovrium docs --export <dir>` writes this into a consumer repository from the
 * compiled binary; `scripts/build/generate-website-docs.ts` writes it into
 * `apps/website/content/docs/en/` from the source tree. Both call
 * {@link renderSiteArticles}, so the two trees cannot disagree — a site that
 * leaves this repository switches to the binary with a zero-line diff.
 *
 * The rendered article differs from `sovrium docs <address>` in exactly ONE way:
 * a six-key frontmatter block is prepended, and links a website cannot follow
 * are flattened to their words. The body is otherwise byte-identical.
 *
 * ## The payload is a PARAMETER
 *
 * The fragments live in an embedded payload the infrastructure layer owns, and
 * an application module may not reach infrastructure for behaviour. So the
 * reader is handed in as {@link DocsPayloadReader} — the CLI and the script
 * each pass the same two functions from `embedded-docs`, and a test can pass
 * two literals.
 *
 * ### Cross-references are refused, not rewritten
 *
 * A hand-written fragment carrying a link the site could not resolve — a
 * relative path, a `.md`/`.ts` target, a source path — is REFUSED by
 * {@link assertFragmentLinks}. There is no cross-reference in the corpus, so a
 * rewriter would be a guess about a convention nobody has chosen; the refusal
 * makes the day someone writes the first one the day the convention is
 * designed. The two halves a fragment author does NOT control — the option
 * tables expanded from annotations and the Behaviour block rendered from
 * acceptance criteria — are flattened by {@link flattenUnresolvableLinks}
 * instead, keeping the words and dropping the dead target.
 */

import { Data, Effect } from 'effect'
import { markdownSegments, proseOf } from '@/domain/kernel/markdown/markdown-segments'
import { articleAddress, embeddedDocKey, locatedArticles, renderManualArticle } from './docs-manual'
import type { LocatedArticle, ManualSection } from './docs-manual'
import type { BehaviourStory } from './docs-markdown'

/**
 * Articles about the PROJECT rather than the software.
 *
 * The licence, the trademark, how to contribute and how Sovrium is built. None
 * of it is a property of the running binary, so none of it is in the manual:
 * a site authors these beside the exported ones, and an export never owns them.
 */
export const PROJECT_ARTICLES: readonly string[] = [
  'contributing',
  'how-sovrium-is-built',
  'license',
  'trademark',
]

/** The manifest an export writes beside its articles. */
export const EXPORT_MANIFEST_FILE = '_nav.json'

/** The two reads a render needs from the embedded payload. */
export interface DocsPayloadReader {
  /** The fragment a payload key names. */
  readonly readFragment: (key: string) => Promise<string>
  /** The acceptance criteria an article's Behaviour block lists. */
  readonly behaviourFor: (slug: string) => readonly BehaviourStory[]
}

/** An article that could not be rendered, carrying the address it failed on. */
export class DocsSiteRenderError extends Data.TaggedError('DocsSiteRenderError')<{
  readonly address: string
  readonly cause: unknown
}> {}

// =============================================================================
// Frontmatter
// =============================================================================

/**
 * The six keys a docs zone reads, in the order the corpus already uses.
 *
 * Grouped by `section`, sorted by `order`, labelled from `sidebarLabel`, and
 * `title`/`description`/`keywords` for SEO. A seventh key would be dead weight;
 * a missing one is a silently unlabelled sidebar entry.
 */
export interface Frontmatter {
  readonly title: string
  readonly description: string
  readonly keywords: string
  readonly section: string
  readonly order: number
  readonly sidebarLabel: string
}

/**
 * Whether a plain YAML scalar would be misread, by YAML or by Sovrium's own
 * splitter.
 *
 * Two readers, two different rules, and the emitter has to satisfy both.
 * `splitFrontmatter` splits on the FIRST colon and strips one leading and one
 * trailing quote character, so it tolerates `a: b: c`; strict YAML does not,
 * and the published tree is also read by GitHub. So the stricter rule wins.
 */
const needsQuoting = (value: string): boolean =>
  value === '' ||
  value !== value.trim() ||
  /^[-?:,[\]{}#&*!|>'"%@`]/.test(value) ||
  /:(\s|$)/.test(value) ||
  /\s#/.test(value)

/**
 * One frontmatter value, quoted only when it has to be.
 *
 * REFUSES rather than escaping. `splitFrontmatter` strips the outer quote pair
 * and performs no unescaping at all, so a `''` or a `\"` inside a quoted value
 * would survive into the parsed string and reach the page title. A value that
 * needs quoting and contains both quote characters cannot be emitted safely by
 * either strategy — and a mangled `<title>` is worse than a failed build a
 * human can fix in the annotation it came from.
 */
export const yamlScalar = (key: string, value: string): string => {
  if (!needsQuoting(value)) return `${key}: ${value}`
  if (!value.includes("'")) return `${key}: '${value}'`
  if (!value.includes('"') && !value.includes('\\')) return `${key}: "${value}"`
  // eslint-disable-next-line functional/no-throw-statements -- a pure renderer's refusal; the use-case below turns it into a typed failure
  throw new Error(
    `Cannot emit frontmatter "${key}" safely: the value needs quoting and contains both quote ` +
      `characters.\n  Value: ${value}\n  Reword the manifest entry — the frontmatter parser ` +
      'strips the outer quotes without unescaping, so no escaping strategy survives it.'
  )
}

/** The frontmatter block, fences included, ending in a blank line. */
export const renderFrontmatter = (front: Frontmatter): string =>
  [
    '---',
    yamlScalar('title', front.title),
    yamlScalar('description', front.description),
    yamlScalar('keywords', front.keywords),
    yamlScalar('section', front.section),
    `order: ${front.order}`,
    yamlScalar('sidebarLabel', front.sidebarLabel),
    '---',
    '',
    '',
  ].join('\n')

// =============================================================================
// Links
// =============================================================================

const MARKDOWN_LINK = /\[[^\]]*\]\(([^)\s]+)[^)]*\)/g

/**
 * A link target a docs site can actually resolve.
 *
 * An in-page anchor, an absolute URL, a mail link, or a site-root path. A
 * RELATIVE path is the one that cannot work: a fragment sits beside the code it
 * documents, the article sits at `/{lang}/docs/<slug>`, and nothing maps one
 * onto the other. `.md` and `.ts` targets are the same defect in another
 * spelling.
 */
const isWebResolvable = (target: string): boolean =>
  target.startsWith('#') ||
  target.startsWith('/') ||
  /^(https?|mailto):/.test(target) ||
  target.startsWith('data:')

/**
 * Every link target in a piece of markdown that a site could not follow.
 *
 * Reads PROSE only: link syntax quoted inside a code span or a fenced block is
 * a specimen being documented, not a link anyone can click.
 */
export const unresolvableTargets = (markdown: string): readonly string[] =>
  proseOf(markdown)
    .flatMap((prose) => [...prose.matchAll(MARKDOWN_LINK)])
    .map((match) => match[1] ?? '')
    .filter((target) => !isWebResolvable(target))

/**
 * Refuse a FRAGMENT that carries a link a site could not follow.
 *
 * Scoped to the hand-written fragment, which is clean today — so the guard is
 * live rather than aspirational.
 */
export const assertFragmentLinks = (address: string, fragment: string): void => {
  const bad = unresolvableTargets(fragment)
  if (bad.length === 0) return
  // eslint-disable-next-line functional/no-throw-statements -- a pure renderer's refusal; the use-case below turns it into a typed failure
  throw new Error(
    `Fragment for "${address}" carries ${bad.length} link target(s) the website cannot resolve: ` +
      `${bad.join(', ')}.\n  A fragment may link to an anchor, an absolute URL or a site-root ` +
      'path. A relative or source-file target has no meaning at /{lang}/docs/<slug> — either ' +
      'make it a `/en/docs/<slug>` link or name the article in prose.'
  )
}

/**
 * Turn `[text](unresolvable)` into `text`, keeping the words and dropping the
 * dead link.
 *
 * For the option tables and the Behaviour block, which a fragment author does
 * not write and which were written for readers inside the repository. Rewrites
 * PROSE only: a code span or a fenced block is reassembled verbatim — quoting
 * `[a](b.md)` to document the syntax is not a dead link, and flattening it
 * corrupts the very thing being described.
 */
export const flattenUnresolvableLinks = (markdown: string): string =>
  markdownSegments(markdown)
    .map((segment) =>
      segment.kind === 'code'
        ? segment.text
        : segment.text.replaceAll(MARKDOWN_LINK, (whole, target: string) =>
            isWebResolvable(target) ? whole : (/\[([^\]]*)\]/.exec(whole)?.[1] ?? whole)
          )
    )
    .join('')

// =============================================================================
// Rendering
// =============================================================================

/**
 * How many articles render at once. Each render is one payload read and a
 * string transform, so the ceiling is about bounding open reads, not speed —
 * the whole manual renders in well under a second either way.
 */
const RENDER_CONCURRENCY = 8

/** One article, as a site file: its name, its bytes, and what was flattened. */
export interface SiteArticle {
  readonly slug: string
  /** `<slug>.md` — the file name, relative to the tree it is written into. */
  readonly file: string
  readonly content: string
  /** Link targets flattened out of the tables and the Behaviour block. */
  readonly flattened: readonly string[]
}

/** Render one located article into its site file. */
const renderOne = async (
  located: LocatedArticle,
  payload: DocsPayloadReader
): Promise<SiteArticle> => {
  const { article, section } = located
  const fragment = await payload.readFragment(embeddedDocKey(article.body))
  assertFragmentLinks(articleAddress(located), fragment)
  const rendered = renderManualArticle({
    article,
    body: fragment,
    behaviour: payload.behaviourFor(article.slug),
  })
  return {
    slug: article.slug,
    file: `${article.slug}.md`,
    flattened: unresolvableTargets(rendered),
    content:
      renderFrontmatter({
        title: article.title,
        description: article.description,
        keywords: article.keywords.join(', '),
        section: section.slug,
        order: article.order,
        sidebarLabel: article.sidebarLabel,
      }) + flattenUnresolvableLinks(rendered),
  }
}

/**
 * Every article the manual publishes, rendered, sorted by slug.
 *
 * Sorted by SLUG rather than by walk order: the output is a directory, and a
 * directory has no order — sorting makes every report built on it stable
 * regardless of how the manifests happen to be arranged.
 */
export const renderSiteArticles = (
  sections: readonly ManualSection[],
  payload: DocsPayloadReader
): Effect.Effect<readonly SiteArticle[], DocsSiteRenderError> =>
  Effect.forEach(
    locatedArticles(sections),
    (located) =>
      Effect.tryPromise({
        try: () => renderOne(located, payload),
        catch: (cause) => new DocsSiteRenderError({ address: articleAddress(located), cause }),
      }),
    { concurrency: RENDER_CONCURRENCY }
  ).pipe(
    Effect.map((articles) =>
      articles.toSorted((left, right) => left.slug.localeCompare(right.slug))
    ),
    Effect.withSpan('admin.render-site-articles')
  )

// =============================================================================
// The export manifest
// =============================================================================

/**
 * `_nav.json` — what a sidebar needs without re-reading the articles.
 *
 * Sections in manual reading order, articles in section order, tabs in
 * first-appearance order, `files` sorted. Deliberately free of anything a run
 * could vary: no timestamp, no absolute path, so two exports from one binary
 * are byte-identical. Labels, icons and landing paths are the site's copy and
 * are not in it.
 */
export const renderExportManifest = (input: {
  readonly sections: readonly ManualSection[]
  readonly files: readonly string[]
  readonly engine: string
}): string => {
  const ordered = input.sections.toSorted((left, right) => left.order - right.order)
  const manifest = {
    format: 'sovrium-docs-export',
    schemaVersion: 1,
    engine: input.engine,
    lang: 'en',
    tabs: [...new Set(ordered.map((section) => section.tab))],
    sections: ordered.map((section) => ({
      slug: section.slug,
      title: section.title,
      tab: section.tab,
      order: section.order,
      articles: section.articles
        .toSorted((left, right) => left.order - right.order)
        .map((article) => ({
          slug: article.slug,
          title: article.title,
          sidebarLabel: article.sidebarLabel,
          order: article.order,
          file: `${article.slug}.md`,
        })),
    })),
    files: input.files.toSorted(),
  }
  return `${JSON.stringify(manifest, undefined, 2)}\n`
}

/**
 * Whether a manifest `files` entry names a plain file directly inside the
 * export directory.
 *
 * `--force` deletes what the previous manifest lists, and a manifest is a file
 * anyone can edit — so this is the line between "replace my export" and
 * "delete an arbitrary path". A separator of either kind, a parent or self
 * reference, or a NUL byte names something other than a sibling file, and is
 * never honoured. An absolute path always carries a separator, so it falls
 * under the same rule.
 */
export const isPlainExportFileName = (name: unknown): name is string =>
  typeof name === 'string' &&
  name !== '' &&
  name !== '.' &&
  name !== '..' &&
  !name.includes('/') &&
  !name.includes('\\') &&
  !name.includes('\0')

/**
 * The files a previous export owns, read from its parsed manifest.
 *
 * Anything that is not an object with a `files` array owns nothing, and every
 * entry is filtered through {@link isPlainExportFileName}.
 */
export const ownedExportFiles = (manifest: unknown): readonly string[] => {
  const files =
    typeof manifest === 'object' && manifest !== null && 'files' in manifest ? manifest.files : []
  return Array.isArray(files) ? files.filter(isPlainExportFileName) : []
}

/** One file an export writes: its name inside the target, and its bytes. */
export interface ExportFile {
  readonly file: string
  readonly content: string
}

/**
 * The whole export — every article plus the manifest that indexes them.
 *
 * Rendered in full BEFORE anything touches the disk, which is what lets the
 * caller promise that a failed or refused run wrote nothing.
 */
export const renderDocsExport = (input: {
  readonly sections: readonly ManualSection[]
  readonly payload: DocsPayloadReader
  readonly engine: string
}): Effect.Effect<readonly ExportFile[], DocsSiteRenderError> =>
  renderSiteArticles(input.sections, input.payload).pipe(
    Effect.map((articles) => {
      const files = articles.map((article) => ({ file: article.file, content: article.content }))
      const manifest = renderExportManifest({
        sections: input.sections,
        files: files.map((entry) => entry.file),
        engine: input.engine,
      })
      return [...files, { file: EXPORT_MANIFEST_FILE, content: manifest }]
    }),
    Effect.withSpan('admin.render-docs-export')
  )
