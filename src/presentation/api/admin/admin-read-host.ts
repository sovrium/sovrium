/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The one presentation-side implementation of `AdminReadHost` — the facts an
 * admin read needs from the serving process — shared by the two surfaces the
 * admin read registry answers on: the HTTP admin routes (directly) and the MCP
 * admin tools (handed `makeAdminReadHost` by the composition root, since an
 * MCP route may not import a sibling slug). Only the origin differs between
 * them, and it is passed in.
 *
 * Every other value is a process fact, so both surfaces answer it identically:
 * the boot instant is ONE frozen constant (the config version's `startedAt`
 * and the attention report's are byte-identical by construction, not by two
 * clocks agreeing), and the engine build and the footprint telemetry are read
 * from the same modules for both.
 */

import { Effect } from 'effect'
import {
  AdminReadHost,
  type AdminReadHostFactory,
} from '@/application/ports/services/admin-read-host'
import { resolveRuntimeLabel } from '@/domain/models/process-env/database/database-dialect'
import { readSovriumDevClock } from '@/domain/models/process-env/dev-clock'
import { exportRecordsToCsv } from '@/infrastructure/export/csv-exporter'
import { onDevTimeline, readServerBootInstant } from '@/infrastructure/process/server-boot-instant'
import { getSovriumVersion } from '@/infrastructure/process/version'
import { assembleFootprintOverview } from '@/presentation/api/admin/footprint-overview'
import type { ConfigVersionResponse } from '@/domain/models/api/admin/config/version'

/**
 * Process-boot timestamp, captured once at module import.
 *
 * `GET /api/admin/config/version` reports this as `startedAt`; freezing it
 * here (not per-request) means the value is byte-identical across every call
 * within a process lifetime, letting operators correlate audit entries to a
 * specific process instance.
 */
const PROCESS_STARTED_AT: string = new Date().toISOString()

/**
 * When this instance started, as its console reads it: the process boot, or —
 * on a host pinned with `SOVRIUM_DEV_CLOCK` — the server's boot on the
 * development timeline (the pinned instant), the timeline its runs are stamped
 * on, so « failed since this instance started » counts the runs it made.
 */
const instanceStartedAt = (): string =>
  readSovriumDevClock() === undefined
    ? PROCESS_STARTED_AT
    : onDevTimeline(readServerBootInstant()).toISOString()

/**
 * The git commit SHA from `SOVRIUM_COMMIT_SHA`, injected at binary build time.
 *
 * Falls back to the literal `'unknown'` when the env var is unset (a binary
 * built without commit injection) or when it is not a valid 7-40-char hex
 * fragment — both are accepted by the response schema regex.
 */
const buildCommit = (): string => {
  const sha = process.env['SOVRIUM_COMMIT_SHA']
  return typeof sha === 'string' && /^[0-9a-f]{7,40}$/.test(sha) ? sha : 'unknown'
}

/**
 * The config version body: the Sovrium build version (build-time define, with a
 * `package.json` fallback and `'0.0.0'` last resort), the build commit, the
 * active database runtime (`resolveRuntimeLabel()`, the single source of truth
 * for dialect detection), the Bun version, and the process boot timestamp.
 */
const configVersion: Effect.Effect<ConfigVersionResponse> = Effect.gen(function* () {
  // effect-promise: total -- getSovriumVersion falls back to package.json and then to '0.0.0', and never rejects
  const version = yield* Effect.promise(() => getSovriumVersion())
  return {
    version,
    commit: buildCommit(),
    runtime: resolveRuntimeLabel(),
    nodeVersion: Bun.version,
    startedAt: instanceStartedAt(),
  }
})

/** The host an admin read runs against, for a caller that reached `origin`. */
export const makeAdminReadHost: AdminReadHostFactory = (origin) =>
  AdminReadHost.of({
    origin,
    processStartedAt: instanceStartedAt(),
    configVersion,
    footprintOverview: assembleFootprintOverview,
    encodeCsv: exportRecordsToCsv,
  })

/** Provide the host to an admin read program, for a caller that reached `origin`. */
export const provideAdminReadHost = <A, E, R>(
  program: Effect.Effect<A, E, R>,
  origin: string
): Effect.Effect<A, E, Exclude<R, AdminReadHost>> =>
  Effect.provideService(program, AdminReadHost, makeAdminReadHost(origin))
