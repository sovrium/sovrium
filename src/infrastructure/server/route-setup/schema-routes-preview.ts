/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 *
 * Ephemeral preview-server lifecycle — `/api/admin/schema/draft/preview/*`.
 *
 * A preview is an out-of-band Bun CLI process spawned on a SEPARATE port,
 * running a frozen copy of the current draft snapshot. The admin probes
 * the preview URL to validate the candidate schema before publishing.
 *
 * Lifecycle: starting → running → stopped (or → expired via the TTL
 * sweeper). At most ONE preview may be active per Sovrium instance — a
 * second `POST /start` while one is running returns 409.
 *
 * The DB table `system.sovrium_preview_sessions` mirrors the row
 * lifecycle for introspection; the live process descriptor (the spawned
 * child + its temp dirs) is held in a module-level singleton `Map` —
 * keyed by the constant `'current'` — because a process handle cannot be
 * serialised and `Map` mutation is the project's sanctioned escape hatch
 * for module-level mutable state.
 *
 * The draft snapshot is FROZEN at start time — it is captured into the
 * child process's `APP_SCHEMA` env var, so mutations to the draft after
 * `POST /start` never affect a running preview.
 */


import { type ChildProcess, spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sql } from 'drizzle-orm'
import { type Context } from 'hono'
import { db } from '@/infrastructure/database'
import { escapeSqlLiteral } from './schema-persistence'
import { jsonError, parseBody, readLatestDraft, withAdmin } from './schema-routes-core'
import type { App } from '@/domain/models/app'


type PreviewStatus = 'starting' | 'running' | 'stopped' | 'expired'

interface LivePreview {
  readonly previewId: string
  readonly port: number
  readonly previewUrl: string
  readonly createdByUserId: string
  readonly createdAt: string
  readonly expiresAt: string
  readonly process: ChildProcess
  readonly lockDir: string
  readonly status: PreviewStatus
}

const previewStore = new Map<'current', LivePreview>()

export const getPreview = (): LivePreview | undefined => previewStore.get('current')

const setPreview = (preview: LivePreview): void => {
  previewStore.set('current', preview)
}

export const clearPreview = (): void => {
  previewStore.delete('current')
}

const sweeperStore = new Map<'handle', ReturnType<typeof setInterval>>()


const allocatePort = (): Promise<number> =>
  new Promise<number>((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (address === null || typeof address === 'string') {
        server.close(() => reject(new Error('Failed to allocate preview port')))
        return
      }
      const port = 10_000 + (address.port % 50_001)
      server.close(() => resolve(port))
    })
  })


const insertPreviewRow = (input: {
  readonly previewId: string
  readonly port: number
  readonly draftSnapshot: unknown
  readonly expiresAt: string
  readonly createdByUserId: string
}): Promise<unknown> => {
  const snapJson = escapeSqlLiteral(JSON.stringify(input.draftSnapshot))
  const previewId = escapeSqlLiteral(input.previewId)
  const userId = escapeSqlLiteral(input.createdByUserId)
  const expiresAt = escapeSqlLiteral(input.expiresAt)
  return db.execute(
    sql.raw(
      `INSERT INTO system.sovrium_preview_sessions (preview_id, port, draft_snapshot, expires_at, status, created_by_user_id, created_at) VALUES ('${previewId}', ${Math.floor(input.port)}, '${snapJson}'::jsonb, '${expiresAt}'::timestamptz, 'starting', '${userId}', NOW())`
    )
  )
}

export const markStatus = (previewId: string, status: PreviewStatus): Promise<unknown> =>
  db.execute(
    sql.raw(
      `UPDATE system.sovrium_preview_sessions SET status = '${status}' WHERE preview_id = '${escapeSqlLiteral(previewId)}'`
    )
  )


export const teardownPreview = async (preview: Readonly<LivePreview>): Promise<void> => {
  try {
    preview.process.kill('SIGKILL')
  } catch {
  }
  await rm(preview.lockDir, { recursive: true, force: true }).catch(() => undefined)
}

const probeReadinessInBackground = async (preview: Readonly<LivePreview>): Promise<void> => {
  const deadline = Date.now() + 45_000
  while (Date.now() < deadline) {
    const current = getPreview()
    if (current === undefined || current.previewId !== preview.previewId) return
    if (current.status !== 'starting') return
    try {
      const probe = await fetch(`${preview.previewUrl}/api/health`)
      if (probe.ok) {
        const live = getPreview()
        if (live !== undefined && live.previewId === preview.previewId) {
          setPreview({ ...live, status: 'running' })
          await markStatus(preview.previewId, 'running').catch(() => undefined)
        }
        return
      }
    } catch {
    }
    await new Promise<void>((r) => setTimeout(r, 250))
  }
}


const sweepExpired = async (): Promise<void> => {
  const preview = getPreview()
  if (preview === undefined) return
  if (Date.parse(preview.expiresAt) > Date.now()) return
  await teardownPreview(preview)
  await markStatus(preview.previewId, 'expired').catch(() => undefined)
  clearPreview()
}

const ensureSweeper = (): void => {
  if (sweeperStore.has('handle')) return
  const handle = setInterval(() => {
    void sweepExpired()
  }, 15_000)
  handle.unref?.()
  sweeperStore.set('handle', handle)
}


const DEFAULT_TTL_MINUTES = 30
const MIN_TTL_MINUTES = 1
const MAX_TTL_MINUTES = 1440

export const clampTtlMinutes = (raw: unknown): number => {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return DEFAULT_TTL_MINUTES
  const rounded = Math.round(raw)
  return Math.min(MAX_TTL_MINUTES, Math.max(MIN_TTL_MINUTES, rounded))
}


const spawnPreviewServer = async (input: {
  readonly draftSnapshot: unknown
  readonly port: number
}): Promise<{ readonly process: ChildProcess; readonly lockDir: string }> => {
  const lockDir = await mkdtemp(join(tmpdir(), 'sovrium-preview-lock-'))
  const child = spawn('bun', ['run', 'src/cli/index.ts'], {
    env: {
      ...process.env,
      NODE_ENV: 'development',
      APP_SCHEMA: JSON.stringify(input.draftSnapshot),
      PORT: String(input.port),
      SOVRIUM_LOCK_DIR: lockDir,
      SCHEMA_EDIT_API_ENABLED: 'false',
    } as Record<string, string>,
    stdio: 'pipe',
    detached: true,
    cwd: process.cwd(),
  })
  return { process: child, lockDir }
}


export const launchPreview = async (input: {
  readonly draftSnapshot: unknown
  readonly createdByUserId: string
  readonly ttlMinutes: number
}): Promise<LivePreview> => {
  const previewId = randomBytes(12).toString('hex')
  const port = await allocatePort()
  const previewUrl = `http://localhost:${port}`
  const createdAt = new Date()
  const expiresAt = new Date(createdAt.getTime() + input.ttlMinutes * 60_000)

  const { process: childProcess, lockDir } = await spawnPreviewServer({
    draftSnapshot: input.draftSnapshot,
    port,
  })

  const preview: LivePreview = {
    previewId,
    port,
    previewUrl,
    createdByUserId: input.createdByUserId,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    process: childProcess,
    lockDir,
    status: 'starting',
  }
  setPreview(preview)
  ensureSweeper()

  childProcess.once('exit', () => {
    if (getPreview()?.previewId === previewId) clearPreview()
    rm(lockDir, { recursive: true, force: true }).catch(() => undefined)
  })

  await insertPreviewRow({
    previewId,
    port,
    draftSnapshot: input.draftSnapshot,
    expiresAt: expiresAt.toISOString(),
    createdByUserId: input.createdByUserId,
  }).catch(() => undefined)

  return preview
}

export const handlePreviewStart = (c: Readonly<Context>, app: Readonly<App>): Promise<Response> =>
  withAdmin(c, app, async (caller) => {
    const existing = getPreview()
    if (
      existing !== undefined &&
      (existing.status === 'starting' || existing.status === 'running')
    ) {
      return jsonError(c, 409, {
        code: 'CONFLICT',
        message: 'A preview is already running — stop it before starting another',
      })
    }

    const draft = await readLatestDraft()
    if (draft === undefined) {
      return jsonError(c, 404, { code: 'NOT_FOUND', message: 'no draft exists' })
    }

    const body = await parseBody(c)
    const ttlMinutes = clampTtlMinutes(body?.['ttlMinutes'])

    const preview = await launchPreview({
      draftSnapshot: draft.snapshot,
      createdByUserId: caller.userId,
      ttlMinutes,
    })

    void probeReadinessInBackground(preview)

    return c.json(
      {
        previewId: preview.previewId,
        previewUrl: preview.previewUrl,
        port: preview.port,
        expiresAt: preview.expiresAt,
        status: preview.status,
      },
      200
    )
  })


export const handlePreviewStatus = (c: Readonly<Context>, app: Readonly<App>): Promise<Response> =>
  withAdmin(c, app, () => {
    const preview = getPreview()
    if (preview === undefined || preview.status === 'stopped' || preview.status === 'expired') {
      return Promise.resolve(c.json({ active: false }, 200))
    }
    return Promise.resolve(
      c.json(
        {
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
        },
        200
      )
    )
  })


export const handlePreviewStop = (c: Readonly<Context>, app: Readonly<App>): Promise<Response> =>
  withAdmin(c, app, async () => {
    const preview = getPreview()
    if (preview === undefined || preview.status === 'stopped' || preview.status === 'expired') {
      return jsonError(c, 404, { code: 'NOT_FOUND', message: 'no active preview to stop' })
    }
    await teardownPreview(preview)
    const stoppedAt = new Date().toISOString()
    await markStatus(preview.previewId, 'stopped').catch(() => undefined)
    clearPreview()
    return c.json({ previewId: preview.previewId, status: 'stopped', stoppedAt }, 200)
  })
