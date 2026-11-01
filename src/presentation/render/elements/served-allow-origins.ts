/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isProductionNodeEnv } from '@/domain/models/process-env/dev-mode'
import { isPublicOriginEnv } from '@/domain/models/process-env/public-origin'

/**
 * The process environment, read through an alias: the build's `define`
 * replaces a literal `process.env.NODE_ENV`, and this must be the deployer's.
 */
const { env } = process

/**
 * Whether plain-http origins are dropped: the deployment is reachable from
 * elsewhere (`BASE_URL`, else the bind address, names a host that is not
 * loopback), or `NODE_ENV` says production. The binary and the container image
 * never set `NODE_ENV`, so the address is what decides; `NODE_ENV=production`
 * still drops them behind a loopback bind, as it always has.
 */
const dropsPlainHttp = (): boolean => isPublicOriginEnv(env) || isProductionNodeEnv(env['NODE_ENV'])

/**
 * The `onSuccess.allowOrigins` list a page is handed: the config's list, less
 * any plain-`http://` origin when the server is a public deployment.
 *
 * The config admits `http://localhost` so a developer can test a checkout on
 * their own machine; a deployed app must never send a reader to a plain-http
 * address. The page cannot tell which mode the server runs in, so the server
 * decides here, and the browser's check (`toAllowedOriginAddress`) only ever
 * sees the origins this deployment allows. `undefined` when nothing is left.
 */
export function servedAllowOrigins(
  allowOrigins: readonly string[] | undefined
): readonly string[] | undefined {
  if (allowOrigins === undefined) return undefined
  const served = dropsPlainHttp()
    ? allowOrigins.filter((origin) => origin.startsWith('https://'))
    : allowOrigins
  return served.length === 0 ? undefined : served
}

/**
 * `onSuccess` as the page is handed it: unchanged, except its `allowOrigins`
 * narrowed by {@link servedAllowOrigins} (and dropped when nothing is left, so
 * a returned address on that origin is refused like any unlisted one).
 */
export function withServedAllowOrigins<T>(onSuccess: T): T {
  if (typeof onSuccess !== 'object' || onSuccess === null || !('allowOrigins' in onSuccess)) {
    return onSuccess
  }
  const { allowOrigins, ...rest } = onSuccess as T & { readonly allowOrigins?: readonly string[] }
  const served = servedAllowOrigins(allowOrigins)
  return (served === undefined ? rest : { ...rest, allowOrigins: served }) as T
}
