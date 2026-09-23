/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { existsSync, watch, type FSWatcher } from 'node:fs'
import { basename, dirname, join } from 'node:path'

/**
 * One `fs.watch` handle per file of the config graph, kept in sync with the
 * set the last successful load reported.
 *
 * Each file is watched INDIVIDUALLY on purpose. A recursive watch on the
 * config directory would be simpler, but the SQLite data dir `.sovrium/` sits
 * beside the config and is written on every request — a recursive watch would
 * reload the server on its own traffic.
 */
export interface ConfigGraphWatcher {
  /**
   * Make the watched set exactly `files`: a path not yet watched gets a
   * watcher, a watched path no longer listed loses its watcher (closed, so a
   * file dropped from the graph cannot trigger a reload any more).
   */
  readonly sync: (files: ReadonlyArray<string>) => void
  /** Number of files currently watched. */
  readonly size: () => number
}

/**
 * Create a graph watcher whose every observed save calls `onChange` with the
 * path that changed.
 *
 * ## Why a `rename` is followed, and why the handle is rebuilt on one
 *
 * An `fs.watch` handle follows the INODE, not the path. Every editor with
 * atomic save enabled — and every AI coding tool — replaces a file by writing a
 * sibling temp file and renaming it over the target, so after one such save the
 * handle is bound to an inode nothing will ever write to again. What that costs
 * is platform-split, measured 2026-09-18 against Bun 1.4.1:
 *
 * | platform           | atomic save #1                | atomic save #2 | later in-place write |
 * | ------------------ | ----------------------------- | -------------- | -------------------- |
 * | macOS (host)       | `change`                      | `change`       | `change`             |
 * | Linux (alpine, CI) | `change`, then `rename` twice | NOTHING        | NOTHING              |
 *
 * So on Linux the FIRST atomic save is seen and every save after it is silently
 * dropped, while `[watch] Watching …` is still on screen — the worst available
 * shape of the defect, because the loop appears to work once. Following
 * `rename` and re-establishing the handle on the PATH is what makes the second
 * save arrive. macOS cannot show this RED; CI and the shipped container can.
 *
 * ## Why there is also a watcher on each parent directory
 *
 * Re-establishing on `rename` still loses the file permanently in one case: a
 * save that UNLINKS before it writes leaves the path briefly absent, `watch()`
 * throws, and no later event can restore the handle because the only thing that
 * would have restored it was an event. A non-recursive watcher on the parent
 * directory, filtered to the basenames actually watched, closes that hole — it
 * both reports the save and rebuilds the missing file handle.
 *
 * It is NOT the recursive watch the note above refuses: `.sovrium/` is a
 * SUBDIRECTORY, a non-recursive watch reports only direct entries, and the
 * basename filter drops everything that is not a config file anyway. The cost
 * is one `Set` lookup per unrelated write in the config directory.
 */
/**
 * The open handles, by the path or directory they watch.
 *
 * Mutable by nature: a registry that cannot take a handle and cannot release
 * one is not a registry. It is the single mutable seam of this module, and it
 * never escapes — `createConfigGraphWatcher` closes over both instances and
 * publishes only `sync` and `size`.
 */
type WatcherRegistry = Map<string, FSWatcher>

/** Close the watcher registered under `key` and forget it. */
const closeWatcher = (registry: WatcherRegistry, key: string): void => {
  const watcher = registry.get(key)
  if (!watcher) return
  watcher.close()
  // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data, drizzle/enforce-delete-with-where -- watcher registry is the mutable seam of this module; `Map.delete`, not a SQL delete
  registry.delete(key)
}

/**
 * Make `registry` hold a watcher for exactly `keys`: a key it does not have is
 * opened through `open`, a key it has and `keys` does not is closed.
 *
 * Closing is what makes a dropped `$ref` stop triggering reloads, rather than
 * merely being ignored downstream — the file is off the graph, so its saves
 * must stop reaching the scheduler at all.
 */
const syncRegistry = (
  registry: WatcherRegistry,
  keys: ReadonlyArray<string>,
  open: (key: string) => void
): void => {
  const next = new Set(keys)
  ;[...registry.keys()]
    .filter((key) => !next.has(key))
    .forEach((key) => closeWatcher(registry, key))
  keys.filter((key) => !registry.has(key)).forEach(open)
}

/** The directories holding the graph, each mapped to its watched basenames. */
const indexByDirectory = (files: ReadonlyArray<string>): ReadonlyMap<string, ReadonlySet<string>> =>
  new Map(
    [...new Set(files.map(dirname))].map((dir) => [
      dir,
      new Set(files.filter((path) => dirname(path) === dir).map((path) => basename(path))),
    ])
  )

export const createConfigGraphWatcher = (
  onChange: (changedPath: string) => void
): ConfigGraphWatcher => {
  const watchers = new Map<string, FSWatcher>()
  const dirWatchers = new Map<string, FSWatcher>()
  /** Per directory, the basenames of the files of the graph that live in it. */
  // eslint-disable-next-line functional/no-let -- replaced wholesale on every sync; a mutable Map would need clear()+set() instead
  let watchedNames: ReadonlyMap<string, ReadonlySet<string>> = new Map()

  /**
   * Report a save on `path`, unless the path is gone.
   *
   * A `rename` whose target no longer exists is a DELETE, not an edit: there is
   * nothing to reload from, and announcing one would answer the operator's
   * `rm` with a decode failure instead of silence.
   */
  const report = (path: string): void => {
    if (existsSync(path)) onChange(path)
  }

  const watchFile = (path: string): void => {
    try {
      const watcher = watch(path, (eventType) => {
        // Both event types mean "this path may now hold different bytes".
        // `rename` additionally means the handle is stranded on the old inode.
        if (eventType === 'rename') reestablish(path)
        report(path)
      })
      // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- watcher registry is the mutable seam of this module
      watchers.set(path, watcher)
    } catch {
      // A file that vanished between the load and this call cannot be watched.
      // The directory watcher above it restores the handle on the next event,
      // and the next successful reload re-derives the set as well.
    }
  }

  /** Rebind the handle for `path` onto whatever inode the path now names. */
  const reestablish = (path: string): void => {
    closeWatcher(watchers, path)
    watchFile(path)
  }

  const handleDirEvent = (dir: string, filename: string | Buffer | null): void => {
    if (typeof filename !== 'string') return
    if (!watchedNames.get(dir)?.has(filename)) return
    const path = join(dir, filename)
    // The file-level handle can be absent because a previous `watch()` raced a
    // save that unlinked first. This is the only place it can come back.
    if (!watchers.has(path)) watchFile(path)
    report(path)
  }

  const watchDir = (dir: string): void => {
    try {
      const watcher = watch(dir, (_eventType, filename) => handleDirEvent(dir, filename))
      // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- watcher registry is the mutable seam of this module
      dirWatchers.set(dir, watcher)
    } catch {
      // An unreadable config directory leaves the per-file handles as the only
      // coverage — which is exactly what this watcher had before.
    }
  }

  const sync = (files: ReadonlyArray<string>): void => {
    syncRegistry(watchers, files, watchFile)
    const wanted = indexByDirectory(files)
    // eslint-disable-next-line functional/no-expression-statements -- the name index is replaced wholesale, never mutated in place
    watchedNames = wanted
    syncRegistry(dirWatchers, [...wanted.keys()], watchDir)
  }

  return { sync, size: () => watchers.size }
}
