/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What the admin connections read takes from the app's DECLARATION rather than
 * from `system.connections`: the label each connection gives itself, the name a
 * console cell prints, and which static-secret connections wait on a credential
 * variable that is not set. Pure reads of the configuration and the environment,
 * split out of `connections.ts`, which composes them with the stored rows.
 */

import { buildEnvLookup } from '@/domain/models/app/env-reference-service'
import { buildStaticAuthHeader } from '../automations/action-handlers/static-auth-header'
import type { App } from '@/domain/models/app'

/** The declared connections, automations and variables a connection's labels, uses and state are read from. */
export type DeclaredConfig = Pick<App, 'connections' | 'automations' | 'env'>

/**
 * The declared static-secret connections whose credential reads a `$env.`
 * variable that is not set on this instance — the ones every run skips. Read
 * through the same check the run applies, so the list and the run agree.
 */
export const unconfiguredNamesOf = (config: DeclaredConfig): ReadonlySet<string> => {
  const envLookup = buildEnvLookup(config.env, process.env)
  return new Set(
    (config.connections ?? [])
      .filter((connection) => connection.type !== 'oauth2')
      .filter(
        (connection) =>
          'unconfigured' in
          buildStaticAuthHeader(
            {
              name: connection.name,
              type: connection.type,
              props: (connection.props ?? {}) as Record<string, unknown>,
            },
            envLookup
          )
      )
      .map((connection) => connection.name)
  )
}

/**
 * The `label` each declared connection gives itself, keyed by its `name` — the
 * key a `system.connections` row shares with its `app.connections[]` entry.
 * A connection declaring no label (or an empty one) is absent from the map.
 */
export type DeclaredConnectionLabels = ReadonlyMap<string, string>

/** No declared labels: every connection is named by `name · provider`. */
export const NO_DECLARED_LABELS: DeclaredConnectionLabels = new Map()

/** Read the declared labels off `app.connections[]`. */
export function declaredLabelsOf(
  connections: ReadonlyArray<{ readonly name: string; readonly label?: string }> | undefined
): DeclaredConnectionLabels {
  return new Map(
    (connections ?? []).flatMap((connection) =>
      connection.label === undefined || connection.label.length === 0
        ? []
        : [[connection.name, connection.label] as const]
    )
  )
}

/**
 * The connection named in one reading, for a console cell that shows one
 * field: the `label` its configuration declares when it declares one;
 * otherwise `name · provider`, or the name alone when the two are the same word
 * (compared without regard to case). Built from the configuration's own words,
 * so it does not depend on the operator's language.
 */
export function connectionLabel(
  name: string,
  provider: string,
  declared: string | undefined
): string {
  if (declared !== undefined) return declared
  return name.toLowerCase() === provider.toLowerCase() ? name : `${name} · ${provider}`
}
