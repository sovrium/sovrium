/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { readFile, writeFile, rm } from 'node:fs/promises'
import { Effect, Console } from 'effect'
import { printFailure, printStderr } from '@/infrastructure/logging/cli-output'
import { formatRuntimeError } from '@/infrastructure/logging/format-runtime-error'
import {
  computeConfigHash,
  getReloadMessageFilePath,
  isProcessRunning,
  readLockFile,
  writeLockFile,
} from '@/infrastructure/server/lock-file'
import { lazyImportSchema } from './utils'

/**
 * Parsed `sovrium reload` invocation. One scalar flag:
 *   --message "..."   commit message attached to the new version row
 */
interface ReloadOptions {
  readonly message: string | undefined
}

const parseReloadArgs = (argv: readonly string[]): ReloadOptions => {
  const messageIndex = argv.indexOf('--message')
  const message =
    messageIndex >= 0 && argv.length > messageIndex + 1 ? argv[messageIndex + 1] : undefined
  return { message }
}

/**
 * Read the config file and resolve its `$ref`s, without throwing.
 *
 * Split out so the decode below can report a REFUSAL distinctly from a file
 * that could not be read or parsed at all — folding both into one `catch` is
 * what let the old gate print a raw `ParseError` stack for a config Sovrium
 * simply declined.
 */
const readAndParseConfig = async (
  configPath: string
): Promise<
  | { readonly ok: true; readonly parsed: unknown; readonly content: string }
  | { readonly ok: false; readonly error: unknown }
> => {
  try {
    const content = await readFile(configPath, 'utf-8')
    const { loadSchemaFromFile } = await lazyImportSchema()
    const parsed = await loadSchemaFromFile(configPath)
    return { ok: true, parsed, content }
  } catch (error) {
    return { ok: false, error }
  }
}

/**
 * Handle the 'reload' command -- send SIGUSR1 to running server to reload config
 */
export const handleReloadCommand = async (argv: readonly string[] = []): Promise<void> => {
  const options = parseReloadArgs(argv)
  const lockData = await readLockFile()
  if (!lockData) {
    printStderr('Error: No server is running (lock file not found)')
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }

  if (!isProcessRunning(lockData.pid)) {
    printStderr('Error: Server is not running')
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }

  // Read and validate the config file before sending the reload signal.
  //
  // THE SAME PIPELINE `validate`, `start` AND `build` RUN. This gate used to
  // call `Schema.decodeUnknownSync(AppSchema)` directly, which made it a fourth
  // contract disagreeing with the other three: it decoded with Effect's default
  // excess-property behaviour, so it accepted — silently stripped — a property
  // AppSchema does not declare and that `start` now refuses outright. An
  // operator reads this gate as "is my config good?", so it has to give the
  // answer the rest of the CLI gives.
  if (lockData.configPath) {
    const parseResult = await readAndParseConfig(lockData.configPath)
    if (!parseResult.ok) {
      // `start` and `build` both refuse through formatConfigRejection; reload
      // hand-rolled a second shape with a spaced hyphen and no next action.
      // Three commands, one refusal contract.

      printFailure({
        headline: 'Sovrium refused this configuration — nothing was reloaded.',
        detail: [formatRuntimeError(parseResult.error)],
        guidance:
          'Run `sovrium validate <config>` to check it without touching the running server.',
      })
      // eslint-disable-next-line functional/no-expression-statements
      process.exit(1)
    }

    const { decodeAppConfigObject } =
      await import('@/application/use-cases/config/decode-app-config')
    const decoded = decodeAppConfigObject(parseResult.parsed)
    if (!decoded.valid) {
      printFailure({
        headline: 'Sovrium refused this configuration — nothing was reloaded.',
        detail: decoded.errors,
        guidance:
          'Run `sovrium validate <config>` to check it without touching the running server.',
      })
      // eslint-disable-next-line functional/no-expression-statements
      process.exit(1)
    }

    // Update lock file with new config hash
    const newHash = computeConfigHash(parseResult.content)
    await writeLockFile({ ...lockData, configHash: newHash })
  }

  // Stage the reload-time commit message via a sidecar file (signals carry
  // no data). The server's SIGUSR1 handler reads-and-deletes it before
  // appending the new version row. Missing sidecar ⇒ server uses its
  // default fallback ("Reloaded from app.yaml").
  if (options.message !== undefined && options.message.length > 0) {
    try {
      await writeFile(getReloadMessageFilePath(), options.message, 'utf-8')
    } catch {
      // Non-fatal — the reload still happens, just without the message.
    }
  } else {
    // Clear any stale sidecar from a prior reload that crashed mid-handler.
    try {
      await rm(getReloadMessageFilePath(), { force: true })
    } catch {
      // Ignore.
    }
  }

  // Send SIGUSR1 to trigger config reload in running server
  try {
    // eslint-disable-next-line functional/no-expression-statements
    process.kill(lockData.pid, 'SIGUSR1')
  } catch {
    printStderr('Error: Failed to send reload signal')
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }

  Effect.runSync(Console.log('Configuration reloaded'))
}
