/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data, type Effect } from 'effect'
import type { InstanceLogUnit } from '@/domain/models/app/automations/actions/instance/logs'

/**
 * A supervision step the host did not carry out: a unit command it refused or
 * that failed, a release directory that could not be written, a missing
 * setting. `message` is written for the operator and names the unit or the
 * path involved.
 */
export class InstanceSupervisorError extends Data.TaggedError('InstanceSupervisorError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

/** What `systemctl show` reports about an app's service unit. */
export interface InstanceUnitStatus {
  /** `active`, `inactive`, `failed`, `activating`, `deactivating`, or `unknown`. */
  readonly active: string
  readonly sub: string
  /** Absent when the unit has no main process. */
  readonly mainPid?: number
  readonly restarts: number
  /** `memory.current` of the unit, absent when systemd reports none. */
  readonly memoryBytes?: number
  /**
   * systemd's `Result` for the unit's last run (`success`, `exit-code`,
   * `signal`, `timeout`, …). Not `result`: `{{steps.<name>.result}}` already
   * names a step's whole output.
   */
  readonly unitResult?: string
  /** The main process's exit status, as systemd reports it. */
  readonly execMainStatus?: number
  /** The 32-hex id of the unit's current run; absent when systemd names none. */
  readonly invocationId?: string
}

/** `status.json` of an app's instance directory: what the last apply or rollback recorded. */
export interface InstanceReleaseStatus {
  readonly revision: string
  readonly previousRevision?: string
  /** When the revision now current was applied (a rollback gives it back its own time). */
  readonly appliedAt: string
  /** When the other revision, `previousRevision`, was applied. */
  readonly previousAppliedAt?: string
  /** When the last rollback swapped the two; the next apply drops it. */
  readonly rolledBackAt?: string
  /** The loopback port the release listens on, from its `PORT`. */
  readonly port?: number
}

/**
 * A bundle whose signature and every entry were checked. Only the apply
 * use-case builds one, after both checks pass; the supervisor writes nothing
 * else as a release.
 */
export interface VerifiedBundle {
  /** Every archive entry by path, `manifest.json` included. */
  readonly entries: ReadonlyMap<string, Uint8Array>
  /** The key that verified the manifest signature. */
  readonly verifiedWith: string
}

export interface ReleaseWrite {
  readonly bundle: VerifiedBundle
  readonly revision: string
  readonly env: Readonly<Record<string, string>>
  /**
   * The engine version the release runs on, already in the engine store: the
   * release gets `.engine`, an absolute link to `<store>/<engine>/sovrium`.
   */
  readonly engine: string
}

/** The outcome of writing a release: whether anything changed. */
export interface ReleaseWriteResult {
  /** False when the revision was already current — nothing was written. */
  readonly applied: boolean
  readonly previousRevision?: string
}

/** What installing an engine version did: whether it was installed now, and where it sits. */
export interface EngineInstallResult {
  /** False when the version was already in the store — nothing was downloaded. */
  readonly installed: boolean
  /** `<store>/<version>/sovrium`. */
  readonly path: string
}

/** What a prune of the engine store removed and kept, each sorted by version. */
export interface EnginePruneResult {
  readonly removed: readonly string[]
  readonly kept: readonly string[]
}

/** The outcome of a health probe. An app that does not answer is `ok: false`, not an error. */
export interface InstanceProbeResult {
  readonly ok: boolean
  /** The HTTP status answered, absent when nothing answered. */
  readonly status?: number
  readonly latencyMs: number
}

/**
 * What the app's seed unit left: its `report.json` as written — a seed report,
 * or `{ error }` when the seeder refused — and why the unit failed, if it did.
 */
export interface SeedUnitOutcome {
  /** `report.json`, parsed; `undefined` when the unit left none. */
  readonly report: unknown
  /** The unit's own failure, when `systemctl start` did not succeed. */
  readonly unitError?: string
}

/**
 * InstanceSupervisor — drive other Sovrium apps on this host: their systemd
 * units and their release directories under `SOVRIUM_INSTANCES_DIR`.
 *
 * Every `slug` handed to it must already match the instance slug rule; it is
 * the only caller value that reaches a command line or a path. The adapter
 * re-checks it and refuses one that does not.
 */
export class InstanceSupervisor extends Context.Service<
  InstanceSupervisor,
  {
    readonly status: (slug: string) => Effect.Effect<InstanceUnitStatus, InstanceSupervisorError>
    /**
     * start = the socket; stop = socket, proxy and app in one call; restart =
     * the proxy and the app stopped in one call, then the app started.
     */
    readonly control: (
      slug: string,
      verb: 'start' | 'stop' | 'restart'
    ) => Effect.Effect<void, InstanceSupervisorError>
    /**
     * The entries of an INFLATED bundle tar, read in memory — nothing is
     * written. The caller inflates the gzip layer against the unpacked-size
     * cap first (`gunzipBounded`), so the tar handed here is already bounded.
     * `only` reads just the named entries (the manifest, before its signature
     * is checked). `undefined` when the bytes are not a readable tar.
     */
    readonly readBundleEntries: (
      tar: Uint8Array,
      only?: readonly string[]
    ) => Effect.Effect<ReadonlyMap<string, Uint8Array> | undefined>
    /** `status.json`, or `undefined` when the app has no release recorded. */
    readonly readRelease: (
      slug: string
    ) => Effect.Effect<InstanceReleaseStatus | undefined, InstanceSupervisorError>
    /** Write a verified bundle as `rev-<revision>` and make it current. Restarts nothing. */
    readonly writeRelease: (
      slug: string,
      release: ReleaseWrite
    ) => Effect.Effect<ReleaseWriteResult, InstanceSupervisorError>
    /** Point `current` back at the previous release. Restarts nothing. */
    readonly rollbackRelease: (
      slug: string
    ) => Effect.Effect<InstanceReleaseStatus, InstanceSupervisorError>
    /**
     * The engine version the app's current release links (`current/.engine`),
     * or the one `rev-<revision>` links when a revision is named; `undefined`
     * when that release has no link.
     */
    readonly releaseEngine: (
      slug: string,
      revision?: string
    ) => Effect.Effect<string | undefined, InstanceSupervisorError>
    /** `<store>/<version>/sovrium` when the version is in the engine store, else `undefined`. */
    readonly enginePath: (
      version: string
    ) => Effect.Effect<string | undefined, InstanceSupervisorError>
    /**
     * Download a Sovrium release and install it in the engine store, after
     * checking its published sha256, its release signature and the version
     * its binary reports, under a lock per version held across processes. A
     * version already in the store downloads nothing.
     */
    readonly installEngine: (
      version: string
    ) => Effect.Effect<EngineInstallResult, InstanceSupervisorError>
    /**
     * Put the running binary in the engine store under its own version when
     * that version is missing; answers the version.
     */
    readonly adoptRunningEngine: Effect.Effect<string, InstanceSupervisorError>
    /**
     * Remove every version of the engine store that is neither in `keep` nor
     * linked by an app's current release or by the previous one its
     * `status.json` records.
     */
    readonly pruneEngines: (
      keep: readonly string[]
    ) => Effect.Effect<EnginePruneResult, InstanceSupervisorError>
    /** Delete the app's whole instance directory. */
    readonly removeRelease: (slug: string) => Effect.Effect<void, InstanceSupervisorError>
    /**
     * `GET http://127.0.0.1:<port>/api/health` on the recorded port, asked again
     * at a short interval until it answers or `timeoutMs` runs out. Loopback only.
     */
    readonly probe: (
      slug: string,
      timeoutMs: number
    ) => Effect.Effect<InstanceProbeResult, InstanceSupervisorError>
    /** The last journal lines of one of the app's units: app, seed, backup, restore or proxy. */
    readonly logs: (
      slug: string,
      options: { readonly lines: number; readonly since?: string; readonly unit: InstanceLogUnit }
    ) => Effect.Effect<readonly string[], InstanceSupervisorError>
    /**
     * The journal of an app found unhealthy: one line saying what systemd
     * reports about its unit, then the lines of the unit's current run when it
     * started at or after the release time `status.json` records — or a line
     * saying no process started since then. With no run named, the unit's lines
     * since the release time (the last five minutes when none is). Bounded in
     * lines, bytes and time; takes no window from the caller.
     */
    readonly crashJournal: (
      slug: string
    ) => Effect.Effect<readonly string[], InstanceSupervisorError>
    /**
     * Run the app's backup unit and hand back the archive it left, deleting the
     * local copy.
     */
    readonly backup: (
      slug: string,
      timeoutMs: number
    ) => Effect.Effect<Uint8Array, InstanceSupervisorError>
    /**
     * Restore the app from an archive: hand it to the restore unit with the app
     * stopped, then start the app's socket. A failed restore unit leaves the app
     * stopped. The archive handed over is deleted either way.
     */
    readonly restore: (
      slug: string,
      archive: Uint8Array,
      timeoutMs: number
    ) => Effect.Effect<void, InstanceSupervisorError>
    /**
     * Seed the app from the `seed/` folder of its current release: refuse when
     * it has none, before anything is written or started; hand `request` to the
     * seed unit, run it, and hand back what it left. Both files are deleted
     * either way. A failed unit is an outcome, not an error: its report says why.
     */
    readonly seed: (
      slug: string,
      request: Readonly<Record<string, unknown>>,
      timeoutMs: number
    ) => Effect.Effect<SeedUnitOutcome, InstanceSupervisorError>
  }
>()('InstanceSupervisor') {}
