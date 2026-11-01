/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A sign-in page opened by the redirect of a refused session — its address
 * carries `session=ended` (`session-ended-marker.ts`) — tells each of its
 * sign-in forms so (`action._sessionEnded`), and the form draws one sentence
 * saying the session ended above itself.
 *
 * Runs on the tree with its references already inlined, so a sign-in form
 * placed through a template or a library block is reached like any other.
 */

import { isSessionEndedQuery } from '@/domain/models/app/auth/session-ended-marker'

type AuthAction = { readonly type?: unknown; readonly method?: unknown }

/** Whether `node` is a sign-in form (`login`, the default auth method). */
const isSignInForm = (node: object): boolean => {
  const { action } = node as { readonly action?: AuthAction }
  return action?.type === 'auth' && (action.method ?? 'login') === 'login'
}

/** `tree` with `_sessionEnded` on the action of every sign-in form, at any depth. */
const withSessionEnded = (tree: unknown): unknown => {
  if (Array.isArray(tree)) return tree.map(withSessionEnded)
  if (typeof tree !== 'object' || tree === null) return tree
  const walked = Object.fromEntries(
    Object.entries(tree).map(([key, value]) => [
      key,
      key === 'action' ? value : withSessionEnded(value),
    ])
  )
  if (!isSignInForm(tree)) return walked
  const { action } = tree as { readonly action: object }
  return { ...walked, action: { ...action, _sessionEnded: true } }
}

/** Stamp a page's sign-in forms when its address says the reader's session ended. */
export function stampSessionEnded<T extends { readonly components?: unknown }>(
  page: T,
  requestQuery: Readonly<Record<string, string>> | undefined
): T {
  if (!isSessionEndedQuery(requestQuery) || page.components === undefined) return page
  return { ...page, components: withSessionEnded(page.components) }
}
