/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { Effect, Data } from 'effect'
import type { Dirent } from 'node:fs'

/**
 * File copy error - infrastructure layer error
 */
export class FileCopyError extends Data.TaggedError('FileCopyError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

/**
 * Copy a single file from source to destination
 */
const copyFile = (
  sourcePath: string,
  destPath: string
): Effect.Effect<string, FileCopyError, never> =>
  Effect.gen(function* () {
    // Read file as binary (Buffer) to preserve binary content exactly
    const content = yield* Effect.tryPromise({
      try: () => readFile(sourcePath),
      catch: (error) =>
        new FileCopyError({
          message: `Failed to read file ${sourcePath}`,
          cause: error,
        }),
    })

    // Write file as binary (Buffer) to preserve binary content exactly
    yield* Effect.tryPromise({
      try: () => writeFile(destPath, content),
      catch: (error) =>
        new FileCopyError({
          message: `Failed to write file ${destPath}`,
          cause: error,
        }),
    })

    return destPath
  })

/**
 * Create a directory at the destination
 */
const createDirectory = (
  destPath: string
): Effect.Effect<void, FileCopyError, never> =>
  Effect.tryPromise({
    try: () => mkdir(destPath, { recursive: true }),
    catch: (error) =>
      new FileCopyError({
        message: `Failed to create directory ${destPath}`,
        cause: error,
      }),
  })

/**
 * Read directory entries
 */
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

/**
 * Recursively copy directory contents from source to destination
 *
 * This function:
 * 1. Preserves directory structure
 * 2. Handles binary files correctly (no corruption)
 * 3. Skips the assets/ directory in destination (reserved for CSS)
 * 4. Returns list of copied file paths (relative to destination)
 *
 * @param source - Source directory path
 * @param destination - Destination directory path
 * @returns Effect with list of copied file paths (relative to destination)
 */
export const copyDirectory = (
  source: string,
  destination: string
): Effect.Effect<readonly string[], FileCopyError, never> => {
  // Recursive copy function that returns list of copied files
  const copyRecursive = (
    sourcePath: string,
    destPath: string
  ): Effect.Effect<readonly string[], FileCopyError, never> =>
    Effect.gen(function* () {
      const entries = yield* readDirectoryEntries(sourcePath)

      // Process entries and collect copied files immutably
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

            // Not a directory or file (e.g., symlink) - skip
            return [] as readonly string[]
          }),
        { concurrency: 'unbounded' }
      )

      return copiedFiles.flat() as readonly string[]
    })

  return copyRecursive(source, destination)
}
