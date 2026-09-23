#!/usr/bin/env bun
/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Render the binary's manual into the website's English documentation tree.
 *
 * ## Why this exists
 *
 * Until [internal ref] the platform documentation was authored twice: once as prose
 * under `apps/website/content/docs/en/` and once, implicitly, as the schema
 * annotations, JSDoc and user stories that described the same options. The two
 * drifted in the only direction they could — the website kept a stale copy of
 * whatever the code used to do — and the C5 harvest measured it: the published
 * security article keyed CSRF on `NODE_ENV` where the engine keys it on
 * transport posture, the migrations article promised three flags that dispatch
 * nowhere, the field-type counts were a version behind.
 *
 * So the website's English tree stops being a source and becomes an OUTPUT.
 * The manual inside the binary is the one copy; this renders it into the shape
 * the docs zone reads, and `Docs Payload Drift` byte-compares the result.
 *
 * ## It runs the `docs` verb's own code path, in process
 *
 * `renderManualArticle` — the same function `sovrium docs <address>` calls —
 * over the same `EMBEDDED_DOCS` payload, reached through the same
 * `embeddedDocKey`. Shelling out to the CLI would be the other way to get one
 * code path, and it would cost a process per article and lose every typed
 * error the renderer raises; importing the renderer keeps the guarantee and
 * the diagnostics.
 *
 * The generated markdown therefore differs from `sovrium docs <address>` in
 * exactly ONE way: a website frontmatter block is prepended. The body is
 * byte-identical. That is worth stating precisely, because the obvious
 * expectation is the opposite — the CLI's own `sovrium docs …` hints live in
 * the table of contents, the section index and the llms index, none of which
 * the website consumes, so no hint has to be stripped from an article.
 *
 * ### Cross-references are not rewritten, because there are none
 *
 * Measured at the time of writing: ONE markdown link across all 223 fragments,
 * and it is external (`https://llmstxt.org`). A link rewriter would therefore
 * be speculative code with no input. What is here instead is
 * {@link assertFragmentLinks}, which REFUSES a link the website could not
 * resolve — a relative path, a `.md`/`.ts` target, a source path. The day a
 * fragment gains a cross-reference this fails loudly rather than publishing a
 * dead link, and the rewriter is written then, against a real case.
 *
 * The two halves this campaign does NOT author — the option tables expanded
 * from annotations, and the Behaviour block rendered from acceptance-criteria
 * cells — get {@link flattenUnresolvableLinks} instead, which keeps the words
 * and drops the dead target. Thirteen criteria link at a relative path today;
 * blocking a phase on another agent's cells would be worse, and so would
 * publishing the 404.
 *
 * ## Two allow-lists, and they are not the same kind of thing
 *
 * {@link PROJECT_ARTICLES} is permanent: the four articles about the PROJECT
 * rather than the software (licence, trademark, contributing, how it is built)
 * stay on the website by founder decision — they are not in the binary and
 * never will be.
 *
 * {@link PENDING_FRAGMENT_ARTICLES} is temporary and each row carries its exit
 * condition. These are articles whose fragment has not been written yet;
 * deleting them would delete live documentation of shipped behaviour to make
 * room for nothing. `Docs Payload Drift` FAILS when a pending slug becomes a
 * registered article, which is what stops the list outliving its reason.
 *
 * Everything else that is not produced by a registered article is DELETED.
 * That is the whole point: a file nobody generates is a file nobody maintains.
 *
 * ## What it also emits
 *
 * `apps/website/config/pages/docs/_docs-nav.generated.ts` — the section list
 * and its registry tab, so the docs zone's sidebar IA stops being 38 section
 * slugs hand-copied out of the manifests. Labels, icons and landing paths stay
 * AUTHORED in `markdown.ts`; only membership and order are derived.
 *
 * Usage:
 *   bun run build:website-docs          # write
 *   bun run build:website-docs --check  # report staleness, write nothing
 */

import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  articleAddress,
  embeddedDocKey,
  locatedArticles,
  renderManualArticle,
} from '@/application/use-cases/admin/docs-manual'
import { SECTIONS } from '@/docs/sections'
import { embeddedBehaviourFor, readEmbeddedDoc } from '@/infrastructure/assets/embedded-docs'
import { printJournal, printStderr } from '@/infrastructure/logging/cli-output'
import { markdownSegments, proseOf } from '../lib/markdown-segments'
import type { LocatedArticle } from '@/application/use-cases/admin/docs-manual'

export const REPO_ROOT = resolve(import.meta.dir, '..', '..')

/** The generated tree. Repo-relative; FR is authored and never touched. */
export const EN_DOCS_DIR = 'apps/website/content/docs/en'

/** The derived sidebar IA the docs page config composes with authored labels. */
export const NAV_MODULE = 'apps/website/config/pages/docs/_docs-nav.generated.ts'

/** The command a human runs to resolve a `Docs Payload Drift` finding. */
export const FIX_COMMAND = 'bun run build:website-docs'

/**
 * Articles about the PROJECT rather than the software.
 *
 * Founder decision, recorded in [internal ref]: these describe the licence, the
 * trademark, how to contribute and how Sovrium is built. None of it is a
 * property of the running binary, so none of it belongs in a manual the binary
 * prints. They are authored, and this generator leaves them alone.
 */
export const PROJECT_ARTICLES: readonly string[] = [
  'contributing',
  'how-sovrium-is-built',
  'license',
  'trademark',
]

/**
 * Articles still authored on the website because their fragment does not exist.
 *
 * Each row names its owner and the condition that retires it. This list is the
 * one place the "the website is generated" claim is qualified, so it says so
 * out loud rather than letting five admin articles look like an oversight.
 *
 * `Docs Payload Drift` fails when a slug here is ALSO produced by a registered
 * article: at that moment the fragment exists, the authored copy is a second
 * source, and the row has to go.
 */
export const PENDING_FRAGMENT_ARTICLES: readonly {
  readonly slug: string
  readonly until: string
}[] = [
  // The operator console's five articles left this list in Phase 5 of the
  // documentation plan, when each was written as a fragment beside the thing it
  // documents and the `admin` section was registered. The list is EMPTY, and
  // that is its finished state rather than a gap: every article the website
  // publishes is now either generated from the manual or in
  // {@link PROJECT_ARTICLES}. Anything added here again owes a named owner and
  // an exit condition in the same commit.
]

/** Every slug this generator must find on disk and must not produce. */
const authoredSlugs = (): readonly string[] =>
  [...PROJECT_ARTICLES, ...PENDING_FRAGMENT_ARTICLES.map((row) => row.slug)].toSorted()

// =============================================================================
// Frontmatter
// =============================================================================

/**
 * The six keys the docs zone reads, in the order the corpus already uses.
 *
 * `markdown-page-resolver` groups by `section`, sorts by `order`, labels the
 * sidebar from `sidebarLabel` and synthesises SEO from `title`/`description`/
 * `keywords`. A seventh key would be dead weight, and a missing one is a
 * silently unlabelled sidebar entry.
 */
interface Frontmatter {
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
 * and the published tree is also read by GitHub on the public mirror. So the
 * stricter rule wins.
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
 * needs quoting and contains both quote characters therefore cannot be emitted
 * safely by either strategy — and shipping a mangled `<title>` is worse than
 * failing a build a human can fix in the annotation it came from.
 */
export const yamlScalar = (key: string, value: string): string => {
  if (!needsQuoting(value)) return `${key}: ${value}`
  if (!value.includes("'")) return `${key}: '${value}'`
  if (!value.includes('"') && !value.includes('\\')) return `${key}: "${value}"`
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
 * A link target the docs zone can actually resolve.
 *
 * An in-page anchor, an absolute URL, a mail link, or a site-root path. A
 * RELATIVE path is the one that cannot work: a fragment sits beside the code it
 * documents, the article sits at `/{lang}/docs/<slug>`, and nothing maps one
 * onto the other. `.md` and `.ts` targets are the same defect wearing a
 * different spelling.
 */
const isWebResolvable = (target: string): boolean =>
  target.startsWith('#') ||
  target.startsWith('/') ||
  /^(https?|mailto):/.test(target) ||
  target.startsWith('data:')

/**
 * Every link target in a piece of markdown that the website could not follow.
 *
 * Reads PROSE only: link syntax quoted inside a code span or a fenced block is
 * a specimen being documented, not a link anyone can click. See
 * {@link markdownSegments}, in `[internal ref]` — shared with
 * `check-docs-links.ts`, which needs the same distinction.
 */
export const unresolvableTargets = (markdown: string): readonly string[] =>
  proseOf(markdown)
    .flatMap((prose) => [...prose.matchAll(MARKDOWN_LINK)])
    .map((match) => match[1] ?? '')
    .filter((target) => !isWebResolvable(target))

/**
 * Refuse a FRAGMENT that carries a link the website could not follow.
 *
 * Scoped to the hand-written fragment, which is the half [internal ref] put under this
 * campaign's control and which is clean today — so the guard is live rather
 * than aspirational. Deliberately a refusal rather than a rewrite: there is no
 * cross-reference in the corpus, so a rewriter would be a guess about a
 * convention nobody has chosen. This makes the day someone writes the first one
 * the day the convention gets designed, instead of the day a reader hits a 404.
 */
export const assertFragmentLinks = (address: string, fragment: string): void => {
  const bad = unresolvableTargets(fragment)
  if (bad.length === 0) return
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
 * For the two halves of an article this campaign does NOT author: the option
 * tables, expanded from schema annotations, and the Behaviour block, rendered
 * from acceptance-criteria cells in `[internal ref]`. Both belong to
 * `[internal ref]`, and both were written for readers inside the
 * repository — measured at the time of writing, 13 criteria link at a relative
 * `index.md#…` or `../../decisions/…` path, which resolves to a 404 under
 * `/en/docs/<slug>` and resolved to nothing at all in `sovrium docs`.
 *
 * Flattened rather than refused, because refusing would block a whole phase on
 * twenty-seven cells in another agent's tree; flattened rather than left alone,
 * because a 404 in published documentation is not an acceptable default. The
 * count is printed in the drift gate's census, so it is a visible backlog that
 * drains to zero rather than a silent rewrite.
 *
 * Rewrites PROSE only. A code span or a fenced block is reassembled verbatim —
 * quoting `[a](b.md)` to document the syntax is not a dead link, and flattening
 * it corrupts the very thing the criterion is describing.
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

/** One file this generator owns: where it goes and what it holds. */
export interface GeneratedArticle {
  readonly slug: string
  readonly path: string
  readonly content: string
  /** Link targets flattened out of the tables and the Behaviour block. */
  readonly flattened: readonly string[]
}

/** Render one located article into its website file. */
const renderOne = async (located: LocatedArticle): Promise<GeneratedArticle> => {
  const { article, section } = located
  const fragment = await readEmbeddedDoc(embeddedDocKey(article.body))
  assertFragmentLinks(articleAddress(located), fragment)
  const rendered = renderManualArticle({
    article,
    body: fragment,
    behaviour: embeddedBehaviourFor(article.slug),
  })
  return {
    slug: article.slug,
    path: `${EN_DOCS_DIR}/${article.slug}.md`,
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
 * Every article the manual publishes, rendered, sorted by file name.
 *
 * Sorted by SLUG rather than by walk order: the output is a directory, and a
 * directory has no order — sorting by slug makes the census line and the drift
 * report stable regardless of how the manifests happen to be arranged.
 */
export const renderWebsiteArticles = async (
  sections: readonly (typeof SECTIONS)[number][] = SECTIONS
): Promise<readonly GeneratedArticle[]> => {
  const rendered = await Promise.all(locatedArticles(sections).map(renderOne))
  return rendered.toSorted((left, right) => left.slug.localeCompare(right.slug))
}

// =============================================================================
// The derived sidebar IA
// =============================================================================

/**
 * The section list and its registry tab, rendered as a TypeScript module.
 *
 * Membership and order only. The docs zone's labels, icons and landing paths
 * are copy and design, which the registry does not carry and should not: a
 * manual section's `tab` says which part of the product it belongs to, not what
 * the sub-nav calls it.
 */
export const renderNavModule = (
  sections: readonly (typeof SECTIONS)[number][] = SECTIONS
): string => {
  const ordered = sections.toSorted((left, right) => left.order - right.order)
  const rows = ordered.map(
    (section) =>
      `  { slug: '${section.slug}', tab: '${section.tab}', articles: ${section.articles.length} },`
  )
  const tabs = [...new Set(ordered.map((section) => section.tab))]
  return [
    '/**',
    ' * Copyright (c) 2025-2026 ESSENTIAL SERVICES',
    ' *',
    ' * This source code is licensed under the Business Source License 1.1',
    ' * found in the LICENSE.md file in the root directory of this source tree.',
    ' */',
    '',
    '// GENERATED by `bun run build:website-docs` from the manual inside the binary',
    '// (`src/docs/sections/`). Do not edit; `Docs Payload Drift` byte-compares it.',
    '//',
    '// Membership and ORDER only. The sidebar group label, its icon and each zone',
    '// tab’s landing path are copy and design decisions the manual does not carry,',
    '// and they stay authored in `markdown.ts` beside this import.',
    '',
    '/** One manual section, and the part of the product its manifest files it under. */',
    'export interface GeneratedDocsSection {',
    '  readonly slug: string',
    '  /** The registry tab, which `markdown.ts` maps onto a docs-zone tab. */',
    '  readonly tab: string',
    '  /** How many articles the section publishes, for the census only. */',
    '  readonly articles: number',
    '}',
    '',
    '/** Every registered section, in manual reading order. */',
    'export const GENERATED_DOCS_SECTIONS: readonly GeneratedDocsSection[] = [',
    ...rows,
    ']',
    '',
    '/** Every registry tab, in first-appearance order. */',
    `export const GENERATED_DOCS_TABS: readonly string[] = [${tabs
      .map((tab) => `'${tab}'`)
      .join(', ')}]`,
    '',
  ].join('\n')
}

// =============================================================================
// The plan
// =============================================================================

/** What the tree should hold, and what is in it that should not be. */
export interface GenerationPlan {
  readonly articles: readonly GeneratedArticle[]
  readonly navModule: GeneratedArticle
  /** Slugs on disk that are neither generated nor allow-listed. */
  readonly obsolete: readonly string[]
  /** Allow-listed slugs that are MISSING from disk — an authored file lost. */
  readonly missingAuthored: readonly string[]
  /** Pending slugs a registered article now produces: the row must go. */
  readonly retiredPending: readonly string[]
}

/** Every `.md` slug currently in the English tree. */
export const readTreeSlugs = (root: string = REPO_ROOT): readonly string[] => {
  try {
    return readdirSync(join(root, EN_DOCS_DIR))
      .filter((name) => name.endsWith('.md'))
      .map((name) => name.slice(0, -'.md'.length))
      .toSorted()
  } catch {
    return []
  }
}

/** Compute the whole plan without touching the tree. */
export const planGeneration = async (root: string = REPO_ROOT): Promise<GenerationPlan> => {
  const articles = await renderWebsiteArticles()
  const generated = new Set(articles.map((article) => article.slug))
  const authored = authoredSlugs()
  const onDisk = new Set(readTreeSlugs(root))
  return {
    articles,
    navModule: {
      slug: '_docs-nav.generated',
      path: NAV_MODULE,
      content: renderNavModule(),
      flattened: [],
    },
    obsolete: readTreeSlugs(root).filter(
      (slug) => !generated.has(slug) && !authored.includes(slug)
    ),
    missingAuthored: authored.filter((slug) => !onDisk.has(slug)),
    retiredPending: PENDING_FRAGMENT_ARTICLES.map((row) => row.slug).filter((slug) =>
      generated.has(slug)
    ),
  }
}

/** Files whose committed bytes differ from what the plan renders. */
export const staleFiles = (plan: GenerationPlan, root: string = REPO_ROOT): readonly string[] =>
  [...plan.articles, plan.navModule]
    .filter((file) => {
      try {
        return readFileSync(join(root, file.path), 'utf8') !== file.content
      } catch {
        return true
      }
    })
    .map((file) => file.path)

// =============================================================================
// CLI
// =============================================================================

const TAG = 'website-docs'

const write = (plan: GenerationPlan, root: string): void => {
  mkdirSync(join(root, EN_DOCS_DIR), { recursive: true })
  for (const file of [...plan.articles, plan.navModule]) {
    writeFileSync(join(root, file.path), file.content)
  }
  for (const slug of plan.obsolete) {
    rmSync(join(root, EN_DOCS_DIR, `${slug}.md`), { force: true })
  }
}

const main = async (argv: readonly string[]): Promise<number> => {
  const checkOnly = argv.includes('--check')
  const plan = await planGeneration()

  if (plan.missingAuthored.length > 0) {
    printStderr(
      `Error: allow-listed article(s) missing from ${EN_DOCS_DIR}: ` +
        `${plan.missingAuthored.join(', ')}.\n  They are authored, not generated, so nothing ` +
        'here can recreate them. Restore them, or drop the row in generate-website-docs.ts.'
    )
    return 1
  }
  if (plan.retiredPending.length > 0) {
    printStderr(
      `Error: pending article(s) now produced by the manual: ${plan.retiredPending.join(', ')}.\n` +
        '  The fragment exists, so the authored copy is a second source. Remove the row from ' +
        'PENDING_FRAGMENT_ARTICLES and re-run.'
    )
    return 1
  }

  const stale = staleFiles(plan)
  if (checkOnly) {
    if (stale.length === 0 && plan.obsolete.length === 0) {
      printJournal(TAG, `${plan.articles.length} article(s) current; nothing obsolete.`)
      return 0
    }
    printStderr(
      `Stale: ${stale.length} file(s), obsolete: ${plan.obsolete.length}.\n  Run: ${FIX_COMMAND}`
    )
    return 1
  }

  write(plan, REPO_ROOT)
  printJournal(
    TAG,
    `Wrote ${plan.articles.length} article(s) and the nav module; ` +
      `${stale.length} changed, ${plan.obsolete.length} deleted` +
      `${plan.obsolete.length === 0 ? '' : ` (${plan.obsolete.join(', ')})`}. ` +
      `${authoredSlugs().length} authored article(s) left untouched.`
  )
  return 0
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)))
}
