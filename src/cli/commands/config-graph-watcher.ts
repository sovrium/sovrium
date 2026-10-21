/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { existsSync, readFileSync, watch } from 'node:fs'
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
 * is platform-split, measured against Bun 1.4.1:
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
 *
 * ## Why a handle is checked on again shortly after it is opened
 *
 * `watch()` returning is not the same as the platform watching. On macOS, Bun
 * serves every handle of the process from ONE FSEvents stream, built on a
 * separate thread some time after the call, and rebuilt from scratch whenever a
 * handle is added or closed. A stream starts "from now", so a save landing in
 * that gap is never reported by anyone: the boot prints `Watching …`, the
 * operator saves, and nothing reloads until the NEXT save. A fast boot (the
 * compiled binary reaches `Watching` in a fraction of a second) makes the gap
 * easy to hit; a loaded machine widens it.
 *
 * So every time the set of handles changes, the watcher re-reads each watched
 * file's content a few times over the next seconds and reports any file that no
 * longer matches what it last knew. It is a backstop for that window only, not
 * a poll: it stops after the last delay, and a file whose change WAS reported
 * by an event has already had its record updated, so it is never reported
 * twice. Linux (inotify) arms synchronously and never needs it.
 */
/**
 * The open handles, by the path or directory they watch.
 *
 * Mutable by nature: a registry that cannot take a handle and cannot release
 * one is not a registry. It is the single mutable seam of this module, and it
 * never escapes — `createConfigGraphWatcher` closes over both instances and
 * publishes only `sync` and `size`.
 */
type WatcherRegistry = Map<string, WatchHandle>

/** What this module needs from an open watch: the means to close it. */
interface WatchHandle {
  readonly close: () => void
}

/** `fs.watch` as this module calls it — injectable so a test can withhold events. */
export type WatchFunction = (
  path: string,
  listener: (eventType: string, filename: string | Buffer | null) => void
) => WatchHandle

/** Options of {@link createConfigGraphWatcher}; the defaults are what the CLI runs. */
export interface ConfigGraphWatcherOptions {
  readonly watch?: WatchFunction
  /**
   * When, after the handles last changed, each watched file is re-checked for
   * a save the platform watcher was not yet armed to see.
   */
  readonly recheckDelaysMs?: ReadonlyArray<number>
}

/**
 * The re-check schedule after the handles change: every 25 ms for the first
 * 300 ms, then a few late entries for a machine too loaded to arm quickly. Each
 * one is a read of each (small) config file.
 *
 * The early entries are dense because a save caught by a re-check still pays
 * the reload debounce on top, and on a loaded machine FSEvents delivers its own
 * event 100-200 ms after the write: a re-check that sees the save first is what
 * keeps that delivery delay out of the time the operator waits.
 */
const RECHECK_DELAYS_MS: ReadonlyArray<number> = [
  ...Array.from({ length: 12 }, (_, index) => (index + 1) * 25),
  600,
  1500,
  5000,
]

/**
 * A hash of what a file holds, or `undefined` when it is absent or unreadable.
 *
 * The CONTENT, not the `stat`: Linux stamps `mtime` from a coarse clock (one
 * tick is several milliseconds), so two same-size saves landing in one tick
 * leave inode, size and `mtime` all identical. A `stat` fingerprint then calls
 * the second save "unchanged" — the re-check misses it and the de-duplication
 * below drops its event, which is a lost save. Equal content, on the other
 * hand, is exactly the case where nothing needs reloading.
 */
const fingerprintOf = (path: string): string | undefined => {
  try {
    return String(Bun.hash(readFileSync(path)))
  } catch {
    return undefined
  }
}

/**
 * The reporting end of the watcher, with the re-check described under "checked
 * on again": what each file of the graph looked like when the watcher last knew
 * it, and the timers that compare.
 */
interface ReportingBackstop {
  /**
   * Report a save on `path`, unless the path is gone, or it holds exactly what
   * it held when it was reported less than {@link DUPLICATE_WINDOW_MS} ago.
   *
   * The second case is a re-check and an event noticing the SAME save, in
   * either order. Reporting it twice is not harmless: every report restarts the
   * reload debounce, so a late event would push back a reload the re-check had
   * already scheduled. Nothing is lost by dropping it — the reload reads the
   * files when it runs, not when it was scheduled. The window is what keeps a
   * deliberate re-save of unchanged content (retrying after a refused reload)
   * from being swallowed: outside it, an event is always reported.
   *
   * A `rename` whose target no longer exists is a DELETE, not an edit: there is
   * nothing to reload from, and announcing one would answer the operator's
   * `rm` with a decode failure instead of silence.
   */
  readonly report: (path: string) => void
  /** Make the tracked set exactly `files`; a newly tracked file is fingerprinted now. */
  readonly track: (files: ReadonlyArray<string>) => void
  /** (Re)start the re-checks — a no-op once nothing is tracked. Called when a handle opens or closes. */
  readonly schedule: () => void
}

/** How long after a report the same content counts as the same save. */
const DUPLICATE_WINDOW_MS = 1000

/** True when `fingerprint` is the save last reported, and that report is recent. */
const isRecentDuplicate = (
  fingerprint: string | undefined,
  lastFingerprint: string | undefined,
  lastReportedAt: number | undefined
): boolean =>
  fingerprint === lastFingerprint &&
  lastReportedAt !== undefined &&
  Date.now() - lastReportedAt < DUPLICATE_WINDOW_MS

const createReportingBackstop = (
  onChange: (changedPath: string) => void,
  delaysMs: ReadonlyArray<number>
): ReportingBackstop => {
  const known = new Map<string, string | undefined>()
  const reportedAt = new Map<string, number>()
  let timers: ReadonlyArray<ReturnType<typeof setTimeout>> = []

  const announce = (path: string, fingerprint: string | undefined): void => {
    known.set(path, fingerprint)
    reportedAt.set(path, Date.now())
    onChange(path)
  }

  const report = (path: string): void => {
    if (!existsSync(path)) return
    const fingerprint = fingerprintOf(path)
    if (isRecentDuplicate(fingerprint, known.get(path), reportedAt.get(path))) return
    announce(path, fingerprint)
  }

  /** A re-check has no event behind it: only a real content change is a save. */
  const recheck = (): void => {
    ;[...known.keys()].forEach((path) => {
      const fingerprint = fingerprintOf(path)
      if (fingerprint !== undefined && fingerprint !== known.get(path)) announce(path, fingerprint)
    })
  }

  const cancel = (): void => {
    timers.forEach(clearTimeout)
    timers = []
  }

  return {
    report,
    track: (files) => {
      const wanted = new Set(files)
      ;[...known.keys()].filter((path) => !wanted.has(path)).forEach((path) => known.delete(path))
      // `reportedAt` is left as it is: a timestamp older than the duplicate
      // window is inert, and a path re-added within it IS the same save.
      files
        .filter((path) => !known.has(path))
        .forEach((path) => known.set(path, fingerprintOf(path)))
    },
    schedule: () => {
      cancel()
      // An emptied graph has nothing left to re-check.
      if (known.size === 0) return
      timers = delaysMs.map((delay) => {
        const timer = setTimeout(recheck, delay)
        // A pending re-check must never be what keeps the process alive.
        timer.unref?.()
        return timer
      })
    },
  }
}

/** Close the watcher registered under `key` and forget it. */
const closeWatcher = (registry: WatcherRegistry, key: string): void => {
  const watcher = registry.get(key)
  if (!watcher) return
  watcher.close()
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
): boolean => {
  const next = new Set(keys)
  const dropped = [...registry.keys()].filter((key) => !next.has(key))
  const added = keys.filter((key) => !registry.has(key))
  dropped.forEach((key) => closeWatcher(registry, key))
  added.forEach(open)
  return dropped.length > 0 || added.length > 0
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
  onChange: (changedPath: string) => void,
  { watch: watchFn = watch, recheckDelaysMs = RECHECK_DELAYS_MS }: ConfigGraphWatcherOptions = {}
): ConfigGraphWatcher => {
  const watchers: WatcherRegistry = new Map()
  const dirWatchers: WatcherRegistry = new Map()
  /** Per directory, the basenames of the files of the graph that live in it. */
  let watchedNames: ReadonlyMap<string, ReadonlySet<string>> = new Map()

  // Every report also restores a missing file-level handle: it can be absent
  // because a previous `watch()` raced a save that unlinked first, and a save
  // found by the directory watcher OR by a re-check is the proof it is back.
  const backstop = createReportingBackstop((path) => {
    if (!watchers.has(path)) watchFile(path)
    onChange(path)
  }, recheckDelaysMs)
  const { report } = backstop

  const watchFile = (path: string): void => {
    try {
      const watcher = watchFn(path, (eventType) => {
        // Both event types mean "this path may now hold different bytes".
        // `rename` additionally means the handle is stranded on the old inode.
        if (eventType === 'rename') reestablish(path)
        report(path)
      })
      watchers.set(path, watcher)
      backstop.schedule()
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
    // A missing file-level handle is restored by `report` itself.
    report(join(dir, filename))
  }

  const watchDir = (dir: string): void => {
    try {
      const watcher = watchFn(dir, (_eventType, filename) => handleDirEvent(dir, filename))
      dirWatchers.set(dir, watcher)
    } catch {
      // An unreadable config directory leaves the per-file handles as the only
      // coverage — which is exactly what this watcher had before.
    }
  }

  const sync = (files: ReadonlyArray<string>): void => {
    backstop.track(files)
    const filesChanged = syncRegistry(watchers, files, watchFile)
    watchedNames = indexByDirectory(files)
    // Any handle opened or closed rebuilds the platform stream, and its gap.
    if (syncRegistry(dirWatchers, [...watchedNames.keys()], watchDir) || filesChanged) {
      backstop.schedule()
    }
  }

  return { sync, size: () => watchers.size }
}
