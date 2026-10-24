/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Use cases for the **App Connections** admin read endpoint family
 * (`GET /api/admin/connections` + `.../:id`) — the last data page of the pure
 * operational admin DATA console (`/_admin/data/connections`).
 *
 * The application layer owns ALL projection + derivation logic:
 *   - reading `system.connections` rows + the per-connection secret-free token
 *     summary (`ConnectionUserSummary[]`) from `system.connection_tokens`,
 *   - projecting each connection to the HARD ALLOW-LIST (`id`, `name`,
 *     `provider`, `type`, `tokenCount`, soonest `expiresAt`, derived `status`,
 *     `createdAt`) — NEVER `credentials` / `accessToken` / `refreshToken` (S4),
 *   - deriving the connection-level + per-user `status` via the pure domain
 *     `deriveConnectionStatus` helper,
 *   - assembling + response-schema-validating both bodies against the
 *     `.strict()` Zod allow-list (a stray secret key fails the parse).
 *
 * Only the raw `connections` / `connection_tokens` reads live in the
 * infrastructure repositories, reused via {@link ConnectionRepository} +
 * {@link ConnectionTokenRepository} (their `list` / `findById` /
 * `listUsersForConnection` methods already return secret-free shapes). The audit
 * emits (`connection.{list|detail}.queried`) stay in the route after a
 * successful read.
 */

import { Effect } from 'effect'
import {
  AdminAutomationsRepository,
  type AdminAutomationsDatabaseError,
  type LatestStepRun,
} from '@/application/ports/repositories/automations/admin-automations-repository'
import {
  type ConnectionDatabaseError,
  ConnectionRepository,
} from '@/application/ports/repositories/connections/connection-repository'
import {
  type ConnectionAppTokenSummary,
  type ConnectionTokenDatabaseError,
  ConnectionTokenRepository,
  type ConnectionUserSummary,
} from '@/application/ports/repositories/connections/connection-token-repository'
import {
  connectionsListResponseSchema,
  connectionDetailResponseSchema,
  type ConnectionListItem,
  type ConnectionUserToken,
} from '@/domain/models/api/admin/connections/connections'
import { decodeSafe } from '@/domain/models/api/combinators/decode'
import {
  deriveConnectionListStatus,
  deriveConnectionRowAction,
  deriveTokenStatus,
  soonestExpiryMs,
} from '@/domain/models/app/admin/connection-status'
import {
  connectionUsesOf,
  latestRunOfUses,
  type ConnectionUse,
} from '@/domain/models/app/connections/connection-usage-service'
import {
  connectionLabel,
  declaredLabelsOf,
  NO_DECLARED_LABELS,
  unconfiguredNamesOf,
  type DeclaredConfig,
  type DeclaredConnectionLabels,
} from './connection-declared-facts'

/** Where a connection is used and when a call to it last ran. */
interface ConnectionUsage {
  readonly uses: readonly ConnectionUse[]
  readonly lastRun: LatestStepRun | undefined
}

/** No configuration in hand: a connection read outside a request is used by nothing known. */
const NO_USAGE: ConnectionUsage = { uses: [], lastRun: undefined }

/**
 * Read where each of `names` is used, then the newest run of the steps that
 * call it — the latest run of every such step in ONE grouped read, each
 * connection then picking its newest among its own steps.
 */
const usagesOf = (
  config: DeclaredConfig,
  names: readonly string[]
): Effect.Effect<
  ReadonlyMap<string, ConnectionUsage>,
  AdminAutomationsDatabaseError,
  AdminAutomationsRepository
> =>
  Effect.gen(function* () {
    const usesByName = names.map(
      (name) => [name, connectionUsesOf(config.automations, name)] as const
    )
    const steps = [
      ...new Map(
        usesByName.flatMap(([, uses]) =>
          uses.flatMap((use) =>
            use.stepNames.map(
              (stepName) =>
                [`${use.name}\u0000${stepName}`, { automationName: use.name, stepName }] as const
            )
          )
        )
      ).values(),
    ]
    const runs = yield* (yield* AdminAutomationsRepository).findLatestRunPerStep(steps)
    return new Map(
      usesByName.map(
        ([name, uses]) => [name, { uses, lastRun: latestRunOfUses(uses, runs) }] as const
      )
    )
  })

/** The three usage facts a connection row carries. */
const usageFields = ({ uses, lastRun }: ConnectionUsage) => ({
  usedBy: uses.map(({ kind, name, label }) => ({ kind, name, label })),
  lastUsedAt: expiryToIso(lastRun?.startedAt),
  lastError: lastRun?.status === 'failed' ? (lastRun.error ?? null) : null,
})

// ─── Pure coercion + projection helpers ──────────────────────────────────────

/** Coerce a dialect-native timestamp to an ISO 8601 string. */
function toIso(raw: Readonly<Date> | string): string {
  return raw instanceof Date ? raw.toISOString() : new Date(raw).toISOString()
}

/** Coerce a dialect-native nullable expiry to an ISO 8601 string, or `null`. */
function expiryToIso(raw: Readonly<Date> | string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null
  return toIso(raw)
}

/**
 * Project a raw `system.connections` row + its token summary to the canonical
 * HARD ALLOW-LIST list item. Reads ONLY the allow-listed columns by name — the
 * raw row is NEVER spread, so `credentials` (NOT NULL on the table) cannot ride
 * along (S4). `tokenCount` is the summary length; the connection-level
 * `expiresAt` is the soonest token expiry (null when no tokens / no expiry); the
 * `status` derives from that soonest expiry.
 */
function buildConnectionItem(
  row: Readonly<Record<string, unknown>>,
  tokens: readonly ConnectionUserSummary[],
  appToken: Readonly<ConnectionAppTokenSummary> | undefined,
  named: {
    readonly declaredLabels: DeclaredConnectionLabels
    readonly usage: ConnectionUsage
    readonly unconfigured?: ReadonlySet<string>
  }
): ConnectionListItem {
  const { declaredLabels, usage, unconfigured } = named
  // The count is the UNION of the two stores, derived from which rows actually
  // exist rather than from the connection's declared `scope`. That matters:
  // these rows are read from `system.connections`, which is also populated by
  // paths that have no `app.connections[]` entry at all, so a scope-driven
  // count would report every such connection as unconnected. "One shared
  // credential counts as one."
  const soonestMs = soonestExpiryMs([
    ...tokens.map((t) => t.expiresAt),
    ...(appToken === undefined ? [] : [appToken.expiresAt]),
  ])
  const type = String(row['type'])
  const name = String(row['name'])
  const status = deriveConnectionListStatus(
    type,
    [...tokens, ...(appToken === undefined ? [] : [appToken])],
    Date.now(),
    unconfigured?.has(name) === true
  )
  const tokenCount = tokens.length + (appToken === undefined ? 0 : 1)
  const provider = String(row['provider'])
  return {
    id: String(row['id']),
    name,
    provider,
    label: connectionLabel(name, provider, declaredLabels.get(name)),
    type,
    tokenCount,
    expiresAt: soonestMs === null ? null : new Date(soonestMs).toISOString(),
    status,
    // Server-computed display hint so the dashboard data-table can gate its
    // connect/reconnect/disconnect buttons with a single-field `visibleWhen`
    // (the compound rule — type + tokenCount + status — stays here, not config).
    rowAction: deriveConnectionRowAction(type, tokenCount, status),
    createdAt: toIso(row['createdAt'] as Date | string),
    ...usageFields(usage),
  }
}

/**
 * Project a secret-free token summary to the canonical per-user token row —
 * EXACTLY the three allow-listed keys (`userId`, `expiresAt`, `status`). The
 * summary already excludes the access/refresh-token plaintext (S4).
 */
function buildUserToken(summary: Readonly<ConnectionUserSummary>): ConnectionUserToken {
  return {
    userId: summary.userId,
    expiresAt: expiryToIso(summary.expiresAt),
    status: deriveTokenStatus(summary),
  }
}

// ─── List use case ────────────────────────────────────────────────────────────

/**
 * Outcome of the connection-list build. `Ok` carries the response-schema-
 * validated body; `ValidationFailed` signals the assembled body failed the
 * `.strict()` response gate (the route maps this to a 500 + logs the schema decode error —
 * a stray secret field would fail the parse rather than leak).
 */
export type ConnectionsListOutcome =
  | { readonly _tag: 'Ok'; readonly body: { readonly connections: readonly ConnectionListItem[] } }
  | { readonly _tag: 'ValidationFailed'; readonly error: unknown }

/** The connections' usage, by name: read from the configuration and the run history, or not at all. */
type UsageReader<E, R> = (
  names: readonly string[]
) => Effect.Effect<ReadonlyMap<string, ConnectionUsage>, E, R>

const noUsage: UsageReader<never, never> = () => Effect.succeed(new Map())

/** The list build, naming each connection with `declaredLabels` where it has one. */
const buildConnectionsList = <E = never, R = never>(
  declaredLabels: DeclaredConnectionLabels,
  readUsage: UsageReader<E, R>,
  unconfigured: ReadonlySet<string> = new Set()
): Effect.Effect<
  ConnectionsListOutcome,
  ConnectionDatabaseError | ConnectionTokenDatabaseError | E,
  ConnectionRepository | ConnectionTokenRepository | R
> =>
  Effect.gen(function* () {
    const connRepo = yield* ConnectionRepository
    const tokenRepo = yield* ConnectionTokenRepository

    const rows = yield* connRepo.list
    const usages = yield* readUsage(rows.map((row) => String(row['name'])))

    const connections = yield* Effect.forEach(rows, (row) =>
      Effect.gen(function* () {
        const connectionId = String(row['id'])
        const tokens = yield* tokenRepo.listUsersForConnection({ connectionId })
        const appToken = yield* tokenRepo.findAppSummary({ connectionId })
        const usage = usages.get(String(row['name'])) ?? NO_USAGE
        return buildConnectionItem(row, tokens, appToken, { declaredLabels, usage, unconfigured })
      })
    )

    const body = { connections }
    const parsed = decodeSafe(connectionsListResponseSchema)(body)
    if (!parsed.success) {
      return { _tag: 'ValidationFailed', error: parsed.error } as const
    }
    return { _tag: 'Ok', body: { connections: parsed.data.connections } } as const
  })

/**
 * Build the connection-list body. Reads every `system.connections` row, then
 * the per-connection token summary, projects to the allow-list, and validates
 * against the `.strict()` list schema. `declared` is the app's declared
 * `app.connections[]`, read only for the `label` each entry declares.
 */
export const BuildConnectionsListFor = (
  declared: ReadonlyArray<{ readonly name: string; readonly label?: string }> | undefined
): Effect.Effect<
  ConnectionsListOutcome,
  ConnectionDatabaseError | ConnectionTokenDatabaseError,
  ConnectionRepository | ConnectionTokenRepository
> =>
  buildConnectionsList(declaredLabelsOf(declared), noUsage).pipe(
    Effect.withSpan('admin.build-connections-list-for')
  )

/**
 * The connection-list body the admin read answers: each connection named as
 * declared, with the automations that call it (`usedBy`) and when a call to it
 * last ran and how (`lastUsedAt`, `lastError`), read from the run history.
 */
export const BuildConnectionsListWithUsage = (
  config: DeclaredConfig
): Effect.Effect<
  ConnectionsListOutcome,
  ConnectionDatabaseError | ConnectionTokenDatabaseError | AdminAutomationsDatabaseError,
  ConnectionRepository | ConnectionTokenRepository | AdminAutomationsRepository
> =>
  buildConnectionsList(
    declaredLabelsOf(config.connections),
    (names) => usagesOf(config, names),
    unconfiguredNamesOf(config)
  ).pipe(Effect.withSpan('admin.build-connections-list-with-usage'))

/**
 * The connection-list body without the app's declared labels in hand, for the
 * roll-ups that read it outside a request: each row is named `name · provider`.
 */
export const BuildConnectionsList: Effect.Effect<
  ConnectionsListOutcome,
  ConnectionDatabaseError | ConnectionTokenDatabaseError,
  ConnectionRepository | ConnectionTokenRepository
> = buildConnectionsList(NO_DECLARED_LABELS, noUsage).pipe(
  Effect.withSpan('admin.build-connections-list')
)

// ─── Detail use case ──────────────────────────────────────────────────────────

/**
 * Outcome of the connection-detail build. `Ok` carries the response-schema-
 * validated body; `NotFound` signals an unknown connection id (the route maps
 * this to the anti-enum 404); `ValidationFailed` signals the assembled body
 * failed the response gate (route → 500).
 */
export type ConnectionDetailOutcome =
  | {
      readonly _tag: 'Ok'
      readonly body: {
        readonly connection: ConnectionListItem
        readonly tokens: readonly ConnectionUserToken[]
      }
    }
  | { readonly _tag: 'NotFound' }
  | { readonly _tag: 'ValidationFailed'; readonly error: unknown }

/**
 * Build the connection-detail body for a single connection id. A miss
 * (`findById` returns undefined — unknown id) resolves to `NotFound`. On a hit,
 * the per-user token roster is loaded (secret-free) and shaped into the
 * connection header + token rows.
 */
export const BuildConnectionDetail = (
  id: string,
  config: DeclaredConfig = {}
): Effect.Effect<
  ConnectionDetailOutcome,
  ConnectionDatabaseError | ConnectionTokenDatabaseError | AdminAutomationsDatabaseError,
  ConnectionRepository | ConnectionTokenRepository | AdminAutomationsRepository
> =>
  Effect.gen(function* () {
    const connRepo = yield* ConnectionRepository
    const tokenRepo = yield* ConnectionTokenRepository

    const row = yield* connRepo.findById(id)
    if (row === undefined) {
      return { _tag: 'NotFound' } as const
    }

    const connectionId = String(row['id'])
    const summaries = yield* tokenRepo.listUsersForConnection({ connectionId })
    const appToken = yield* tokenRepo.findAppSummary({ connectionId })
    const name = String(row['name'])
    const usage = (yield* usagesOf(config, [name])).get(name) ?? NO_USAGE
    const body = {
      // The `tokens` roster stays per-user only: the shared credential has no
      // user, and inventing one would put a userId in the roster that names
      // nobody. It still contributes to the header's `tokenCount`/`status`.
      connection: buildConnectionItem(row, summaries, appToken, {
        declaredLabels: declaredLabelsOf(config.connections),
        usage,
        unconfigured: unconfiguredNamesOf(config),
      }),
      tokens: summaries.map((summary) => buildUserToken(summary)),
    }

    const parsed = decodeSafe(connectionDetailResponseSchema)(body)
    if (!parsed.success) {
      return { _tag: 'ValidationFailed', error: parsed.error } as const
    }
    return {
      _tag: 'Ok',
      body: { connection: parsed.data.connection, tokens: parsed.data.tokens },
    } as const
  }).pipe(Effect.withSpan('admin.build-connection-detail'))
