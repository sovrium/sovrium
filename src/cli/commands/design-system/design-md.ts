/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium design-system [config] --format design-md [--output <file>] [--force]`
 *
 * Prints the app's DESIGN.md, the file design agents read. With `--output` it
 * writes the DESIGN.md, THEN its sidecar `.impeccable/design.json` beside it
 * (so the sidecar is never older than the file it extends), then, add-only,
 * one surface brief per zone under `.impeccable/surfaces/` and a `PRODUCT.md`
 * when the folder has none. A brief and a PRODUCT.md are meant to be completed
 * by hand, so an export never replaces one. A `template.yaml` beside the config
 * fills the PRODUCT.md as `sovrium init --template` does; `init` renders the
 * same records through {@link renderDesignMdRecords}.
 *
 * ─── REWRITES ONLY WHAT IT WROTE ───────────────────────────────────────────
 *
 * A DESIGN.md at `--output` that does not open with the generated marker was
 * written by someone else: replacing it needs `--force`. One that does keeps
 * what is written inside its narrative blocks; everything else is regenerated.
 */

import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { stopCommand } from '@/cli/runtime/run-command'
import { detectFormat } from '@/domain/kernel/config-parsing/format-detection'
import { primaryPagePath } from '@/domain/kernel/matching/localized-path'
import {
  carryNarrativeSlots,
  DESIGN_MD_GENERATED_PREFIX,
  designMdInputOf,
  renderDesignMd,
  renderDesignSidecar,
  renderSurfaceBriefs,
  type DesignMdSidecarInput,
  type SkippedSurface,
  type SurfaceBrief,
  type SurfacePage,
} from '@/domain/models/app/design/adapters/export'
import { defaultLanguageTranslator } from '@/domain/models/app/languages/translation-resolver'
import { printLine, printStderr } from '@/infrastructure/logging/cli-output'
import { writeStdout } from '../document-output'
import { decodeTemplateManifest, TEMPLATE_MANIFEST_FILE } from '../init/template-manifest'
import { renderProductMd } from '../init/template-product-md'
import { fileOf, readConfigFiles } from './import-ref-owners'
import type { TemplateManifest } from '../init/template-manifest'
import type { App } from '@/domain/models/app'

/** Whether a path exists. */
const exists = (path: string): Promise<boolean> =>
  access(path).then(
    () => true,
    () => false
  )

/** A path relative to a folder, `/`-separated whatever the platform. */
const posixRelative = (from: string, to: string): string => relative(from, to).split(sep).join('/')

/**
 * The file each page is written in, relative to `outputDir`. A YAML or JSON
 * config is followed through its `$ref` includes; a TypeScript config is one
 * file as far as this command can tell.
 */
const surfacePagesOf = async (
  app: App,
  configPath: string,
  outputDir: string
): Promise<readonly SurfacePage[]> => {
  const pages = app.pages ?? []
  const format = detectFormat(configPath)
  const config =
    format === 'yaml' || format === 'json' ? await readConfigFiles(configPath) : undefined
  const configDir = dirname(resolve(configPath))
  return pages.map((page, index) => ({
    name: page.name,
    path: primaryPagePath(page.path),
    file: posixRelative(
      outputDir,
      config === undefined
        ? resolve(configPath)
        : resolve(configDir, fileOf(config, ['pages', index]))
    ),
  }))
}

/** The DESIGN.md text to write over an existing one, refusing what would lose someone's text. */
const replacementFor = (existing: string, rendered: string, force: boolean): string => {
  if (!existing.includes(DESIGN_MD_GENERATED_PREFIX)) {
    if (force) return rendered
    return stopCommand(
      1,
      'Error: The DESIGN.md at --output was not written by `sovrium design-system`, so it is left as it is.\n\n' +
        '  Pass --force to replace it with a generated one, or choose another --output.'
    )
  }
  const carried = carryNarrativeSlots(existing, rendered)
  if (carried._tag === 'Carried') return carried.text
  if (force) return rendered
  return stopCommand(
    1,
    `Error: The narrative block of section "${carried.section}" is ${carried.problem} in the DESIGN.md at --output, so what is written in it cannot be kept.\n\n` +
      '  Restore its sovrium:narrative markers, or pass --force to regenerate the file without its narrative.'
  )
}

/** Write a file, creating its folder, and report it. */
const writeReported = async (path: string, content: string): Promise<void> => {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content)
  printLine(`Wrote ${path}`)
}

/** Write a file only when none is there; report what was written. */
const writeIfAbsent = async (path: string, content: string): Promise<void> => {
  if (await exists(path)) return
  await writeReported(path, content)
}

/** The notice naming each zone that got no surface brief. */
const skippedNotice = (skipped: readonly SkippedSurface[]): string =>
  [
    'Notice: no surface brief for these zones:',
    '',
    ...skipped.map(({ zone, reason }) =>
      reason === 'shared-file'
        ? `  ${zone}: its pages share a file with another zone's pages; move each zone's pages into files of their own.`
        : `  ${zone}: no page renders in it.`
    ),
    '',
  ].join('\n')

/**
 * The `template.yaml` beside a config, decoded: a template directory exports the
 * PRODUCT.md its scaffold receives. Absent, or not a manifest: none.
 */
const manifestBeside = async (configPath: string): Promise<TemplateManifest | undefined> => {
  const manifestPath = join(dirname(resolve(configPath)), TEMPLATE_MANIFEST_FILE)
  const text = await readFile(manifestPath, 'utf-8').catch(() => undefined)
  if (text === undefined) return undefined
  const decoded = decodeTemplateManifest(text)
  return decoded._tag === 'Success' ? decoded.success : undefined
}

/** The PRODUCT.md for an app, from its config and its template's manifest. */
const productMdFor = async (
  app: App,
  configPath: string,
  manifest: TemplateManifest | undefined
): Promise<string> => {
  const configDir = join(dirname(resolve(configPath)), 'config')
  const hasConfigDir = await stat(configDir).then(
    (entry) => entry.isDirectory(),
    () => false
  )
  return renderProductMd({
    appName: app.name,
    ...(app.description === undefined ? {} : { description: app.description }),
    ...(manifest === undefined ? {} : { manifest }),
    entryFile: basename(configPath),
    hasConfigDir,
    ...(app.design?.voice?.pronoun === undefined ? {} : { pronoun: app.design.voice.pronoun }),
    hasLogo: app.design?.logo !== undefined,
  })
}

/** The facts the DESIGN.md and its sidecar are rendered from, in the app's default language. */
const sidecarInputOf = (app: App): DesignMdSidecarInput =>
  designMdInputOf(app, defaultLanguageTranslator(app.languages))

/** The records an export writes beside a DESIGN.md, rendered and not yet written. */
export interface DesignMdRecords {
  /** A fresh DESIGN.md, before any narrative of an existing one is carried over. */
  readonly designMd: string
  /** `.impeccable/design.json`. */
  readonly sidecar: string
  /** One brief per zone, each `path` relative to the DESIGN.md's folder. */
  readonly briefs: readonly SurfaceBrief[]
  /** The zones that get no brief, and why. */
  readonly skipped: readonly SkippedSurface[]
  readonly productMd: string
}

/**
 * Render every record of an app's DESIGN.md written at `outputPath`. PRODUCT.md
 * draws on `manifest`, else on a `template.yaml` beside the config.
 */
export const renderDesignMdRecords = async (
  app: App,
  configPath: string,
  outputPath: string,
  manifest?: TemplateManifest
): Promise<DesignMdRecords> => {
  const input = sidecarInputOf(app)
  const { briefs, skipped } = renderSurfaceBriefs({
    zones: app.design?.zones,
    pages: await surfacePagesOf(app, configPath, dirname(resolve(outputPath))),
    languageCodes: app.languages?.supported.map((language) => language.code) ?? [],
  })
  return {
    designMd: renderDesignMd(input),
    sidecar: renderDesignSidecar(input),
    briefs,
    skipped,
    productMd: await productMdFor(app, configPath, manifest ?? (await manifestBeside(configPath))),
  }
}

/** Write the DESIGN.md, its sidecar, the surface briefs and a PRODUCT.md beside `outputPath`. */
const writeDesignMdRecords = async (
  app: App,
  configPath: string,
  options: { readonly outputPath: string; readonly force: boolean }
): Promise<void> => {
  const { outputPath, force } = options
  const records = await renderDesignMdRecords(app, configPath, outputPath)
  const existing = await readFile(outputPath, 'utf-8').catch(() => undefined)
  const designMd =
    existing === undefined ? records.designMd : replacementFor(existing, records.designMd, force)
  const folder = dirname(outputPath)

  await writeReported(outputPath, designMd)
  await writeReported(join(folder, '.impeccable', 'design.json'), records.sidecar)
  await records.briefs.reduce(async (previous, brief) => {
    await previous
    await writeIfAbsent(join(folder, brief.path), brief.content)
  }, Promise.resolve())
  await writeIfAbsent(join(folder, 'PRODUCT.md'), records.productMd)
  if (records.skipped.length > 0) printStderr(skippedNotice(records.skipped))
}

/**
 * Export an app's DESIGN.md: printed to stdout, or written with its records
 * when `outputPath` is given.
 */
export const exportDesignMd = async (
  app: App,
  configPath: string,
  options: { readonly outputPath?: string; readonly force?: boolean }
): Promise<void> => {
  if (options.outputPath === undefined) return writeStdout(renderDesignMd(sidecarInputOf(app)))
  return writeDesignMdRecords(app, configPath, {
    outputPath: options.outputPath,
    force: options.force ?? false,
  })
}
