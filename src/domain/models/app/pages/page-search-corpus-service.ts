/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { evaluateFormAccess } from '@/domain/models/app/forms/form-access-flow'
import { resolveTranslationPattern } from '@/domain/models/app/languages/translation-resolver'
import { isArticleReadable } from './content-dir-access'
import { extractMatchExcerpt, stripMarkdownToPlainText } from './content-dir-excerpt'
import { readEmbeddedFormRef } from './embedded-form-ref'
import type { PageAccess } from './access'
import type { Page } from './page'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'

/**
 * The page corpus behind every server-answered page search: the session-scoped
 * `GET /api/search/pages` and the page half of the command palette.
 *
 * ONE corpus and ONE filter, so the two surfaces cannot disagree about what a
 * reader may find. A document is a page the author WROTE — a declared page's own
 * text components, or a `contentDir` article's markdown — never a value rendered
 * from a record: one role's rows must not surface in another role's results.
 *
 * The filter is `checkPageAccess`, the check the router applies when the reader
 * opens the page. NOT `isPublicPage`: that is the static index's predicate, and
 * the static file must stay public-only whatever this corpus answers. The router
 * composes ONE more gate on top of it — a page embedding a `formRef` the reader
 * may not use answers 404 — and the corpus composes the same one, so a page the
 * router refuses cannot be found by name either.
 */

/** Plain-text ceiling per document; a longer page is indexed on its first 16 KB. */
export const PAGE_SEARCH_TEXT_CAP = 16_384

/** Result ceiling for one page search. */
const PAGE_SEARCH_RESULT_CAP = 10

/** One searchable page: a declared page or one article of a `contentDir` page. */
export interface PageSearchDocument {
  readonly kind: 'page' | 'article'
  /** The navigable URL — never a `:slug` template. */
  readonly url: string
  readonly title: string
  /** The page name, or the article slug — matched alongside the title. */
  readonly name: string
  /** Plain text, capped at {@link PAGE_SEARCH_TEXT_CAP}. */
  readonly text: string
  /** The owning page's `access`; an article inherits its page's. */
  readonly access: Page['access']
  /**
   * An article's own `access`, from its front matter, answered after
   * the page's. Absent for a page, and for an article that declares none.
   */
  readonly articleAccess?: PageAccess
  /**
   * Every form the owning page embeds by `formRef` — an article inherits its
   * page's. Each one's own `access` must admit the reader, as on a visit.
   */
  readonly formRefs: readonly string[]
}

/** One match. `excerpt` is present only when the query matched the text. */
export interface PageSearchHit {
  readonly kind: 'page' | 'article'
  readonly url: string
  readonly title: string
  readonly excerpt?: string
  readonly matchRange?: readonly [number, number]
}

const capText = (text: string): string =>
  text.length > PAGE_SEARCH_TEXT_CAP ? text.slice(0, PAGE_SEARCH_TEXT_CAP) : text

/**
 * The author's text in a component subtree.
 *
 * Conservative by construction: a subtree bound to data (`dataSource`) is
 * skipped because what it shows comes from records, and a subtree carrying
 * `visibility` is skipped because a reader allowed on the page may still not be
 * allowed to see that part of it. A reference to a shared component is not
 * expanded either. Losing some findable text is the price of never indexing a
 * word a reader could not have read on the page.
 */
const isOutsideTheCorpus = (component: Readonly<Record<string, unknown>>): boolean => {
  const props = component['props'] as Readonly<Record<string, unknown>> | undefined
  return (
    component['dataSource'] !== undefined ||
    component['visibility'] !== undefined ||
    props?.['visibility'] !== undefined ||
    component['$ref'] !== undefined
  )
}

const collectComponentText = (
  node: unknown,
  resolve: (text: string) => string
): readonly string[] => {
  if (typeof node === 'string') return [resolve(node)]
  if (node === null || typeof node !== 'object') return []
  const component = node as Readonly<Record<string, unknown>>
  if (isOutsideTheCorpus(component)) return []
  const own = typeof component['content'] === 'string' ? [resolve(component['content'])] : []
  const children = Array.isArray(component['children'])
    ? component['children'].flatMap((child) => collectComponentText(child, resolve))
    : []
  return [...own, ...children]
}

type Templates = App['components']

const templateNamed = (name: string, templates: Templates): unknown =>
  (templates ?? []).find((template) => (template as { readonly name?: unknown }).name === name)

/** The template a `{ component: name }` / `{ $ref: name }` node names, if any. */
const referenceName = (node: Readonly<Record<string, unknown>>): string | undefined => {
  if (typeof node['component'] === 'string') return node['component']
  return typeof node['$ref'] === 'string' ? node['$ref'] : undefined
}

/**
 * Every `formRef` reachable from `node`: every nested value, and every template
 * a reference names (each expanded once per path, so a cycle ends).
 *
 * WIDER than the router's walk on purpose. The router skips a subtree hidden
 * from the session by `visibility`; this walk cannot evaluate that rule in the
 * domain, so it counts the form anyway. The cost is a page left out of a search
 * it could have appeared in — never a page the router would refuse appearing.
 */
const collectFormRefs = (
  node: unknown,
  templates: Templates,
  expanding: ReadonlySet<string>
): readonly string[] => {
  if (Array.isArray(node))
    return node.flatMap((item) => collectFormRefs(item, templates, expanding))
  if (node === null || typeof node !== 'object') return []
  const record = node as Readonly<Record<string, unknown>>
  const ref = readEmbeddedFormRef(record)
  const own = ref === undefined ? [] : [ref]
  const name = referenceName(record)
  const referenced =
    name !== undefined && !expanding.has(name)
      ? collectFormRefs(templateNamed(name, templates), templates, new Set([...expanding, name]))
      : []
  const nested = Object.values(record).flatMap((value) =>
    typeof value === 'object' ? collectFormRefs(value, templates, expanding) : []
  )
  return [...own, ...referenced, ...nested]
}

/** The forms a page embeds by `formRef`, templates followed. */
const pageFormRefs = (page: Page, app: App): readonly string[] => [
  ...new Set(collectFormRefs(page.components ?? [], app.components, new Set())),
]

const translatorFor =
  (app: App) =>
  (text: string): string =>
    resolveTranslationPattern(text, app.languages?.default ?? 'en', app.languages)

/** The declared, navigable pages (no `:param` segment) as search documents. */
export const declaredPageDocuments = (app: App): readonly PageSearchDocument[] => {
  const resolve = translatorFor(app)
  return (app.pages ?? []).flatMap((page): readonly PageSearchDocument[] => {
    if (typeof page.path !== 'string' || page.path.includes(':')) return []
    const metaTitle = typeof page.meta?.title === 'string' ? resolve(page.meta.title) : ''
    const title = metaTitle.length > 0 ? metaTitle : page.name
    const text = (page.components ?? [])
      .flatMap((component) => collectComponentText(component, resolve))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    return [
      {
        kind: 'page',
        url: page.path,
        title,
        name: page.name,
        text: capText(text),
        access: page.access,
        formRefs: pageFormRefs(page, app),
      },
    ]
  })
}

/**
 * One `contentDir` article as a search document, inheriting its page's `access`
 * and embedded forms — the router serves the article through that same page.
 */
export const articleDocument = (
  app: App,
  page: Page,
  article: {
    readonly path: string
    readonly title: string
    readonly slug: string
    readonly access?: PageAccess
  },
  markdownBody: string
): PageSearchDocument => ({
  kind: 'article',
  url: article.path,
  title: article.title,
  name: article.slug,
  text: capText(stripMarkdownToPlainText(markdownBody)),
  access: page.access,
  ...(article.access === undefined ? {} : { articleAccess: article.access }),
  formRefs: pageFormRefs(page, app),
})

/**
 * Whether every form a document's page embeds admits the reader — the router's
 * second gate. A `formRef` naming no declared form is ignored, as on a visit.
 */
const embeddedFormsAdmit = (
  formRefs: readonly string[],
  app: App,
  session: SessionInfo | undefined
): boolean => {
  const formSession =
    session === undefined
      ? undefined
      : {
          userId: session.userId,
          role: session.role,
          ...(session.groups !== undefined ? { groups: session.groups } : {}),
        }
  return formRefs.every((ref) => {
    const form = app.forms?.find((candidate) => candidate.name === ref)
    return (
      form === undefined || evaluateFormAccess(form.access?.require, formSession).kind === 'allow'
    )
  })
}

/** The router's whole verdict on opening a document's page: access, then embedded forms. */
const isReadableBy = (
  document: Pick<PageSearchDocument, 'access' | 'articleAccess' | 'formRefs'>,
  app: App,
  session: SessionInfo | undefined
): boolean =>
  isArticleReadable(document.access, document.articleAccess, app, session) &&
  embeddedFormsAdmit(document.formRefs, app, session)

/**
 * The documents this reader may open — the router's own page-access check, then
 * its embedded-form gate. A misconfigured `access` (an unknown role or group)
 * is not `allowed` and drops.
 */
export const documentsReadableBy = (
  documents: readonly PageSearchDocument[],
  app: App,
  session: SessionInfo | undefined
): readonly PageSearchDocument[] =>
  documents.filter((document) => isReadableBy(document, app, session))

/**
 * Whether a page search could answer a signed-in reader differently from a
 * visitor: some declared page is closed to a reader with no session, or some
 * page lists articles — any of which may gate itself in its front matter
 *, out of the config's sight. Only then is the session read.
 */
export const hasGatedPage = (app: App): boolean =>
  (app.pages ?? []).some(
    (page) =>
      page.contentDir !== undefined ||
      !isReadableBy({ access: page.access, formRefs: pageFormRefs(page, app) }, app, undefined)
  )

/**
 * Match `query` (case-insensitive substring) against title + name, and against
 * the text unless `matchText` excludes that kind. A text match carries an
 * excerpt around it; a title-only match carries none. Declaration order —
 * title matches first under `titleFirst` — capped.
 */
export const searchPageDocuments = (
  documents: readonly PageSearchDocument[],
  query: string,
  options: {
    readonly matchText: (kind: PageSearchDocument['kind']) => boolean
    readonly limit?: number
    /**
     * Rank a document whose TITLE holds the query before those that only
     * mention it, keeping declaration order within each rank.
     */
    readonly titleFirst?: boolean
  }
): readonly PageSearchHit[] => {
  const needle = query.trim().toLowerCase()
  if (needle.length === 0) return []
  const hits = documents.flatMap((document): readonly PageSearchHit[] => {
    const base = { kind: document.kind, url: document.url, title: document.title }
    const textMatch =
      options.matchText(document.kind) && document.text.toLowerCase().includes(needle)
    if (textMatch) {
      const { excerpt, matchStart, matchEnd } = extractMatchExcerpt(document.text, query.trim())
      return [
        {
          ...base,
          excerpt,
          ...(matchStart >= 0 ? { matchRange: [matchStart, matchEnd] as const } : {}),
        },
      ]
    }
    const titleMatch = `${document.title} ${document.name}`.toLowerCase().includes(needle)
    return titleMatch ? [base] : []
  })
  const ranked =
    options.titleFirst === true
      ? [
          ...hits.filter((hit) => hit.title.toLowerCase().includes(needle)),
          ...hits.filter((hit) => !hit.title.toLowerCase().includes(needle)),
        ]
      : hits
  return ranked.slice(0, options.limit ?? PAGE_SEARCH_RESULT_CAP)
}
