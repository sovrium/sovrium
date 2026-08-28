/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { Effect } from 'effect'
import { formatConfigRejection, isConfigRejectedError } from '@/domain/errors/config-rejected'
import { formatPathForDisplay } from '@/infrastructure/logging/format-path'
import {
  isPublicDirOptOut,
  parseBooleanEnv,
  readPublicDirEnv,
  resolveDefaultPublicDir,
} from './option-parsing'
import { lazyImportIndex, lazyImportCli, lazyImportLogger, lazyImportStartupSummary } from './utils'
import type { GenerateStaticOptions } from '@/application/use-cases/server/generate-static'
import type { StartupPhase } from '@/infrastructure/logging/startup-summary'

/**
 * Parse build options from environment variables
 */
const parseBuildOptions = (): GenerateStaticOptions => {
  // Parse environment variables
  const envVars = {
    outputDir: Bun.env.SOVRIUM_OUTPUT_DIR,
    baseUrl: Bun.env.SOVRIUM_BASE_URL,
    basePath: Bun.env.SOVRIUM_BASE_PATH,
    deployment: Bun.env.SOVRIUM_DEPLOYMENT as 'github-pages' | 'generic' | undefined,
    languages: Bun.env.SOVRIUM_LANGUAGES?.split(',').map((lang) => lang.trim()),
    defaultLanguage: Bun.env.SOVRIUM_DEFAULT_LANGUAGE,
    generateSitemap: parseBooleanEnv(Bun.env.SOVRIUM_GENERATE_SITEMAP),
    generateRobotsTxt: parseBooleanEnv(Bun.env.SOVRIUM_GENERATE_ROBOTS),
    hydration: parseBooleanEnv(Bun.env.SOVRIUM_HYDRATION),
    generateManifest: parseBooleanEnv(Bun.env.SOVRIUM_GENERATE_MANIFEST),
    bundleOptimization: Bun.env.SOVRIUM_BUNDLE_OPTIMIZATION as 'split' | 'none' | undefined,
    publicDir: readPublicDirEnv(),
  }

  // Build options object with only defined values
  const options = [
    { key: 'outputDir', value: envVars.outputDir },
    { key: 'baseUrl', value: envVars.baseUrl },
    { key: 'basePath', value: envVars.basePath },
    { key: 'deployment', value: envVars.deployment },
    { key: 'languages', value: envVars.languages },
    { key: 'defaultLanguage', value: envVars.defaultLanguage },
    { key: 'generateSitemap', value: envVars.generateSitemap },
    { key: 'generateRobotsTxt', value: envVars.generateRobotsTxt },
    { key: 'hydration', value: envVars.hydration },
    { key: 'generateManifest', value: envVars.generateManifest },
    { key: 'bundleOptimization', value: envVars.bundleOptimization },
    { key: 'publicDir', value: envVars.publicDir },
  ].reduce(
    (acc, { key, value }) =>
      value !== undefined && value !== false ? { ...acc, [key]: value } : acc,
    {} as GenerateStaticOptions
  )

  return options
}

/**
 * Assemble the `✓` success phases shown in the build banner.
 *
 * Mirrors `buildStartupPhases` for `sovrium start` (see
 * `startup-degradation-phases.ts`): a pure function of the resolved build
 * inputs, kept separate from the I/O so it stays trivially testable and so the
 * two banners can evolve in lockstep.
 */
const buildBuildPhases = (summary: {
  readonly mode: 'development' | 'production'
  readonly languages: readonly string[]
  readonly publicDirLabel?: string
  readonly fileCount: number
  readonly durationLabel: string
}): readonly StartupPhase[] => {
  const fileWord = summary.fileCount === 1 ? 'file' : 'files'
  return [
    { label: `Mode: ${summary.mode}`, type: 'success' as const },
    // Single-language sites have no `app.languages` block (empty array) — omit
    // the line entirely rather than printing a hollow "Languages:" default.
    ...(summary.languages.length > 0
      ? [{ label: `Languages: ${summary.languages.join(', ')}`, type: 'success' as const }]
      : []),
    ...(summary.publicDirLabel
      ? [
          {
            label: `Public directory: ${summary.publicDirLabel}`,
            type: 'success' as const,
          },
        ]
      : []),
    { label: 'CSS compiled', type: 'success' as const },
    {
      label: `Generated ${summary.fileCount} ${fileWord} in ${summary.durationLabel}`,
      type: 'success' as const,
    },
  ]
}

/**
 * Resolve the static-assets source directory for `sovrium build` using the
 * same fallback chain as `sovrium start`: opt-out (env `none` or
 * `--no-publicDir`) wins; otherwise `SOVRIUM_PUBLIC_DIR`; otherwise the
 * anchored `./public` next to the config file. Extracted so the dispatcher
 * stays under the complexity / statement caps.
 */
const resolveBuildPublicDir = (
  filePath: string | undefined,
  publicDirFlag: string | false | undefined,
  envPublicDir: string | undefined
): string | undefined => {
  const explicitOptOut = publicDirFlag === false || isPublicDirOptOut(envPublicDir)
  if (explicitOptOut) return undefined
  return envPublicDir ?? resolveDefaultPublicDir(filePath)
}

/**
 * Format the `Public directory: <path>` line for the build banner, but ONLY
 * when the resolved dir is a real directory on disk — mirrors
 * `collectPublicDirPhases` in server mode so both banners stay silent on the
 * silent-skip path.
 */
const buildPublicDirLabel = async (
  resolvedPublicDir: string | undefined
): Promise<string | undefined> => {
  if (!resolvedPublicDir) return undefined
  return stat(resolvedPublicDir)
    .then((s) => (s.isDirectory() ? formatPathForDisplay(resolvedPublicDir) : undefined))
    .catch(() => undefined)
}

/**
 * Handle the 'build' command.
 *
 * NOTE: the second arg is named `publicDir` because dispatch threads
 * `parsed.publicDir` here, but the build pipeline historically treats it as an
 * `outputDir` override (the build command never had an output-dir flag of its
 * own). The opt-out tri-state `string | false` shows up here too because the
 * dispatcher returns `false` for `--no-publicDir`; for build, `false` simply
 * means "no flag override" — `outputDir` falls back to the env / default.
 */
export const handleBuildCommand = async (
  filePath?: string,
  publicDir?: string | false
): Promise<void> => {
  const { build } = await lazyImportIndex()
  const { resolveAppSchema } = await lazyImportCli()
  const { logError } = await lazyImportLogger()
  const { renderBuildSummary, formatDuration } = await lazyImportStartupSummary()
  const { getSovriumVersion } = await import('@/infrastructure/utils/version')

  // `configFile`, not the `filePath` parameter — they differ only under
  // auto-discovery, where the operator named no file but one sits in the
  // working directory. `start` anchors the same way and for the same reason:
  // a discovered config must resolve `public/` and `dist/` exactly as a named
  // one does, or `sovrium build` beside an `app.yaml` silently ships no assets.
  const { app, configFile } = await resolveAppSchema('build', filePath)
  const envOptions = parseBuildOptions()
  const defaultOutputDir = configFile ? join(dirname(configFile), 'dist') : './dist'
  // `publicDir === false` is the `--no-publicDir` opt-out from dispatch. For
  // build, that flag does NOT drive the legacy outputDir override (it would be
  // a footgun); fall back to env / default like an unset flag.
  const outputOverride = publicDir === false ? undefined : publicDir
  const resolvedPublicDir = resolveBuildPublicDir(configFile, publicDir, envOptions.publicDir)
  const options = {
    ...envOptions,
    outputDir: outputOverride || envOptions.outputDir || defaultOutputDir,
    ...(resolvedPublicDir && { publicDir: resolvedPublicDir }),
  }

  // Build the static site, timing it for the "Generated N files in Xs" phase.
  const startedAt = Date.now()
  const result = await build(app, options).catch((error) => {
    // Same split as `sovrium start`: a refused config prints as prose, because
    // it is the author's mistake to read rather than a Sovrium fault to trace.
    // Routing it through `logError` would also forward the author's typo to
    // error tracking as if the engine had crashed.
    if (isConfigRejectedError(error)) {
      console.error(formatConfigRejection(error, 'built'))
    } else {
      logError('Failed to build static site', error)
    }
    // Terminate process - imperative statement required for CLI
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  })
  const durationMs = Date.now() - startedAt

  // Render the completion banner with the same format as `sovrium start`.
  const version = await getSovriumVersion()
  const mode = process.env['NODE_ENV'] === 'production' ? 'production' : 'development'
  const languages = app.languages?.supported.map((lang) => lang.code) ?? []
  const publicDirLabel = await buildPublicDirLabel(resolvedPublicDir)
  const phases = buildBuildPhases({
    mode,
    languages,
    ...(publicDirLabel !== undefined && { publicDirLabel }),
    fileCount: result.files.length,
    durationLabel: formatDuration(durationMs),
  })

  Effect.runSync(renderBuildSummary({ version, phases, outputDir: result.outputDir }))
}
