/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * An article's own `access`, declared in its front matter.
 *
 * One handbook, one folder for managers: an article may say who reads it,
 * beside the text it protects — `access: authenticated`, or a list of roles
 * (`access: [admin]`), the page `access` grammar. A folder is gated by gating
 * its articles. The collection page's own `access` still applies first.
 *
 * The verdict is the router's own predicate, `checkPageAccess`, applied to the
 * article's access after the page's — so a reader outside it gets the same 404
 * as for any page they may not open, and every surface that lists articles (the
 * sidebar, previous/next, the session search) asks the same question. A public
 * artefact — the static index, `llms.txt`, a markdown twin — carries only the
 * articles that declare no access, or `all`.
 */

import { isOpenToEveryone, toPermissionValue } from '@/domain/models/app/auth/permission-evaluation'
import { checkPageAccess } from './page-access-check'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { PageAccess } from '@/domain/models/app/pages/access'

/**
 * The `access` an article's front matter declares, or `undefined` for none.
 *
 * The front matter is read as flat scalars, so a list arrives as its text —
 * `[admin, manager]` — and is split here; a bare word is `all`,
 * `authenticated` or a single role.
 *
 * FAILS CLOSED. Once the key is present, anything that does not read as one
 * of those shapes — an empty value, `[]`, or a YAML block list, which the flat
 * reader sees as an empty value — is an empty role list: only an unrestricted
 * admin reads the article, and no public artefact carries it. An author who
 * meant to gate an article must never publish it by a typo.
 */
export function frontmatterAccess(
  frontmatter: Readonly<Record<string, string>>
): PageAccess | undefined {
  if (!Object.hasOwn(frontmatter, 'access')) return undefined
  const raw = (frontmatter['access'] ?? '').trim()
  if (raw === 'all' || raw === 'authenticated') return raw
  return raw
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((role) => role.trim().replace(/^['"]|['"]$/g, ''))
    .filter((role) => role !== '')
}

/** One article's Markdown body and its own front matter `access`, when it declares one. */
export interface ContentDirArticleBody {
  readonly body: string
  readonly access?: PageAccess
}

/** Whether an article is open to everyone — the only kind a public artefact carries. */
export const isPublicArticle = (access: PageAccess | undefined): boolean =>
  access === undefined || isOpenToEveryone(toPermissionValue(access))

/**
 * Whether `session` may read an article: its page's access, then its own —
 * both answered by the router's `checkPageAccess`.
 */
export function isArticleReadable(
  pageAccess: PageAccess | undefined,
  articleAccess: PageAccess | undefined,
  app: App,
  session: SessionInfo | undefined
): boolean {
  return (
    checkPageAccess(pageAccess, app, session).allowed &&
    (articleAccess === undefined || checkPageAccess(articleAccess, app, session).allowed)
  )
}
