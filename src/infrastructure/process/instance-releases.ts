/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { randomUUID } from 'node:crypto'
import {
  chmod,
  mkdir,
  readFile,
  readlink,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import { DateTime, Effect } from 'effect'
import {
  InstanceSupervisorError,
  type InstanceReleaseStatus,
  type ReleaseWrite,
  type ReleaseWriteResult,
} from '@/application/ports/services/instance-supervisor'
import { INSTANCE_REVISION_PATTERN } from '@/domain/models/app/automations/actions/instance/apply'
import { INSTANCE_SLUG_PATTERN } from '@/domain/models/app/automations/actions/instance/instance-slug'
import { resolveInstancesDir } from '@/domain/models/process-env/host-actions'

/**
 * The release directories of supervised apps, under
 * `SOVRIUM_INSTANCES_DIR/<slug>/`:
 *
 *   rev-<revision>/   every bundle entry, manifest.json included, written whole
 *   current           relative symlink to the rev-<revision> in service
 *   env               KEY="value" lines (systemd EnvironmentFile syntax), mode 0640
 *   status.json       { revision, previousRevision?, appliedAt, previousAppliedAt?,
 *                       rolledBackAt?, port? }
 *
 * Every write goes to a temporary name in the same directory and is renamed
 * into place, so a crash never leaves a half-written release current. Nothing
 * here runs a unit; `systemd-supervisor-live.ts` does that.
 */

/** Mode of the env file and of a file handed to a unit: the app's group reads it. */
export const GROUP_READABLE_MODE = 0o640

export const fail = (
  message: string,
  cause?: unknown
): Effect.Effect<never, InstanceSupervisorError> =>
  Effect.fail(new InstanceSupervisorError({ message, ...(cause === undefined ? {} : { cause }) }))

const describe = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause)

/** A filesystem step, failing with the action it was doing. */
export const fsStep = <A>(action: string, run: () => Promise<A>) =>
  Effect.tryPromise({
    try: run,
    catch: (cause) =>
      new InstanceSupervisorError({ message: `could not ${action}: ${describe(cause)}`, cause }),
  })

export const isMissing = (cause: unknown): boolean =>
  (cause as { readonly code?: string } | null)?.code === 'ENOENT'

/** The slug, re-checked: the one caller value that reaches argv and a path. */
export const checkedSlug = (slug: string): Effect.Effect<string, InstanceSupervisorError> =>
  INSTANCE_SLUG_PATTERN.test(slug)
    ? Effect.succeed(slug)
    : fail(`"${slug}" is not an instance slug (2 to 28 lowercase letters, digits and "-")`)

const instancesRoot: Effect.Effect<string, InstanceSupervisorError> = Effect.suspend(() => {
  const root = resolveInstancesDir(process.env)
  return root === undefined
    ? fail(
        'SOVRIUM_INSTANCES_DIR is not set; it names the directory holding one folder per supervised app'
      )
    : Effect.succeed(root)
})

/** `SOVRIUM_INSTANCES_DIR/<slug>`, after checking both. */
export const instanceDir = (slug: string): Effect.Effect<string, InstanceSupervisorError> =>
  Effect.all([checkedSlug(slug), instancesRoot]).pipe(Effect.map(([s, root]) => join(root, s)))

/** Remove a file a step handed over; a leftover is logged, never a failure of the step. */
export const discard = (path: string): Effect.Effect<void> =>
  fsStep(`remove ${path}`, () => rm(path, { force: true })).pipe(
    Effect.tapCause((cause) => Effect.logWarning(`instance: could not remove ${path}`, cause)),
    // The step's outcome is decided; a copy left behind is reported in the log only.
    Effect.ignore
  )

export const readStatusFile = (dir: string) =>
  fsStep(`read ${join(dir, 'status.json')}`, async () => {
    const text = await readFile(join(dir, 'status.json'), 'utf8').catch((cause: unknown) => {
      if (isMissing(cause)) return undefined
      throw cause
    })
    if (text === undefined) return undefined
    const parsed = JSON.parse(text) as Partial<InstanceReleaseStatus>
    if (typeof parsed.revision !== 'string') return undefined
    return {
      revision: parsed.revision,
      appliedAt: String(parsed.appliedAt ?? ''),
      ...(typeof parsed.previousRevision === 'string'
        ? { previousRevision: parsed.previousRevision }
        : {}),
      ...(typeof parsed.previousAppliedAt === 'string'
        ? { previousAppliedAt: parsed.previousAppliedAt }
        : {}),
      ...(typeof parsed.rolledBackAt === 'string' ? { rolledBackAt: parsed.rolledBackAt } : {}),
      ...(typeof parsed.port === 'number' ? { port: parsed.port } : {}),
    } satisfies InstanceReleaseStatus
  })

const currentTarget = (dir: string) =>
  fsStep(`read ${join(dir, 'current')}`, () =>
    readlink(join(dir, 'current')).catch((cause: unknown) => {
      if (isMissing(cause)) return undefined
      throw cause
    })
  )

/** Replace `path` with `content` through a temporary file renamed into place. */
const writeAtomically = (path: string, content: string, mode: number) =>
  fsStep(`write ${path}`, async () => {
    const temporary = join(dirname(path), `.${randomUUID()}.tmp`)
    try {
      await writeFile(temporary, content, { mode })
      await chmod(temporary, mode)
      await rename(temporary, path)
    } finally {
      await rm(temporary, { force: true })
    }
  })

/** Point `current` at `rev-<revision>`, atomically, with a relative link. */
const pointCurrentAt = (dir: string, revision: string) =>
  fsStep(`point ${join(dir, 'current')} at rev-${revision}`, async () => {
    const temporary = join(dir, `.current.${randomUUID()}`)
    await symlink(`rev-${revision}`, temporary)
    await rename(temporary, join(dir, 'current'))
  })

const writeStatus = (dir: string, status: InstanceReleaseStatus) =>
  writeAtomically(join(dir, 'status.json'), `${JSON.stringify(status, undefined, 2)}\n`, 0o644)

/** Write every entry under `rev-<revision>`, through a temporary directory renamed into place. */
const writeReleaseDirectory = (
  dir: string,
  revision: string,
  entries: ReadonlyMap<string, Uint8Array>
) =>
  fsStep(`write ${join(dir, `rev-${revision}`)}`, async () => {
    const staging = join(dir, `.rev-${revision}.${randomUUID()}.tmp`)
    const target = join(dir, `rev-${revision}`)
    try {
      await mkdir(staging, { recursive: true })
      for (const [path, bytes] of entries) {
        const file = resolve(staging, path)
        if (!file.startsWith(staging + sep)) throw new Error(`entry ${path} leaves the release`)
        await mkdir(dirname(file), { recursive: true })
        await writeFile(file, bytes)
      }
      await rm(target, { recursive: true, force: true })
      await rename(staging, target)
    } finally {
      await rm(staging, { recursive: true, force: true })
    }
  })

/**
 * The env file, one `NAME="value"` line per variable, in the syntax systemd's
 * `EnvironmentFile=` reads. Unquoted, systemd trims the spaces around a value,
 * drops its backslashes and strips one pair of wrapping quotes; inside double
 * quotes it keeps every character and un-escapes only `"`, `\`, `` ` `` and `$`,
 * so those four are escaped and the value arrives byte for byte. Line breaks
 * never reach here: the action refuses a value that holds one.
 */
export const envFileContent = (env: Readonly<Record<string, string>>): string =>
  Object.entries(env)
    .map(([key, value]) => `${key}="${value.replace(/["\\`$]/g, '\\$&')}"\n`)
    .join('')

const portOf = (env: Readonly<Record<string, string>>): number | undefined => {
  const raw = env['PORT'] ?? ''
  const port = Number(raw)
  return /^\d+$/.test(raw) && port > 0 && port < 65_536 ? port : undefined
}

const nowIso = DateTime.now.pipe(Effect.map(DateTime.formatIso))

/** `status.json`, or `undefined` when no release is recorded (or no instances directory is set). */
export const readRelease = Effect.fn('instance.read-release')(function* (slug: string) {
  const s = yield* checkedSlug(slug)
  const root = resolveInstancesDir(process.env)
  // No instances directory means nowhere a release could be recorded.
  if (root === undefined) return undefined
  return yield* readStatusFile(join(root, s))
})

/** Write a verified bundle as `rev-<revision>` and make it current; the current revision is a no-op. */
export const writeRelease = (
  slug: string,
  release: ReleaseWrite
): Effect.Effect<ReleaseWriteResult, InstanceSupervisorError> =>
  Effect.gen(function* () {
    if (!INSTANCE_REVISION_PATTERN.test(release.revision)) {
      return yield* fail(`"${release.revision}" is not a revision name`)
    }
    const dir = yield* instanceDir(slug)
    const before = yield* readStatusFile(dir)
    const linked = yield* currentTarget(dir)
    const previous = before === undefined ? {} : { previousRevision: before.revision }
    if (before?.revision === release.revision && linked === `rev-${release.revision}`) {
      return {
        applied: false,
        ...(before.previousRevision === undefined
          ? {}
          : { previousRevision: before.previousRevision }),
      }
    }
    yield* fsStep(`create ${dir}`, () => mkdir(dir, { recursive: true, mode: 0o750 }))
    yield* writeReleaseDirectory(dir, release.revision, release.bundle.entries)
    yield* writeAtomically(join(dir, 'env'), envFileContent(release.env), GROUP_READABLE_MODE)
    yield* pointCurrentAt(dir, release.revision)
    const port = portOf(release.env)
    // A fresh `appliedAt`; the replaced revision's time is kept, and no rollback date survives.
    yield* writeStatus(dir, {
      revision: release.revision,
      ...previous,
      appliedAt: yield* nowIso,
      ...(before === undefined || before.appliedAt === ''
        ? {}
        : { previousAppliedAt: before.appliedAt }),
      ...(port === undefined ? {} : { port }),
    })
    return { applied: true, ...previous }
  }).pipe(Effect.withSpan('instance.write-release'))

/**
 * Point `current` back at the previous release, swapping the two. Each keeps
 * its own release time: the restored one gets back `previousAppliedAt` (the
 * moment of the swap when a file written before that field has none), the
 * other's becomes `previousAppliedAt`, and the swap is dated `rolledBackAt`.
 */
export const rollbackRelease = (
  slug: string
): Effect.Effect<InstanceReleaseStatus, InstanceSupervisorError> =>
  Effect.gen(function* () {
    const dir = yield* instanceDir(slug)
    const before = yield* readStatusFile(dir)
    if (before?.previousRevision === undefined) {
      return yield* fail(`${slug} has no previous release to roll back to`)
    }
    const previous = before.previousRevision
    yield* fsStep(`find ${join(dir, `rev-${previous}`)}`, () => stat(join(dir, `rev-${previous}`)))
    yield* pointCurrentAt(dir, previous)
    const rolledBackAt = yield* nowIso
    const after: InstanceReleaseStatus = {
      revision: previous,
      previousRevision: before.revision,
      appliedAt: before.previousAppliedAt ?? rolledBackAt,
      ...(before.appliedAt === '' ? {} : { previousAppliedAt: before.appliedAt }),
      rolledBackAt,
      ...(before.port === undefined ? {} : { port: before.port }),
    }
    yield* writeStatus(dir, after)
    return after
  }).pipe(Effect.withSpan('instance.rollback-release'))

/** Delete the app's whole instance directory. */
export const removeRelease = (slug: string): Effect.Effect<void, InstanceSupervisorError> =>
  instanceDir(slug).pipe(
    Effect.flatMap((dir) =>
      fsStep(`remove ${dir}`, () => rm(dir, { recursive: true, force: true }))
    ),
    Effect.withSpan('instance.remove-release')
  )

/**
 * The entries of an inflated bundle tar (or only those named), read in memory;
 * `undefined` when it is not one. The size cap is the caller's: it inflates the
 * gzip layer with `gunzipBounded` before handing the tar over.
 */
export const readBundleEntries = (
  tar: Uint8Array,
  only?: readonly string[]
): Effect.Effect<ReadonlyMap<string, Uint8Array> | undefined> =>
  Effect.tryPromise({
    try: async (): Promise<ReadonlyMap<string, Uint8Array>> => {
      const files = await new Bun.Archive(tar).files(only)
      const entries = new Map<string, Uint8Array>()
      for (const [path, file] of files) {
        entries.set(path, new Uint8Array(await file.arrayBuffer()))
      }
      return entries
    },
    catch: (cause) =>
      new InstanceSupervisorError({
        message: `the bundle is not a readable archive: ${describe(cause)}`,
        cause,
      }),
  }).pipe(
    Effect.tapCause((cause) =>
      Effect.logDebug('instance: bundle is not a readable archive', cause)
    ),
    // An unreadable archive is answered as `undefined`; the caller refuses it by name.
    Effect.orElseSucceed(() => undefined),
    Effect.withSpan('instance.read-bundle-entries')
  )
