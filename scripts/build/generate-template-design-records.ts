#!/usr/bin/env bun
/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Template design records generator
 *
 * Every template under `src/templates/<slug>/` commits the design records
 * `sovrium init --template <slug>` writes into a new project: `DESIGN.md`, its
 * sidecar `.impeccable/design.json`, one surface brief per zone under
 * `.impeccable/surfaces/`, and `PRODUCT.md`. They are committed so a design
 * agent run inside the template tree, or in its published template repository,
 * reads that template's design rather than the operator console's root records.
 * `init` renders a project's records itself and never copies these
 * (`isScaffoldedTemplateFile`), and the binary never embeds them
 * (`isTemplateDesignRecord`).
 *
 * This writes all of them, for every template, through the renderer `init` and
 * `sovrium design-system --format design-md` share (`renderDesignMdRecords`), so
 * the committed copy and a fresh scaffold agree byte for byte. Unlike the export
 * it OVERWRITES: an operator completes PRODUCT.md and the briefs by hand, which
 * is why the export only adds them, but a template's are generated and nobody
 * completes them here. A brief whose zone no longer renders is removed.
 *
 * Nothing is formatted. The export's YAML front matter is not stable under
 * `bun fmt`, so each template's `DESIGN.md` is in `.prettierignore` and is
 * written as rendered; the other records come out of the renderers already in
 * the formatter's shape.
 *
 * Generated Assets Drift holds every file this writes (one row per file, from
 * {@link templateDesignRecordAssets}). A brief deleted from a commit is not a
 * row, since the rows come from the files on disk; the template bundle spec,
 * which compares each template's records with a real scaffold, catches that.
 *
 * Regenerate after a change to a template's config or `template.yaml`, or to
 * the renderers:
 *   bun run build:template-design-records
 */

import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dir, '..', '..')

/** Where the templates live, repo-relative. */
export const TEMPLATES_DIR = 'src/templates'

/** This generator, repo-relative, as Generated Assets Drift runs it. */
const GENERATOR = 'scripts/build/generate-template-design-records.ts'

/** The command a human runs to regenerate and commit. */
export const TEMPLATE_DESIGN_RECORDS_FIX = 'bun run build:template-design-records'

/** The folder of the surface briefs, relative to a template. */
const SURFACES_DIR = '.impeccable/surfaces'

/**
 * The config file names a template may use, in the order `init` probes them.
 * Kept literal rather than imported so that Generated Assets Drift, which lists
 * the rows through this module, never loads the engine to do it.
 */
const CONFIG_FILE_NAMES = ['app.yaml', 'app.yml', 'app.ts', 'app.json'] as const

/** A template's config file name, or undefined when the directory holds none. */
const configFileOf = (templateDir: string): string | undefined =>
  CONFIG_FILE_NAMES.find((name) => existsSync(join(templateDir, name)))

/** Every template slug, sorted: each directory of `src/templates/` holding a config. */
export const templateSlugs = (root: string = ROOT): readonly string[] =>
  readdirSync(join(root, TEMPLATES_DIR), { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() && configFileOf(join(root, TEMPLATES_DIR, entry.name)) !== undefined
    )
    .map((entry) => entry.name)
    .toSorted()

/**
 * The record files committed for one template, repo-relative: DESIGN.md, its
 * sidecar, each brief on disk, then PRODUCT.md (the order a run writes them).
 */
export const templateDesignRecordFiles = (slug: string, root: string = ROOT): readonly string[] => {
  const dir = `${TEMPLATES_DIR}/${slug}`
  const surfaces = join(root, dir, SURFACES_DIR)
  const briefs = existsSync(surfaces)
    ? readdirSync(surfaces)
        .filter((name) => name.endsWith('.md'))
        .toSorted()
        .map((name) => `${dir}/${SURFACES_DIR}/${name}`)
    : []
  return [`${dir}/DESIGN.md`, `${dir}/.impeccable/design.json`, ...briefs, `${dir}/PRODUCT.md`]
}

/** One Generated Assets Drift row per committed template record, all sharing this generator. */
export const templateDesignRecordAssets = (
  root: string = ROOT
): readonly { readonly file: string; readonly generator: string; readonly fixCommand: string }[] =>
  templateSlugs(root).flatMap((slug) =>
    templateDesignRecordFiles(slug, root).map((file) => ({
      file,
      generator: GENERATOR,
      fixCommand: TEMPLATE_DESIGN_RECORDS_FIX,
    }))
  )

/** A template whose config does not load, or does not decode. */
export class TemplateDesignRecordsError extends Error {
  override readonly name = 'TemplateDesignRecordsError'
}

/** The records of one template as `[path relative to the template, content]`, in write order. */
const renderTemplate = async (
  templateDir: string
): Promise<readonly (readonly [string, string])[]> => {
  const configFile = configFileOf(templateDir)
  if (configFile === undefined) {
    throw new TemplateDesignRecordsError(`${templateDir} holds no app config.`)
  }
  const configPath = join(templateDir, configFile)
  const { loadConfigForValidationWithSources } = await import('@/cli/commands/validate')
  const { decodeAppConfigObject } = await import('@/application/use-cases/config/decode-app-config')
  const { renderDesignMdRecords } = await import('@/cli/commands/design-system/design-md')
  const loaded = await loadConfigForValidationWithSources(configPath)
  const decoded = decodeAppConfigObject(loaded.parsed, { refSources: loaded.refSources })
  if (!decoded.valid) {
    throw new TemplateDesignRecordsError(
      `${configPath} does not decode:\n${decoded.errors.map((error) => `  ${error}`).join('\n')}`
    )
  }
  const records = await renderDesignMdRecords(
    decoded.app,
    configPath,
    join(templateDir, 'DESIGN.md')
  )
  return [
    ['DESIGN.md', records.designMd],
    ['.impeccable/design.json', records.sidecar],
    ...records.briefs.map((brief) => [brief.path, brief.content] as const),
    ['PRODUCT.md', records.productMd],
  ]
}

/** Write one template's records, removing a brief it no longer renders; returns the paths written. */
const writeTemplate = async (slug: string, root: string): Promise<readonly string[]> => {
  const templateDir = join(root, TEMPLATES_DIR, slug)
  const files = await renderTemplate(templateDir)
  const kept = new Set(files.map(([path]) => path))
  const surfaces = join(templateDir, SURFACES_DIR)
  if (existsSync(surfaces)) {
    readdirSync(surfaces)
      .map((name) => `${SURFACES_DIR}/${name}`)
      .filter((path) => !kept.has(path))
      .forEach((path) => rmSync(join(templateDir, path)))
  }
  files.forEach(([path, content]) => {
    const target = join(templateDir, path)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, content)
  })
  return files.map(([path]) => `${TEMPLATES_DIR}/${slug}/${path}`)
}

/** Write every template's records, one template at a time; returns the paths written. */
export const generateTemplateDesignRecords = async (
  root: string = ROOT
): Promise<readonly string[]> =>
  templateSlugs(root).reduce<Promise<readonly string[]>>(
    async (previous, slug) => [...(await previous), ...(await writeTemplate(slug, root))],
    Promise.resolve([])
  )

if (import.meta.main) {
  const written = await generateTemplateDesignRecords()
  console.log(
    `Wrote ${written.length} design records for ${templateSlugs().length} templates under ${TEMPLATES_DIR}/`
  )
}
