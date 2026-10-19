/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The rows of a table the records list admits the person a chat read answers
 * to (`readerRowsOf`, the list's own answer): every row, the rows a grant
 * admits on a table whose fields her role may not read, or none at all. A chat
 * count, total, list or tool reads those rows and no other, so it agrees with
 * the list she would be served.
 */

import { Effect } from 'effect'
import {
  buildGuestSession,
  buildSyntheticSession,
} from '@/application/use-cases/automations/build-guest-session'
import { readerRowsOf, type ReaderRows } from '@/application/use-cases/tables/row-read-admission'
import type { App } from '@/domain/models/app'
import type { DomainContext } from '@/infrastructure/logging/request-effect'

/** The parts of a chat reader the list's admission is asked about. */
export interface AdmissionReader {
  readonly role: string
  readonly groups: readonly string[]
  /** The signed-in user; absent for no one. */
  readonly userId?: string | undefined
  /** True for a declared agent, which reads under its declared role. */
  readonly agent?: boolean | undefined
}

/** True for a visitor signed in to nothing: no role, no identity, not an agent. */
export const isSignedOut = (reader: AdmissionReader): boolean =>
  reader.role === '' && reader.agent !== true && reader.userId === undefined

/**
 * The rows of `tableName` the records list admits `reader` and the grants
 * behind them — asked for a person, signed in or not. A declared agent reads
 * with the reach its config gives it, so `undefined` (as for a reader with no
 * identity at all).
 */
export const chatReaderRows = async (
  services: DomainContext,
  app: App | undefined,
  tableName: string,
  reader: AdmissionReader
): Promise<ReaderRows | undefined> => {
  if (app === undefined || reader.agent === true) return undefined
  const signedOut = isSignedOut(reader)
  if (reader.userId === undefined && !signedOut) return undefined
  const session =
    reader.userId === undefined ? buildGuestSession() : buildSyntheticSession(reader.userId)
  const role = signedOut ? 'guest' : reader.role
  return Effect.runPromise(
    readerRowsOf(app, tableName, { session, role, groups: reader.groups }).pipe(
      Effect.provide(services)
    )
  )
}
