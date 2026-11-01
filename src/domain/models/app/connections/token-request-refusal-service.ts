/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The reason a refused token request gives the step. A token endpoint that
 * redirected the request to another origin is named as such: the body carried
 * the credential, so it was not re-sent, and the operator has a service
 * misconfiguration (or a hostile endpoint) to look at rather than a refusal.
 */
export const tokenRequestRefusal = (
  connectionName: string,
  request: string,
  error: string
): string =>
  error.endsWith('_invalid_url_cross-origin-redirect')
    ? `connection ${connectionName}: the ${request} was redirected to another origin and was not re-sent`
    : `connection ${connectionName}: ${request} refused (${error})`
