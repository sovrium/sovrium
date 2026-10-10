/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { InstanceSupervisor } from '@/application/ports/services/instance-supervisor'
import { StorageService, UNATTRIBUTED_BUCKET } from '@/application/ports/services/storage-service'
import { INSTANCE_ENGINE_VERSION_PATTERN } from '@/domain/models/app/automations/actions/instance/engine-install'
import { INSTANCE_SLUG_PATTERN } from '@/domain/models/app/automations/actions/instance/instance-slug'
import {
  INSTANCE_LOG_UNITS,
  INSTANCE_LOGS_SINCE_PATTERN,
  type InstanceLogUnit,
} from '@/domain/models/app/automations/actions/instance/logs'
import {
  HOST_ACTIONS_DISABLED_MESSAGE,
  isHostActionsEnabled,
} from '@/domain/models/process-env/host-actions'
import { logError } from '@/infrastructure/logging/logger'
import { actionAttributes } from './shared'
import type { ActionHandler, ActionOutcome } from './shared'
import type { InstanceSupervisorError } from '@/application/ports/services/instance-supervisor'
import type { StorageError } from '@/application/ports/services/storage-service'

/**
 * `instance/*` action handlers — supervise the other Sovrium apps of this host
 * through the `InstanceSupervisor` port (systemd units + release directories).
 *
 * Every handler checks the operator switch FIRST, before reading a prop: a code
 * action reaches it through `context.actions.instance.*` with no schema decode,
 * and an app declaring no instance step has nothing for the boot check to refuse.
 * Then every prop is re-checked — the slug above all, the only caller value that
 * reaches a command line or a path — as a templated prop, a loop item or a code
 * call arrives as whatever it resolved to.
 */

/** A prop that does not hold what the operator needs; the step fails with `message`. */
class InstanceRefusal extends Data.TaggedError('InstanceRefusal')<{ readonly message: string }> {}

type StepError = InstanceRefusal | InstanceSupervisorError | StorageError

/** Default and bounds of `health.timeoutMs`. */
const DEFAULT_PROBE_TIMEOUT_MS = 10_000
const MIN_PROBE_TIMEOUT_MS = 100
const MAX_PROBE_TIMEOUT_MS = 60_000

/** Default of `logs.lines`, and its bound. */
const DEFAULT_LOG_LINES = 100
const MAX_LOG_LINES = 1000

/** Time a backup or restore unit may take when the step sets no `timeout`: the action maximum. */
const DEFAULT_UNIT_JOB_TIMEOUT_MS = 900_000

const refuse = (message: string) => Effect.fail(new InstanceRefusal({ message }))

const propsOf = (action: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> => {
  const raw = action['props']
  return raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

export const slugOf = (props: Readonly<Record<string, unknown>>) => {
  const { slug } = props
  return typeof slug === 'string' && INSTANCE_SLUG_PATTERN.test(slug)
    ? Effect.succeed(slug)
    : refuse(
        `instance: slug "${String(slug)}" is not a slug of 2 to 28 lowercase letters, digits and "-", starting and ending with a letter or digit; "engines" is reserved for the host's engine store`
      )
}

/** A non-empty string prop, else a refusal naming it. */
const textOf = (value: unknown, name: string) =>
  typeof value === 'string' && value.trim() !== ''
    ? Effect.succeed(value)
    : refuse(`instance: ${name} must be a non-empty string`)

/** A release number `<major>.<minor>.<patch>`, or a refusal naming the value and the rule. */
export const engineVersionOf = (value: unknown, name: string) =>
  typeof value === 'string' && INSTANCE_ENGINE_VERSION_PATTERN.test(value)
    ? Effect.succeed(value)
    : refuse(`instance: ${name} "${String(value)}" is not a release number <major>.<minor>.<patch>`)

/** A whole number within bounds, or the default when absent. */
const boundedInteger = (
  value: unknown,
  name: string,
  bounds: { readonly min: number; readonly max: number; readonly fallback: number }
) => {
  if (value === undefined) return Effect.succeed(bounds.fallback)
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return typeof number === 'number' &&
    Number.isInteger(number) &&
    number >= bounds.min &&
    number <= bounds.max
    ? Effect.succeed(number)
    : refuse(
        `instance: ${name} must be a whole number from ${String(bounds.min)} to ${String(bounds.max)} (got ${String(value)})`
      )
}

/** How long a backup or restore unit may run: the step's own `timeout`, else the maximum. */
export const unitJobTimeout = (action: Readonly<Record<string, unknown>>): number => {
  const { timeout } = action
  return typeof timeout === 'number' && Number.isInteger(timeout) && timeout > 0
    ? timeout
    : DEFAULT_UNIT_JOB_TIMEOUT_MS
}

const causeText = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause)

const storageMessage = (key: string, error: Readonly<StorageError>): string =>
  `instance: could not read ${key} from storage: ${causeText(error.cause)}`

/** The message a failed step carries. */
const messageOf = (error: Readonly<StepError>): string =>
  error._tag === 'StorageError'
    ? `instance: storage failed: ${causeText(error.cause)}`
    : error.message

/**
 * Wrap an operator: the gate first, then the body; any refusal or host failure
 * becomes a failed step carrying its message.
 */
export const instanceHandler =
  (
    operator: string,
    body: (
      props: Readonly<Record<string, unknown>>,
      action: Readonly<Record<string, unknown>>
    ) => Effect.Effect<Record<string, unknown>, StepError, InstanceSupervisor | StorageService>
  ): ActionHandler =>
  (action) =>
    Effect.suspend(() =>
      isHostActionsEnabled(process.env)
        ? body(propsOf(action), action)
        : refuse(HOST_ACTIONS_DISABLED_MESSAGE)
    ).pipe(
      Effect.map((output): ActionOutcome => ({ status: 'success', output })),
      Effect.catch((error: Readonly<StepError>) =>
        Effect.succeed<ActionOutcome>({
          status: 'failure',
          error: messageOf(error),
          retryable: false,
        })
      ),
      Effect.withSpan(`automations.handle-instance-${operator}`, {
        attributes: actionAttributes(action),
      })
    )

export const handleInstanceStatus = instanceHandler('status', (props) =>
  Effect.gen(function* () {
    const slug = yield* slugOf(props)
    const supervisor = yield* InstanceSupervisor
    const unit = yield* supervisor.status(slug)
    const release = yield* supervisor.readRelease(slug)
    const engine = release === undefined ? undefined : yield* supervisor.releaseEngine(slug)
    return {
      slug,
      ...unit,
      ...(release === undefined ? {} : { revision: release.revision }),
      ...(engine === undefined ? {} : { engine }),
    }
  })
)

const controlHandler = (verb: 'start' | 'stop' | 'restart') =>
  instanceHandler(verb, (props) =>
    Effect.gen(function* () {
      const slug = yield* slugOf(props)
      const supervisor = yield* InstanceSupervisor
      yield* supervisor.control(slug, verb)
      return { slug, verb, ok: true }
    })
  )

export const handleInstanceStart = controlHandler('start')
export const handleInstanceStop = controlHandler('stop')
export const handleInstanceRestart = controlHandler('restart')

export const handleInstanceRemove = instanceHandler('remove', (props) =>
  Effect.gen(function* () {
    const slug = yield* slugOf(props)
    const { purge } = props
    if (purge !== undefined && typeof purge !== 'boolean') {
      return yield* refuse('instance: purge must be true or false')
    }
    const supervisor = yield* InstanceSupervisor
    yield* supervisor.control(slug, 'stop')
    if (purge === true) yield* supervisor.removeRelease(slug)
    return { slug, removed: true }
  })
)

export const handleInstanceRollback = instanceHandler('rollback', (props) =>
  Effect.gen(function* () {
    const slug = yield* slugOf(props)
    const supervisor = yield* InstanceSupervisor
    const { revision, previousRevision, rolledBackAt } = yield* supervisor.rollbackRelease(slug)
    yield* supervisor.control(slug, 'restart')
    const engine = yield* supervisor.releaseEngine(slug)
    return {
      slug,
      revision,
      previousRevision,
      rolledBackAt,
      ...(engine === undefined ? {} : { engine }),
    }
  })
)

export const handleInstanceHealth = instanceHandler('health', (props) =>
  Effect.gen(function* () {
    const slug = yield* slugOf(props)
    const timeoutMs = yield* boundedInteger(props['timeoutMs'], 'timeoutMs', {
      min: MIN_PROBE_TIMEOUT_MS,
      max: MAX_PROBE_TIMEOUT_MS,
      fallback: DEFAULT_PROBE_TIMEOUT_MS,
    })
    const supervisor = yield* InstanceSupervisor
    const probe = yield* supervisor.probe(slug, timeoutMs)
    if (probe.ok) return { slug, ...probe }
    const journal = yield* supervisor.crashJournal(slug).pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() => logError('[instance/health] journal read failed', cause, { slug }))
      ),
      // effect-swallow: logged above; an unreadable journal must not turn « unhealthy » into « broken ».
      Effect.orElseSucceed((): readonly string[] | undefined => undefined)
    )
    return { slug, ...probe, ...(journal === undefined ? {} : { journal }) }
  })
)

const isLogUnit = (value: unknown): value is InstanceLogUnit =>
  INSTANCE_LOG_UNITS.some((known) => known === value)

/** The unit a `logs` step reads, `app` when it names none; any other value is refused. */
const logUnitOf = (value: unknown) =>
  value === undefined
    ? Effect.succeed<InstanceLogUnit>('app')
    : isLogUnit(value)
      ? Effect.succeed(value)
      : refuse(
          `instance: unit must be one of ${INSTANCE_LOG_UNITS.join(', ')} (got "${String(value)}")`
        )

export const handleInstanceLogs = instanceHandler('logs', (props) =>
  Effect.gen(function* () {
    const slug = yield* slugOf(props)
    const lines = yield* boundedInteger(props['lines'], 'lines', {
      min: 1,
      max: MAX_LOG_LINES,
      fallback: DEFAULT_LOG_LINES,
    })
    const { since } = props
    if (
      since !== undefined &&
      (typeof since !== 'string' || !INSTANCE_LOGS_SINCE_PATTERN.test(since))
    ) {
      return yield* refuse(
        `instance: since must be an ISO 8601 date or date and time (got "${String(since)}")`
      )
    }
    const unit = yield* logUnitOf(props['unit'])
    const supervisor = yield* InstanceSupervisor
    const read = yield* supervisor.logs(slug, {
      lines,
      unit,
      ...(since === undefined ? {} : { since }),
    })
    return { slug, lines: read }
  })
)

export const handleInstanceBackup = instanceHandler('backup', (props, action) =>
  Effect.gen(function* () {
    const slug = yield* slugOf(props)
    const destination = isRecord(props['destination']) ? props['destination'] : {}
    const objectKey = yield* textOf(destination['objectKey'], 'destination.objectKey')
    const supervisor = yield* InstanceSupervisor
    const archive = yield* supervisor.backup(slug, unitJobTimeout(action))
    const storage = yield* StorageService
    yield* storage.upload(objectKey, archive, 'application/gzip', UNATTRIBUTED_BUCKET)
    return { slug, objectKey, bytes: archive.byteLength }
  })
)

export const handleInstanceRestore = instanceHandler('restore', (props, action) =>
  Effect.gen(function* () {
    const slug = yield* slugOf(props)
    const source = isRecord(props['source']) ? props['source'] : {}
    const objectKey = yield* textOf(source['objectKey'], 'source.objectKey')
    const storage = yield* StorageService
    const archive = yield* storage
      .download(objectKey, UNATTRIBUTED_BUCKET)
      .pipe(
        Effect.mapError(
          (error) => new InstanceRefusal({ message: storageMessage(objectKey, error) })
        )
      )
    const supervisor = yield* InstanceSupervisor
    yield* supervisor.restore(slug, archive, unitJobTimeout(action))
    return { slug, restored: true }
  })
)
