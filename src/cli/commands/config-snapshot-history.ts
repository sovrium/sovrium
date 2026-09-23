/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Undo that does not require git.
 *
 * A person who asks an AI to change their app and gets a worse app needs to go
 * back. Many of them have no git, no account anywhere, and no idea what a
 * commit is — so the engine keeps the history itself: under `--watch`, every
 * config that is ACCEPTED AND SERVED is copied whole into
 * `<dataDir>/history/<ISO-timestamp>-<configHash>/`, at the relative paths it
 * occupies in the project.
 *
 * ### Three decisions, each of which is the feature
 *
 * - **The boot counts.** Without a snapshot at boot, the history after one edit
 *   holds exactly one entry — the state the user is trying to leave — and undo
 *   has nowhere to go.
 * - **Accepted configs only.** This is a list of configs that SERVED, not of
 *   configs that were attempted. An entry that never booted is an undo target
 *   that breaks the app, which is the one thing an undo may not be.
 * - **The whole graph, not the edited file.** A restore is then a directory
 *   copy rather than a merge, and a restore that has to merge is a restore that
 *   can half-fail.
 *
 * ### Two writers now, and the second one changes no rule
 *
 * `_config_write_file` ([internal ref] A8 surface 10) snapshots the PRE-write state
 * before it touches a byte. Left to the watcher alone, the "accepted configs
 * only" rule above makes undo unreachable for the exact case that surface exists
 * to serve — an AI editing a project with NO server running, where nothing ever
 * reaches "accepted" and the history stays empty. So a second caller was added
 * to the first rule rather than the rule being weakened.
 *
 * It does not double up, because {@link snapshotConfigGraphIfChanged} is a
 * NO-OP when the newest existing snapshot already holds byte-identical files:
 *
 * - **A `--watch` server is running.** It snapshotted the config it is serving,
 *   which IS the pre-write state, so the write tool finds it identical and
 *   skips; the watcher then snapshots the newly accepted config. `[pre, post]`.
 * - **Nothing is running.** Nobody else snapshots, so the write tool records the
 *   pre-write state. `[pre]`, with the post-write bytes only on disk.
 *
 * ### The restore is still just a directory copy
 *
 * {@link restoreSnapshot} writes a snapshot's files back over the project and
 * does nothing else — no reload, no privileged path, nothing a shell could not
 * do. The watcher sees the writes and the ordinary reload path serves the
 * result, exactly as it would for a person with a file manager. What the helper
 * adds over `cp -r` is the ONE decision undo has to make, which is
 * {@link findRestorableSnapshot}: restore the most recent snapshot whose files
 * DIFFER from what is on disk now. Both history shapes above are then served by
 * one rule — "the second-most-recent" would be right in one and wrong in the
 * other.
 */

import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { parseDataDir } from '@/domain/models/process-env/data-dir'
import { isPathWithin } from '@/domain/models/process-env/desktop'
import { printJournalWarning } from '@/infrastructure/logging/cli-output'

/**
 * How many snapshots are kept.
 *
 * Twenty is far more than the handful of steps anyone retraces by hand, and
 * small enough that a config graph's worth of text stays negligible on disk.
 * A cap has to exist at all because `--watch` snapshots on every accepted save,
 * so an afternoon of editing is hundreds of them.
 */
const MAX_SNAPSHOTS = 20

/** Where a `--watch` boot keeps its accepted-config snapshots. */
export const historyDir = (): string => join(parseDataDir(), 'history')

/**
 * A directory name that is filesystem-safe AND sorts chronologically.
 *
 * `:` is illegal on Windows and `.` would read as an extension, so both become
 * `-`. What survives is the property the pruner depends on: the names are
 * fixed-width and lexical order IS chronological, so "the oldest" needs no
 * `stat` call and no parsing.
 */
const snapshotName = (configHash: string): string =>
  `${new Date().toISOString().replace(/[:.]/g, '-')}-${configHash}`

/**
 * Drop the oldest entries until at most {@link MAX_SNAPSHOTS} remain.
 *
 * Prunes the OLDEST, which is the half an assertion on the count alone would
 * miss: a pruner working from the wrong end keeps twenty entries and throws
 * away the one the user is most likely to want.
 */
const pruneToCap = async (dir: string): Promise<void> => {
  const entries = await readdir(dir, { withFileTypes: true })
  const names = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .toSorted()

  const excess = names.slice(0, Math.max(0, names.length - MAX_SNAPSHOTS))
  // eslint-disable-next-line functional/no-expression-statements -- delete the pruned directories
  await Promise.all(excess.map((name) => rm(join(dir, name), { recursive: true, force: true })))
}

/**
 * Copy one accepted config graph into the history.
 *
 * Never throws and never blocks a boot or a reload: a history that cannot be
 * written is a lost convenience, while a boot that fails because of one is a
 * lost application. Failures are reported once, as a warning, and the server
 * carries on.
 *
 * Answers the directory NAME it wrote, or `undefined` when it wrote nothing.
 * The watcher ignores that; `_config_write_file` reports it back to its caller,
 * which is how an AI knows which snapshot its edit can be undone to.
 *
 * @param rootFile - The config graph's root file
 * @param files - Every file the graph was read from, root included
 * @param configHash - The hash the lock file records for this config
 * @public
 */
export const snapshotConfigGraph = async (
  rootFile: string,
  files: ReadonlyArray<string>,
  configHash: string
): Promise<string | undefined> => {
  try {
    const rootDir = dirname(resolve(rootFile))
    const name = snapshotName(configHash)
    const target = join(historyDir(), name)

    /* eslint-disable functional/no-expression-statements -- write the snapshot tree to disk */
    await Promise.all(
      files.map(async (file) => {
        // A `$ref` reaching above the config's own directory would otherwise
        // be copied OUTSIDE the snapshot directory — which is both wrong and
        // destructive. Skipping it leaves the snapshot incomplete, and an
        // incomplete snapshot is a much smaller problem than a copy that
        // escapes its destination.
        //
        // The containment test is the `$ref` jail's own, imported rather than
        // re-typed: it is the same question asked of the same kind of path, and
        // a security predicate spelled out twice is two chances to spell it
        // differently.
        const absolute = resolve(file)
        if (!isPathWithin(rootDir, absolute)) return

        const destination = join(target, relative(rootDir, absolute))
        await mkdir(dirname(destination), { recursive: true })
        await cp(resolve(file), destination)
      })
    )
    /* eslint-enable functional/no-expression-statements */

    await pruneToCap(historyDir())
    return name
  } catch (error) {
    printJournalWarning(
      'watch',
      `Could not record this config in the history — undo will not reach it.\n` +
        (error instanceof Error ? error.message : String(error))
    )
    return undefined
  }
}

// ---------------------------------------------------------------------------
// Reading the history back
// ---------------------------------------------------------------------------

/** Snapshot directory names, OLDEST first — the names sort chronologically. */
export const listSnapshots = async (): Promise<readonly string[]> => {
  const entries = await readdir(historyDir(), { withFileTypes: true }).catch(() => [])
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .toSorted()
}

/** Every file a snapshot holds, as paths relative to the snapshot's own root. */
const snapshotFiles = async (dir: string, prefix = ''): Promise<readonly string[]> => {
  const entries = await readdir(join(dir, prefix), { withFileTypes: true }).catch(() => [])
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const relativePath = prefix === '' ? entry.name : join(prefix, entry.name)
      return entry.isDirectory() ? snapshotFiles(dir, relativePath) : [relativePath]
    })
  )
  return nested.flat()
}

/** Text of a file, or `undefined` when it does not exist or cannot be read. */
const readTextOrUndefined = async (path: string): Promise<string | undefined> => {
  try {
    return await Bun.file(path).text()
  } catch {
    return undefined
  }
}

/** The files of `snapshot` whose bytes differ from what sits in `rootDir` now. */
const differingFiles = async (
  rootDir: string,
  snapshotDir: string,
  files: readonly string[]
): Promise<readonly string[]> => {
  const verdicts = await Promise.all(
    files.map(async (file) => {
      const [stored, live] = await Promise.all([
        readTextOrUndefined(join(snapshotDir, file)),
        readTextOrUndefined(join(rootDir, file)),
      ])
      return stored === live ? [] : [file]
    })
  )
  return verdicts.flat()
}

/** A snapshot, its directory, and what it would change if restored. */
export interface RestorableSnapshot {
  readonly name: string
  readonly directory: string
  /** Project-relative paths whose bytes differ from the snapshot's. */
  readonly files: readonly string[]
}

/**
 * The most recent snapshot whose files DIFFER from what is on disk.
 *
 * The one decision undo has to make, and it is worded this way because it has
 * to serve both history shapes the header describes — see there. A snapshot
 * holding exactly what is already on disk is not a way back from anything, so
 * skipping it is also what stops an undo loop ping-ponging forever.
 *
 * @param rootDir - The directory the snapshot's relative paths are anchored to
 * @public
 */
export const findRestorableSnapshot = async (
  rootDir: string
): Promise<RestorableSnapshot | undefined> => {
  const names = (await listSnapshots()).toReversed()
  // Sequential on purpose: the answer is almost always the first candidate, and
  // reading every snapshot in the history to discard nineteen of them would
  // turn a cheap question into twenty directory walks.
  // eslint-disable-next-line functional/no-loop-statements -- see above; `find` cannot await
  for (const name of names) {
    const directory = join(historyDir(), name)
    const files = await differingFiles(rootDir, directory, await snapshotFiles(directory))
    if (files.length > 0) return { name, directory, files }
  }
  return undefined
}

/**
 * Copy a snapshot's files back over the project.
 *
 * Only the files that differ, so a restore touches nothing it does not have to
 * — the watcher then reloads once rather than once per unchanged file.
 *
 * @public
 */
export const restoreSnapshot = async (
  rootDir: string,
  snapshot: Readonly<RestorableSnapshot>
): Promise<void> => {
  /* eslint-disable functional/no-expression-statements -- writing the restored files IS the operation */
  await Promise.all(
    snapshot.files.map(async (file) => {
      const destination = join(rootDir, file)
      await mkdir(dirname(destination), { recursive: true })
      const stored = await readTextOrUndefined(join(snapshot.directory, file))
      // A file the snapshot does not hold is one the edit CREATED, so putting
      // the project back means emptying it is wrong and deleting it is right.
      if (stored === undefined) return rm(destination, { force: true })
      return writeFile(destination, stored, 'utf-8')
    })
  )
  /* eslint-enable functional/no-expression-statements */
}

/**
 * Snapshot the graph unless the newest existing snapshot already holds it.
 *
 * The no-op is what lets `_config_write_file` and the watcher both snapshot
 * without the history doubling up — see the header.
 *
 * @public
 */
export const snapshotConfigGraphIfChanged = async (
  rootFile: string,
  files: ReadonlyArray<string>,
  configHash: string
): Promise<string | undefined> => {
  const rootDir = dirname(resolve(rootFile))
  const newest = (await listSnapshots()).at(-1)
  if (newest !== undefined) {
    const directory = join(historyDir(), newest)
    const stored = await snapshotFiles(directory)
    const changed = await differingFiles(rootDir, directory, stored)
    if (stored.length > 0 && changed.length === 0) return undefined
  }
  return snapshotConfigGraph(rootFile, files, configHash)
}
