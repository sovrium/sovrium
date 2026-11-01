/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Effect, Layer } from 'effect'
import {
  StaticOutputError,
  StaticOutputWriter,
} from '@/application/ports/services/static-output-writer'

/** One filesystem promise, its rejection carried untouched as the cause. */
const attempt = <A>(run: () => Promise<A>): Effect.Effect<A, StaticOutputError> =>
  Effect.tryPromise({ try: run, catch: (cause) => new StaticOutputError({ cause }) })

/** A filesystem check whose rejection IS its `false` answer. */
const check = (run: () => Promise<boolean>): Effect.Effect<boolean> =>
  // effect-promise: total -- the rejection handler turns every failure into `false`, so the promise never rejects.
  Effect.promise(() => run().catch(() => false))

/**
 * The `StaticOutputWriter` port, as `node:fs/promises`: each method is the
 * call the build and the boot made themselves before the port existed.
 */
export const StaticOutputWriterLive = Layer.succeed(StaticOutputWriter, {
  makeDirectory: (target) =>
    attempt(() => fs.mkdir(target, { recursive: true })).pipe(Effect.asVoid),
  writeFile: (target, contents) => attempt(() => fs.writeFile(target, contents, 'utf-8')),
  writeFileAtomically: (target, contents) =>
    attempt(async () => {
      const temporary = `${target}.${process.pid}.tmp`
      await fs.writeFile(temporary, contents, 'utf-8')
      return fs.rename(temporary, target)
    }),
  readFile: (target) => attempt(() => fs.readFile(target, 'utf-8')),
  exists: (target) => check(() => fs.access(target).then(() => true)),
  isDirectory: (target) => check(() => fs.stat(target).then((stats) => stats.isDirectory())),
  readDirectory: (target) => attempt(() => fs.readdir(target)),
  remove: (target) => attempt(() => fs.rm(target, { recursive: true, force: true })),
  // `sovrium-` first, so the runner sweeps that find leftovers by `sovrium-*` find these.
  makeTemporaryDirectory: (name) =>
    attempt(() => fs.mkdtemp(path.join(os.tmpdir(), `sovrium-${name}-`))),
})
