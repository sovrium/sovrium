/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { getFlagPathValue, getFlagValue } from '@/cli/runtime/flag-vocabulary'
import { isRecord, type Raw } from '@/domain/kernel/config-parsing/plain-object'
import { printStderr } from '@/infrastructure/logging/cli-output'
import { writeStdout } from './document-output'
import type { AssetStoreShape } from '@/application/ports/services/asset-store'
import type { PreviewFormat } from '@/application/use-cases/automations/template-preview'
import type { App } from '@/domain/models/app'

/**
 * `sovrium render <asset> [--data <file>] [--out <file>] [--email] [--locale
 * <code>] [--config <file>]` — render one template asset the way an
 * automation would, with a data file or the asset's `sampleData`, and print it
 * or write it.
 *
 * Offline by construction: it reads the config and its assets, then renders —
 * no server, no port, no database, no automation. The output follows `--out`'s
 * extension; without `--out` a text template prints to stdout and a Word or
 * Excel template is refused, naming the flag.
 */

const FORMAT_BY_EXTENSION: Readonly<Record<string, PreviewFormat>> = {
  html: 'html',
  htm: 'html',
  svg: 'svg',
  txt: 'text',
  pdf: 'pdf',
  png: 'png',
  jpg: 'jpeg',
  jpeg: 'jpeg',
  webp: 'webp',
  docx: 'docx',
  xlsx: 'xlsx',
}

const fail = (message: string): never => {
  printStderr(`Error: ${message}`)
  process.exit(1)
}

/** Parse a data file's text as YAML (by its extension) or JSON. */
const parseData = (text: string, path: string): Raw => {
  try {
    const value: unknown = /\.ya?ml$/i.test(path) ? Bun.YAML.parse(text) : JSON.parse(text)
    return isRecord(value) ? value : fail(`${path} does not hold an object of values`)
  } catch (error) {
    return fail(
      `${path} is not valid ${/\.ya?ml$/i.test(path) ? 'YAML' : 'JSON'}: ${String(error)}`
    )
  }
}

/** The values to render with: `--data`, else the asset's `sampleData`, else none (said on stderr). */
const valuesFor = async (
  app: App,
  assetPath: string,
  dataPath: string | undefined,
  store: AssetStoreShape
): Promise<Raw> => {
  if (dataPath !== undefined) {
    const text = await readFile(dataPath, 'utf8').catch(() =>
      fail(`cannot read --data ${dataPath}`)
    )
    return parseData(text, dataPath)
  }
  const sample = (app.assets ?? []).find((entry) => entry.path === assetPath)?.sampleData
  if (isRecord(sample)) return sample
  if (typeof sample === 'string') {
    const asset = store.get(sample)
    if (asset !== undefined) return parseData(new TextDecoder().decode(asset.bytes), sample)
  }
  printStderr(`No --data and no sampleData for ${assetPath}: rendering with empty values.`)
  return {}
}

/** The format `--out` asks for, by its extension. */
const formatOf = (out: string | undefined): PreviewFormat | undefined => {
  if (out === undefined) return undefined
  const extension = /\.([^./\\]+)$/.exec(out)?.[1]?.toLowerCase() ?? ''
  const format = FORMAT_BY_EXTENSION[extension]
  return format ?? fail(`--out ${out}: .${extension} is not a format render writes`)
}

/** The decoded app and its loaded assets, or an exit naming what is wrong. */
const loadProject = async (configFile: string) => {
  const { loadConfigForValidationWithSources } = await import('./validate')
  const { decodeAppConfigObject } = await import('@/application/use-cases/config/decode-app-config')
  const { assetProjectDir, loadPrivateAssets } =
    await import('@/infrastructure/assets/private-assets')
  const { parsed, refSources } = await loadConfigForValidationWithSources(configFile)
  const decoded = decodeAppConfigObject(parsed, { refSources, configFile })
  if (!decoded.valid) return fail(`Validation failed.\n\n${decoded.report.join('\n')}`)
  const assets = await loadPrivateAssets(decoded.app.assets, assetProjectDir(configFile))
  if (!assets.ok) return fail(`the assets could not be loaded:\n  ${assets.issues.join('\n  ')}`)
  return { app: decoded.app, store: assets.store }
}

/**
 * The config of the project render runs in: the one discovery finds (an
 * `app.yaml`, `app.yml` or `app.ts`), else an `app.json` beside them.
 */
const discoverConfig = async (): Promise<string> => {
  const { discoverDefaultConfigFile } = await import('@/infrastructure/config/config-discovery')
  const discovered = await discoverDefaultConfigFile(process.cwd())
  if (discovered !== undefined) return discovered
  const json = resolve(process.cwd(), 'app.json')
  return (await Bun.file(json).exists())
    ? json
    : fail('no config file here (app.yaml, app.yml, app.ts or app.json); pass --config <file>')
}

/** The first positional after the verb: the asset path. */
const assetPathOf = (argv: readonly string[]): string | undefined => {
  const values = new Set(
    ['--data', '--out', '--locale', '--config'].flatMap((flag) => {
      const index = argv.indexOf(flag)
      return index < 0 ? [] : [index + 1]
    })
  )
  return argv.find((arg, index) => index > 0 && !arg.startsWith('-') && !values.has(index))
}

export const handleRenderCommand = async (argv: readonly string[]): Promise<void> => {
  const assetPath = assetPathOf(argv)
  if (assetPath === undefined) {
    return fail('render needs the path of a template asset: sovrium render <asset> [--out <file>]')
  }
  const out = getFlagPathValue(argv, '--out')
  const format = formatOf(out)
  const config = getFlagPathValue(argv, '--config')
  const configFile = resolve(config ?? (await discoverConfig()))
  const { app, store } = await loadProject(configFile)
  const data = await valuesFor(app, assetPath, getFlagPathValue(argv, '--data'), store)
  const { runTemplatePreview } = await import('@/infrastructure/server/template-preview-runtime')
  const locale = getFlagValue(argv, '--locale')
  const rendered = await runTemplatePreview(
    {
      app,
      path: assetPath,
      data,
      email: argv.includes('--email'),
      format,
      ...(locale === undefined ? {} : { locale }),
    },
    store
  )
  if (!rendered.ok) return fail(rendered.message)
  const { preview } = rendered
  if (out === undefined) {
    return preview.kind === 'text'
      ? writeStdout(preview.text.endsWith('\n') ? preview.text : `${preview.text}\n`)
      : fail(`${assetPath} renders to a file; pass --out`)
  }
  await mkdir(dirname(resolve(out)), { recursive: true })
  await writeFile(out, preview.kind === 'text' ? preview.text : preview.bytes)
}
