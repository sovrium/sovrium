/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { readFile, writeFile, mkdir, access } from 'node:fs/promises'
import * as Context from 'effect/Context'
import * as Data from 'effect/Data'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Schedule from 'effect/Schedule'
import { formatText } from '../format'

/**
 * The path `format()` formats content AS when the caller names none: a
 * TypeScript file inside the tree, so the repository config applies (the
 * Prettier-API version defaulted to the `typescript` parser the same way, but
 * without the config).
 */
const DEFAULT_FORMAT_PATH = 'scripts/lib/effect/format-input.ts'

/**
 * File System Error Types
 */
export class FileNotFoundError extends Data.TaggedError('FileNotFoundError')<{
  readonly path: string
  readonly cause?: unknown
}> {}

export class FileReadError extends Data.TaggedError('FileReadError')<{
  readonly path: string
  readonly cause?: unknown
}> {}

export class FileWriteError extends Data.TaggedError('FileWriteError')<{
  readonly path: string
  readonly cause?: unknown
}> {}

export class DirectoryCreateError extends Data.TaggedError('DirectoryCreateError')<{
  readonly path: string
  readonly cause?: unknown
}> {}

export class GlobError extends Data.TaggedError('GlobError')<{
  readonly pattern: string
  readonly cause?: unknown
}> {}

export class FormattingError extends Data.TaggedError('FormattingError')<{
  readonly content: string
  readonly cause?: unknown
}> {}

/**
 * File System Service Interface
 */
export interface FileSystemService {
  /**
   * Read file contents as UTF-8 string
   * @param path - Absolute or relative file path
   * @returns Effect that resolves to file contents
   */
  readonly readFile: (path: string) => Effect.Effect<string, FileNotFoundError | FileReadError>

  /**
   * Write content to file (creates parent directories if needed)
   * @param path - Absolute or relative file path
   * @param content - Content to write
   * @returns Effect that completes when write is successful
   */
  readonly writeFile: (
    path: string,
    content: string
  ) => Effect.Effect<void, FileWriteError | DirectoryCreateError>

  /**
   * Check if file or directory exists
   * @param path - Path to check
   * @returns Effect that resolves to true if exists, false otherwise
   */
  readonly exists: (path: string) => Effect.Effect<boolean>

  /**
   * Create directory recursively
   * @param path - Directory path
   * @returns Effect that completes when directory is created
   */
  readonly mkdir: (path: string) => Effect.Effect<void, DirectoryCreateError>

  /**
   * Find files matching glob pattern
   * @param pattern - Glob pattern (e.g., "src/**\/*.ts")
   * @returns Effect that resolves to array of file paths
   */
  readonly glob: (pattern: string) => Effect.Effect<readonly string[], GlobError>

  /**
   * Format content with the repository formatter (`bun fmt`, [internal ref])
   * @param content - Content to format
   * @param filepath - The path the content is formatted AS: it picks the
   *   language, and `.prettierrc.json` / `.prettierignore` apply to it as to a
   *   real file there. It need not exist. Defaults to a TypeScript file.
   * @returns Effect that resolves to formatted content
   */
  readonly format: (content: string, filepath?: string) => Effect.Effect<string, FormattingError>

  /**
   * Write file and format it with the repository formatter
   * @param path - File path (also picks the language)
   * @param content - Content to write
   * @returns Effect that completes when write + format is successful
   */
  readonly writeFormatted: (
    path: string,
    content: string
  ) => Effect.Effect<void, FileWriteError | DirectoryCreateError | FormattingError>
}

/**
 * File System Service Tag (for dependency injection)
 */
export const FileSystemService = Context.Service<FileSystemService>('FileSystemService')

/**
 * Default retry policy: 3 attempts (initial + 2 retries) with exponential backoff.
 *
 * Effect 4 removed `Schedule.compose`, which v3 used to cap an exponential
 * schedule at N recurrences. v4 expresses the cap on `Effect.retry` itself via
 * `times`, so the policy is an options object rather than a composed Schedule.
 * Same behaviour: exponential backoff from 100ms, at most 2 retries.
 */
const defaultRetryPolicy = {
  schedule: Schedule.exponential('100 millis'),
  times: 2,
} as const

/**
 * Live File System Service Implementation
 */
export const FileSystemServiceLive = Layer.succeed(
  FileSystemService,
  FileSystemService.of({
    readFile: (path: string) =>
      Effect.tryPromise({
        try: () => readFile(path, 'utf-8'),
        catch: (error) => {
          if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
            return new FileNotFoundError({ path, cause: error })
          }
          return new FileReadError({ path, cause: error })
        },
      }).pipe(Effect.retry(defaultRetryPolicy)),

    writeFile: (path: string, content: string) =>
      Effect.gen(function* () {
        // Extract directory path and create if needed.
        //
        // The retry is on the WRITE alone, not on the whole generator. It used
        // to wrap both, so a transient write failure re-ran `mkdir` as well —
        // pointless when it succeeded (it is `recursive`, so a no-op) and
        // actively wrong when it did NOT: a genuinely unwritable directory was
        // retried three times with exponential backoff before reporting the
        // failure it had already established on the first attempt.
        const dir = path.split('/').slice(0, -1).join('/')
        if (dir) {
          yield* Effect.tryPromise({
            try: () => mkdir(dir, { recursive: true }),
            catch: (error) => new DirectoryCreateError({ path: dir, cause: error }),
          })
        }

        // Write file
        yield* Effect.tryPromise({
          try: () => writeFile(path, content, 'utf-8'),
          catch: (error) => new FileWriteError({ path, cause: error }),
        }).pipe(Effect.retry(defaultRetryPolicy))
      }),

    // `access` is the only thing that can reject and its rejection is caught
    // inside the thunk, which is the whole point: a missing path is the ANSWER
    // here, not an error. This was written as `Effect.tryPromise` with
    // `catch: () => false as never`, a cast that claimed the catch branch was
    // unreachable while supplying a value for it.
    // effect-promise: total -- `access` is the only rejection and the thunk catches it
    exists: (path: string) =>
      Effect.promise(async () => {
        try {
          await access(path)
          return true
        } catch {
          return false
        }
      }),

    mkdir: (path: string) =>
      Effect.tryPromise({
        try: () => mkdir(path, { recursive: true }),
        catch: (error) => new DirectoryCreateError({ path, cause: error }),
      }).pipe(Effect.retry(defaultRetryPolicy), Effect.asVoid),

    glob: (pattern: string) =>
      Effect.tryPromise({
        try: async () => {
          // `Bun.Glob` replaces the `glob` npm package (removed 2026-09-03).
          // Two behaviours the callers depend on are preserved deliberately:
          //   - a non-existent root yields `[]` rather than throwing, which
          //     `SpecMappingService.validateGlobRoots` relies on to make a
          //     dead glob root detectable at Layer construction instead of as
          //     a silent empty match (see the WHY comment there);
          //   - paths come back relative to the process cwd, as before.
          // `Bun.Glob` has NO `ignore` option, so `node_modules/**` is
          // filtered from the iterable instead of excluded during the walk.
          const matches: string[] = []
          for await (const path of new Bun.Glob(pattern).scan({ onlyFiles: true })) {
            if (!path.startsWith('node_modules/') && !path.includes('/node_modules/')) {
              matches.push(path)
            }
          }
          return matches
        },
        catch: (error) => new GlobError({ pattern, cause: error }),
      }).pipe(Effect.retry(defaultRetryPolicy)),

    format: (content: string, filepath: string = DEFAULT_FORMAT_PATH) =>
      Effect.try({
        try: () => formatText(content, filepath),
        catch: (error) => new FormattingError({ content: content.slice(0, 100), cause: error }),
      }),

    writeFormatted: (path: string, content: string) =>
      Effect.gen(function* () {
        const formatted = yield* Effect.try({
          try: () => formatText(content, path),
          catch: (error) => new FormattingError({ content: content.slice(0, 100), cause: error }),
        })

        // Extract directory path and create if needed
        const dir = path.split('/').slice(0, -1).join('/')
        if (dir) {
          yield* Effect.tryPromise({
            try: () => mkdir(dir, { recursive: true }),
            catch: (error) => new DirectoryCreateError({ path: dir, cause: error }),
          })
        }

        // Write formatted file. Retried on its own — re-running the formatter and
        // `mkdir` because a write failed buys nothing: formatting is
        // deterministic and `mkdir -p` is idempotent, so the only step whose
        // second attempt can differ is the write itself.
        yield* Effect.tryPromise({
          try: () => writeFile(path, formatted, 'utf-8'),
          catch: (error) => new FileWriteError({ path, cause: error }),
        }).pipe(Effect.retry(defaultRetryPolicy))
      }),
  })
)

/**
 * Helper functions for common operations
 */

/**
 * Read file with FileSystemService
 * @public
 */
export const readFile_ = (path: string) =>
  FileSystemService.pipe(Effect.flatMap((service) => service.readFile(path)))

/**
 * Write file with FileSystemService
 * @public
 */
export const writeFile_ = (path: string, content: string) =>
  FileSystemService.pipe(Effect.flatMap((service) => service.writeFile(path, content)))

/**
 * Check if path exists with FileSystemService
 * @public
 */
export const exists = (path: string) =>
  FileSystemService.pipe(Effect.flatMap((service) => service.exists(path)))

/**
 * Create directory with FileSystemService
 * @public
 */
export const mkdir_ = (path: string) =>
  FileSystemService.pipe(Effect.flatMap((service) => service.mkdir(path)))

/**
 * Glob files with FileSystemService
 * @public
 */
export const glob = (pattern: string) =>
  FileSystemService.pipe(Effect.flatMap((service) => service.glob(pattern)))

/**
 * Format content with FileSystemService
 * @public
 */
export const format = (content: string, filepath?: string) =>
  FileSystemService.pipe(Effect.flatMap((service) => service.format(content, filepath)))

/**
 * Write formatted file with FileSystemService
 * @public
 */
export const writeFormatted = (path: string, content: string) =>
  FileSystemService.pipe(Effect.flatMap((service) => service.writeFormatted(path, content)))
