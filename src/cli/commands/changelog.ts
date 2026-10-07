/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium changelog [<version>] [--list] [--since <version>] [--format md|json] [--output <path>]`
 *
 * The release notes of this binary and of every release before it, printed
 * from the copy the binary embeds. The same promise `sovrium docs` makes for
 * the manual, extended to history: the notes printed are the ones published
 * with this binary, so a server with no network still answers "what changed?".
 *
 * ─── OFFLINE BY CONSTRUCTION ────────────────────────────────────────────────
 *
 * No config, no database, no network, no working directory. The notes are a
 * property of the binary, not of a project.
 *
 * ─── THE PAYLOAD IS LOADED INSIDE THE HANDLER ───────────────────────────────
 *
 * `@/infrastructure/assets/embedded-changelog` is reached through
 * `await import()` and named nowhere at module scope, so `sovrium start` never
 * pays for ~250 KB of release notes nobody asked for. The decisions — which
 * view, which releases, which refusal — live in `changelog-render.ts`.
 *
 * ─── REFUSALS, NOT FALLBACKS ────────────────────────────────────────────────
 *
 * An unknown `--format`, a version the binary does not carry, a word that is
 * not a version, and two views asked for at once each exit 1 with a message on
 * stderr and nothing on stdout. Guessing would hand a script the wrong notes
 * behind a green exit code.
 */

import { printStderr } from '@/infrastructure/logging/cli-output'
import { renderChangelogRequest } from './changelog-render'
import { resolveDocumentFormat, writeDocument } from './document-output'
import { getCurrentVersion } from './update'

/** Options as parsed from argv. */
export interface ChangelogCommandOptions {
  /** Positionals after `changelog` — at most one version. */
  readonly args: readonly string[]
  /** The RAW `--format` value, deliberately unvalidated by the parser. */
  readonly format?: string
  readonly outputPath?: string
  readonly list: boolean
  /** Whether `--since` appeared at all, so a bare `--since` is refused by name. */
  readonly sinceRequested: boolean
  readonly since?: string
}

/** Stop with a refusal on stderr and exit 1. */
const refuse = (message: string): never => {
  printStderr(message)
  process.exit(1)
}

/**
 * Handle the `changelog` command.
 *
 * @param options - The parsed positionals and flag values.
 */
export const handleChangelogCommand = async (options: ChangelogCommandOptions): Promise<void> => {
  // Resolved before the payload is loaded: a mistyped format is refused at once.
  const format = resolveDocumentFormat(options.format, ['json'], 'markdown.')
  const { embeddedReleases } = await import('@/infrastructure/assets/embedded-changelog')
  const outcome = renderChangelogRequest(await embeddedReleases(), {
    args: options.args,
    list: options.list,
    sinceRequested: options.sinceRequested,
    ...(options.since === undefined ? {} : { since: options.since }),
    format,
    running: await getCurrentVersion(),
  })
  if (outcome.kind === 'refused') return refuse(outcome.reason)
  await writeDocument(outcome.content, options.outputPath, 'Release notes')
}
