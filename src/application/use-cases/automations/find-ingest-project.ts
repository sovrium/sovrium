/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Find the sender a telemetry key belongs to (`auth: { type: projectKey }`).
 *
 * The key a Sentry-compatible client or an OTLP exporter presents is looked up
 * by equality in `keyField` of `table`, as the system: the sender's row is
 * configuration the operator wrote into their own table, not data a caller is
 * allowed to read. What comes back is the row REDUCED to what a run may see —
 * its `id`, and the `projectField` value when one is declared — so the key
 * never travels further than this lookup.
 */

import { Effect, Option } from 'effect'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import { buildSystemSession } from '@/application/use-cases/automations/build-guest-session'

/** Where a protocol trigger's senders and their keys live. */
export interface IngestProjectSource {
  readonly table: string
  readonly keyField: string
  readonly projectField?: string | undefined
}

/** The sender as a run sees it: `id`, plus the `projectField` value when declared. */
export type IngestProject = Readonly<Record<string, unknown>> & { readonly id: unknown }

/** Reduce a sender row to what a run may see. */
const projectOf = (
  row: Readonly<Record<string, unknown>>,
  source: IngestProjectSource
): IngestProject => ({
  id: row['id'],
  ...(source.projectField === undefined ? {} : { [source.projectField]: row[source.projectField] }),
})

/**
 * The sender holding `key`, or none. A database failure (the table gone, the
 * connection lost) fails the effect: an unreadable key table must answer an
 * error, never a refusal that reads like an unknown key.
 */
export const findIngestProject = Effect.fn('automations.find-ingest-project')(function* (
  source: IngestProjectSource,
  key: string
) {
  const repository = yield* TableRepository
  const rows = yield* repository.listRecords({
    session: buildSystemSession(),
    tableName: source.table,
    filter: { and: [{ field: source.keyField, operator: 'equals', value: key }] },
    limit: 1,
  })
  return Option.map(Option.fromUndefinedOr(rows[0]), (row) => projectOf(row, source))
})
