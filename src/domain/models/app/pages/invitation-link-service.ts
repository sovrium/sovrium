/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Where an invitation link sends the invitee: the app's own invitation page
 * when it declares one, the built-in `/accept-invitation` otherwise.
 *
 * The first page declaring `invitation` wins, at its path, with the token under
 * the query key its `param` names (`token` by default). A page whose path holds
 * a `:param` segment is skipped: a link cannot fill that segment, so it would
 * open a page that does not exist.
 */

/** The built-in invitation page, kept for an app that declares none. */
export const BUILT_IN_INVITATION_PATH = '/accept-invitation'

/** The query key an invitation page reads its token from when it names none. */
export const DEFAULT_INVITATION_PARAM = 'token'

/** The page fields the link reads. */
export interface InvitationLinkPage {
  readonly path: string
  readonly invitation?: { readonly param?: string | undefined } | undefined
}

/** The path and token key an invitation link uses. */
export interface InvitationLinkTarget {
  readonly path: string
  readonly param: string
}

/** The page an app's invitation links open, from its pages. */
export const invitationLinkTarget = (
  pages: readonly InvitationLinkPage[] | undefined
): InvitationLinkTarget => {
  const page = (pages ?? []).find(
    (candidate) => candidate.invitation !== undefined && !candidate.path.includes(':')
  )
  return page === undefined
    ? { path: BUILT_IN_INVITATION_PATH, param: DEFAULT_INVITATION_PARAM }
    : { path: page.path, param: page.invitation?.param ?? DEFAULT_INVITATION_PARAM }
}

/**
 * The absolute invitation link for `token`: `origin`, the base the app is
 * served at, the page's path, and the token under the page's key.
 */
export const buildInvitationLink = (
  origin: string,
  token: string,
  target: InvitationLinkTarget,
  basePath = ''
): string => {
  const root = `${origin.replace(/\/$/, '')}${basePath.replace(/\/$/, '')}`
  return `${root}${target.path}?${encodeURIComponent(target.param)}=${encodeURIComponent(token)}`
}
