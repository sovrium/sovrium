/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `--format` and `--output` contract of the verbs that print ONE document:
 * `sovrium design-system`, `sovrium docs` and `sovrium changelog`.
 *
 * Each of them owned a private copy of both halves, byte-identical but for the
 * formats it accepts and the noun it names. The contract is the part a user
 * relies on across verbs — `md` is the default and `markdown` its alias, an
 * unknown format is refused BY NAME with the accepted set, and `--output` is
 * the ONE destination (never stdout as well) with its parent directories
 * created — so it lives once, and a fourth document verb inherits it rather
 * than re-deriving it.
 *
 * What stays per verb is what differs: the formats beyond markdown, the phrase
 * describing what omitting `--format` prints, and the noun the written-file
 * notice uses.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { Effect, Console } from 'effect'
import { printStderr } from '@/infrastructure/logging/cli-output'

/** The spellings every document verb accepts for markdown, its default. */
const MARKDOWN_FORMATS: ReadonlySet<string> = new Set(['md', 'markdown'])

/**
 * Normalise a RAW `--format`, refusing anything else by name and exiting 1.
 *
 * The accepted set is printed in the refusal because a caller who typed `yaml`
 * needs to learn what to type instead, not merely that they were wrong. A
 * silent fallback to markdown is the worse failure: a build step asking for
 * the wrong format exits 0, writes the wrong file, and nobody looks again.
 *
 * @param raw - The `--format` value as typed, or `undefined` when absent.
 * @param others - The formats this verb accepts besides markdown, in the order
 *   the refusal lists them.
 * @param omittedPrints - What the verb prints without `--format`, completing
 *   the sentence "Omitting --format prints …".
 */
export function resolveDocumentFormat<F extends string>(
  raw: string | undefined,
  others: readonly F[],
  omittedPrints: string
): 'md' | F {
  if (raw === undefined) return 'md'
  const normalized = raw.trim().toLowerCase()
  if (MARKDOWN_FORMATS.has(normalized)) return 'md'
  const other = others.find((format) => format === normalized)
  if (other !== undefined) return other

  printStderr(
    `Error: Unsupported --format "${raw}".\n\n` +
      `  Accepted values: ${['md (or markdown)', ...others].join(', ')}.\n\n` +
      `  Omitting --format prints ${omittedPrints}`
  )
  process.exit(1)
}

/**
 * The slice of a writable stream {@link writeStdout} needs. `process.stdout`
 * satisfies it; a unit test passes a fake, so the broken-pipe path is pinned
 * without a real pipe and without `mock.module()`.
 */
export interface StdoutSink {
  write(chunk: string, callback: (error?: Error | null) => void): unknown
  on(event: 'error', listener: (error: Error) => void): unknown
  off(event: 'error', listener: (error: Error) => void): unknown
}

/** True for the error a write raises once the pipe's reader has gone away. */
const isBrokenPipe = (error: Error): boolean => (error as NodeJS.ErrnoException).code === 'EPIPE'

/**
 * Write to stdout and resolve only once the stream has taken all of it.
 *
 * Every command that prints a document is an EXIT command: `src/cli/index.ts`
 * calls `process.exit(0)` as soon as the handler returns. A bare
 * `process.stdout.write` returns before a pipe has accepted the bytes, so the
 * exit cut a large document short — `sovrium changelog --list --format json |
 * jq` received the first 128 KiB and invalid JSON. A file or a terminal hid
 * it; only a pipe showed it. The write callback fires once the chunk is
 * handed to the operating system, which is the point where exiting is safe.
 *
 * A reader that closes early (`sovrium licenses | head`) is a NORMAL end, not a
 * failure: the write fails with `EPIPE`, and the verb resolves so the command
 * exits 0 with nothing on stderr — the convention every Unix filter follows.
 * This is the one deliberate swallow here, and it is narrow: only `EPIPE`, and
 * only on this stream. Its cause is still logged, at Debug so the default
 * level keeps the terminal quiet. Any other write error rejects, and an
 * `--output` file is written by `writeFile`, never through here, so a real
 * write failure stays loud.
 *
 * The `error` listener is what keeps the stream's own `error` event — emitted
 * after the callback — from becoming an uncaught exception and a stack trace.
 * After a broken pipe it stays attached: the stream is dead and the process is
 * about to exit, so a late duplicate of the same `EPIPE` must find a listener.
 */
export const writeStdout = (content: string, stream: StdoutSink = process.stdout): Promise<void> =>
  new Promise((resolve, reject) => {
    const settle = (error?: Error | null): void => {
      if (!error) {
        stream.off('error', settle)
        resolve()
        return
      }
      if (!isBrokenPipe(error)) {
        stream.off('error', settle)
        reject(error)
        return
      }
      Effect.runSync(
        Effect.logDebug('stdout reader closed early (EPIPE); treated as a normal end', error)
      )
      resolve()
    }
    stream.on('error', settle)
    stream.write(content, settle)
  })

/**
 * Send a rendered document to its single destination.
 *
 * ONE destination per run: with `--output` the document does NOT also go to
 * stdout, so a shell redirect cannot silently duplicate it into two places.
 * Parent directories are created, matching `sovrium schema --output`.
 *
 * @param content - The document, already rendered.
 * @param outputPath - The `--output` path, or `undefined` for stdout.
 * @param noun - What the notice says was written: "Manual", "Release notes".
 */
export const writeDocument = async (
  content: string,
  outputPath: string | undefined,
  noun: string
): Promise<void> => {
  if (outputPath === undefined) return writeStdout(content)
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, content)
  Effect.runSync(Console.log(`${noun} written to ${outputPath}.`))
}
