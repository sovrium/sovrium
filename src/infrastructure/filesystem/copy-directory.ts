/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { Effect, Data } from 'effect'

/**
 * File copy error - infrastructure layer error
 */
export class FileCopyError extends Data.TaggedError('FileCopyError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

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
): Effect.Effect<readonly string[], FileCopyError, never> =>
  // eslint-disable-next-line max-lines-per-function -- Complex recursive directory copy with error handling
  Effect.gen(function* () {
    const copiedFiles: string[] = []

    // Recursive copy function
    const copyRecursive = (sourcePath: string, destPath: string): Effect.Effect<void, FileCopyError, never> =>
      Effect.gen(function* () {
        // Get entries in directory
        const entries = yield* Effect.tryPromise({
          try: () => readdir(sourcePath, { withFileTypes: true }),
          catch: (error) =>
            new FileCopyError({
              message: `Failed to read directory ${sourcePath}`,
              cause: error,
            }),
        })

        // Process each entry
        // eslint-disable-next-line functional/no-loop-statements -- Imperative iteration required for sequential file I/O
        for (const entry of entries) {
          const sourceEntryPath = join(sourcePath, entry.name)
          const destEntryPath = join(destPath, entry.name)

          if (entry.isDirectory()) {
            // Create directory at destination
            yield* Effect.tryPromise({
              try: () => mkdir(destEntryPath, { recursive: true }),
              catch: (error) =>
                new FileCopyError({
                  message: `Failed to create directory ${destEntryPath}`,
                  cause: error,
                }),
            })

            // Recursively copy directory contents
            yield* copyRecursive(sourceEntryPath, destEntryPath)
          } else if (entry.isFile()) {
            // Read file as binary (Buffer) to preserve binary content exactly
            const content = yield* Effect.tryPromise({
              try: () => readFile(sourceEntryPath),
              catch: (error) =>
                new FileCopyError({
                  message: `Failed to read file ${sourceEntryPath}`,
                  cause: error,
                }),
            })

            // Write file as binary (Buffer) to preserve binary content exactly
            yield* Effect.tryPromise({
              try: () => writeFile(destEntryPath, content),
              catch: (error) =>
                new FileCopyError({
                  message: `Failed to write file ${destEntryPath}`,
                  cause: error,
                }),
            })

            // Track copied file (relative to destination)
            const relativePath = relative(destination, destEntryPath)
            // eslint-disable-next-line functional/immutable-data -- Building array during copy operation
            copiedFiles.push(relativePath)
          }
        }
      })

    // Start recursive copy
    yield* copyRecursive(source, destination)

    return copiedFiles as readonly string[]
  })
