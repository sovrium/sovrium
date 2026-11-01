/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isLoopbackHostname } from '@/domain/kernel/url/loopback-host'
import { resolveBindHost } from './server-lifecycle'

type Env = Readonly<Record<string, string | undefined>>

/** The hostname of `BASE_URL`, or `undefined` when it is unset or not a URL. */
const baseUrlHost = (env: Env): string | undefined => {
  const raw = env['BASE_URL']?.trim() ?? ''
  if (raw === '') return undefined
  try {
    return new URL(raw).hostname
  } catch {
    return undefined
  }
}

/**
 * The host the deployment is reached at: the host of `BASE_URL`, else the bind
 * host (`SOVRIUM_BIND_HOST`, then the deprecated `HOSTNAME`, then `localhost`).
 */
export const resolvePublicOriginHost = (env: Env): string =>
  baseUrlHost(env) ?? resolveBindHost(env).host

/**
 * Whether the environment describes a deployment reachable from elsewhere: its
 * origin host is not loopback. A development seam (a pinned clock, an injected
 * fault) is closed on such a deployment whatever `NODE_ENV` says, because the
 * binary and the container image never set `NODE_ENV`.
 *
 * Pure: the environment is a parameter. The infrastructure posture resolver
 * reads the same precedence from the live process environment.
 */
export const isPublicOriginEnv = (env: Env): boolean =>
  !isLoopbackHostname(resolvePublicOriginHost(env))
