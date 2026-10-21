/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The connections a whole import shares: one per app per source
 * credential, named, and written the way their origin writes them.
 *
 * ## Naming
 *
 * Within one import, the distinct source credentials of one app are named, in
 * order of first appearance, `<slug>`, `<slug>-2`, `<slug>-3` — byte for byte
 * what `sovrium library add connection/<slug> --as <slug>-2` names them. A step
 * whose export labels no credential shares the first credential's connection.
 *
 * A name the config already holds is REUSED when it is the same connection —
 * the library's fragment of that slug, or, for the catalogue and a skeleton,
 * the inline entry an earlier import wrote — and skipped otherwise: a
 * connection the operator wrote is never overwritten.
 *
 * ## Secrets
 *
 * A connection named after another credential reads its own env names, as
 * `library add --as` writes them: `APIFY_TOKEN` becomes `APIFY_2_TOKEN` for
 * `apify-2`. Only an OAuth2 client's id and secret stay shared, since every
 * account connects through the one registered app (`connection-env-service.ts`).
 *
 * ## Operations
 *
 * A library connection keeps every operation its entry builds; each operation
 * of the generated set the steps call is appended, as `sovrium library add
 * <slug>/<operation>` appends it. A catalogue connection declares every
 * operation the catalogue gives it; a skeleton declares none.
 */

import { connectionForAccount } from '@/domain/models/app/connections/connection-env-service'
import {
  catalogueConnection,
  catalogueEntryOf,
  skeletonConnection,
  skeletonEnvOf,
} from './flow-app-catalogue-service'
import type { ConnectionCall, ConnectionOrigin, LibraryConnection } from './flow-app-call-service'
import type { ImportReport } from './import-report'
import type { ConfigEntry } from './table-mapper-service'

/** A connection the config already holds. */
export interface ExistingConnection {
  /** The library slug, when it is a library fragment (`# sovrium-library: connection/<slug>@…`). */
  readonly library?: string
}

/** One connection the import writes or reuses. */
export interface PlannedConnection {
  readonly name: string
  readonly origin: ConnectionOrigin
  readonly slug: string
  /** The `connections[]` entry, with the operations the steps need declared. */
  readonly entry: ConfigEntry
  /** The operations the imported steps and triggers call on it, sorted. */
  readonly operations: readonly string[]
  /** For a library connection, the generated-set operations appended to what its entry builds. */
  readonly extra: readonly string[]
  /** The env NAMES it reads, sorted. */
  readonly env: readonly string[]
  /** True when the config already held it. */
  readonly reused: boolean
  readonly oauthApp?: string
  readonly sourceCredential?: string
}

/** What naming and planning read besides the calls. */
export interface ConnectionContext {
  readonly connection: (slug: string) => LibraryConnection | undefined
  readonly existing?: (name: string) => ExistingConnection | undefined
}

/** A name one credential of one connection received. */
interface Assigned {
  readonly key: string
  readonly origin: ConnectionOrigin
  readonly slug: string
  readonly credential: string | undefined
  readonly name: string
  readonly reused: boolean
}

const groupOf = (call: ConnectionCall): string => `${call.origin}:${call.slug}`

/** The connections in order of first appearance, each with its credentials in that order. */
const groupsOf = (calls: readonly ConnectionCall[]) =>
  [...new Set(calls.map(groupOf))].map((group) => {
    const own = calls.filter((call) => groupOf(call) === group)
    const labelled = [...new Set(own.flatMap((call) => call.credential ?? []))]
    const first = own[0]
    return {
      group,
      origin: first?.origin ?? 'skeleton',
      slug: first?.slug ?? group,
      credentials: labelled.length === 0 ? [undefined] : labelled,
    }
  })

/** Whether `name` may carry this connection, and whether it is reused. */
const usable = (
  origin: ConnectionOrigin,
  slug: string,
  held: ExistingConnection | undefined
): { readonly reused: boolean } | undefined => {
  if (held === undefined) return { reused: false }
  if (origin === 'library') return held.library === slug ? { reused: true } : undefined
  return held.library === undefined ? { reused: true } : undefined
}

const candidate = (slug: string, index: number): string =>
  index === 1 ? slug : `${slug}-${String(index)}`

/** Every credential of every connection, named. */
const assign = (
  calls: readonly ConnectionCall[],
  existing: (name: string) => ExistingConnection | undefined
): readonly Assigned[] =>
  groupsOf(calls)
    .flatMap((group) => group.credentials.map((credential) => ({ ...group, credential })))
    .reduce<readonly Assigned[]>((done, one) => {
      const taken = new Set(done.map((assigned) => assigned.name))
      const own = done.filter((assigned) => assigned.key === one.group).length
      const found = Array.from({ length: 999 }, (_, index) => index + 1 + own)
        .map((index) => {
          const name = candidate(one.slug, index)
          const fits = taken.has(name) ? undefined : usable(one.origin, one.slug, existing(name))
          return fits === undefined ? undefined : { name, ...fits }
        })
        .find((fit) => fit !== undefined) ?? { name: candidate(one.slug, own + 1), reused: false }
      return [
        ...done,
        {
          key: one.group,
          origin: one.origin,
          slug: one.slug,
          credential: one.credential,
          name: found.name,
          reused: found.reused,
        },
      ]
    }, [])

/** The name a connection need received. */
export type ConnectionNaming = (need: ConnectionCall) => string

const assignedFor = (all: readonly Assigned[], call: ConnectionCall): Assigned | undefined => {
  const own = all.filter((assigned) => assigned.key === groupOf(call))
  return own.find((assigned) => assigned.credential === call.credential) ?? own[0]
}

/** Name every connection the calls need, against what the config holds. */
export const nameConnections = (
  calls: readonly ConnectionCall[],
  context: ConnectionContext
): { readonly naming: ConnectionNaming; readonly assigned: readonly Assigned[] } => {
  const assigned = assign(calls, context.existing ?? (() => undefined))
  return {
    assigned,
    naming: (need) => assignedFor(assigned, need)?.name ?? need.slug,
  }
}

const sortedUnique = (values: readonly string[]): readonly string[] =>
  [...new Set(values)].toSorted()

/** A library connection: what its entry builds, plus the generated operations called. */
const libraryDefinition = (
  assigned: Assigned,
  operations: readonly string[],
  context: ConnectionContext
) => {
  const library = context.connection(assigned.slug)
  const built = library?.built ?? Object.keys(library?.operations ?? {})
  const extra = operations.filter((operation) => !built.includes(operation))
  return {
    entry: library?.entry(assigned.name, extra) ?? { name: assigned.name },
    extra,
    env: library?.env ?? [],
    oauthApp: library?.oauthApp,
  }
}

/** The entry and report facts of one named connection, by origin, before its secrets are renamed. */
const originDefinitionOf = (
  assigned: Assigned,
  operations: readonly string[],
  context: ConnectionContext
) => {
  if (assigned.origin === 'library') return libraryDefinition(assigned, operations, context)
  const catalogue = assigned.origin === 'catalogue' ? catalogueEntryOf(assigned.slug) : undefined
  if (catalogue !== undefined)
    return {
      entry: catalogueConnection(catalogue, assigned.name),
      extra: [],
      env: catalogue.env,
      oauthApp: catalogue.oauthApp?.registerAt,
    }
  return {
    entry: skeletonConnection(assigned.slug, assigned.name),
    extra: [],
    env: skeletonEnvOf(assigned.slug),
    oauthApp: undefined,
  }
}

/** The entry and report facts of one named connection, reading its own secrets. */
const definitionOf = (
  assigned: Assigned,
  operations: readonly string[],
  context: ConnectionContext
) => {
  const defined = originDefinitionOf(assigned, operations, context)
  const { connection, env } = connectionForAccount({
    slug: assigned.slug,
    name: assigned.name,
    env: defined.env,
    connection: defined.entry,
  })
  return { ...defined, entry: connection, env }
}

/** Every connection the calls need, named and defined, sorted by name. */
export const planConnections = (
  calls: readonly ConnectionCall[],
  context: ConnectionContext
): readonly PlannedConnection[] => {
  const { assigned } = nameConnections(calls, context)
  const usedBy = (one: Assigned) =>
    calls.filter((call) => assignedFor(assigned, call)?.name === one.name)
  return assigned
    .map((one) => {
      const operations = sortedUnique(usedBy(one).flatMap((call) => call.operation ?? []))
      const { oauthApp, ...defined } = definitionOf(one, operations, context)
      return {
        name: one.name,
        origin: one.origin,
        slug: one.slug,
        operations,
        ...defined,
        env: sortedUnique(defined.env),
        reused: one.reused,
        ...(oauthApp === undefined ? {} : { oauthApp }),
        ...(one.credential === undefined ? {} : { sourceCredential: one.credential }),
      }
    })
    .toSorted((left, right) => left.name.localeCompare(right.name))
}

type ConnectionLine = NonNullable<ImportReport['automations']>['connections'][number]

/** A planned connection as its line of the report's `automations.connections`. */
export const connectionLine = (planned: PlannedConnection): ConnectionLine => ({
  name: planned.name,
  ...(planned.origin === 'library' ? { library: planned.slug } : {}),
  origin: planned.origin,
  reused: planned.reused,
  operations: planned.operations,
  env: planned.env,
  ...(planned.oauthApp === undefined ? {} : { oauthApp: planned.oauthApp }),
  ...(planned.sourceCredential === undefined ? {} : { sourceCredential: planned.sourceCredential }),
})
