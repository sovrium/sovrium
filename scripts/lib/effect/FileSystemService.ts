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
import { glob as globSync } from 'glob'
import { format as prettierFormat } from 'prettier'
import type { Options as PrettierOptions } from 'prettier'

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

export interface FileSystemService {
  readonly readFile: (path: string) => Effect.Effect<string, FileNotFoundError | FileReadError>

  readonly writeFile: (
    path: string,
    content: string
  ) => Effect.Effect<void, FileWriteError | DirectoryCreateError>

  readonly exists: (path: string) => Effect.Effect<boolean>

  readonly mkdir: (path: string) => Effect.Effect<void, DirectoryCreateError>

  readonly glob: (pattern: string) => Effect.Effect<readonly string[], GlobError>

  readonly format: (
    content: string,
    options?: PrettierOptions
  ) => Effect.Effect<string, FormattingError>

  readonly writeFormatted: (
    path: string,
    content: string,
    options?: PrettierOptions
  ) => Effect.Effect<void, FileWriteError | DirectoryCreateError | FormattingError>
}

export const FileSystemService = Context.GenericTag<FileSystemService>('FileSystemService')

const defaultRetrySchedule = Schedule.exponential('100 millis').pipe(
  Schedule.compose(Schedule.recurs(2))
)

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
      }).pipe(Effect.retry(defaultRetrySchedule)),

    writeFile: (path: string, content: string) =>
      Effect.gen(function* () {
        const dir = path.split('/').slice(0, -1).join('/')
        if (dir) {
          yield* Effect.tryPromise({
            try: () => mkdir(dir, { recursive: true }),
            catch: (error) => new DirectoryCreateError({ path: dir, cause: error }),
          })
        }

        yield* Effect.tryPromise({
          try: () => writeFile(path, content, 'utf-8'),
          catch: (error) => new FileWriteError({ path, cause: error }),
        })
      }).pipe(Effect.retry(defaultRetrySchedule)),

    exists: (path: string) =>
      Effect.tryPromise({
        try: async () => {
          try {
            await access(path)
            return true
          } catch {
            return false
          }
        },
        catch: () => false as never,
      }),

    mkdir: (path: string) =>
      Effect.tryPromise({
        try: () => mkdir(path, { recursive: true }),
        catch: (error) => new DirectoryCreateError({ path, cause: error }),
      }).pipe(Effect.retry(defaultRetrySchedule), Effect.asVoid),

    glob: (pattern: string) =>
      Effect.tryPromise({
        try: () => globSync(pattern, { ignore: 'node_modules/**' }),
        catch: (error) => new GlobError({ pattern, cause: error }),
      }).pipe(Effect.retry(defaultRetrySchedule)),

    format: (content: string, options?: PrettierOptions) =>
      Effect.tryPromise({
        try: async () => {
          const defaultOptions: PrettierOptions = {
            parser: 'typescript',
            ...options,
          }
          return await prettierFormat(content, defaultOptions)
        },
        catch: (error) => new FormattingError({ content: content.slice(0, 100), cause: error }),
      }),

    writeFormatted: (path: string, content: string, options?: PrettierOptions) =>
      Effect.gen(function* () {
        const formatted = yield* Effect.tryPromise({
          try: async () => {
            const defaultOptions: PrettierOptions = {
              parser: 'typescript',
              filepath: path,
              ...options,
            }
            return await prettierFormat(content, defaultOptions)
          },
          catch: (error) => new FormattingError({ content: content.slice(0, 100), cause: error }),
        })

        const dir = path.split('/').slice(0, -1).join('/')
        if (dir) {
          yield* Effect.tryPromise({
            try: () => mkdir(dir, { recursive: true }),
            catch: (error) => new DirectoryCreateError({ path: dir, cause: error }),
          })
        }

        yield* Effect.tryPromise({
          try: () => writeFile(path, formatted, 'utf-8'),
          catch: (error) => new FileWriteError({ path, cause: error }),
        })
      }).pipe(Effect.retry(defaultRetrySchedule)),
  })
)


export const readFile_ = (path: string) =>
  FileSystemService.pipe(Effect.flatMap((service) => service.readFile(path)))

export const writeFile_ = (path: string, content: string) =>
  FileSystemService.pipe(Effect.flatMap((service) => service.writeFile(path, content)))

export const exists = (path: string) =>
  FileSystemService.pipe(Effect.flatMap((service) => service.exists(path)))

export const mkdir_ = (path: string) =>
  FileSystemService.pipe(Effect.flatMap((service) => service.mkdir(path)))

export const glob = (pattern: string) =>
  FileSystemService.pipe(Effect.flatMap((service) => service.glob(pattern)))

export const format = (content: string, options?: PrettierOptions) =>
  FileSystemService.pipe(Effect.flatMap((service) => service.format(content, options)))

export const writeFormatted = (path: string, content: string, options?: PrettierOptions) =>
  FileSystemService.pipe(
    Effect.flatMap((service) => service.writeFormatted(path, content, options))
  )
