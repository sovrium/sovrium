/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  InstanceSupervisor,
  InstanceSupervisorError,
} from '@/application/ports/services/instance-supervisor'
import {
  INSTANCE_ENV_KEY_PATTERN,
  INSTANCE_REVISION_PATTERN,
} from '@/domain/models/app/automations/actions/instance/apply'
import {
  chooseReleaseEngine,
  raisesEngine,
} from '@/domain/models/app/automations/actions/instance/engine-version-service'
import { engineVersionOf, instanceHandler, slugOf } from './instance'
import { verifiedBundleOf } from './instance-bundle'
import { starterFileGate } from './starter-file-gate'

/**
 * `instance/apply` — write a signed bundle as a release of a supervised app,
 * linked to the engine it runs on, make it current, and restart the app.
 *
 * Every prop is re-checked first; nothing reaches the host until the
 * manifest's signature and every entry check out. The release gets `.engine`,
 * an absolute link into the engine store, so a rollback brings its engine back
 * with it; the step reports the engine and whether the release raised it.
 */

const refuse = (message: string) => Effect.fail(new InstanceSupervisorError({ message }))

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** A non-empty string prop, else a refusal naming it. */
const textOf = (value: unknown, name: string) =>
  typeof value === 'string' && value.trim() !== ''
    ? Effect.succeed(value)
    : refuse(`instance: ${name} must be a non-empty string`)

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

/**
 * `engine: { version }` of an apply, already in the engine store, or
 * `undefined` when the step names none.
 */
const installedEngineOf = (engine: unknown) =>
  Effect.gen(function* () {
    if (engine === undefined || engine === null) return undefined
    if (!isRecord(engine)) return yield* refuse('instance: engine must be { version }')
    const version = yield* engineVersionOf(engine['version'], 'engine.version')
    const { enginePath } = yield* InstanceSupervisor
    if ((yield* enginePath(version)) !== undefined) return version
    return yield* refuse(
      `instance: engine ${version} is not in the engine store; install it with instance/engineInstall first`
    )
  })

/** Every prop of an apply but the bundle, checked before anything is read or written. */
const applyPropsOf = (props: Readonly<Record<string, unknown>>) =>
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
    const named = yield* installedEngineOf(props['engine'])
    return { slug, revision, env, signed: { keyId, signature: value }, named }
  })

/**
 * The engine the release links: the one named, else — for the revision
 * already current — the one it links, else the engine running this step.
 * The current revision on another engine is refused: that is a new release.
 */
const releaseEngineOf = (slug: string, revision: string, named: string | undefined) =>
  Effect.gen(function* () {
    const supervisor = yield* InstanceSupervisor
    const before = yield* supervisor.readRelease(slug)
    const current = before === undefined ? undefined : yield* supervisor.releaseEngine(slug)
    const choice = chooseReleaseEngine({ isCurrent: before?.revision === revision, named, current })
    if (choice._tag === 'Conflict') {
      return yield* refuse(
        `instance: revision ${revision} is current and runs engine ${current ?? 'none (no .engine link)'}; a release on engine ${String(named)} needs a revision of its own`
      )
    }
    const engine = choice._tag === 'Link' ? choice.engine : yield* supervisor.adoptRunningEngine
    // A first release raises nothing; a changed one raises a newer or a never-linked engine.
    return { engine, raises: before !== undefined && raisesEngine(current, engine) }
  })

export const handleInstanceApply = instanceHandler('apply', (props, _action, app, automation) =>
  Effect.gen(function* () {
    const { slug, revision, env, signed, named } = yield* applyPropsOf(props)
    // Nothing touches the host until signature and entries check out; then the socket, the app.
    const gate = starterFileGate(app, automation)
    const verified = yield* verifiedBundleOf(props['bundle'], signed, gate)
    const { engine, raises } = yield* releaseEngineOf(slug, revision, named)
    const supervisor = yield* InstanceSupervisor
    const written = yield* supervisor.writeRelease(slug, {
      bundle: verified,
      revision,
      env,
      engine,
    })
    if (written.applied) {
      yield* Effect.andThen(supervisor.control(slug, 'start'), supervisor.control(slug, 'restart'))
    }
    return {
      slug,
      revision,
      applied: written.applied,
      ...(written.previousRevision === undefined
        ? {}
        : { previousRevision: written.previousRevision }),
      engine,
      engineRaised: written.applied && raises,
    }
  })
)
