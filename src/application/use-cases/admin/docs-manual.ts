/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * THE MANUAL AS A WHOLE — the table of contents, one section, one article, and
 * the corpus `--full` concatenates.
 *
 * Beside `docs-markdown.ts`, which renders ONE article's markdown. This module
 * is the level above it: what the manual contains, in what order, and how a
 * reader addresses a piece of it.
 *
 * ─── THE SECTION REGISTRY IS AN ARGUMENT, NOT AN IMPORT ────────────────────
 *
 * `src/docs/sections/` is DATA — typed manifests and prose — and the verb that
 * reads it hands it here. Importing it instead would make this module's cost
 * the registry's cost, and the registry pulls in every schema the manual
 * documents; `embedded-docs-boot.test.ts` asserts a real boot loads none of it.
 * So the input is a structural type this module declares, which a `DocSection`
 * satisfies without either side naming the other.
 *
 * ─── BODIES ARE READ BY THE CALLER ─────────────────────────────────────────
 *
 * Every function here is pure and synchronous. The fragment text arrives as a
 * string the caller already read from the embedded payload, because the read is
 * the one part that differs between dev (a real path) and the compiled binary
 * (a `$bunfs` path) — and a projection that could not be tested without a
 * filesystem is a projection nobody tests.
 */

import { astOf } from '@/domain/models/app/design/type-introspection'
import { directiveIdentifiers, renderArticle } from './docs-markdown'
import type { BehaviourStory, DirectiveRegistry } from './docs-markdown'
import type { SchemaNode } from '@/domain/models/app/design/type-introspection'

/** One article, as a section manifest declares it. */
export interface ManualArticle {
  readonly slug: string
  readonly title: string
  readonly description: string
  readonly keywords: readonly string[]
  readonly order: number
  readonly sidebarLabel: string
  /** Repo-relative path to the fragment, as the embedded payload keys it. */
  readonly body: string
  /** The schemas this article's directives name, in directive order. */
  readonly documents: readonly unknown[]
  readonly stories: readonly string[]
}

/** One section of the manual. */
export interface ManualSection {
  readonly slug: string
  readonly title: string
  readonly order: number
  readonly tab: string
  readonly articles: readonly ManualArticle[]
}

/** An article together with the section a reader reaches it through. */
export interface LocatedArticle {
  readonly section: ManualSection
  readonly article: ManualArticle
}

/** `app-schema/llms-txt` — how every article is addressed and printed. */
export const articleAddress = (located: LocatedArticle): string =>
  `${located.section.slug}/${located.article.slug}`

/**
 * Every article, section order then article order.
 *
 * Sorted rather than taken in declaration order, because `--full` must be a
 * pure function of the binary: two runs produce identical bytes only if the
 * iteration cannot depend on how a manifest array happened to be written.
 */
export const locatedArticles = (sections: readonly ManualSection[]): readonly LocatedArticle[] =>
  sections
    .toSorted((left, right) => left.order - right.order)
    .flatMap((section) =>
      section.articles
        .toSorted((left, right) => left.order - right.order)
        .map((article) => ({ section, article }))
    )

/** The section a slug names, or `undefined`. */
export const findSection = (
  sections: readonly ManualSection[],
  slug: string
): ManualSection | undefined => sections.find((section) => section.slug === slug)

/**
 * The article an address names.
 *
 * Both `section/slug` and a bare `slug` resolve, because an article slug is
 * unique across the whole manual (asserted in `docs-structure.test.ts`) and a
 * reader who has just seen `llms-txt` in a search result should not have to
 * look up which section it lives in to read it.
 */
export const findArticle = (
  sections: readonly ManualSection[],
  address: string
): LocatedArticle | undefined => {
  const [head, ...rest] = address.split('/')
  const slug = rest.length === 0 ? head : rest.join('/')
  return locatedArticles(sections).find(
    (located) =>
      located.article.slug === slug && (rest.length === 0 || located.section.slug === head)
  )
}

/**
 * The directive registry for one article: its fragment's names, its manifest's
 * schemas, paired by POSITION.
 *
 * Position is the only thing connecting them, and it is what
 * `docs-structure.test.ts` asserts from the other end — one `documents` entry
 * per directive, in order. A value that is not a schema contributes no entry,
 * so the directive naming it is refused by name rather than expanded from
 * nothing.
 */
export const directiveRegistryFor = (article: ManualArticle, body: string): DirectiveRegistry =>
  Object.fromEntries(
    directiveIdentifiers(body).flatMap((identifier, index): readonly [string, SchemaNode][] => {
      const node = astOf(article.documents[index])
      return node === undefined ? [] : [[identifier, node]]
    })
  )

/**
 * A fragment with its own opening H1 and summary blockquote removed.
 *
 * Every fragment opens with them, because a fragment is also a file somebody
 * reads on disk and a markdown file with no heading reads as an orphan. The
 * MANIFEST carries the same two strings, and they are the ones the manual is
 * indexed, searched and rendered by — so the rendered article would otherwise
 * open with the title and the summary TWICE, which is what this removes.
 *
 * Conservative by construction: only a heading on the very first non-blank
 * line is taken, and only the blockquote immediately under it. A fragment that
 * opens with prose keeps every byte.
 */
const withoutLeadingHeading = (body: string): string => {
  const lines = body.split('\n')
  const start = lines.findIndex((line) => line.trim() !== '')
  if (start === -1 || !(lines[start] ?? '').startsWith('# ')) return body

  const afterHeading = lines.slice(start + 1)
  const summaryStart = afterHeading.findIndex((line) => line.trim() !== '')
  const isSummary = summaryStart !== -1 && (afterHeading[summaryStart] ?? '').startsWith('> ')
  const summaryEnd = isSummary
    ? afterHeading.findIndex((line, index) => index > summaryStart && !line.startsWith('> '))
    : 0
  return afterHeading.slice(isSummary ? Math.max(summaryEnd, 0) : 0).join('\n')
}

/**
 * The key the embedded payload files a fragment under.
 *
 * A manifest's `body` is an absolute path in dev and a `/$bunfs/…` one in the
 * compiled binary, while the payload is keyed by the REPO-RELATIVE path. The
 * cut is at the LAST `/src/` — the same recovery `docs-structure.test.ts`
 * makes, and for the same reason it cuts there rather than at a layer name: a
 * CLI fragment's path contains no layer word at all.
 *
 * That cut recovers the key in dev ONLY, and the `/$bunfs/…` half of the line
 * above is the reason: such a path carries no directory, so it holds no `/src/`
 * to cut at and the `body` comes back unchanged. That is correct rather than a
 * failure — inside the binary the raw path IS the value the payload files the
 * fragment under, because two imports of one file share one `$bunfs` name. So
 * `readEmbeddedDoc` accepts BOTH forms, resolving the second by a reverse
 * lookup over the payload, and this function deliberately does not know which
 * runtime it is in.
 *
 * It lives here rather than in either caller because there are now TWO of them,
 * the `docs` verb and the website generator, and a second copy of this
 * three-line rule is how the two would come to disagree about which fragment an
 * article renders — silently, since both copies would still resolve SOMETHING.
 */
export const embeddedDocKey = (body: string): string => {
  const index = body.lastIndexOf('/src/')
  return index === -1 ? body : body.slice(index + 1)
}

/**
 * Render one article: its prose, its expanded tables, its Behaviour block.
 *
 * @throws UnknownDocsDirectiveError / EmptyDocsDirectiveError - from the engine,
 *   when the fragment and its manifest have come apart.
 */
export const renderManualArticle = (input: {
  readonly article: ManualArticle
  readonly body: string
  readonly behaviour: readonly BehaviourStory[]
}): string =>
  renderArticle({
    title: input.article.title,
    description: input.article.description,
    body: withoutLeadingHeading(input.body),
    // The registry is paired against the ORIGINAL body: stripping a heading
    // cannot change a directive's position, but pairing against the same text
    // the manifest's author counted is the invariant, not an optimisation.
    registry: directiveRegistryFor(input.article, input.body),
    behaviour: input.behaviour,
  })

// =============================================================================
// Indexes
// =============================================================================

/** One section's heading line in the table of contents. */
const tocSectionLines = (section: ManualSection): readonly string[] => [
  '',
  `## ${section.title} — \`${section.slug}\` (${section.articles.length} article(s))`,
  '',
  ...section.articles
    .toSorted((left, right) => left.order - right.order)
    .map((article) => `- \`${section.slug}/${article.slug}\` — ${article.description}`),
]

/**
 * The table of contents — every section, every article, one line each.
 *
 * The ENTRY POINT an agent reads first, so it carries the address to type next
 * to each description rather than only the title: a reader who has to guess the
 * address from a title guesses wrong, and an unknown address is a refusal.
 */
export const renderTableOfContents = (sections: readonly ManualSection[]): string =>
  [
    '# Sovrium — the platform manual',
    '',
    '> Read one article with `sovrium docs <section>/<slug>`, find one with',
    '> `sovrium docs search <query>`, look one option up with',
    '> `sovrium docs config <path>`.',
    ...sections
      .toSorted((left, right) => left.order - right.order)
      .flatMap((section) => tocSectionLines(section)),
    '',
  ].join('\n')

/** One section's own index: its articles and what each covers. */
export const renderSectionIndex = (section: ManualSection): string =>
  [
    `# ${section.title}`,
    '',
    `> \`${section.slug}\` — ${section.articles.length} article(s). Read one with`,
    `> \`sovrium docs ${section.slug}/<slug>\`.`,
    ...section.articles
      .toSorted((left, right) => left.order - right.order)
      .flatMap((article) => [
        '',
        `## ${article.title}`,
        '',
        `\`${section.slug}/${article.slug}\` — ${article.description}`,
      ]),
    '',
  ].join('\n')

/**
 * The llms.txt-shaped index: one H1, one blockquote, a list per section.
 *
 * The SHAPE of llmstxt.org rather than its link semantics — the addresses are
 * commands rather than URLs, because the corpus this indexes has no server in
 * front of it. Reserved for `--format llms` without `--full`; with `--full` the
 * same flag prints the concatenated corpus, which is the llms-full half.
 */
export const renderLlmsIndex = (sections: readonly ManualSection[]): string =>
  [
    '# Sovrium',
    '',
    '> The platform manual, shipped inside the binary. Every address below is a',
    '> `sovrium docs <address>` argument.',
    ...sections
      .toSorted((left, right) => left.order - right.order)
      .flatMap((section) => [
        '',
        `## ${section.title}`,
        '',
        ...section.articles
          .toSorted((left, right) => left.order - right.order)
          .map(
            (article) =>
              `- [${article.title}](${section.slug}/${article.slug}): ${article.description}`
          ),
      ]),
    '',
  ].join('\n')
