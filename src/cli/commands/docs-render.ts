/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * WHAT `sovrium docs <arguments>` ANSWERS WITH — the request router.
 *
 * Split out of `docs.ts` so the verb keeps only argv concerns (the two
 * refusals, the single destination) and this keeps only the manual. The split
 * is also what makes the laziness statable in one sentence:
 *
 * **NOTHING in this module is imported at module scope.** Every payload,
 * manifest and renderer is reached through an `await import()` inside
 * {@link loadManual}, and the only static imports are `type`-only ones, which
 * erase. `src/cli/index.ts` imports `docs.ts` eagerly — it imports every
 * command eagerly — so a value import anywhere down this chain would put the
 * whole manual, and every schema it documents, on the boot path of
 * `sovrium start`. `embedded-docs-boot.test.ts` is the assertion that catches
 * it, and a static import here typechecks and lints clean right up until that
 * test fails.
 */

import type { DocsCorpusEntry } from '@/application/use-cases/admin/docs-lookup'
import type {
  LocatedArticle,
  ManualArticle,
  ManualSection,
} from '@/application/use-cases/admin/docs-manual'

/** The three shapes the manual is emitted in. */
export type DocsFormat = 'md' | 'json' | 'llms'

export interface DocsRenderRequest {
  /** Positionals after `docs` — an address, or a subcommand and its argument. */
  readonly args: readonly string[]
  readonly format: DocsFormat
  readonly full: boolean
  readonly listSections: boolean
  readonly sections: readonly string[]
}

export interface DocsRenderResult {
  readonly content: string
  /** Set when the request named something the manual does not carry. */
  readonly refusal?: string
}

const refuse = (message: string): DocsRenderResult => ({ content: '', refusal: message })

const ok = (content: string): DocsRenderResult => ({ content })

/**
 * The manual's own projection: the payload reader and the article renderers.
 *
 * Every module is DESTRUCTURED at the await rather than kept as a namespace.
 * That is not style: `knip` resolves a named binding out of a dynamic import
 * and cannot see a member read off a namespace object, so a namespace here
 * would report every function this command calls as an unused export — and an
 * unused-export report that is always wrong is one nobody reads.
 */
const loadProjection = async () => {
  const [payload, projection] = await Promise.all([
    import('@/infrastructure/assets/embedded-docs'),
    import('@/application/use-cases/admin/docs-manual'),
  ])
  const { embeddedBehaviourFor, readEmbeddedDoc } = payload
  const {
    articleAddress,
    embeddedDocKey,
    findArticle,
    findSection,
    locatedArticles,
    renderLlmsIndex,
    renderManualArticle,
    renderSectionIndex,
    renderTableOfContents,
  } = projection
  return {
    embeddedBehaviourFor,
    readEmbeddedDoc,
    articleAddress,
    embeddedDocKey,
    findArticle,
    findSection,
    locatedArticles,
    renderLlmsIndex,
    renderManualArticle,
    renderSectionIndex,
    renderTableOfContents,
  }
}

/** The point lookups, and the four sources they read: schema, env, help, search. */
const loadLookups = async () => {
  const [lookup, search, introspection, app, template, help] = await Promise.all([
    import('@/application/use-cases/admin/docs-lookup'),
    import('@/application/use-cases/admin/docs-search'),
    import('@/domain/models/app/design/type-introspection'),
    import('@/domain/models/app'),
    import('./env-example-template'),
    import('@/cli/runtime/command-help'),
  ])
  const {
    adminRouteInventory,
    envTemplateLines,
    findCliArticle,
    lookupAdminPage,
    lookupConfigOption,
    lookupEnvVariable,
    renderAdminPage,
    renderCliVerb,
    renderConfigOption,
    renderEnvVariable,
  } = lookup
  const { renderSearchResults, searchDocs } = search
  const { astOf } = introspection
  const { AppSchema } = app
  const { ENV_EXAMPLE_CONTENT } = template
  const { getCommandHelp } = help
  return {
    adminRouteInventory,
    envTemplateLines,
    findCliArticle,
    lookupAdminPage,
    lookupConfigOption,
    lookupEnvVariable,
    renderAdminPage,
    renderCliVerb,
    renderConfigOption,
    renderEnvVariable,
    renderSearchResults,
    searchDocs,
    astOf,
    AppSchema,
    ENV_EXAMPLE_CONTENT,
    getCommandHelp,
  }
}

/**
 * Everything the manual is made of, loaded on demand.
 *
 * One `Promise.all` rather than a chain of awaits: the three are independent,
 * and a sequential load would make the command's latency their sum for no gain.
 */
const loadManual = async () => {
  const [registry, projection, lookups] = await Promise.all([
    import('@/docs/sections'),
    loadProjection(),
    loadLookups(),
  ])
  const { SECTIONS } = registry
  return { SECTIONS, ...projection, ...lookups }
}

type Manual = Readonly<Awaited<ReturnType<typeof loadManual>>>

const readBody = async (manual: Manual, article: ManualArticle): Promise<string> =>
  manual.readEmbeddedDoc(manual.embeddedDocKey(article.body))

/** Every article with its prose — the input the scanning answers need. */
const loadCorpus = async (
  manual: Manual,
  located: readonly LocatedArticle[]
): Promise<readonly DocsCorpusEntry[]> =>
  Promise.all(
    located.map(async (entry) => ({
      address: manual.articleAddress(entry),
      title: entry.article.title,
      body: await readBody(manual, entry.article),
      documents: entry.article.documents,
    }))
  )

/** One article, rendered with its tables expanded and its Behaviour block. */
const renderOne = async (manual: Manual, located: LocatedArticle): Promise<string> =>
  manual.renderManualArticle({
    article: located.article,
    body: await readBody(manual, located.article),
    behaviour: manual.embeddedBehaviourFor(located.article.slug),
  })

// =============================================================================
// The whole manual
// =============================================================================

/** The sections a `--section` narrowing leaves, or all of them. */
const narrow = (manual: Manual, slugs: readonly string[]) =>
  slugs.length === 0
    ? { sections: manual.SECTIONS, unknown: undefined }
    : {
        sections: manual.SECTIONS.filter((section) => slugs.includes(section.slug)),
        unknown: slugs.find((slug) => manual.SECTIONS.every((section) => section.slug !== slug)),
      }

/**
 * `--full`: every article, in one document, concatenated in walk order.
 *
 * The order is `locatedArticles`', which sorts by section order then article
 * order — so two runs of one binary produce identical bytes, which is what lets
 * a consumer pin a version, regenerate, and treat any diff as a real change.
 * `Promise.all` cannot disturb that: the order comes from the ARRAY, not from
 * the order the promises happen to settle in.
 */
const renderFullManual = async (
  manual: Manual,
  sections: readonly ManualSection[]
): Promise<string> => {
  const located = manual.locatedArticles(sections)
  const articles = await Promise.all(
    located.map(async (entry) => [
      `<!-- ${manual.articleAddress(entry)} -->`,
      '',
      await renderOne(manual, entry),
    ])
  )
  return [manual.renderTableOfContents(sections), '', ...articles.flat()].join('\n')
}

/** The manual as a document a renderer can walk. */
const jsonDocument = async (
  manual: Manual,
  sections: readonly ManualSection[],
  full: boolean
): Promise<string> => {
  const located = manual.locatedArticles(sections)
  const rendered = full
    ? await Promise.all(located.map(async (entry) => await renderOne(manual, entry)))
    : []
  const bodyOf = (index: number): Readonly<Record<string, string>> =>
    full ? { body: rendered[index] ?? '' } : {}
  const document = {
    sections: sections
      .toSorted((left, right) => left.order - right.order)
      .map((section) => ({
        slug: section.slug,
        title: section.title,
        order: section.order,
        tab: section.tab,
        articles: section.articles
          .toSorted((left, right) => left.order - right.order)
          .map((article) => ({
            slug: article.slug,
            address: `${section.slug}/${article.slug}`,
            title: article.title,
            description: article.description,
            keywords: article.keywords,
            order: article.order,
            sidebarLabel: article.sidebarLabel,
            stories: article.stories,
            ...bodyOf(located.findIndex((entry) => entry.article === article)),
          })),
      })),
  }
  // eslint-disable-next-line unicorn/no-null -- JSON.stringify requires null as its replacer
  return `${JSON.stringify(document, null, 2)}\n`
}

// =============================================================================
// The point lookups
// =============================================================================

const answerConfig = async (manual: Manual, path: string | undefined, format: DocsFormat) => {
  if (path === undefined)
    return refuse('Error: `sovrium docs config <path>` needs a path, e.g. `llms.full`.')

  const root = manual.astOf(manual.AppSchema)
  const located = manual.locatedArticles(manual.SECTIONS)
  const corpus = located.map((entry) => ({
    address: manual.articleAddress(entry),
    title: entry.article.title,
    body: '',
    documents: entry.article.documents,
  }))
  const answer =
    root === undefined ? undefined : manual.lookupConfigOption(root, path, corpus, manual.astOf)

  if (answer === undefined)
    return refuse(
      `Error: No config option at "${path}".\n\n` +
        '  Paths are written as the config writes them — `llms.full`,\n' +
        '  `tables[].fields[].type`. Find the owning article with\n' +
        `  \`sovrium docs search ${path.split(/[.[]/)[0] ?? path}\`.`
    )

  return ok(
    format === 'json'
      ? // eslint-disable-next-line unicorn/no-null -- JSON.stringify requires null as its replacer
        `${JSON.stringify(answer, null, 2)}\n`
      : manual.renderConfigOption(answer)
  )
}

const answerEnv = async (manual: Manual, variable: string | undefined, format: DocsFormat) => {
  if (variable === undefined)
    return refuse('Error: `sovrium docs env <NAME>` needs a variable, e.g. `DATABASE_URL`.')

  const corpus = await loadCorpus(manual, manual.locatedArticles(manual.SECTIONS))
  const mentions = manual.lookupEnvVariable(corpus, variable)
  const templateLines = manual.envTemplateLines(manual.ENV_EXAMPLE_CONTENT, variable)

  if (mentions.length === 0 && templateLines.length === 0)
    return refuse(
      `Error: The manual does not document an environment variable "${variable}".\n\n` +
        '  Names are UPPER_SNAKE_CASE. The full reference is\n' +
        '  `sovrium docs cli-api/env-vars`.'
    )

  return ok(
    format === 'json'
      ? // eslint-disable-next-line unicorn/no-null -- JSON.stringify requires null as its replacer
        `${JSON.stringify({ variable, templateLines, mentions }, null, 2)}\n`
      : manual.renderEnvVariable({ variable, templateLines, mentions })
  )
}

const answerCli = async (manual: Manual, verb: string | undefined, format: DocsFormat) => {
  if (verb === undefined)
    return refuse('Error: `sovrium docs cli <verb>` needs a command, e.g. `migrate`.')

  const help = manual.getCommandHelp(verb)
  const corpus = await loadCorpus(manual, manual.locatedArticles(manual.SECTIONS))
  const entry = manual.findCliArticle(corpus, verb)

  if (help === undefined && entry === undefined)
    return refuse(
      `Error: No command "${verb}".\n\n` +
        '  Run `sovrium --help` for the command list, or read the overview\n' +
        '  with `sovrium docs cli-api/cli`.'
    )

  return ok(
    format === 'json'
      ? // eslint-disable-next-line unicorn/no-null -- JSON.stringify requires null as its replacer
        `${JSON.stringify({ verb, help, article: entry?.address }, null, 2)}\n`
      : manual.renderCliVerb({ verb, help, article: entry?.body })
  )
}

const answerSearch = async (manual: Manual, query: string, format: DocsFormat) => {
  if (query.trim().length === 0)
    return refuse('Error: `sovrium docs search <query>` needs something to look for.')

  const located = manual.locatedArticles(manual.SECTIONS)
  const searchable = await Promise.all(
    located.map(async (entry) => ({
      address: manual.articleAddress(entry),
      title: entry.article.title,
      description: entry.article.description,
      keywords: entry.article.keywords,
      body: await readBody(manual, entry.article),
    }))
  )
  const hits = manual.searchDocs(searchable, query)

  if (hits.length === 0)
    return refuse(
      `Error: Nothing in the manual matches "${query}".\n\n` +
        '  The table of contents is `sovrium docs`; the section list is\n' +
        '  `sovrium docs --list-sections`.'
    )

  return ok(
    format === 'json'
      ? // eslint-disable-next-line unicorn/no-null -- JSON.stringify requires null as its replacer
        `${JSON.stringify({ query, hits }, null, 2)}\n`
      : manual.renderSearchResults(query, hits)
  )
}

/**
 * `admin <page>` — the console route a page name resolves to.
 *
 * The sidebar says Records and the router says `/tables`, and a reader holding
 * one should not have to guess the other. So the query is matched against both
 * the ROUTE and the row's summary, after the address-bar spellings (`/records`,
 * `/_admin/tables`) are collapsed onto the sidebar one.
 *
 * The inventory is the two console fragments' own route tables, which
 * `src/docs/docs-structure.test.ts` holds equal to
 * `resolveAdminPresetApp().pages[].path` in both directions — so a route this
 * can find is a route the binary serves. Reading the table rather than the
 * preset is what keeps the verb offline and lazy: decoding the admin preset to
 * answer a documentation question would put it on a path that has no business
 * touching it.
 */
const answerAdmin = async (manual: Manual, page: string | undefined, format: DocsFormat) => {
  if (page === undefined)
    return refuse('Error: `sovrium docs admin <page>` needs a page, e.g. `/tables`.')

  const corpus = await loadCorpus(manual, manual.locatedArticles(manual.SECTIONS))
  const routes = manual.lookupAdminPage(manual.adminRouteInventory(corpus), page)

  if (routes.length === 0)
    return refuse(
      `Error: The console serves no page matching "${page}".\n\n` +
        '  A page is named as the sidebar names it or as the router matches it\n' +
        '  — `records`, `/tables`, `/_admin/tables`. The whole inventory is\n' +
        '  `sovrium docs admin/admin-dashboard`.'
    )

  return ok(
    format === 'json'
      ? // eslint-disable-next-line unicorn/no-null -- JSON.stringify requires null as its replacer
        `${JSON.stringify({ page, routes }, null, 2)}\n`
      : manual.renderAdminPage({ page, routes })
  )
}

// =============================================================================
// The router
// =============================================================================

/** An address — a whole section, or one article inside one. */
const answerAddress = async (manual: Manual, address: string, format: DocsFormat) => {
  const section = manual.findSection(manual.SECTIONS, address)
  if (section !== undefined)
    return ok(
      format === 'json'
        ? await jsonDocument(manual, [section], false)
        : manual.renderSectionIndex(section)
    )

  const located = manual.findArticle(manual.SECTIONS, address)
  if (located === undefined)
    return refuse(
      `Error: No section or article "${address}".\n\n` +
        '  Sections: `sovrium docs --list-sections`.\n' +
        `  Search instead: \`sovrium docs search ${address.split('/').at(-1) ?? address}\`.`
    )

  const rendered = await renderOne(manual, located)
  return ok(
    format === 'json'
      ? // eslint-disable-next-line unicorn/no-null -- JSON.stringify requires null as its replacer
        `${JSON.stringify({ address: manual.articleAddress(located), title: located.article.title, body: rendered }, null, 2)}\n`
      : rendered
  )
}

/**
 * What a positional argument asks for: a subcommand, or an address.
 *
 * Split from {@link renderDocsRequest} so each half stays readable, and because
 * the two halves answer different questions: this one is "you named a thing",
 * the other is "you named nothing, so how much of the manual do you want".
 */
const answerPositional = async (
  manual: Manual,
  head: string,
  rest: readonly string[],
  format: DocsFormat
): Promise<DocsRenderResult> => {
  if (head === 'search') return answerSearch(manual, rest.join(' '), format)
  if (head === 'config') return answerConfig(manual, rest[0], format)
  if (head === 'env') return answerEnv(manual, rest[0], format)
  if (head === 'cli') return answerCli(manual, rest[0], format)
  if (head === 'admin') return answerAdmin(manual, rest[0], format)
  return answerAddress(manual, head, format)
}

/** The manual's own index, in whichever of the three shapes was asked for. */
const answerIndex = async (
  manual: Manual,
  sections: readonly ManualSection[],
  request: DocsRenderRequest
): Promise<DocsRenderResult> => {
  if (request.format === 'json')
    return ok(await jsonDocument(manual, sections, request.full && !request.listSections))

  if (request.listSections)
    return ok(
      `${sections
        .toSorted((left, right) => left.order - right.order)
        .map((section) => `${section.slug} — ${section.title} (${section.articles.length})`)
        .join('\n')}\n`
    )

  if (request.full) return ok(await renderFullManual(manual, sections))

  return ok(
    request.format === 'llms'
      ? manual.renderLlmsIndex(sections)
      : manual.renderTableOfContents(sections)
  )
}

/** The manual, or the piece of it the arguments name. */
export const renderDocsRequest = async (request: DocsRenderRequest): Promise<DocsRenderResult> => {
  const manual = await loadManual()
  const { sections, unknown } = narrow(manual, request.sections)
  if (unknown !== undefined)
    return refuse(
      `Error: No section "${unknown}".\n\n` +
        `  Registered sections: ${manual.SECTIONS.map((section) => section.slug).join(', ')}.`
    )

  const [head, ...rest] = request.args
  return head === undefined
    ? answerIndex(manual, sections, request)
    : answerPositional(manual, head, rest, request.format)
}
