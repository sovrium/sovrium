/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


const env = process.env as Record<string, string | undefined>

const isFlagSet = (value: string | undefined): boolean => value !== undefined && value !== ''

export const isInsecureOptOut = (): boolean => isFlagSet(env['SOVRIUM_ALLOW_INSECURE'])

export const isLoopbackHost = (host: string | undefined): boolean => {
  if (host === undefined || host === '') return true
  const normalized = stripIpv6Brackets(host.trim().toLowerCase())
  if (normalized === 'localhost' || normalized === 'localhost.localdomain') return true
  if (normalized === '::1' || normalized === '::') return true
  if (normalized === '0.0.0.0') return true
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(normalized)
}

const stripIpv6Brackets = (host: string): string =>
  host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host

export const resolveBindHostname = (explicit?: string): string => {
  if (explicit !== undefined && explicit !== '') return explicit
  const baseUrlHost = parseHostFromUrl(env['BASE_URL'])
  if (baseUrlHost !== undefined) return baseUrlHost
  const hostnameEnv = env['HOSTNAME']
  if (hostnameEnv !== undefined && hostnameEnv !== '') return hostnameEnv
  return 'localhost'
}

const parseHostFromUrl = (rawUrl: string | undefined): string | undefined => {
  if (rawUrl === undefined || rawUrl === '') return undefined
  try {
    return new URL(rawUrl).hostname
  } catch {
    return undefined
  }
}

export const isTransportRelaxed = (bindHost?: string): boolean =>
  isInsecureOptOut() || isLoopbackHost(resolveBindHostname(bindHost))

export const isSsrfRelaxed = (): boolean =>
  isInsecureOptOut() || isFlagSet(env['SOVRIUM_ALLOW_PRIVATE_OUTBOUND'])

export const isDevKeyAllowed = (): boolean =>
  isInsecureOptOut() || isFlagSet(env['SOVRIUM_ALLOW_DEV_KEY'])
