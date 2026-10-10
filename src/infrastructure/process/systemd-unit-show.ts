/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type InstanceUnitStatus } from '@/application/ports/services/instance-supervisor'
import { INVOCATION_ID_SHAPE, type UnitRunFacts } from './instance-journal'

/**
 * What `systemctl show` answers about an app's unit, read back by name: the
 * properties `status` and the crash journal ask for, and their parsing.
 */

const UNIT_ACTIVE_STATES: ReadonlySet<string> = new Set([
  'active',
  'inactive',
  'failed',
  'activating',
  'deactivating',
])

/** The properties `status` asks of systemd, read back by name. */
export const STATUS_PROPERTIES =
  'ActiveState,SubState,MainPID,NRestarts,MemoryCurrent,Result,ExecMainStatus,InvocationID'

/** The properties the crash journal asks of systemd before it reads a line. */
export const RUN_PROPERTIES =
  'ActiveState,SubState,Result,ExecMainStatus,InvocationID,ExecMainStartTimestamp'

/** `systemctl show` output, `Key=Value` per line, in whatever order systemd prints them. */
const showFields = (stdout: string) => {
  const fields = new Map(
    stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.includes('='))
      .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)] as const)
  )
  const integer = (key: string): number | undefined => {
    const raw = fields.get(key) ?? ''
    return /^\d+$/.test(raw) ? Number(raw) : undefined
  }
  const text = (key: string): string | undefined => {
    const raw = fields.get(key) ?? ''
    return raw === '' ? undefined : raw
  }
  const active = fields.get('ActiveState') ?? ''
  const invocationId = text('InvocationID')
  const result = text('Result')
  const execMainStatus = integer('ExecMainStatus')
  return {
    integer,
    text,
    active: UNIT_ACTIVE_STATES.has(active) ? active : 'unknown',
    sub: fields.get('SubState') ?? 'unknown',
    ...(result === undefined ? {} : { result }),
    ...(execMainStatus === undefined ? {} : { execMainStatus }),
    // Only the shape systemd prints for a run: the id later reaches journalctl's argv.
    ...(invocationId !== undefined && INVOCATION_ID_SHAPE.test(invocationId)
      ? { invocationId }
      : {}),
  }
}

/** Parse what `status` asked of systemd. An empty invocation id — a unit that never ran — is absent. */
export const parseShow = (stdout: string): InstanceUnitStatus => {
  const { integer, active, sub, result, execMainStatus, invocationId } = showFields(stdout)
  const mainPid = integer('MainPID')
  const memory = integer('MemoryCurrent')
  return {
    active,
    sub,
    ...(mainPid !== undefined && mainPid > 0 ? { mainPid } : {}),
    restarts: integer('NRestarts') ?? 0,
    // systemd prints 2^64-1 for "no figure" on some versions, `[not set]` on others.
    ...(memory !== undefined && memory < Number.MAX_SAFE_INTEGER ? { memoryBytes: memory } : {}),
    ...(result === undefined ? {} : { unitResult: result }),
    ...(execMainStatus === undefined ? {} : { execMainStatus }),
    ...(invocationId === undefined ? {} : { invocationId }),
  }
}

/**
 * Parse what the crash journal asked of systemd, `--timestamp=unix` included:
 * `ExecMainStartTimestamp=@<seconds>`, empty when the unit never started.
 */
export const parseRunFacts = (stdout: string): UnitRunFacts => {
  const { text, active, sub, result, execMainStatus, invocationId } = showFields(stdout)
  const started = /^@(\d+)(?:\.\d+)?$/.exec(text('ExecMainStartTimestamp') ?? '')?.[1]
  return {
    active,
    sub,
    ...(result === undefined ? {} : { result }),
    ...(execMainStatus === undefined ? {} : { execMainStatus }),
    ...(invocationId === undefined ? {} : { invocationId }),
    ...(started === undefined ? {} : { startedAtSeconds: Number(started) }),
  }
}
