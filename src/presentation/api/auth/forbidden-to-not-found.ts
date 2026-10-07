/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The S1 anti-enumeration rewrite of Better Auth's 403s: which refusals become
 * the canonical 404, read off the error code Better Auth answers with.
 */

/** The `code` of a Better Auth error body, read from a copy so the response stays readable. */
export const readErrorCode = async (response: Readonly<Response>): Promise<string | undefined> => {
  try {
    const body = (await response.clone().json()) as { code?: unknown } | null
    return typeof body?.code === 'string' ? body.code : undefined
  } catch {
    // A body that is not JSON carries no code.
    return undefined
  }
}

/**
 * The Better Auth error codes that refuse the caller's own permission on the
 * admin plane — `YOU_ARE_NOT_ALLOWED_TO_CHANGE_USERS_ROLE`, `…_TO_BAN_USERS`,
 * `…_TO_LIST_USERS` and the rest of the family. `YOU_CANNOT_…` codes
 * (`YOU_CANNOT_IMPERSONATE_ADMINS`) and `BANNED_USER` are about the TARGET and
 * are not part of it.
 */
const CALLER_PERMISSION_DENIAL = /^YOU_ARE_NOT_ALLOWED_TO_/

/**
 * Whether a Better Auth response must be rewritten to the canonical 404 per S1
 * anti-enumeration. Only a 403 qualifies:
 *
 * - `/api/auth/organization/*` and `/api/auth/oauth2/*`: every 403. These
 *   admin-only plugin routes have no Sovrium-level role guard, so a 403 there
 *   is the plugin refusing a non-admin or non-owner caller.
 * - `/api/auth/admin/*`: only a 403 whose code refuses the caller's own
 *   permission. `applyAdminRoleCheckMiddleware` answers a non-admin 404 before
 *   Better Auth runs, but a caller demoted after that check and before Better
 *   Auth's own permission check — by a request of their own in flight — is
 *   refused by Better Auth with `YOU_ARE_NOT_ALLOWED_TO_…`. That caller is no
 *   longer an admin, so the answer is the 404 any non-admin gets. The code
 *   decides, not a second read of the caller's role, which would reopen the
 *   same window. A 403 about the target stands: `YOU_CANNOT_IMPERSONATE_ADMINS`
 *   and impersonating a banned user are refusals an admin receives, and the
 *   caller already sees the target.
 * - Everything else (`/sign-in`, `/verify-email`, `/csrf`, …): a 403 there is
 *   a state error (CSRF rejection, unverified email) and is kept.
 */
export const rewritesForbiddenToNotFound = (
  path: string,
  status: number,
  code: string | undefined
): boolean => {
  if (status !== 403) return false
  if (path.startsWith('/api/auth/organization/') || path.startsWith('/api/auth/oauth2/')) {
    return true
  }
  return (
    path.startsWith('/api/auth/admin/') && code !== undefined && CALLER_PERMISSION_DENIAL.test(code)
  )
}
