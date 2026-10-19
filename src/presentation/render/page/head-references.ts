/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createContext } from 'react'
import { resolveAppVarValues } from '@/domain/models/app/pages/app-vars'
import { substituteAppVars } from '@/presentation/render/resolve/app-vars-resolver'
import { substituteRouteParams } from '@/presentation/render/resolve/route-param-props-resolver'
import type { App } from '@/domain/models/app'

/**
 * The `$app.*` and `$param.*` substitution a document's HEAD applies to its
 * title and description, AFTER they are translated.
 *
 * ─── WHY THE HEAD HAS ITS OWN PASS ─────────────────────────────────────────
 *
 * The page tree is substituted before rendering, but a `meta.title` naming a
 * `$t:` key only becomes text when the head is built — once for the served
 * language, then once per supported language for the client's in-place repaint
 * (`data-page-meta`). A tree pass widened to `meta` would resolve a title
 * written directly and still ship `$app.label — Records` from every
 * translation. So the head substitutes the TRANSLATED text, in every language,
 * with the same values and the same closed sets as the tree pass — a reference
 * neither answers is left verbatim there too.
 *
 * Every title channel reads the result: the server `<title>` and description,
 * the per-language entries the client repaints `document.title` from, and —
 * because it is read off the rendered `<title>` — the title an SPA swap adopts.
 *
 * `$query.*` is deliberately absent: a title is what a shared link and a
 * search engine show, and must not be written by whoever crafts the URL.
 */
export type HeadReferences = (text: string) => string

/** No references to resolve: a document rendered outside a page request. */
const UNRESOLVED: HeadReferences = (text) => text

/**
 * Provided once per document by `renderPageHtml`. A context rather than a prop
 * because the per-language metadata is serialised two components below the
 * head, by a renderer that otherwise has no reason to know about the request.
 */
export const HeadReferencesContext = createContext<HeadReferences>(UNRESOLVED)

/**
 * The head's substitution for one request: `$app.*` from `app` (the HOST app
 * on a mounted console, whose name the operator reads), then `$param.*` from
 * the matched route — the order the page-tree passes run in.
 */
export const buildHeadReferences = (
  app: App,
  routeParams: Readonly<Record<string, string>>,
  origin: string | undefined,
  serving: Parameters<typeof resolveAppVarValues>[2]
): HeadReferences => {
  const values = resolveAppVarValues(app, origin, serving)
  return (text) => substituteRouteParams(substituteAppVars(text, values), routeParams)
}

/** The request facts the head's references read, as `renderPageByPath` receives them. */
interface DocumentRequest {
  readonly hostApp?: App
  readonly requestOrigin?: string
  readonly basePath?: string
  readonly engineVersion?: string
  readonly requestPath?: string | undefined
}

/**
 * `$app.path`: the address asked for, read by the page tree and the head alike.
 * Absent, it is the path being rendered; passed as `undefined`, the request
 * named no single address and the token is left verbatim.
 */
export const requestPathOf = (
  path: string,
  request: DocumentRequest | undefined
): string | undefined =>
  request !== undefined && 'requestPath' in request ? request.requestPath : path

/**
 * What the document reads about the request beside its page: the head's
 * `$app.*` / `$param.*` substitution, built from the same facts the page tree
 * read, and — on a mounted surface — the host app whose facts it prints.
 */
export const documentRequestFacts = (
  app: App,
  routeParams: Readonly<Record<string, string>>,
  path: string,
  request: DocumentRequest | undefined
): { readonly headReferences: HeadReferences; readonly hostApp?: App } => ({
  headReferences: buildHeadReferences(
    request?.hostApp ?? app,
    routeParams,
    request?.requestOrigin,
    {
      basePath: request?.basePath ?? '',
      engineVersion: request?.engineVersion,
      path: requestPathOf(path, request),
    }
  ),
  ...(request?.hostApp !== undefined ? { hostApp: request.hostApp } : {}),
})
