/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { type Context } from 'hono'
import { resolvePruneSet, type VersionRow } from '@/domain/models/schema/retention'
import { deleteVersionsByNumbers, readAllVersionRows } from './schema-persistence'
import { jsonError, parseBody, withAdmin } from './schema-routes-core'
import type { App } from '@/domain/models/app'

const projectForResolver = (
  rows: ReadonlyArray<Record<string, unknown>>
): ReadonlyArray<VersionRow> =>
  rows.map((row) => {
    const versionNumber = Number(row['version_number'])
    const restoredRaw = row['restored_from_version']
    const restoredFromVersion =
      restoredRaw === null || restoredRaw === undefined ? undefined : Number(restoredRaw)
    return restoredFromVersion !== undefined
      ? { versionNumber, restoredFromVersion }
      : { versionNumber }
  })

const readKeep = (body: Readonly<Record<string, unknown>> | undefined): number | undefined => {
  const raw = body?.['keep']
  if (raw === undefined) return undefined
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return Number.NaN
  return raw
}

export const handlePruneVersions = (c: Readonly<Context>, app: Readonly<App>): Promise<Response> =>
  withAdmin(c, app, async () => {
    const body = await parseBody(c)
    const keep = readKeep(body)
    if (keep !== undefined && (Number.isNaN(keep) || keep < 1)) {
      return jsonError(c, 400, {
        code: 'VALIDATION_ERROR',
        message: 'keep must be a positive integer',
      })
    }

    const rows = await readAllVersionRows()
    const resolverInput = projectForResolver(rows)
    const { toKeep, toPrune } = resolvePruneSet(resolverInput, keep)
    const prunedCount = await deleteVersionsByNumbers([...toPrune])
    const retainedVersionNumbers =
      [...toKeep].sort((a, b) => a - b)
    return c.json(
      {
        pruned: prunedCount,
        kept: retainedVersionNumbers.length,
        retainedVersionNumbers,
      },
      200
    )
  })
