/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data, type Effect } from 'effect'

/**
 * The files a static build and a server boot write and read: the HTML, CSS,
 * sitemap, robots and llms files of `sovrium build`, the page-search index and
 * its runtime, and the directories they live in.
 *
 * The application layer may not touch the filesystem, so the build and the
 * boot ask this port. Its adapter (`infrastructure/filesystem/
 * static-output-writer-live.ts`) is `node:fs/promises`, call for call. Text is
 * always UTF-8 and every directory is made with its parents.
 *
 * A failure carries the filesystem's own error as `cause`, so each caller
 * wraps it in its own typed error with the message it has always written.
 */

/** A filesystem call that did not complete; `cause` is the error it rejected with. */
export class StaticOutputError extends Data.TaggedError('StaticOutputError')<{
  readonly cause: unknown
}> {}

/** The writer itself, also handed by value to the build steps that take it. */
export interface StaticOutputWriterShape {
  /** Make `path` and every missing parent; an existing directory is not an error. */
  readonly makeDirectory: (path: string) => Effect.Effect<void, StaticOutputError>
  /** Write `contents` as UTF-8 to `path`, replacing what was there. */
  readonly writeFile: (path: string, contents: string) => Effect.Effect<void, StaticOutputError>
  /**
   * Write `contents` whole or not at all: into a sibling temporary file, then
   * renamed over `path`. A rename within one directory is atomic, so a server
   * serving `path` while it is rebuilt answers the old file or the new one,
   * never a half-written one.
   */
  readonly writeFileAtomically: (
    path: string,
    contents: string
  ) => Effect.Effect<void, StaticOutputError>
  /** The UTF-8 text of `path`. */
  readonly readFile: (path: string) => Effect.Effect<string, StaticOutputError>
  /** Whether anything can be reached at `path`. Never fails: an unreachable path is `false`. */
  readonly exists: (path: string) => Effect.Effect<boolean>
  /** Whether `path` is a directory. Never fails: a missing path is `false`. */
  readonly isDirectory: (path: string) => Effect.Effect<boolean>
  /** The names of the entries of the directory `path`. */
  readonly readDirectory: (path: string) => Effect.Effect<readonly string[], StaticOutputError>
  /** Remove `path` and everything below it; a missing path is not an error. */
  readonly remove: (path: string) => Effect.Effect<void, StaticOutputError>
  /** Make a new, empty directory under the system's temporary directory, `sovrium-<name>-…`. */
  readonly makeTemporaryDirectory: (name: string) => Effect.Effect<string, StaticOutputError>
}

export class StaticOutputWriter extends Context.Service<
  StaticOutputWriter,
  StaticOutputWriterShape
>()('sovrium/StaticOutputWriter') {}
