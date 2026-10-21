/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The environment variables a connection reads when it is written under a
 * name other than its app's own — the second account of one app.
 *
 * Two accounts of one app are two connections, `stripe` and `stripe-2`, and
 * each has to read its own secrets: were `stripe-2` to read `STRIPE_SECRET_KEY`
 * too, it would silently act as the first account. So every variable that
 * holds a secret OF THE ACCOUNT — an API key, a token, a username and
 * password, the base URL of a self-hosted instance — gets the name's suffix
 * after the app's stem: `STRIPE_SECRET_KEY` → `STRIPE_2_SECRET_KEY` for
 * `stripe-2`, `STRIPE_BILLING_SECRET_KEY` for `billing`.
 *
 * One credential stays shared: the client id and secret of an OAuth2
 * connection identify the application registered with the provider, which
 * every account connects through, so both accounts read the same two names.
 * Each account's own tokens are obtained when it connects, never read from
 * the environment.
 *
 * A variable whose name does not start with the app's stem keeps its name and
 * gains the suffix at its end: `TOKEN` → `TOKEN_2`.
 */

const ENV_REFERENCE = /\$env\.([A-Z][A-Z0-9_]*)/g

const stemOf = (word: string): string => word.toUpperCase().replaceAll('-', '_')

/**
 * The suffix a connection named `name` adds to its app's variables: `2` for
 * `stripe-2`, `BILLING` for `billing`; `undefined` under the app's own name.
 */
export const accountSuffixOf = (slug: string, name: string): string | undefined => {
  if (name === slug) return undefined
  return stemOf(name.startsWith(`${slug}-`) ? name.slice(slug.length + 1) : name)
}

/** One variable of `slug` renamed for the account `suffix`. */
export const accountEnvName = (slug: string, suffix: string, envName: string): string => {
  const stem = stemOf(slug)
  return envName.startsWith(`${stem}_`)
    ? `${stem}_${suffix}_${envName.slice(stem.length + 1)}`
    : `${envName}_${suffix}`
}

/** The variables a string reads through `$env.NAME`, in order. */
export const envReferencesIn = (value: unknown): readonly string[] =>
  typeof value === 'string'
    ? [...value.matchAll(ENV_REFERENCE)].flatMap((match) => match[1] ?? [])
    : []

/** The variables every account of a connection shares: an OAuth2 client's id and secret. */
export const sharedEnvOf = (connection: unknown): ReadonlySet<string> => {
  const { type, props } = (connection ?? {}) as {
    readonly type?: unknown
    readonly props?: { readonly clientId?: unknown; readonly clientSecret?: unknown }
  }
  if (type !== 'oauth2') return new Set()
  return new Set([...envReferencesIn(props?.clientId), ...envReferencesIn(props?.clientSecret)])
}

/** What renaming one connection's variables reads. */
export interface ConnectionEnvInput {
  /** The app's own name, which its variables are derived from. */
  readonly slug: string
  /** The name the connection is written under. */
  readonly name: string
  /** Every variable the connection reads under the app's own name. */
  readonly env: readonly string[]
  /** The connection as built, whose type and OAuth2 client say what is shared. */
  readonly connection: unknown
}

/** Each variable the connection reads under another name, mapped to its new name. */
export const connectionEnvRenames = (input: ConnectionEnvInput): ReadonlyMap<string, string> => {
  const suffix = accountSuffixOf(input.slug, input.name)
  if (suffix === undefined) return new Map()
  const shared = sharedEnvOf(input.connection)
  return new Map(
    input.env
      .filter((envName) => !shared.has(envName))
      .map((envName) => [envName, accountEnvName(input.slug, suffix, envName)] as const)
  )
}

/** `env` with each renamed variable under its new name. */
export const renamedEnvNames = (
  env: readonly string[],
  renames: ReadonlyMap<string, string>
): readonly string[] => env.map((envName) => renames.get(envName) ?? envName)

/** `value` with every `$env.NAME` of a renamed variable pointing at its new name. */
export const renameEnvReferences = (
  value: unknown,
  renames: ReadonlyMap<string, string>
): unknown => {
  if (renames.size === 0) return value
  if (typeof value === 'string')
    return value.replaceAll(
      ENV_REFERENCE,
      (_reference: string, envName: string) => `$env.${renames.get(envName) ?? envName}`
    )
  if (Array.isArray(value)) return value.map((item: unknown) => renameEnvReferences(item, renames))
  if (typeof value === 'object' && value !== null)
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, renameEnvReferences(item, renames)])
    )
  return value
}

/** A connection under `name`: its value and the variables it reads, renamed. */
export const connectionForAccount = <T>(
  input: ConnectionEnvInput & { readonly connection: T }
): { readonly connection: T; readonly env: readonly string[] } => {
  const renames = connectionEnvRenames(input)
  return {
    connection: renameEnvReferences(input.connection, renames) as T,
    env: renamedEnvNames(input.env, renames),
  }
}

/**
 * A step's request address as the connection `name` of `slug` reads it: an
 * address built on the connection's base URL (`$env.APIFY_BASE_URL/…`) reads
 * the account's own (`$env.APIFY_2_BASE_URL/…`) under another name.
 */
export const addressForAccount = (slug: string, name: string, address: string): string =>
  renameEnvReferences(
    address,
    connectionEnvRenames({ slug, name, env: envReferencesIn(address), connection: undefined })
  ) as string
