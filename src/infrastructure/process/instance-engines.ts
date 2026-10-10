/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { randomUUID } from 'node:crypto'
import {
  chmod,
  copyFile,
  mkdir,
  readdir,
  readFile,
  readlink,
  rename,
  rm,
  stat,
} from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { Effect } from 'effect'
import {
  type EngineInstallResult,
  type EnginePruneResult,
  type InstanceSupervisorError,
} from '@/application/ports/services/instance-supervisor'
import { INSTANCE_REVISION_PATTERN } from '@/domain/models/app/automations/actions/instance/apply'
import { INSTANCE_ENGINE_VERSION_PATTERN } from '@/domain/models/app/automations/actions/instance/engine-install'
import { sortReleaseNumbers } from '@/domain/models/app/automations/actions/instance/engine-version-service'
import { INSTANCE_SLUG_PATTERN } from '@/domain/models/app/automations/actions/instance/instance-slug'
import { resolveEnginesDir, resolveInstancesDir } from '@/domain/models/process-env/host-actions'
import { acquireLock } from './instance-engine-lock'
import {
  EngineRefusal,
  checkReportedVersion,
  describe,
  downloadVerified,
  engineError,
  unpack,
} from './instance-engine-release'
import { getSovriumVersion } from './version'
import type { ProcessRunner } from '@/application/ports/services/process-runner'

/**
 * The engine store, `SOVRIUM_ENGINES_DIR`: one `<version>/sovrium` per
 * Sovrium release a supervised app runs on, the binary mode 0555 in a 0755
 * directory, so the apps' users can run it and none can change it.
 *
 *   <version>/sovrium         an installed engine; nothing else marks it installed
 *   .<version>.lock           held while one process installs that version
 *   .<version>.<uuid>.tmp/    a version being unpacked and checked
 *
 * A version is unpacked and checked in a temporary directory inside the store,
 * then renamed into place, so no reader ever sees half a binary. The lock is a
 * file created exclusively and holding its owner's pid, so it holds across
 * processes and one left by a process that died is taken over.
 */

type Runner = Effect.Success<typeof ProcessRunner>

const isMissing = (cause: unknown): boolean =>
  (cause as { readonly code?: string } | null)?.code === 'ENOENT'

const isNotFound = (cause: unknown): boolean => {
  const code = (cause as { readonly code?: string } | null)?.code
  return code === 'ENOENT' || code === 'ENOTDIR'
}

const exists = (path: string): Promise<boolean> =>
  stat(path).then(
    () => true,
    (cause: unknown) => {
      if (isNotFound(cause)) return false
      throw cause
    }
  )

/** A filesystem step of the store, failing with what it was doing. */
const storeStep = <A>(action: string, run: () => Promise<A>) =>
  Effect.tryPromise({
    try: run,
    catch: (cause) =>
      cause instanceof EngineRefusal
        ? engineError(cause.message)
        : engineError(`instance: could not ${action}: ${describe(cause)}`, cause),
  })

const checkedVersion = (version: string): Effect.Effect<string, InstanceSupervisorError> =>
  INSTANCE_ENGINE_VERSION_PATTERN.test(version)
    ? Effect.succeed(version)
    : Effect.fail(
        engineError(
          `instance: engine version "${version}" is not a release number <major>.<minor>.<patch>`
        )
      )

const binaryOf = (store: string, version: string): string => join(store, version, 'sovrium')

/** Remove a lock or a temporary directory; a leftover is logged, never a failure of the step. */
const discardTree = (path: string): Effect.Effect<void> =>
  Effect.tryPromise(() => rm(path, { recursive: true, force: true })).pipe(
    Effect.tapCause((cause) => Effect.logWarning(`instance: could not remove ${path}`, cause)),
    // The step's outcome is decided; a leftover in the store is reported in the log only.
    Effect.ignore
  )

/**
 * Run `body` holding the store's lock `.<name>.lock` — taken across
 * processes, released afterwards whatever `body` did.
 */
const withStoreLock = <A>(
  store: string,
  name: string,
  subject: string,
  body: Effect.Effect<A, InstanceSupervisorError>
): Effect.Effect<A, InstanceSupervisorError> => {
  const lock = join(store, `.${name}.lock`)
  return Effect.acquireUseRelease(
    storeStep(`lock ${subject} in ${store}`, async () => {
      await mkdir(store, { recursive: true, mode: 0o755 })
      await acquireLock(lock, subject)
    }),
    () => body,
    () => discardTree(lock)
  )
}

/** Run `body` holding the store's lock on `version`: one install of a version at a time. */
const withVersionLock = <A>(
  store: string,
  version: string,
  body: Effect.Effect<A, InstanceSupervisorError>
): Effect.Effect<A, InstanceSupervisorError> =>
  withStoreLock(store, version, `engine ${version}`, body)

/**
 * Run `body` holding the lock on which versions the store keeps. A prune holds
 * it while it reads the links and removes what nothing links; a release holds
 * it from checking its engine is in the store until it is current, so a
 * prune never removes an engine between that check and the link that keeps it.
 */
export const withEngineLinksLock = <A>(
  body: Effect.Effect<A, InstanceSupervisorError>
): Effect.Effect<A, InstanceSupervisorError> =>
  Effect.suspend(() => withStoreLock(resolveEnginesDir(process.env), 'links', 'engine links', body))

/** Fail unless `version` is installed: its binary is a regular file in the store. */
export const requireInstalledEngine = (version: string) =>
  checkedVersion(version).pipe(
    Effect.flatMap((v) => {
      const binary = binaryOf(resolveEnginesDir(process.env), v)
      return storeStep(`read ${binary}`, async () => {
        const found = await stat(binary).catch((cause: unknown) => {
          if (isNotFound(cause)) return undefined
          throw cause
        })
        if (found?.isFile() !== true) {
          throw new EngineRefusal(
            `instance: engine ${v} is not in the engine store; install it with instance/engineInstall first`
          )
        }
        return binary
      })
    })
  )

/**
 * Fill a temporary directory of the store with `fill`, then rename it into
 * place as `<version>/`; the temporary directory is gone afterwards either way.
 */
const placeVersion = (
  store: string,
  version: string,
  fill: (staging: string) => Effect.Effect<void, InstanceSupervisorError>
): Effect.Effect<void, InstanceSupervisorError> => {
  const staging = join(store, `.${version}.${randomUUID()}.tmp`)
  return Effect.acquireUseRelease(
    storeStep(`create ${staging}`, () => mkdir(staging, { mode: 0o755 })),
    () =>
      Effect.andThen(
        fill(staging),
        storeStep(`place engine ${version} in ${store}`, async () => {
          await chmod(staging, 0o755)
          // A directory without its binary is not an installed version: replace it.
          await rm(join(store, version), { recursive: true, force: true })
          await rename(staging, join(store, version))
        })
      ),
    () => discardTree(staging)
  )
}

/** `<store>/<version>/sovrium` when that version is installed, else `undefined`. */
export const enginePath = (version: string) =>
  checkedVersion(version).pipe(
    Effect.flatMap((v) => {
      const binary = binaryOf(resolveEnginesDir(process.env), v)
      return storeStep(`read ${binary}`, () => exists(binary)).pipe(
        Effect.map((found) => (found ? binary : undefined))
      )
    }),
    Effect.withSpan('instance.engine-path')
  )

/** Download, verify and install `version`, once, under its lock. */
export const installEngine = (
  runner: Runner,
  version: string
): Effect.Effect<EngineInstallResult, InstanceSupervisorError> =>
  Effect.gen(function* () {
    const v = yield* checkedVersion(version)
    const store = resolveEnginesDir(process.env)
    const binary = binaryOf(store, v)
    const isInstalled = storeStep(`read ${binary}`, () => exists(binary))
    if (yield* isInstalled) return { installed: false, path: binary }
    const installed = yield* withVersionLock(
      store,
      v,
      Effect.gen(function* () {
        // Another process may have installed it while this one waited for the lock.
        if (yield* isInstalled) return false
        const archive = yield* storeStep(`download engine ${v}`, () => downloadVerified(v))
        yield* placeVersion(store, v, (staging) =>
          Effect.andThen(
            storeStep(`unpack engine ${v}`, () => unpack(archive, staging, v)),
            checkReportedVersion(runner, join(staging, 'sovrium'), v)
          )
        )
        return true
      })
    )
    return { installed, path: binary }
  }).pipe(Effect.withSpan('instance.install-engine', { attributes: { 'engine.version': version } }))

/** Copy the running binary into the store under its own version when missing; answers the version. */
export const adoptRunningEngine: Effect.Effect<string, InstanceSupervisorError> = Effect.gen(
  function* () {
    // effect-promise: total -- getSovriumVersion never rejects; it falls back to 0.0.0.
    const v = yield* checkedVersion(yield* Effect.promise(() => getSovriumVersion()))
    const store = resolveEnginesDir(process.env)
    const binary = binaryOf(store, v)
    const isInstalled = storeStep(`read ${binary}`, () => exists(binary))
    if (yield* isInstalled) return v
    yield* withVersionLock(
      store,
      v,
      Effect.gen(function* () {
        if (yield* isInstalled) return
        yield* placeVersion(store, v, (staging) =>
          storeStep(`copy the running engine into ${staging}`, async () => {
            await copyFile(process.execPath, join(staging, 'sovrium'))
            await chmod(join(staging, 'sovrium'), 0o555)
          })
        )
      })
    )
    return v
  }
).pipe(Effect.withSpan('instance.adopt-running-engine'))

/** The version an `.engine` link names: the directory of `<store>/<version>/sovrium`. */
const linkedVersion = async (link: string): Promise<string | undefined> => {
  const target = await readlink(link).catch((cause: unknown) => {
    if (isNotFound(cause) || (cause as { readonly code?: string }).code === 'EINVAL') {
      return undefined
    }
    throw cause
  })
  if (target === undefined) return undefined
  const version = basename(dirname(target))
  return INSTANCE_ENGINE_VERSION_PATTERN.test(version) ? version : undefined
}

/** The engine version `<instance>/current/.engine` (or `rev-<revision>/.engine`) links. */
export const releaseEngineIn = (dir: string, revision?: string) =>
  storeStep(`read the engine link of ${dir}`, async () =>
    revision !== undefined && !INSTANCE_REVISION_PATTERN.test(revision)
      ? undefined
      : linkedVersion(join(dir, revision === undefined ? 'current' : `rev-${revision}`, '.engine'))
  )

/** The versions the current and the previous release of every supervised app link. */
const linkedVersions = async (instancesDir: string): Promise<ReadonlySet<string>> => {
  const slugs = (
    await readdir(instancesDir).catch((cause: unknown) => {
      if (isMissing(cause)) return [] as string[]
      throw cause
    })
  ).filter((slug) => INSTANCE_SLUG_PATTERN.test(slug))
  const perApp = await Promise.all(
    slugs.map(async (slug) => {
      const dir = join(instancesDir, slug)
      // An unreadable status.json fails the prune: it may name the previous release.
      const status = await readFile(join(dir, 'status.json'), 'utf8')
        .then((text) => JSON.parse(text) as { readonly previousRevision?: unknown } | null)
        .catch((cause: unknown) => {
          if (isMissing(cause)) return undefined
          throw cause
        })
      const previous = status?.previousRevision
      return Promise.all([
        linkedVersion(join(dir, 'current', '.engine')),
        typeof previous === 'string' && INSTANCE_REVISION_PATTERN.test(previous)
          ? linkedVersion(join(dir, `rev-${previous}`, '.engine'))
          : Promise.resolve(undefined),
      ])
    })
  )
  return new Set(perApp.flat().filter((version) => version !== undefined))
}

/** Remove the store's versions that nothing keeps or links. */
export const pruneEngines = (
  keep: readonly string[]
): Effect.Effect<EnginePruneResult, InstanceSupervisorError> =>
  Effect.gen(function* () {
    yield* Effect.forEach(keep, checkedVersion)
    const instancesDir = resolveInstancesDir(process.env)
    if (instancesDir === undefined) {
      return yield* engineError(
        'instance: SOVRIUM_INSTANCES_DIR is not set, so no release link can be read; nothing was pruned'
      )
    }
    const store = resolveEnginesDir(process.env)
    const prune = storeStep(`prune ${store}`, async () => {
      const linked = await linkedVersions(instancesDir)
      const stored = sortReleaseNumbers(
        await readdir(store).catch((cause: unknown) => {
          if (isMissing(cause)) return [] as string[]
          throw cause
        })
      )
      const removed = stored.filter((version) => !keep.includes(version) && !linked.has(version))
      for (const version of removed) {
        await rm(join(store, version), { recursive: true, force: true })
      }
      return { removed, kept: stored.filter((version) => !removed.includes(version)) }
    })
    return yield* withEngineLinksLock(prune)
  }).pipe(Effect.withSpan('instance.prune-engines'))
