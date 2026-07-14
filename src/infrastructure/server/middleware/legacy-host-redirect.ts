/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { MiddlewareHandler } from 'hono'


const REDIRECT_HOST_ENV = 'SOVRIUM_REDIRECT_HOST'
const REDIRECT_HOST_TARGET_ENV = 'SOVRIUM_REDIRECT_HOST_TARGET'

export const normalizeHostHeader = (raw: string | undefined): string | undefined => {
  if (!raw) return undefined
  const first = raw.split(',')[0]?.trim()
  if (!first) return undefined
  const withoutPort = first.split(':')[0]
  return withoutPort ? withoutPort.toLowerCase() : undefined
}

export interface LegacyHostRedirectInputs {
  readonly requestHost: string | undefined
  readonly requestPath: string
  readonly requestSearch: string
  readonly configuredHost: string | undefined
  readonly targetPrefix: string | undefined
  readonly resolvedOrigin: string
}

export const resolveLegacyHostRedirect = (inputs: LegacyHostRedirectInputs): string | undefined => {
  const { configuredHost, targetPrefix } = inputs
  if (!configuredHost || !targetPrefix) return undefined

  const host = normalizeHostHeader(inputs.requestHost)
  if (!host || host !== configuredHost.toLowerCase()) return undefined

  const appendedPath = inputs.requestPath === '/' ? '' : inputs.requestPath
  return `${inputs.resolvedOrigin}${targetPrefix}${appendedPath}${inputs.requestSearch}`
}

const resolveRedirectOrigin = (host: string | undefined, forwardedProto?: string): string => {
  const fromEnv = Bun.env.BASE_URL
  if (fromEnv) return fromEnv.replace(/\/$/, '')

  if (host) {
    const proto = forwardedProto || 'https'
    return `${proto}://${host}`.replace(/\/$/, '')
  }

  return ''
}

export const legacyHostRedirect: MiddlewareHandler = async (c, next) => {
  const configuredHost = Bun.env[REDIRECT_HOST_ENV]
  const targetPrefix = Bun.env[REDIRECT_HOST_TARGET_ENV]
  if (!configuredHost || !targetPrefix) return next()

  const rawHost = c.req.header('X-Forwarded-Host') ?? c.req.header('Host')
  const url = new URL(c.req.url)
  const location = resolveLegacyHostRedirect({
    requestHost: rawHost,
    requestPath: url.pathname,
    requestSearch: url.search,
    configuredHost,
    targetPrefix,
    resolvedOrigin: resolveRedirectOrigin(rawHost, c.req.header('X-Forwarded-Proto')),
  })

  return location === undefined ? next() : c.redirect(location, 301)
}
