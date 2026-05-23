/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { computeDriftStatus, type AppVersionSource } from '@/domain/models/system/app-version'
import { readAllVersionRows } from '@/infrastructure/server/route-setup/schema-persistence'

const normalizeSource = (raw: unknown): AppVersionSource => {
  if (raw === 'env' || raw === 'api' || raw === 'mcp' || raw === 'restore') return raw
  return 'config-file'
}

export const resolveDriftPosture = async (): Promise<{
  readonly source: AppVersionSource | undefined
  readonly fileChecksum: string | undefined
  readonly driftStatus: ReturnType<typeof computeDriftStatus>
}> => {
  const rows = await readAllVersionRows()
  const activeRow = rows[0]
  const source = activeRow !== undefined ? normalizeSource(activeRow['source']) : undefined
  const rawFileChecksum = activeRow?.['file_checksum']
  const fileChecksum = typeof rawFileChecksum === 'string' ? rawFileChecksum : undefined
  const fileLaunchedAncestorExists = rows.some((r) => {
    const s = normalizeSource(r['source'])
    return s === 'config-file' || s === 'env'
  })
  const fileAhead = process.env['SOVRIUM_FORCE_FILE_AHEAD'] === 'true'
  return {
    source,
    fileChecksum,
    driftStatus: computeDriftStatus(source, fileLaunchedAncestorExists, fileAhead),
  }
}

export const composeConfigHeader = async (configHash: string): Promise<string> => {
  try {
    const { driftStatus } = await resolveDriftPosture()
    return `${configHash};drift=${driftStatus}`
  } catch {
    return configHash
  }
}
