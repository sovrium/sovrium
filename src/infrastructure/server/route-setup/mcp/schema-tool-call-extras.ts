/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { resolveDriftPosture } from '@/infrastructure/server/route-setup/drift-posture'
import {
  readAllVersionRows,
  readLatestDraft,
} from '@/infrastructure/server/route-setup/schema-persistence'
import type { SchemaToolCallInput, SchemaToolResultBuilder } from './schema-tool-call-types'


const topLevelKeysOf = (snapshot: Readonly<Record<string, unknown>>): ReadonlySet<string> =>
  new Set(Object.keys(snapshot))

const findFileAncestorSnapshot = (
  rows: ReadonlyArray<Record<string, unknown>>
): Record<string, unknown> | undefined => {
  const fileRow = rows.find((r) => {
    const s = r['source']
    return s === 'config-file' || s === 'env' || s === undefined || s === null
  })
  const snapshot = fileRow?.['snapshot']
  return typeof snapshot === 'object' && snapshot !== null
    ? (snapshot as Record<string, unknown>)
    : undefined
}

const computeChangedPaths = (
  live: Readonly<Record<string, unknown>>,
  file: Readonly<Record<string, unknown>>
): ReadonlyArray<{ readonly path: string }> => {
  const liveKeys = topLevelKeysOf(live)
  const fileKeys = topLevelKeysOf(file)
  const allKeys = new Set([...liveKeys, ...fileKeys])
  return Array.from(allKeys)
    .filter((key) => {
      const inLive = liveKeys.has(key)
      const inFile = fileKeys.has(key)
      if (inLive !== inFile) return true
      return JSON.stringify(live[key]) !== JSON.stringify(file[key])
    })
    .map((path) => ({ path }))
}

export const handleDiff = async (
  input: SchemaToolCallInput,
  successResult: SchemaToolResultBuilder
): Promise<Response> => {
  const drift = await resolveDriftPosture()
  if (drift.driftStatus === 'in-sync') {
    return successResult(input, { driftStatus: drift.driftStatus, changes: [] })
  }
  const rows = await readAllVersionRows()
  const liveSnapshot =
    rows[0] && typeof rows[0]['snapshot'] === 'object' && rows[0]['snapshot'] !== null
      ? (rows[0]['snapshot'] as Record<string, unknown>)
      : {}
  const fileSnapshot = findFileAncestorSnapshot(rows) ?? {}
  const changes = computeChangedPaths(liveSnapshot, fileSnapshot)
  return successResult(input, { driftStatus: drift.driftStatus, changes })
}


interface PreviewErrorBuilder {
  readonly errorResult: (
    input: SchemaToolCallInput,
    body: Readonly<Record<string, unknown>> & { readonly code: string }
  ) => Response
}

export const handlePreviewStart = async (
  input: SchemaToolCallInput,
  successResult: SchemaToolResultBuilder,
  builders: PreviewErrorBuilder
): Promise<Response> => {
  const { launchPreview, getPreview, clampTtlMinutes } =
    await import('@/infrastructure/server/route-setup/schema-routes-preview')
  const existing = getPreview()
  if (existing !== undefined && (existing.status === 'starting' || existing.status === 'running')) {
    return builders.errorResult(input, {
      code: 'CONFLICT',
      message: 'A preview is already running — stop it before starting another',
    })
  }
  const draft = await readLatestDraft()
  if (draft === undefined) {
    return builders.errorResult(input, { code: 'NOT_FOUND', message: 'no draft exists' })
  }
  const ttlMinutes = clampTtlMinutes(input.args['ttlMinutes'])
  const preview = await launchPreview({
    draftSnapshot: draft.snapshot,
    createdByUserId: input.caller.userId ?? 'mcp-system',
    ttlMinutes,
  })
  return successResult(input, {
    previewId: preview.previewId,
    previewUrl: preview.previewUrl,
    port: preview.port,
    expiresAt: preview.expiresAt,
    status: preview.status,
  })
}

export const handlePreviewStatus = async (
  input: SchemaToolCallInput,
  successResult: SchemaToolResultBuilder
): Promise<Response> => {
  const { getPreview } = await import('@/infrastructure/server/route-setup/schema-routes-preview')
  const preview = getPreview()
  if (preview === undefined || preview.status === 'stopped' || preview.status === 'expired') {
    return successResult(input, { active: false })
  }
  return successResult(input, {
    active: true,
    preview: {
      previewId: preview.previewId,
      previewUrl: preview.previewUrl,
      port: preview.port,
      status: preview.status,
      expiresAt: preview.expiresAt,
      createdAt: preview.createdAt,
      createdByUserId: preview.createdByUserId,
    },
  })
}

export const handlePreviewStop = async (
  input: SchemaToolCallInput,
  successResult: SchemaToolResultBuilder,
  builders: PreviewErrorBuilder
): Promise<Response> => {
  const { getPreview, teardownPreview, clearPreview, markStatus } =
    await import('@/infrastructure/server/route-setup/schema-routes-preview')
  const preview = getPreview()
  if (preview === undefined || preview.status === 'stopped' || preview.status === 'expired') {
    return builders.errorResult(input, {
      code: 'NOT_FOUND',
      message: 'no active preview to stop',
    })
  }
  return teardownPreview(preview)
    .then(() => markStatus(preview.previewId, 'stopped').catch(() => undefined))
    .then(() => {
      clearPreview()
      return successResult(input, {
        previewId: preview.previewId,
        status: 'stopped',
        stoppedAt: new Date().toISOString(),
      })
    })
}
