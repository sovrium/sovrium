/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Browser Session Repository Port.
 *
 * Keeps the cookie jar of a named browser session (`browser/run` `session`)
 * between runs. The jar is the session's credential: the adapter seals it
 * with the instance's token key before it reaches the database and opens it
 * on read, so no cookie value is ever readable from a table. Callers see the
 * jar as the opaque text the browser driver exported.
 *
 * Sessions are named app-wide: two automations naming the same session share
 * it, as the schema documents.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

export class BrowserSessionDatabaseError extends Data.TaggedError('BrowserSessionDatabaseError')<{
  readonly cause: unknown
}> {}

export class BrowserSessionRepository extends Context.Service<
  BrowserSessionRepository,
  {
    /** The jar stored under `name`, or `undefined` when none is (or it cannot be opened). */
    readonly load: (name: string) => Effect.Effect<string | undefined, BrowserSessionDatabaseError>
    /** Store `jar` under `name`, replacing the one before. */
    readonly save: (name: string, jar: string) => Effect.Effect<void, BrowserSessionDatabaseError>
  }
>()('BrowserSessionRepository') {}
