/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { InstanceSupervisor } from '@/application/ports/services/instance-supervisor'
import { StorageService, UNATTRIBUTED_BUCKET } from '@/application/ports/services/storage-service'
import { BUNDLE_MANIFEST_ENTRY } from '@/application/use-cases/server/bundle-manifest'
import {
  manifestSignatureProblem,
  verifySignedBundle,
} from '@/application/use-cases/server/signed-bundle'
import {
  BUNDLE_MAX_STORED_BYTES,
  BUNDLE_MAX_UNPACKED_BYTES,
  gunzipBounded,
} from '@/domain/kernel/format/bounded-gunzip'
import { decodeBase64 } from '@/domain/kernel/identity/ed25519'
import {
  INSTANCE_ENV_KEY_PATTERN,
  INSTANCE_REVISION_PATTERN,
} from '@/domain/models/app/automations/actions/instance/apply'
import { INSTANCE_SLUG_PATTERN } from '@/domain/models/app/automations/actions/instance/instance-slug'
import { INSTANCE_LOGS_SINCE_PATTERN } from '@/domain/models/app/automations/actions/instance/logs'
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

const slugOf = (props: Readonly<Record<string, unknown>>) => {
  const { slug } = props
  return typeof slug === 'string' && INSTANCE_SLUG_PATTERN.test(slug)
    ? Effect.succeed(slug)
    : refuse(
        `instance: slug "${String(slug)}" is not a slug of 2 to 28 lowercase letters, digits and "-", starting and ending with a letter or digit`
      )
}

/** A non-empty string prop, else a refusal naming it. */
const textOf = (value: unknown, name: string) =>
  typeof value === 'string' && value.trim() !== ''
    ? Effect.succeed(value)
    : refuse(`instance: ${name} must be a non-empty string`)

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

/** The release's environment: UPPER_SNAKE_CASE names, one-line values. */
const envOf = (value: unknown) => {
  if (!isRecord(value)) return refuse('instance: env must be an object of variables')
  const entries = Object.entries(value).map(
    ([key, raw]) =>
      [key, typeof raw === 'number' || typeof raw === 'boolean' ? String(raw) : raw] as const
  )
  const badName = entries.find(([key]) => !INSTANCE_ENV_KEY_PATTERN.test(key))
  if (badName !== undefined) {
    return refuse(`instance: environment variable names are UPPER_SNAKE_CASE (got "${badName[0]}")`)
  }
  const badValue = entries.find(([, raw]) => typeof raw !== 'string' || /[\n\r\0]/.test(raw))
  if (badValue !== undefined) {
    return refuse(`instance: the value of ${badValue[0]} must be text on one line`)
  }
  return Effect.succeed(Object.fromEntries(entries) as Readonly<Record<string, string>>)
}

/** How long a backup or restore unit may run: the step's own `timeout`, else the maximum. */
const unitJobTimeout = (action: Readonly<Record<string, unknown>>): number => {
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
const instanceHandler =
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
    return { slug, ...unit, ...(release === undefined ? {} : { revision: release.revision }) }
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

/** The archive an `apply` names: inline base64, or an object in this app's storage. */
const bundleBytes = (bundle: unknown) =>
  Effect.gen(function* () {
    if (!isRecord(bundle))
      return yield* refuse('instance: bundle must be { objectKey } or { base64 }')
    if (typeof bundle['base64'] === 'string') {
      const text = bundle['base64'].trim()
      // Measured before decoding: base64 carries 3 bytes in every 4 characters.
      if ((text.length / 4) * 3 > BUNDLE_MAX_STORED_BYTES) return yield* refuse(TOO_LARGE_STORED)
      const bytes = decodeBase64(text)
      return bytes ?? (yield* refuse('instance: bundle.base64 is not base64'))
    }
    const key = yield* textOf(bundle['objectKey'], 'bundle.objectKey')
    const storage = yield* StorageService
    const toRefusal = (error: Readonly<StorageError>) =>
      new InstanceRefusal({ message: storageMessage(key, error) })
    // The size the STORE reports — the control plane wrote this object, so this app's catalog has
    // no row for it — is checked before a byte is downloaded; an unknown size is never downloaded.
    const stored = yield* storage.statObject(key).pipe(Effect.mapError(toRefusal))
    if (stored.size > BUNDLE_MAX_STORED_BYTES) return yield* refuse(TOO_LARGE_STORED)
    return yield* storage.download(key, UNATTRIBUTED_BUCKET).pipe(Effect.mapError(toRefusal))
  })

const TOO_LARGE_STORED = 'instance: the bundle is larger than 100 MiB, the most a bundle may weigh'

/**
 * The bundle's tar, inflated against the 256 MiB unpacked cap — the defence
 * against a small upload that expands a thousandfold; nothing past the cap is
 * ever allocated.
 */
const inflatedBundle = (archive: Uint8Array) => {
  const inflated = gunzipBounded(archive, BUNDLE_MAX_UNPACKED_BYTES)
  if (inflated._tag === 'TooLarge') {
    return refuse('instance: the bundle unpacks to more than 256 MiB, the most a bundle may hold')
  }
  return inflated._tag === 'NotGzip'
    ? refuse('instance: the bundle is not a tar.gz archive')
    : Effect.succeed(inflated.bytes)
}

/**
 * The bundle an `apply` names, verified in this order: stored size, unpacked
 * size, the manifest's signature (read alone, before any other entry), then
 * every entry against the signed manifest.
 */
const verifiedBundleOf = (
  bundle: unknown,
  signed: { readonly keyId: string; readonly signature: string }
) =>
  Effect.gen(function* () {
    const tar = yield* inflatedBundle(yield* bundleBytes(bundle))
    const supervisor = yield* InstanceSupervisor
    const manifest = (yield* supervisor.readBundleEntries(tar, [BUNDLE_MANIFEST_ENTRY]))?.get(
      BUNDLE_MANIFEST_ENTRY
    )
    if (manifest === undefined) {
      return yield* refuse(`instance: the bundle holds no ${BUNDLE_MANIFEST_ENTRY}`)
    }
    const badSignature = manifestSignatureProblem(manifest, signed)
    if (badSignature !== undefined) return yield* refuse(`instance: ${badSignature}`)
    const entries = yield* supervisor.readBundleEntries(tar)
    if (entries === undefined) return yield* refuse('instance: the bundle is not a tar.gz archive')
    const verified = verifySignedBundle({ entries, ...signed })
    return verified._tag === 'Refused' ? yield* refuse(`instance: ${verified.reason}`) : verified
  })

export const handleInstanceApply = instanceHandler('apply', (props) =>
  Effect.gen(function* () {
    const slug = yield* slugOf(props)
    const { revision } = props
    if (typeof revision !== 'string' || !INSTANCE_REVISION_PATTERN.test(revision)) {
      return yield* refuse(
        `instance: revision "${String(revision)}" is not 1 to 64 letters, digits, ".", "_" and "-", not starting with "." or "-"`
      )
    }
    const env = yield* envOf(props['env'])
    const signature = isRecord(props['signature']) ? props['signature'] : {}
    if (signature['algorithm'] !== undefined && signature['algorithm'] !== 'ed25519') {
      return yield* refuse('instance: signature.algorithm must be ed25519')
    }
    const keyId = yield* textOf(signature['keyId'], 'signature.keyId')
    const value = yield* textOf(signature['value'], 'signature.value')
    // Nothing touches the host before both the signature and every entry check out.
    const verified = yield* verifiedBundleOf(props['bundle'], { keyId, signature: value })
    const supervisor = yield* InstanceSupervisor
    const written = yield* supervisor.writeRelease(slug, { bundle: verified, revision, env })
    if (written.applied) yield* supervisor.control(slug, 'restart')
    return {
      slug,
      revision,
      applied: written.applied,
      ...(written.previousRevision === undefined
        ? {}
        : { previousRevision: written.previousRevision }),
    }
  })
)

export const handleInstanceRollback = instanceHandler('rollback', (props) =>
  Effect.gen(function* () {
    const slug = yield* slugOf(props)
    const supervisor = yield* InstanceSupervisor
    const release = yield* supervisor.rollbackRelease(slug)
    yield* supervisor.control(slug, 'restart')
    return { slug, revision: release.revision, previousRevision: release.previousRevision }
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
    const supervisor = yield* InstanceSupervisor
    const read = yield* supervisor.logs(slug, { lines, ...(since === undefined ? {} : { since }) })
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
