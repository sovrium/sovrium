/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The origins a cookie-bearing request may come from: the app's own, each SSO
 * provider's, and those `SOVRIUM_CORS_ORIGINS` lists.
 *
 * ONE list, read by both judges of a cross-site request: Better Auth's origin
 * check on its sign-in routes, and the origin guard in front of every other
 * route (`presentation/api/middleware/cross-site-request-guard.ts`). Two lists
 * would drift, and the drift would be a route that admits an origin the other
 * refuses.
 */

import { preBindOrigin } from '@/domain/models/process-env/server'
import { resolveCorsOrigins } from '@/infrastructure/process/security-posture'
import { buildSsoContext, ssoTrustedOrigins } from './sso-origins'
import type { Auth } from '@/domain/models/app/auth'

/**
 * The base URL Better Auth is configured with: the one pre-bind address rule
 * (`preBindOrigin`), so the guard's list and the auth instance's agree.
 */
const authBaseUrl = (): string => preBindOrigin(process.env)

/** The trusted origins of an auth instance whose base URL and SSO context are known. */
export const trustedOriginsOf = (
  baseURL: string,
  authConfig: Auth | undefined,
  envLookup: Parameters<typeof ssoTrustedOrigins>[1]
): string[] => [baseURL, ...ssoTrustedOrigins(authConfig, envLookup), ...resolveCorsOrigins()]

/** An origin as a browser writes it in `Origin`, or `undefined` for a value that is not a URL. */
const originOf = (value: string): string | undefined =>
  URL.canParse(value) ? new URL(value).origin : undefined

/**
 * The trusted origins of an app, normalised as a browser writes them in
 * `Origin` (scheme, host and port; no path, no trailing slash).
 */
export const appTrustedOrigins = (
  authConfig: Auth | undefined,
  appEnv: Parameters<typeof buildSsoContext>[0]
): readonly string[] => {
  const baseURL = authBaseUrl()
  const { envLookup } = buildSsoContext(appEnv, baseURL)
  return trustedOriginsOf(baseURL, authConfig, envLookup)
    .map(originOf)
    .filter((origin): origin is string => origin !== undefined)
}
