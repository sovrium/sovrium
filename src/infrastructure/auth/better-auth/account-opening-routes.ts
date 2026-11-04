/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Better Auth routes that open an account or write the profile of one, in
 * one place.
 *
 * Every request guard (`avatar-url-guard.ts`, `display-name-guard.ts`,
 * `language-preference-guard.ts`, `sso-owned-domain-guard.ts`, and the
 * creation guard behind them) knows the doors by path. They all read those
 * paths from here, because separate copies of the list drift apart: a door
 * added to one copy and not the next would write past the guard that missed
 * it. A new door is therefore added once, and every guard sees it.
 *
 * Paths are Better Auth's own, as `ctx.path` reports them: relative to the
 * auth base path, with route parameters left as their `:name` placeholder.
 */

/** Password sign-up: unauthenticated, writes the profile fields of its body. */
export const SIGN_UP_EMAIL_PATH = '/sign-up/email'

/** The self-service profile update, session-scoped. */
export const UPDATE_USER_PATH = '/update-user'

/** The self-service address change. */
export const CHANGE_EMAIL_PATH = '/change-email'

/** The door an administrator opens accounts by, already limited to administrators. */
export const ADMIN_CREATE_USER_PATH = '/admin/create-user'

/** The door an administrator edits an account by, already limited to administrators. */
export const ADMIN_UPDATE_USER_PATH = '/admin/update-user'

/**
 * Where a door carries a profile field: on the request body itself, or under
 * the admin routes' `data` passthrough (`data: z.record(z.string(), z.any())`),
 * which stores additional fields without naming them in the body schema.
 */
export type ProfileFieldLocation = 'body' | 'data'

/**
 * The four doors on which a client can put a value into a profile column of
 * `auth.user` (`image`, `language`), and where in the body it sits.
 *
 * Better Auth stores those columns verbatim once declared, validating the type
 * and nothing else, so every door reaches the same column and guarding one
 * would be theatre. Reading the wrong location silently skips validation,
 * which is why the location is data rather than a conditional.
 */
export const PROFILE_WRITING_ROUTES: ReadonlyMap<string, ProfileFieldLocation> = new Map([
  [SIGN_UP_EMAIL_PATH, 'body'],
  [UPDATE_USER_PATH, 'body'],
  [ADMIN_CREATE_USER_PATH, 'data'],
  [ADMIN_UPDATE_USER_PATH, 'data'],
])

/**
 * The doors that open an account on their own, other than a password sign-up:
 * following an emailed sign-in link, entering an emailed sign-in code, and
 * returning from a social or OAuth provider (Google, GitHub, a generic OAuth
 * provider, Google One Tap, an ID token handed to `/sign-in/social`). Each
 * creates the account only once the address or the provider vouched for it.
 * An identity provider's own callback (`/sso/...`) is not listed: it is the
 * road an owned domain is meant to take.
 */
export const SELF_SIGN_UP_PATHS: ReadonlySet<string> = new Set([
  '/magic-link/verify',
  '/sign-in/email-otp',
  '/callback/:id',
  '/oauth2/callback/:providerId',
  '/sign-in/social',
  '/one-tap/callback',
])
