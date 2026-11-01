/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { existsSync } from 'node:fs'
import { dirname } from 'node:path'

/**
 * The open handles, by the path or directory they watch.
 *
 * Mutable by nature: a registry that cannot take a handle and cannot release
 * one is not a registry. It is the single mutable seam of the graph watcher, and
 * it never escapes — `createConfigGraphWatcher` closes over both instances and
 * publishes only `sync` and `size`.
 */
export type WatcherRegistry = Map<string, WatchHandle>

/** What the graph watcher needs from an open watch: the means to close it. */
interface WatchHandle {
  readonly close: () => void
}

/** `fs.watch` as the graph watcher calls it — injectable so a test can withhold events. */
export type WatchFunction = (
  path: string,
  listener: (eventType: string, filename: string | Buffer | null) => void
) => WatchHandle

/** Close the watcher registered under `key` and forget it. */
export const closeWatcher = (registry: WatcherRegistry, key: string): void => {
  const watcher = registry.get(key)
  if (!watcher) return
  watcher.close()
  registry.delete(key)
}

/** The closest directory above `dir` that exists, or `undefined` past the root. */
const nearestExistingAncestor = (dir: string): string | undefined => {
  const parent = dirname(dir)
  if (parent === dir) return undefined
  return existsSync(parent) ? parent : nearestExistingAncestor(parent)
}

/** What {@link createDirectoryWatch} tells its caller. */
interface DirectoryWatchEvents {
  /** An entry of a watched directory changed. */
  readonly onEvent: (dir: string, filename: string | Buffer | null) => void
  /** A directory that did not exist when it was named is now watched itself. */
  readonly onArrived: (dir: string) => void
}

/**
 * The function that opens the watch of one directory of the graph, under that
 * directory's key in `registry`.
 *
 * A directory that does not exist yet — a refused `$ref` can name
 * `config/about.yaml` before `config/` is created — is stood in for by a watch
 * on its nearest existing ancestor, kept under the directory's own key. Once
 * the path gets closer to existing it is watched again from there, and when the
 * directory itself is watched `onArrived` runs: the write that follows a
 * `mkdir` can land before the new watch is armed, so its files are checked
 * right away.
 */
export const createDirectoryWatch = (
  watchFn: WatchFunction,
  registry: WatcherRegistry,
  events: DirectoryWatchEvents
): ((dir: string) => void) => {
  const watchExisting = (dir: string): void => {
    try {
      registry.set(
        dir,
        watchFn(dir, (_eventType, filename) => events.onEvent(dir, filename))
      )
    } catch {
      // An unreadable config directory leaves the per-file handles as the only
      // coverage — which is exactly what this watcher had before.
    }
  }

  const watchAncestorOf = (dir: string): void => {
    const ancestor = nearestExistingAncestor(dir)
    if (ancestor === undefined) return
    try {
      const watcher = watchFn(ancestor, () => {
        if (registry.get(dir) !== watcher) return
        if (!existsSync(dir) && nearestExistingAncestor(dir) === ancestor) return
        closeWatcher(registry, dir)
        watchDir(dir)
        if (existsSync(dir)) events.onArrived(dir)
      })
      registry.set(dir, watcher)
    } catch {
      // Nothing above the directory can be watched: the next successful reload
      // re-derives the set, as it did before directories were watched at all.
    }
  }

  const watchDir = (dir: string): void =>
    existsSync(dir) ? watchExisting(dir) : watchAncestorOf(dir)

  return watchDir
}
