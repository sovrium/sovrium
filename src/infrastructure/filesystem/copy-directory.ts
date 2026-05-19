/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { readdir, mkdir } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { Effect, Data } from 'effect'
import type { Dirent } from 'node:fs'

export class FileCopyError extends Data.TaggedError('FileCopyError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

const copyFile = (
  sourcePath: string,
  destPath: string
): Effect.Effect<string, FileCopyError, never> =>
  Effect.gen(function* () {
    const content = yield* Effect.tryPromise({
      try: () => Bun.file(sourcePath).arrayBuffer(),
      catch: (error) =>
        new FileCopyError({
          message: `Failed to read file ${sourcePath}`,
          cause: error,
        }),
    })

    yield* Effect.tryPromise({
      try: () => Bun.write(destPath, content),
      catch: (error) =>
        new FileCopyError({
          message: `Failed to write file ${destPath}`,
          cause: error,
        }),
    })

    return destPath
  })

const createDirectory = (destPath: string): Effect.Effect<void, FileCopyError, never> =>
  Effect.tryPromise({
    try: () => mkdir(destPath, { recursive: true }),
    catch: (error) =>
      new FileCopyError({
        message: `Failed to create directory ${destPath}`,
        cause: error,
      }),
  })

const readDirectoryEntries = (
  sourcePath: string
): Effect.Effect<readonly Dirent[], FileCopyError, never> =>
  Effect.tryPromise({
    try: () => readdir(sourcePath, { withFileTypes: true }),
    catch: (error) =>
      new FileCopyError({
        message: `Failed to read directory ${sourcePath}`,
        cause: error,
      }),
  })

export const copyDirectory = (
  source: string,
  destination: string
): Effect.Effect<readonly string[], FileCopyError, never> => {
  const copyRecursive = (
    sourcePath: string,
    destPath: string
  ): Effect.Effect<readonly string[], FileCopyError, never> =>
    Effect.gen(function* () {
      const entries = yield* readDirectoryEntries(sourcePath)

      const copiedFiles = yield* Effect.forEach(
        entries,
        (entry) =>
          Effect.gen(function* () {
            const sourceEntryPath = join(sourcePath, entry.name)
            const destEntryPath = join(destPath, entry.name)

            if (entry.isDirectory()) {
              yield* createDirectory(destEntryPath)
              return yield* copyRecursive(sourceEntryPath, destEntryPath)
            }

            if (entry.isFile()) {
              yield* copyFile(sourceEntryPath, destEntryPath)
              const relativePath = relative(destination, destEntryPath)
              return [relativePath] as readonly string[]
            }

            return [] as readonly string[]
          }),
        { concurrency: 'unbounded' }
      )

      return copiedFiles.flat() as readonly string[]
    })

  return copyRecursive(source, destination)
}
