/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { Client } from 'pg'
import { pinPostgresSslMode } from '@/domain/kernel/sql/postgres-ssl-mode'
import { logError } from '@/infrastructure/logging/logger'
import type { Context, Scope } from 'effect'

/**
 * One PostgreSQL `LISTEN` connection as a scoped layer.
 *
 * PostgreSQL cannot make an outbound call from PL/pgSQL, so a trigger that
 * needs one (an AI refinement, an embedding) emits `pg_notify` and a listener
 * does the round trip out of band. Every such listener is the same skeleton:
 * decide whether this boot has a reason to listen, open a dedicated `pg`
 * connection, optionally install the triggers, `LISTEN` on one channel, hand
 * each payload to a handler that may never crash the server, and `UNLISTEN`
 * and close when the scope ends. This module is that skeleton; each listener
 * keeps only its gate and its payload handling.
 *
 * ## The connection is a scoped resource (standing rule E3)
 *
 * `Effect.acquireRelease` over the `pg` `Client`, inside a `Layer.effect` —
 * Effect 4's SCOPED layer constructor; there is no `Layer.scoped`. The scope
 * belongs to the server's domain `ManagedRuntime`, so the connection closes on
 * success, on failure and on interruption alike, and two servers in one process
 * never share it.
 *
 * The service value is a {@link PgNotifyListenerStatus} rather than nothing: a
 * layer providing `never` cannot be named in a merged list, and "did this boot
 * actually LISTEN?" is the one fact a caller (or a test) wants from it.
 */

/** What a built listener layer reports about itself. */
export interface PgNotifyListenerStatus {
  /** `true` only when a `pg` connection is open and `LISTEN` succeeded. */
  readonly listening: boolean
}

const INERT: PgNotifyListenerStatus = { listening: false }

/** What one connection is opened for. */
export interface PgNotifySetup {
  /** The channel to `LISTEN` on; notifications on any other channel are ignored. */
  readonly channel: string
  /** Statements run once, in order, before `LISTEN`; each failure is swallowed. */
  readonly setupSql: readonly string[]
  /** Called with each non-empty payload on {@link PgNotifySetup.channel}. */
  readonly onNotification: (raw: string) => void
  /** Told why the connection could not be opened (it then resolves `undefined`). */
  readonly onOpenFailure: (error: unknown) => void
}

/**
 * The `pg` boundary as one injectable pair.
 *
 * Taken as a parameter so the acquire/release contract can be driven by a unit
 * test without `mock.module`, which contaminates Bun's process-global module
 * cache for every later test file (`@docs/infrastructure/testing/bun-test.md`).
 * Nothing in production passes anything but {@link livePgNotifyDriver}.
 */
export interface PgNotifyListenerDriver {
  readonly open: (databaseUrl: string, setup: PgNotifySetup) => Promise<Client | undefined>
  readonly close: (client: Client, channel: string) => Promise<void>
}

/**
 * Deadline for opening the LISTEN connection, in ms. pg waits forever by
 * default, so an address that accepts nothing would hold the listener's boot.
 */
const LISTENER_CONNECT_TIMEOUT_MS = 10_000

/**
 * Open the connection, run the setup statements and subscribe — or resolve
 * `undefined`.
 *
 * Never rejects: a listener that cannot connect is a degraded feature, not a
 * failed boot. The `catch` has to be here rather than in the caller, because
 * this thunk is the acquire half of an `Effect.acquireRelease` and a rejecting
 * acquire would take the whole layer build down with it.
 *
 * @total
 */
const connect = async (databaseUrl: string, setup: PgNotifySetup): Promise<Client | undefined> => {
  const client = new Client({
    connectionString: pinPostgresSslMode(databaseUrl),
    connectionTimeoutMillis: LISTENER_CONNECT_TIMEOUT_MS,
  })
  try {
    await client.connect()

    // Every statement runs sequentially on the one connection. A pg `Client` is
    // a single connection, NOT a pool: overlapping `query()` calls are silently
    // queued in pg@8 (with a deprecation warning) and rejected outright in pg@9.
    // Fanning them out would only ever have looked parallel, while putting the
    // code on a path that breaks at the next major bump.
    await setup.setupSql.reduce(
      (chain, statement) =>
        chain.then(() =>
          client.query(statement).then(
            () => undefined,
            () => undefined
          )
        ),
      Promise.resolve()
    )

    client.on('notification', (message) => {
      if (message.channel !== setup.channel || !message.payload) return
      setup.onNotification(message.payload)
    })
    client.on('error', () => {
      // Connection errors are recoverable on the next restart; silently ignore
      // so the server does not crash while tests tear down.
    })
    await client.query(`LISTEN ${setup.channel}`)
    return client
  } catch (error: unknown) {
    setup.onOpenFailure(error)
    await client.end().catch(() => undefined)
    return undefined
  }
}

/**
 * `UNLISTEN` then close. Best-effort on both, and never rejects.
 *
 * @total
 */
const disconnect = async (client: Client, channel: string): Promise<void> => {
  await client.query(`UNLISTEN ${channel}`).catch(() => undefined)
  await client.end().catch(() => undefined)
}

/** The production `pg` boundary. */
export const livePgNotifyDriver: PgNotifyListenerDriver = { open: connect, close: disconnect }

/** Why a boot listens: where, what to install first, and what to do with a payload. */
export interface PgNotifySubscription {
  readonly databaseUrl: string
  readonly setupSql?: readonly string[]
  /** Handles one payload. A rejection is logged; it never reaches the server. */
  readonly onPayload: (raw: string) => Promise<void>
}

export interface PgNotifyListenerOptions<R = never> {
  /** The `pg_notify` channel. */
  readonly channel: string
  /** Log prefix, such as `[ai-compute]`. */
  readonly label: string
  /**
   * Whether this boot has a reason to listen: the subscription, or `undefined`
   * to resolve inert without opening a connection. It runs in the layer's
   * scope, so what it acquires for the payload handler lives as long as the
   * listener does; what it reads from the composition stays required on the layer.
   */
  readonly shouldListen: Effect.Effect<PgNotifySubscription | undefined, never, Scope.Scope | R>
  /** Told why the connection could not be opened. Silent by default. */
  readonly onOpenFailure?: (error: unknown) => void
  readonly driver?: PgNotifyListenerDriver
}

/** The listener, scoped to the layer that builds it. */
export const makePgNotifyListenerLayer = <Identifier, R = never>(
  service: Context.Key<Identifier, PgNotifyListenerStatus>,
  options: PgNotifyListenerOptions<R>
): Layer.Layer<Identifier, never, Exclude<R, Scope.Scope>> =>
  Layer.effect(
    service,
    Effect.gen(function* () {
      const subscription = yield* options.shouldListen
      if (subscription === undefined) return INERT
      const driver = options.driver ?? livePgNotifyDriver
      const { channel, label } = options

      const client = yield* Effect.acquireRelease(
        // effect-promise: total -- `connect` catches its own rejections and resolves `undefined`; see its doc comment.
        Effect.promise(() =>
          driver.open(subscription.databaseUrl, {
            channel,
            setupSql: subscription.setupSql ?? [],
            onNotification: (raw) => {
              // Fire-and-forget: the handler is best-effort background work and
              // must never crash the server on a transient failure.
              void subscription.onPayload(raw).catch((error: unknown) => {
                logError(`${label} payload handler error`, error)
              })
            },
            onOpenFailure: options.onOpenFailure ?? (() => undefined),
          })
        ),
        (open) =>
          open === undefined
            ? Effect.void
            : // effect-promise: total -- `disconnect` swallows both cleanup rejections.
              Effect.promise(() => driver.close(open, channel))
      )

      return client === undefined ? INERT : { listening: true }
    })
  )
