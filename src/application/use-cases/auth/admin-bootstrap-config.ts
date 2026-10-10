/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How the first admin is seeded at boot, read from the environment — the
 * input of `bootstrapAdmin` (`bootstrap-admin.ts`), kept apart from the
 * program that acts on it.
 */

import { parsePlatformSso } from '@/domain/models/process-env/platform-sso'

/**
 * Admin bootstrap configuration from environment variables
 */
export interface AdminBootstrapConfig {
  readonly email: string
  readonly password: string
  readonly name: string
  /**
   * Role assigned to the seeded admin. Read from the optional `AUTH_ADMIN_ROLE`
   * env var, falling back to `'admin'`. Custom-role apps (e.g. cloud
   * `operator`, partner `engineer`) set it to their highest-level role so the
   * seeded admin can reach every access-gated page.
   *
   * Optional on the type until `parseAdminBootstrapConfig` populates it
   * (Phase P, Gap 2 — implemented downstream); kept optional so the additive
   * type change stays backward-compatible and typecheck-green.
   */
  readonly role?: string
}

/** The first admin seeded from a Sovrium Cloud user: no password, bound by Cloud user id. */
export interface PlatformAdminSeed {
  readonly email: string
  readonly name: string
  readonly role: string
  /** The owner's Cloud user id (`SOVRIUM_PLATFORM_SSO_ADMIN_SUBJECT`). */
  readonly subject: string
}

/**
 * How the first admin is seeded at boot: from a password (`AUTH_ADMIN_EMAIL` +
 * `AUTH_ADMIN_PASSWORD`), or — on an app hosted on Sovrium Cloud, with no
 * password — bound to the owner's Cloud user, who signs in with Sovrium Cloud.
 */
export type AdminBootstrap =
  | ({ readonly kind: 'password' } & AdminBootstrapConfig)
  | ({ readonly kind: 'platform-sso' } & PlatformAdminSeed)

type Env = Readonly<Record<string, string | undefined>>

/** The owner's Cloud user id when the platform sign-in is configured, else `undefined`. */
const platformAdminSubject = (env: Env): string | undefined => {
  try {
    return parsePlatformSso(env)?.adminSubject
  } catch {
    // A malformed set is refused at boot (`validateOperatorEnv`), never here.
    return undefined
  }
}

/**
 * Parse the admin bootstrap from environment variables.
 *
 * - `password`: `AUTH_ADMIN_EMAIL` and `AUTH_ADMIN_PASSWORD` (today's path).
 * - `platform-sso`: `AUTH_ADMIN_EMAIL` with no password, and the platform
 *   sign-in variables naming the owner's Cloud user (`ADMIN_SUBJECT`).
 *
 * `undefined` otherwise. `AUTH_ADMIN_NAME` defaults to "Administrator",
 * `AUTH_ADMIN_ROLE` to `admin`.
 */
export const parseAdminBootstrapConfig = (env: Env = process.env): AdminBootstrap | undefined => {
  const email = env['AUTH_ADMIN_EMAIL']
  const password = env['AUTH_ADMIN_PASSWORD']
  const name = env['AUTH_ADMIN_NAME'] || 'Administrator'
  const role = env['AUTH_ADMIN_ROLE'] || 'admin'
  if (!email) return undefined
  if (password) return { kind: 'password', email, password, name, role }
  const subject = platformAdminSubject(env)
  return subject === undefined ? undefined : { kind: 'platform-sso', email, name, role, subject }
}

/**
 * Whether `AUTH_ADMIN_EMAIL` is set with no way for that admin to sign in —
 * neither a password nor the platform sign-in naming the owner — which seeds
 * nobody and so leaves an empty app with no way in.
 */
export const adminEmailWithoutWayIn = (env: Env = process.env): boolean =>
  Boolean(env['AUTH_ADMIN_EMAIL']) && parseAdminBootstrapConfig(env) === undefined

/** The startup warning for {@link adminEmailWithoutWayIn}, naming what is missing. */
export const ADMIN_EMAIL_WITHOUT_WAY_IN_WARNING =
  'AUTH_ADMIN_EMAIL is set but no admin was created: set AUTH_ADMIN_PASSWORD, or the SOVRIUM_PLATFORM_SSO_ variables with SOVRIUM_PLATFORM_SSO_ADMIN_SUBJECT, so the first admin has a way to sign in.'
