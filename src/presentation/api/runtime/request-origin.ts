/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveRequestBaseUrl as resolveFromSettings } from '@/domain/kernel/url/request-base-url'
import { resolveTrustedProxyHops } from '@/domain/models/process-env/proxy'
import { declaredBaseUrl } from '@/domain/models/process-env/server'
import type { RequestOriginSettings } from '@/domain/kernel/url/request-base-url'

/**
 * The operator's `BASE_URL` and decoded `TRUSTED_PROXY_HOPS`, read from the
 * process environment at the moment of the request.
 *
 * Read per request rather than captured at boot on purpose: `sovrium build`
 * declares `BASE_URL` in-process before it renders, so a value captured when
 * the module loaded would print the wrong address. The hop count goes through
 * the same parser the client-address resolver and the page tier's session
 * binding use, so the three cannot disagree about whether a proxy was declared.
 */
export const readRequestOriginSettings = (): RequestOriginSettings => ({
  trustedProxyHops: resolveTrustedProxyHops(process.env),
  baseUrl: declaredBaseUrl(process.env),
})

/**
 * The public origin this instance should advertise for the request in hand —
 * the kernel resolver ({@link resolveFromSettings}) fed the operator's current
 * declarations. Every API and page route that PRINTS this instance's address
 * calls this one function.
 */
export const resolveRequestBaseUrl = (c: Parameters<typeof resolveFromSettings>[0]): string =>
  resolveFromSettings(c, readRequestOriginSettings())
