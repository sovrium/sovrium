/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { watch, type FSWatcher } from 'node:fs'

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
 * Create a graph watcher whose every `change` event calls `onChange` with the
 * path that changed. Only `change` is followed — the same contract the
 * single-file watcher had — so an editor that renames-into-place needs the
 * same save-in-place behaviour it always needed.
 */
export const createConfigGraphWatcher = (
  onChange: (changedPath: string) => void
): ConfigGraphWatcher => {
  const watchers = new Map<string, FSWatcher>()

  const unwatch = (path: string, watcher: FSWatcher): void => {
    watcher.close()
    // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data, drizzle/enforce-delete-with-where -- watcher registry is the mutable seam of this module; `Map.delete`, not a SQL delete
    watchers.delete(path)
  }

  const watchFile = (path: string): void => {
    try {
      const watcher = watch(path, (eventType) => {
        if (eventType === 'change') onChange(path)
      })
      // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- watcher registry is the mutable seam of this module
      watchers.set(path, watcher)
    } catch {
      // A file that vanished between the load and this call cannot be watched;
      // the next successful reload re-derives the set and retries.
    }
  }

  const sync = (files: ReadonlyArray<string>): void => {
    const next = new Set(files)
    ;[...watchers.entries()]
      .filter(([path]) => !next.has(path))
      .forEach(([path, watcher]) => unwatch(path, watcher))
    files.filter((path) => !watchers.has(path)).forEach(watchFile)
  }

  return { sync, size: () => watchers.size }
}
