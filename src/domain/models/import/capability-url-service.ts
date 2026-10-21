/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Capability URLs: addresses that ARE a credential, because whoever holds
 * one can call it. A migrated HTTP step never writes one into the config,
 * which is usually committed; it reads it from an environment variable
 * instead (`$env.<NAME>`), and the import declares that variable's NAME.
 *
 * A URL is a capability when one row of {@link CAPABILITY_URL_RULES} says
 * so: it carries a user name or a password, a query key that names a secret,
 * or it is a known inbound-webhook address (Zapier catch hooks, Make
 * webhooks, Slack incoming webhooks, n8n webhook paths). The rows are data: a new pattern is a row.
 */

/** One reason a URL is a capability. */
interface CapabilityUrlRule {
  readonly name: string
  readonly matches: (url: Readonly<URL>) => boolean
}

/** Query keys whose value is a secret, compared lowercased. */
export const SECRET_QUERY_KEYS: ReadonlySet<string> = new Set([
  'token',
  'key',
  'secret',
  'sig',
  'signature',
  'api_key',
  'apikey',
  'access_token',
])

/** Every reason a URL is a capability. */
export const CAPABILITY_URL_RULES: readonly CapabilityUrlRule[] = [
  {
    name: 'credentials in the address',
    matches: (url) => url.username !== '' || url.password !== '',
  },
  {
    name: 'a secret in the query',
    matches: (url) =>
      [...url.searchParams.keys()].some((key) => SECRET_QUERY_KEYS.has(key.toLowerCase())),
  },
  { name: 'a Zapier catch hook', matches: (url) => url.hostname === 'hooks.zapier.com' },
  {
    name: 'a Make webhook',
    matches: (url) => /^hook\.[a-z0-9-]+\.make(?:\.celonis)?\.com$/.test(url.hostname),
  },
  {
    name: 'a Slack incoming webhook',
    matches: (url) =>
      url.hostname === 'hooks.slack.com' ||
      /^\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]+$/.test(url.pathname),
  },
  {
    name: 'an n8n webhook',
    matches: (url) => /^\/(?:[^/]+\/)*webhook(?:-test)?\/./.test(url.pathname),
  },
]

/** Why a URL is a capability, or `undefined` when it is an ordinary address. */
export const capabilityOf = (address: string): string | undefined => {
  const url = URL.parse(address.trim())
  if (url === null || (url.protocol !== 'https:' && url.protocol !== 'http:')) return undefined
  return CAPABILITY_URL_RULES.find((rule) => rule.matches(url))?.name
}

/** The host a URL names, for a report: never its path, query or credentials. */
export const reportedHost = (address: string): string =>
  URL.parse(address.trim())?.hostname ?? 'its destination'

/**
 * A command-line argument as a refusal may repeat it: a URL keeps only its
 * scheme and host (`postgres://db.example.com/…`), since its user name,
 * password, path or query may be the very secret the operator pasted; anything
 * else is repeated as written.
 */
export const addressForDisplay = (argument: string): string => {
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(argument)) return argument
  const url = URL.parse(argument.trim())
  if (url === null) return argument.slice(0, argument.indexOf('://') + 3) + '…'
  const rest = `${url.pathname}${url.search}${url.hash}`
  return `${url.protocol}//${url.host}${rest === '' || rest === '/' ? '' : '/…'}`
}

/** An env variable name from words: `weekly digest`, `post` → `WEEKLY_DIGEST_POST`. */
export const toEnvName = (...words: readonly string[]): string => {
  const name = words
    .join('_')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return /^[A-Z]/.test(name) ? name : `URL_${name}`
}
