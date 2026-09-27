/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The OAuth2 `provider` shorthand: a known service's authorization and token
 * endpoints, so a connection naming `provider: google` needs neither URL.
 *
 * An explicit `authorizationUrl` / `tokenUrl` always wins over the preset — a
 * Workspace proxy, a regional endpoint or a sandbox tenant is the operator's
 * call. The table holds only services whose endpoints are one fixed pair for
 * every customer; a provider whose URL carries a tenant, a region or an API
 * version is left out rather than guessed.
 */
export const OAUTH2_PROVIDER_ENDPOINTS: Readonly<
  Record<string, { readonly authorizationUrl: string; readonly tokenUrl: string }>
> = {
  airtable: {
    authorizationUrl: 'https://airtable.com/oauth2/v1/authorize',
    tokenUrl: 'https://airtable.com/oauth2/v1/token',
  },
  github: {
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
  },
  google: {
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
  },
  hubspot: {
    authorizationUrl: 'https://app.hubspot.com/oauth/authorize',
    tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
  },
  linkedin: {
    authorizationUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
  },
  microsoft: {
    authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  },
  notion: {
    authorizationUrl: 'https://api.notion.com/v1/oauth/authorize',
    tokenUrl: 'https://api.notion.com/v1/oauth/token',
  },
  salesforce: {
    authorizationUrl: 'https://login.salesforce.com/services/oauth2/authorize',
    tokenUrl: 'https://login.salesforce.com/services/oauth2/token',
  },
  slack: {
    authorizationUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
  },
}

/** The provider names the shorthand knows, sorted, for error messages and docs. */
export const KNOWN_OAUTH2_PROVIDERS: readonly string[] =
  Object.keys(OAUTH2_PROVIDER_ENDPOINTS).toSorted()

type OAuth2Endpoints = {
  readonly provider?: string | undefined
  readonly authorizationUrl?: string | undefined
  readonly tokenUrl?: string | undefined
}

const isBlank = (value: string | undefined): boolean => value === undefined || value === ''

/** Own keys only — a provider named `toString` is not a preset. */
const presetFor = (
  provider: string | undefined
): { readonly authorizationUrl: string; readonly tokenUrl: string } | undefined =>
  provider !== undefined && Object.hasOwn(OAUTH2_PROVIDER_ENDPOINTS, provider)
    ? OAUTH2_PROVIDER_ENDPOINTS[provider]
    : undefined

/**
 * The connection's endpoints with the provider preset filling whatever the
 * config leaves out. Props with no known provider come back unchanged.
 */
export const withProviderEndpoints = <P extends OAuth2Endpoints>(props: P): P & OAuth2Endpoints => {
  const preset = presetFor(props.provider)
  if (preset === undefined) return props
  return {
    ...props,
    authorizationUrl: isBlank(props.authorizationUrl)
      ? preset.authorizationUrl
      : props.authorizationUrl,
    tokenUrl: isBlank(props.tokenUrl) ? preset.tokenUrl : props.tokenUrl,
  }
}

/**
 * Why an OAuth2 connection's `provider` cannot stand in for the endpoints it
 * omits, or `undefined`. Only an UNKNOWN provider that leaves an endpoint the
 * grant needs missing is refused: an unknown name beside explicit URLs is a
 * label and harms nothing. The client credentials grant needs only `tokenUrl`.
 */
export const providerIssue = (connection: {
  readonly name: string
  readonly type?: string
  readonly props?: unknown
}): string | undefined => {
  if (connection.type !== 'oauth2') return undefined
  const props = (connection.props ?? {}) as OAuth2Endpoints & { readonly grantType?: string }
  if (props.provider === undefined || presetFor(props.provider) !== undefined) return undefined
  const needed =
    props.grantType === 'clientCredentials'
      ? [props.tokenUrl]
      : [props.authorizationUrl, props.tokenUrl]
  if (!needed.some(isBlank)) return undefined
  return `Connection '${connection.name}' names provider '${props.provider}', which Sovrium has no endpoints for — set authorizationUrl and tokenUrl, or use a known provider: ${KNOWN_OAUTH2_PROVIDERS.join(', ')}`
}
