/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { dirname, join } from 'node:path'
import { Effect } from 'effect'
import { parseBooleanEnv, readPublicDirEnv } from './option-parsing'
import { lazyImportIndex, lazyImportCli, lazyImportLogger } from './utils'
import type { GenerateStaticOptions } from '@/application/use-cases/server/generate-static'
import type { StartupPhase } from '@/infrastructure/logging/logger'

const parseBuildOptions = (): GenerateStaticOptions => {
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

const buildBuildPhases = (summary: {
  readonly mode: 'development' | 'production'
  readonly languages: readonly string[]
  readonly fileCount: number
  readonly durationLabel: string
}): readonly StartupPhase[] => {
  const fileWord = summary.fileCount === 1 ? 'file' : 'files'
  return [
    { label: `Mode: ${summary.mode}`, type: 'success' as const },
    ...(summary.languages.length > 0
      ? [{ label: `Languages: ${summary.languages.join(', ')}`, type: 'success' as const }]
      : []),
    { label: 'CSS compiled', type: 'success' as const },
    {
      label: `Generated ${summary.fileCount} ${fileWord} in ${summary.durationLabel}`,
      type: 'success' as const,
    },
  ]
}

export const handleBuildCommand = async (filePath?: string, publicDir?: string): Promise<void> => {
  const { build } = await lazyImportIndex()
  const { parseAppSchema } = await lazyImportCli()
  const { renderBuildSummary, formatDuration, logError } = await lazyImportLogger()
  const { getSovriumVersion } = await import('@/infrastructure/utils/version')

  const app = await parseAppSchema('build', filePath)
  const envOptions = parseBuildOptions()
  const defaultOutputDir = filePath ? join(dirname(filePath), 'dist') : './dist'
  const options = {
    ...envOptions,
    outputDir: publicDir || envOptions.outputDir || defaultOutputDir,
  }

  const startedAt = Date.now()
  const result = await build(app, options).catch((error) => {
    logError('Failed to build static site', error)
    process.exit(1)
  })
  const durationMs = Date.now() - startedAt

  const version = await getSovriumVersion()
  const mode = process.env['NODE_ENV'] === 'production' ? 'production' : 'development'
  const languages = app.languages?.supported.map((lang) => lang.code) ?? []
  const phases = buildBuildPhases({
    mode,
    languages,
    fileCount: result.files.length,
    durationLabel: formatDuration(durationMs),
  })

  Effect.runSync(renderBuildSummary({ version, phases, outputDir: result.outputDir }))
}
