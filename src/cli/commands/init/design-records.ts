/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The design records `sovrium init` writes into a new project: `PRODUCT.md`,
 * and `DESIGN.md` with its `.impeccable/design.json` sidecar and one surface
 * brief per zone, the records `sovrium design-system --format design-md
 * --output DESIGN.md` writes (`design-system/design-md.ts`).
 *
 * ─── ONLY FROM A CONFIG THE BINARY WROTE ───────────────────────────────────
 *
 * DESIGN.md is rendered from the decoded app, and decoding an `app.ts` RUNS it.
 * So the full set is written only when `init` wrote the config itself: the bare
 * scaffold and an embedded `--template`. A project received from elsewhere (a
 * GitHub template, a forked document, a bundle) gets `PRODUCT.md` alone, drawn
 * from a YAML or JSON config read as data, and a notice naming the command that
 * writes the rest once its owner has read the project.
 *
 * ─── ADD-ONLY, EVEN UNDER --force ──────────────────────────────────────────
 *
 * Both records are meant to be completed by hand. PRODUCT.md is written only
 * when absent. DESIGN.md, its sidecar and its briefs are one set, written only
 * when DESIGN.md is absent, and even then an existing sidecar or brief is kept:
 * a sidecar beside someone else's DESIGN.md would describe a design that file
 * may not. The design agent's own settings (`.impeccable/config.json`) are
 * never written.
 */

import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { DEFAULT_CONFIG_FILENAMES } from '@/domain/kernel/config-parsing/default-config-files'
import { detectFormat } from '@/domain/kernel/config-parsing/format-detection'
import { embeddedTemplateDir } from '@/infrastructure/assets/embedded-static-assets'
import { printDocument } from '@/infrastructure/logging/cli-output'
import { isRemoteTemplateRef } from './remote-template'
import { decodeTemplateManifest, TEMPLATE_MANIFEST_FILE } from './template-manifest'
import { renderProductMd } from './template-product-md'
import type { TemplateManifest } from './template-manifest'
import type { App } from '@/domain/models/app'

/**
 * How the project's config came to be: written by `init` itself (bare, or an
 * embedded template), or received from a third party and never to be run.
 */
export type DesignRecordsRoad =
  { readonly kind: 'scaffolded'; readonly templateName?: string } | { readonly kind: 'received' }

/** A project whose config came from elsewhere: a GitHub template, a forked document, a bundle. */
export const RECEIVED_PROJECT: DesignRecordsRoad = { kind: 'received' }

/** The road of a `sovrium init` that did not open a bundle. */
export const designRecordsRoadFor = (
  templateName: string | undefined,
  forked: boolean
): DesignRecordsRoad => {
  if (forked || (templateName !== undefined && isRemoteTemplateRef(templateName))) {
    return RECEIVED_PROJECT
  }
  return templateName === undefined ? { kind: 'scaffolded' } : { kind: 'scaffolded', templateName }
}

/** Whether a path exists. */
const exists = (path: string): Promise<boolean> =>
  access(path).then(
    () => true,
    () => false
  )

/** Write `content` at `path` unless something is there; whether it wrote. */
const writeIfAbsent = async (path: string, content: string): Promise<boolean> => {
  if (await exists(path)) return false
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content)
  return true
}

/** The project's config file, in the order the server resolves one; undefined when none. */
const configFileIn = async (targetDir: string): Promise<string | undefined> => {
  const candidates = [...DEFAULT_CONFIG_FILENAMES, 'app.json']
  const found = await Promise.all(candidates.map((name) => exists(join(targetDir, name))))
  return candidates.find((_, index) => found[index] === true)
}

/** The embedded template's `template.yaml`, decoded; undefined when it has none. */
const embeddedManifestOf = async (templateName: string): Promise<TemplateManifest | undefined> => {
  const manifestPath = embeddedTemplateDir(templateName)[TEMPLATE_MANIFEST_FILE]
  if (manifestPath === undefined) return undefined
  const decoded = decodeTemplateManifest(await Bun.file(manifestPath).text())
  return decoded._tag === 'Success' ? decoded.success : undefined
}

/**
 * The app, loaded as `sovrium validate` and the export load it: `$ref` partials
 * resolved, an `app.ts` evaluated. A config that does not load or decode yields
 * undefined, and the project is then treated as received: `init` reports what it
 * created and never fails on a record.
 */
const loadApp = async (configPath: string): Promise<App | undefined> => {
  const { loadConfigForValidationWithSources } = await import('../validate')
  const { decodeAppConfigObject } = await import('@/application/use-cases/config/decode-app-config')
  const loaded = await loadConfigForValidationWithSources(configPath).catch(() => undefined)
  if (loaded === undefined) return undefined
  const decoded = decodeAppConfigObject(loaded.parsed, { refSources: loaded.refSources })
  return decoded.valid ? decoded.app : undefined
}

/** A plain object, else an empty one. */
const recordOf = (value: unknown): Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

/** A YAML or JSON config read as data, never run; `{}` for TypeScript or a file that does not parse. */
const rawConfigOf = async (configPath: string): Promise<Readonly<Record<string, unknown>>> => {
  const format = detectFormat(configPath)
  if (format !== 'yaml' && format !== 'json') return {}
  const text = await readFile(configPath, 'utf-8')
  try {
    return recordOf(format === 'yaml' ? Bun.YAML.parse(text) : JSON.parse(text))
  } catch {
    return {}
  }
}

/** The PRODUCT.md of a received project, from what its config states as plain data. */
const receivedProductMd = async (targetDir: string, configFile: string): Promise<string> => {
  const raw = await rawConfigOf(join(targetDir, configFile))
  const design = recordOf(raw['design'])
  const { pronoun } = recordOf(design['voice'])
  const hasConfigDir = await stat(join(targetDir, 'config')).then(
    (entry) => entry.isDirectory(),
    () => false
  )
  return renderProductMd({
    appName: typeof raw['name'] === 'string' ? raw['name'] : basename(targetDir),
    ...(typeof raw['description'] === 'string' ? { description: raw['description'] } : {}),
    entryFile: configFile,
    hasConfigDir,
    ...(typeof pronoun === 'string' ? { pronoun } : {}),
    hasLogo: design['logo'] !== undefined,
  })
}

/** Tell the owner of a received project how to write DESIGN.md once they have read it. */
const printDesignMdNotice = (configFile: string): void =>
  printDocument([
    [
      {
        text: 'DESIGN.md was not written: this project came from elsewhere, so its config was not run.',
        detail: [
          'Once you have read it, write DESIGN.md and its records with:',
          `sovrium design-system ${configFile} --format design-md --output DESIGN.md`,
        ],
      },
    ],
  ])

/** PRODUCT.md alone, then the notice when DESIGN.md is still to write. */
const writeReceivedRecords = async (
  targetDir: string,
  configFile: string
): Promise<readonly string[]> => {
  const productPath = join(targetDir, 'PRODUCT.md')
  const wrote = (await exists(productPath))
    ? false
    : await writeIfAbsent(productPath, await receivedProductMd(targetDir, configFile))
  if (!(await exists(join(targetDir, 'DESIGN.md')))) printDesignMdNotice(configFile)
  return wrote ? [productPath] : []
}

/** DESIGN.md, then its sidecar and briefs where absent: the sidecar is never older than the file. */
const writeDesignSet = async (
  targetDir: string,
  records: {
    readonly designMd: string
    readonly sidecar: string
    readonly briefs: readonly { readonly path: string; readonly content: string }[]
  }
): Promise<readonly string[]> => {
  const files: ReadonlyArray<readonly [string, string]> = [
    ['DESIGN.md', records.designMd],
    [join('.impeccable', 'design.json'), records.sidecar],
    ...records.briefs.map((brief) => [brief.path, brief.content] as const),
  ]
  return files.reduce<Promise<readonly string[]>>(async (previous, [relPath, content]) => {
    const written = await previous
    const path = join(targetDir, relPath)
    return (await writeIfAbsent(path, content)) ? [...written, path] : written
  }, Promise.resolve([]))
}

/** The full set, rendered from the app `init` itself wrote. */
const writeScaffoldedRecords = async (
  targetDir: string,
  configFile: string,
  templateName: string | undefined
): Promise<readonly string[]> => {
  const productPath = join(targetDir, 'PRODUCT.md')
  const designPath = join(targetDir, 'DESIGN.md')
  const [needsProduct, needsDesign] = await Promise.all([
    exists(productPath).then((found) => !found),
    exists(designPath).then((found) => !found),
  ])
  if (!needsProduct && !needsDesign) return []
  const configPath = join(targetDir, configFile)
  const app = await loadApp(configPath)
  if (app === undefined) return writeReceivedRecords(targetDir, configFile)
  const manifest = templateName === undefined ? undefined : await embeddedManifestOf(templateName)
  const { renderDesignMdRecords } = await import('../design-system/design-md')
  const records = await renderDesignMdRecords(app, configPath, designPath, manifest)
  const designSet = needsDesign ? await writeDesignSet(targetDir, records) : []
  const wroteProduct = needsProduct && (await writeIfAbsent(productPath, records.productMd))
  return [...designSet, ...(wroteProduct ? [productPath] : [])]
}

/**
 * Write the design records a new project lacks, add-only, and return the
 * absolute paths written. A project with no config file gets none.
 */
export const writeDesignRecordsForScaffold = async (
  targetDir: string,
  road: DesignRecordsRoad
): Promise<readonly string[]> => {
  const configFile = await configFileIn(targetDir)
  if (configFile === undefined) return []
  return road.kind === 'received'
    ? writeReceivedRecords(targetDir, configFile)
    : writeScaffoldedRecords(targetDir, configFile, road.templateName)
}
