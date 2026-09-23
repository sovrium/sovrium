/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `<lockDir>/status.json` — what a running instance publishes about ITSELF, in a
 * shape a program can read.
 *
 * ## Why a file, beside the lock file
 *
 * The three readers this exists for are precisely the three that cannot read the
 * terminal: a supervising shell that needs the port before it knows the port, a
 * CI step, and an AI that has just rewritten the config in another process. The
 * lock file already answers "is something running, and on which port"; it cannot
 * answer "was my edit taken", because it is rewritten identically whether the
 * last save landed or was thrown away.
 *
 * It sits beside the lock file rather than anywhere else so that ONE env var
 * (`SOVRIUM_LOCK_DIR`) moves both, and so a reader that found one has found the
 * other. {@link getStatusFilePath} derives its directory FROM `getLockFilePath`
 * for that reason — two spellings of the same directory is how a sidecar ends up
 * somewhere its reader does not look.
 *
 * ## The two states, and why `seq` is not redundant with them
 *
 * `serving` and `rejected` both describe an instance that answers HTTP. That is
 * the whole difficulty: after a refused save the last-good server keeps serving
 * a perfectly good page, so every signal a caller already has says "fine" while
 * its edit sits on disk unread. `state` is the only place that distinguishes
 * them, and `lastReload.outcome` says what it cost — `kept` means nothing was
 * stopped.
 *
 * `seq` answers a different question again: "has anything happened since I last
 * looked?". A successful save begins and ends at `serving`, so a poller
 * comparing states sees no change at all and concludes it was ignored. A
 * monotonic counter is the smallest thing that ends that confusion.
 *
 * ## Why the write is atomic, and the state retained
 *
 * A reader polls; a writer writes on every boot and every save. Writing in place
 * gives the reader a window in which the file parses as nothing, and the
 * defensive `JSON.parse` that follows would report "no instance" — the one
 * reading that must never be produced by accident. So the bytes are written to a
 * temp file and `rename`d, which is atomic on every filesystem this ships to.
 *
 * The last document is retained in memory because the two writers know different
 * halves. The boot knows the port and the hash and nothing about a save; the
 * watcher knows what a save did and must not have to re-derive the port to say
 * so. Merging over the retained document is what lets each publish only what it
 * learned.
 */

import { readFileSync, rmSync } from 'node:fs'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { logWarning } from '@/infrastructure/logging/logger'
import { notifyDevError } from '@/infrastructure/realtime/dev-reload-channel'
import { getLockFilePath } from '@/infrastructure/server/lock-file'
import type { ConfigFinding } from '@/domain/models/app/app-excess-property-report'

const STATUS_FILE_NAME = 'status.json'

/** What the instance is doing, as opposed to what its last save did. */
export type ServerStatusState =
  /** Serving, and the last save (if any) was applied. */
  | 'serving'
  /** Serving, and the last save was refused — the config on disk is NOT running. */
  | 'rejected'
  /** Nothing is listening: a save failed and the last-good config would not boot either. */
  | 'down'

/** Which of the two reload paths a save took. */
export type ReloadKind = 'hot' | 'restart'

/** What a save did to the listener — the same three outcomes `ReloadServerState` names. */
export type ReloadOutcomeLabel = 'success' | 'kept' | 'rolled-back' | 'down'

/** How far a failing save got. Mirrors `ReloadFailurePhase`. */
export type ReloadPhase = 'load' | 'preflight' | 'boot'

/** What one save did, published for a reader that was not watching the terminal. */
export interface StatusReloadRecord {
  /** When the verdict was reached, ISO-8601. */
  readonly at: string
  /**
   * Absent when the save never got far enough to be classified — an unparsable
   * file has no verdict, and guessing one would tell a supervisor holding an
   * open connection that it must reconnect when nothing was ever torn down.
   */
  readonly kind?: ReloadKind
  readonly durationMs: number
  readonly outcome: ReloadOutcomeLabel
  /** Present on a failure only. */
  readonly phase?: ReloadPhase
  /** Why it was refused, in the vocabulary `sovrium validate --json` speaks. */
  readonly findings: readonly ConfigFinding[]
}

/** The whole document. */
export interface ServerStatusDocument {
  readonly seq: number
  readonly state: ServerStatusState
  readonly pid: number
  readonly port: number
  readonly configHash: string
  readonly configPath: string
  readonly updatedAt: string
  readonly lastReload?: StatusReloadRecord
}

/** What one publisher learned. Everything omitted is carried over. */
export interface ServerStatusPatch {
  readonly state?: ServerStatusState
  readonly port?: number
  readonly configHash?: string
  readonly configPath?: string
  readonly lastReload?: StatusReloadRecord
}

/** The facts a document carries between writes. */
type RetainedStatus = Omit<ServerStatusDocument, 'seq' | 'updatedAt'>

const INITIAL: RetainedStatus = {
  state: 'serving',
  pid: process.pid,
  port: 0,
  configHash: '',
  configPath: '',
}

// Single-key Maps rather than a mutable record: the repo's idiom for
// per-process state that has to survive between calls without a `let` (see
// `lock-file-cleanup.ts`).
const retained = new Map<'status', RetainedStatus>()
const sequence = new Map<'seq', number>()

/**
 * The status file's path, in `SOVRIUM_LOCK_DIR` or the data dir.
 *
 * Derived from the lock file's path rather than from `getLockDir`, which is
 * private to that module: one definition of the directory means the two sidecars
 * cannot end up apart.
 */
export const getStatusFilePath = (): string => join(dirname(getLockFilePath()), STATUS_FILE_NAME)

/** Merge a patch over what was last published. */
const nextDocument = (patch: ServerStatusPatch): ServerStatusDocument => {
  const previous = retained.get('status') ?? INITIAL
  const merged: RetainedStatus = {
    state: patch.state ?? previous.state,
    pid: process.pid,
    port: patch.port ?? previous.port,
    configHash: patch.configHash ?? previous.configHash,
    configPath: patch.configPath ?? previous.configPath,
    // `undefined` in a patch means "I learned nothing about this", so a boot
    // never erases the verdict of the save that produced it.
    ...((patch.lastReload ?? previous.lastReload) !== undefined && {
      lastReload: patch.lastReload ?? previous.lastReload,
    }),
  }
  // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- retain the published document for the next partial write
  retained.set('status', merged)
  const seq = (sequence.get('seq') ?? 0) + 1
  // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- advance the monotonic counter a poller reads
  sequence.set('seq', seq)
  return { seq, ...merged, updatedAt: new Date().toISOString() }
}

/**
 * Publish what this instance now knows about itself.
 *
 * Best-effort, exactly as the lock-file write is: an instance that cannot write
 * its status file still serves correctly, and taking a dev server down over a
 * sidecar would be a worse failure than the one it reports. The warning is what
 * keeps that from being silent.
 */
export const publishServerStatus = async (patch: ServerStatusPatch): Promise<void> => {
  const document = nextDocument(patch)
  const path = getStatusFilePath()
  // The temp name carries the pid so two instances sharing a lock dir — which
  // `sovrium start` refuses, but a test harness does not — cannot half-write
  // each other's file.
  const temporary = `${path}.${String(process.pid)}.tmp`
  try {
    // eslint-disable-next-line functional/no-expression-statements -- filesystem provisioning; mirrors writeLockFile's mkdir-then-write precedent
    await mkdir(dirname(path), { recursive: true })
    await writeFile(temporary, JSON.stringify(document), 'utf-8')
    await rename(temporary, path)
  } catch (cause) {
    logWarning(`[server] could not write the status file: ${String(cause)}`)
    discardTempFile(temporary)
  }
}

/**
 * Read the status document published in this lock directory, if there is one.
 *
 * The reader half of the channel, added for `{app}_config_status` ([internal ref] A8
 * surface 9) and used by both MCP transports. It returns `undefined` rather
 * than a `not-running` shape on purpose: only the CALLER knows what it wants
 * to render for an absent instance, and a reader that invented a document
 * would make an absent file indistinguishable from a published one.
 *
 * Never throws. A missing, malformed or unreadable file reads as absent — a
 * poller must not be handed an exception for a sidecar, and the writer is
 * best-effort for the same reason.
 */
export const readStatusDocument = async (): Promise<ServerStatusDocument | undefined> => {
  try {
    const parsed: unknown = JSON.parse(await Bun.file(getStatusFilePath()).text())
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as ServerStatusDocument)
      : undefined
  } catch {
    return undefined
  }
}

/**
 * Drop the temp file a failed write left behind.
 *
 * Without this, a lock dir accumulates one orphan per failed write — and the
 * reader looking for `status.json` finds a directory that suggests something is
 * badly wrong when the only thing wrong is a disk that was briefly full.
 */
const discardTempFile = (path: string): void => {
  try {
    rmSync(path, { force: true })
  } catch {
    // Nothing to do: the write already failed and was already reported.
  }
}

/**
 * Remove the status file on the way out, if this process wrote it.
 *
 * Synchronous and pid-guarded for the same reasons `cleanupLockFileSync` is: a
 * signal handler has no event loop left to await on, and a process that did not
 * write the file must not delete another instance's.
 *
 * REMOVAL RATHER THAN A `stopped` RECORD. The lock file is unlinked on exit, so
 * a status file that outlived it would leave the older channel saying "no
 * instance" while the newer one still says `serving` — and a reader believes the
 * one that was written last. An absent file is unambiguous and cannot go stale.
 */
export const removeStatusFileSync = (): void => {
  try {
    const path = getStatusFilePath()
    const data = JSON.parse(readFileSync(path, 'utf-8')) as { readonly pid?: number }
    if (data.pid === process.pid) {
      rmSync(path, { force: true })
    }
  } catch {
    // Ignore: the file may not exist, and a shutdown must not fail over it.
  }
}

/** Everything the watcher knows about a save that did not happen. */
export interface RejectedSave {
  readonly kind: ReloadKind | undefined
  readonly durationMs: number
  readonly phase: ReloadPhase
  /** What the save did to the listener. */
  readonly outcome: Exclude<ReloadOutcomeLabel, 'success'>
  readonly findings: readonly ConfigFinding[]
}

/**
 * Publish a REFUSED save on both machine-readable channels at once.
 *
 * The file is for a reader that will come looking; the push is for the page
 * already open, which has no reason to look at all — the last-good server keeps
 * answering 200, so nothing about its own experience suggests anything is wrong.
 * They are published together, from one place, because two call sites are how
 * two channels come to disagree about the same save.
 *
 * The successful case has no twin here: the hot-swap path already pushes
 * `{"type":"reload"}` from `server-reload.ts`, and a restart is announced to the
 * page by the reconnect itself.
 */
export const publishRejectedSave = async (save: RejectedSave): Promise<void> => {
  notifyDevError(save.findings)
  await publishServerStatus({
    // `down` is the one refusal that is not merely a refusal: nothing is
    // listening, so the instance itself is the news rather than the save.
    state: save.outcome === 'down' ? 'down' : 'rejected',
    lastReload: {
      at: new Date().toISOString(),
      ...(save.kind !== undefined && { kind: save.kind }),
      durationMs: save.durationMs,
      outcome: save.outcome,
      phase: save.phase,
      findings: save.findings,
    },
  })
}
