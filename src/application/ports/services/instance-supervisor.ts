/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data, type Effect } from 'effect'

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
}

/** `status.json` of an app's instance directory: what the last apply or rollback recorded. */
export interface InstanceReleaseStatus {
  readonly revision: string
  readonly previousRevision?: string
  readonly appliedAt: string
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
}

/** The outcome of writing a release: whether anything changed. */
export interface ReleaseWriteResult {
  /** False when the revision was already current — nothing was written. */
  readonly applied: boolean
  readonly previousRevision?: string
}

/** The outcome of a health probe. An app that does not answer is `ok: false`, not an error. */
export interface InstanceProbeResult {
  readonly ok: boolean
  /** The HTTP status answered, absent when nothing answered. */
  readonly status?: number
  readonly latencyMs: number
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
    /** start = the socket; stop = socket, proxy and app in one call; restart = the app. */
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
    /** Delete the app's whole instance directory. */
    readonly removeRelease: (slug: string) => Effect.Effect<void, InstanceSupervisorError>
    /** `GET http://127.0.0.1:<port>/api/health` on the recorded port. Loopback only. */
    readonly probe: (
      slug: string,
      timeoutMs: number
    ) => Effect.Effect<InstanceProbeResult, InstanceSupervisorError>
    /** The last journal lines of the app's service unit. */
    readonly logs: (
      slug: string,
      options: { readonly lines: number; readonly since?: string }
    ) => Effect.Effect<readonly string[], InstanceSupervisorError>
    /**
     * The journal of an app found unhealthy: its unit's latest lines since the
     * release time `status.json` records (the last five minutes when none is),
     * bounded in lines, bytes and time. Takes no window from the caller.
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
  }
>()('InstanceSupervisor') {}
