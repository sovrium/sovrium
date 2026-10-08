/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium bundle [config] [--output <file>]`
 *
 * One gzipped tar a host deploys: the config read and validated exactly as
 * `sovrium validate` does, written RESOLVED as `project/app.json` (every `$ref`
 * inlined, a TypeScript config evaluated, `$env` references kept as
 * references), the static files as `public/` and the seed files as `seed/` —
 * each listed in `manifest.json` with its sha256. The `.env` file and the
 * config sources never travel.
 *
 * This file reads the config and the environment and prints the result; the
 * order of the work and every refusal after validation live in the
 * `createBundle` use-case.
 */

import { resolve } from 'node:path'
import { Effect, Console } from 'effect'
import { createBundle } from '@/application/use-cases/server/bundle-programs'
import { BackupWorkspaceLive } from '@/infrastructure/filesystem/backup-workspace-live'
import {
  formatBytes,
  inflect,
  printFailure,
  printStderr,
} from '@/infrastructure/logging/cli-output'
import { discoverConfigFile } from './app-prelude'
import { isPublicDirOptOut, readPublicDirEnv, resolveDefaultPublicDir } from './option-parsing'
import { getCurrentVersion } from './update'
import { loadConfigForValidationWithSources, validateParsedConfig } from './validate'
import type { BundleSummary } from '@/application/use-cases/server/bundle-programs'

/** Everything `sovrium bundle` reads from the command line. */
export interface BundleCommandOptions {
  readonly configFile: string | undefined
  readonly outputPath: string | undefined
}

const fail = (headline: string, guidance: string, detail?: readonly string[]): never => {
  printFailure({ headline, guidance, ...(detail === undefined ? {} : { detail }) })
  process.exit(1)
  return undefined as never
}

/**
 * The static files to carry, as `sovrium start` would serve them:
 * `SOVRIUM_PUBLIC_DIR` when set, `none` for no static files at all, otherwise
 * `public/` beside the config.
 */
const resolvePublicDirectory = (configPath: string): string | undefined => {
  const fromEnv = readPublicDirEnv()
  if (isPublicDirOptOut(fromEnv)) return undefined
  return fromEnv === undefined || fromEnv === ''
    ? resolveDefaultPublicDir(configPath)
    : resolve(fromEnv)
}

/** What a caller of {@link buildValidatedBundle} asks for. */
export interface BuildBundleRequest {
  readonly configFile: string | undefined
  /** Absolute or relative archive path; `undefined` names a dated file here. */
  readonly outputPath: string | undefined
  /** The verb that is building, for the refusal's "run it again" line. */
  readonly command: string
  /** What did not happen when the build is refused, e.g. `nothing was written`. */
  readonly outcome: string
}

/**
 * Validate the config exactly as `sovrium validate` does and write the
 * archive. Every refusal prints and exits 1; returns only on success. Shared
 * with `sovrium deploy`, which bundles into a temporary file before uploading.
 */
export const buildValidatedBundle = async (request: BuildBundleRequest): Promise<BundleSummary> => {
  const configPath = resolve(request.configFile ?? (await discoverConfigFile()))
  const { parsed, refSources } = await loadConfigForValidationWithSources(configPath)
  const outcome = await validateParsedConfig(parsed, refSources, configPath)
  if (!outcome.valid) {
    // The report `sovrium validate` prints for the same config, word for word.
    printStderr(`Error: Validation failed.\n\n${outcome.report.join('\n')}`)
    return fail(
      `The config does not validate — ${request.outcome}.`,
      `Fix the problems above, then run 'sovrium ${request.command}' again.`
    )
  }

  const result = await Effect.runPromise(
    createBundle({
      configPath,
      document: parsed as Readonly<Record<string, unknown>>,
      outputPath: request.outputPath === undefined ? undefined : resolve(request.outputPath),
      workingDirectory: process.cwd(),
      publicDirectory: resolvePublicDirectory(configPath),
      engineVersion: await getCurrentVersion(),
      now: new Date(),
    }).pipe(Effect.provide(BackupWorkspaceLive), Effect.result)
  )

  if (result._tag === 'Failure') {
    const { failure } = result
    return failure._tag === 'BundleRefusal'
      ? fail(`${failure.reason} — ${request.outcome}.`, failure.guidance)
      : fail(
          `Sovrium could not ${failure.action} — ${request.outcome}.`,
          'Check that the path exists and is readable, then run the command again.',
          [failure.cause instanceof Error ? failure.cause.message : String(failure.cause)]
        )
  }
  return result.success
}

/** Handle `sovrium bundle`. Exits 1 on any refusal; returns on success. */
export const handleBundleCommand = async (options: BundleCommandOptions): Promise<void> => {
  const { archivePath, archiveBytes, manifest } = await buildValidatedBundle({
    configFile: options.configFile,
    outputPath: options.outputPath,
    command: 'bundle',
    outcome: 'nothing was written',
  })
  Effect.runSync(
    Console.log(
      `Bundle written to ${archivePath} (${inflect(manifest.entries.length, 'file')}, ${formatBytes(archiveBytes)}).`
    )
  )
}
