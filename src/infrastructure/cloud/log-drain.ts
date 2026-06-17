/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import { sql } from 'drizzle-orm'
import { db } from '@/infrastructure/database'
import { nowSqlLiteral } from '@/infrastructure/database/sql/dialect-ddl'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import type { App } from '@/domain/models/app'


const APP_LOGS_TABLE = 'app_logs'

const SLUG_COLUMN_CANDIDATES = ['app_slug', 'app'] as const

const KNOWN_LEVELS = new Set(['debug', 'info', 'warn', 'error'])

const TAIL_BUFFER_LIMIT = 500

const DEFAULT_TAIL_LINES = 100

export const requestSourceStore = new AsyncLocalStorage<string>()

const drainingStore = new AsyncLocalStorage<true>()

let capturedSlug: string | undefined

let recentLines: readonly CapturedLine[] = []

const appDeclaresAppLogs = (app: Readonly<App>): boolean =>
  (app.tables ?? []).some((table) => table.name === APP_LOGS_TABLE)

const resolveSlugColumn = (app: Readonly<App>): string => {
  const table = (app.tables ?? []).find((candidate) => candidate.name === APP_LOGS_TABLE)
  const fieldNames = new Set((table?.fields ?? []).map((field) => field.name))
  return SLUG_COLUMN_CANDIDATES.find((candidate) => fieldNames.has(candidate)) ?? 'app_slug'
}

const sqliteDb = (): any => db as any

interface CapturedLine {
  readonly level: string
  readonly message: string
  readonly source: string | undefined
}

const deriveLevel = (message: string, streamLevel: 'info' | 'warn' | 'error'): string => {
  const match = message.match(/\[([A-Za-z]+)\]/g)
  const token = match
    ?.map((raw) => raw.slice(1, -1).toLowerCase())
    .find((candidate) => KNOWN_LEVELS.has(candidate))
  if (token) return token
  return streamLevel
}

const sourceBind = (source: string | undefined): string | null => source ?? null

const insertLinePg = async (
  slugColumn: string,
  slug: string,
  line: CapturedLine
): Promise<void> => {
  await db.execute(sql`
    INSERT INTO ${sql.identifier(APP_LOGS_TABLE)} (${sql.identifier(slugColumn)}, "level", "message", "logged_at", "source")
    VALUES (${slug}, ${line.level}, ${line.message}, ${sql.raw(nowSqlLiteral())}, ${sourceBind(line.source)})
  `)
}

const insertLineSqlite = async (
  slugColumn: string,
  slug: string,
  line: CapturedLine
): Promise<void> => {
  const sdb = sqliteDb()
  await sdb.run(sql`
    INSERT INTO ${sql.identifier(APP_LOGS_TABLE)} (${sql.identifier(slugColumn)}, level, message, logged_at, source)
    VALUES (${slug}, ${line.level}, ${line.message}, ${sql.raw(nowSqlLiteral())}, ${sourceBind(line.source)})
  `)
}

const insertLine = async (slugColumn: string, slug: string, line: CapturedLine): Promise<void> => {
  try {
    await (isSqliteRuntime()
      ? insertLineSqlite(slugColumn, slug, line)
      : insertLinePg(slugColumn, slug, line))
  } catch {
  }
}

const persist = (slug: string, line: CapturedLine): Promise<void> =>
  drainingStore.run(true, () => insertLine('app_slug', slug, line))

const TAIL_SOURCE = 'tail'

const EMPTY_TAIL_LINE: CapturedLine = {
  level: 'info',
  message: 'tail-logs: no recent process log lines captured',
  source: undefined,
}

export const tailRecentLines = async (
  app: Readonly<App>,
  slug: string,
  lines: number = DEFAULT_TAIL_LINES
): Promise<void> => {
  if (!appDeclaresAppLogs(app)) return
  const slugColumn = resolveSlugColumn(app)
  const limit = Number.isFinite(lines) && lines > 0 ? Math.floor(lines) : DEFAULT_TAIL_LINES
  const slice = recentLines.length > 0 ? recentLines.slice(-limit) : [EMPTY_TAIL_LINE]
  await Promise.all(
    slice.map((line) =>
      insertLine(slugColumn, slug, {
        level: line.level,
        message: line.message,
        source: TAIL_SOURCE,
      })
    )
  )
}

const capture = (args: readonly unknown[], streamLevel: 'info' | 'warn' | 'error'): void => {
  if (drainingStore.getStore()) return
  const slug = capturedSlug
  if (slug === undefined) return
  const message = typeof args[0] === 'string' ? args[0] : String(args[0] ?? '')
  if (message.length === 0) return
  const level = deriveLevel(message, streamLevel)
  const source = requestSourceStore.getStore()
  recentLines = [...recentLines, { level, message, source: undefined }].slice(-TAIL_BUFFER_LIMIT)
  void persist(slug, { level, message, source })
}

interface ConsoleSnapshot {
  readonly log: typeof console.log
  readonly info: typeof console.info
  readonly debug: typeof console.debug
  readonly warn: typeof console.warn
  readonly error: typeof console.error
}

let snapshot: ConsoleSnapshot | undefined

const wrapMethod =
  (
    original: (...args: unknown[]) => void,
    streamLevel: 'info' | 'warn' | 'error'
  ) =>
  (...args: unknown[]): void => {
    original(...args)
    capture(args, streamLevel)
  }

export const installHostLogDrain = (app: Readonly<App>): (() => void) => {
  if (!appDeclaresAppLogs(app)) return () => undefined
  if (snapshot) return uninstallHostLogDrain

  capturedSlug = app.name
  const original: ConsoleSnapshot = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    debug: console.debug.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  }
  snapshot = original

  console.log = wrapMethod(original.log, 'info')
  console.info = wrapMethod(original.info, 'info')
  console.debug = wrapMethod(original.debug, 'info')
  console.warn = wrapMethod(original.warn, 'warn')
  console.error = wrapMethod(original.error, 'error')

  return uninstallHostLogDrain
}

export const uninstallHostLogDrain = (): void => {
  const original = snapshot
  if (!original) return
  console.log = original.log
  console.info = original.info
  console.debug = original.debug
  console.warn = original.warn
  console.error = original.error
  snapshot = undefined
  capturedSlug = undefined
  recentLines = []
}
