/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium init --template <name>` from a template embedded in the binary: the
 * catalogue lookup, and the copy of the template's tree into the project.
 * Remote templates are `remote-template.ts`; the strategy is chosen in
 * `init.ts`.
 */

import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { Effect } from 'effect'
import {
  isScaffoldedTemplateFile,
  writeRenderedTemplateWrappers,
} from '@/cli/commands/init/template-scaffold'
import { isHeadlessEntry, readEmbeddedTemplateCatalog } from '@/cli/commands/templates-catalog'
import { stopCommand } from '@/cli/runtime/run-command'
import { embeddedTemplateDir } from '@/infrastructure/assets/embedded-static-assets'
import type { TemplateCatalog } from '@/cli/commands/templates-catalog'

/**
 * The bundled templates, read from the catalogue the binary embeds.
 *
 * Each template is a directory under `src/templates/<template>/`, named after its
 * slug one-to-one (business jobs such as `crm`, `intranet`, with no aliases
 * for older names — the templates are pre-1.0 content, not API). Init copies
 * the template's config, `seed/` and `public/` into the target and renders its
 * `CLAUDE.md` and `.env.example` from its `template.yaml`
 * (`template-scaffold.ts`). The agent skills are not part of any
 * template: they come from the binary (`writeSkillsForScaffold`), added beside
 * the tree without overwriting.
 *
 * The slugs and their `headless` flags come from the SAME reader
 * `sovrium templates` prints from, so the list a developer is shown and the
 * names this command accepts cannot disagree. A catalogue that does not
 * decode is a build defect and exits 1.
 */
const templateCatalog = (): TemplateCatalog => {
  // A synchronous read of the embedded catalogue, inside a synchronous helper.
  const outcome = Effect.runSync(Effect.result(readEmbeddedTemplateCatalog))
  if (outcome._tag === 'Failure') {
    return stopCommand(1, `Error: ${outcome.failure.message}`)
  }
  return outcome.success
}

/** The template directory a bundled name resolves to, or `undefined` for an unknown name. */
const templateDirOf = (templateName: string): string | undefined =>
  Object.hasOwn(templateCatalog(), templateName) ? templateName : undefined

/**
 * Templates that ship with a user-facing front-end and benefit from a
 * pre-scaffolded `public/` directory next to `app.yaml`: every template the
 * catalogue does not mark headless (the API and MCP templates, where a blank
 * public/ would just be noise). The default no-template `init` (no positional
 * template arg) also scaffolds `public/` so the convention is discoverable
 * from the very first run.
 */
const isWebFacingCatalogTemplate = (template: string): boolean => {
  const entry = templateCatalog()[template]
  return entry !== undefined && !isHeadlessEntry(entry)
}

/**
 * Resolve and validate a template name, returning its directory under `src/templates/`.
 *
 * Exits with code 1 (and a list of available templates) on an unknown name,
 * and on a known name whose embedded template directory turns out to be empty
 * — the latter is an asset-pipeline bug (the manifest claims this template
 * exists but no files were embedded), not a user error, but still fatal.
 */
const resolveTemplate = (templateName: string): string => {
  const entry = templateDirOf(templateName)
  if (entry === undefined) {
    return stopCommand(
      1,
      `Error: Unknown template "${templateName}" — does not exist\n\nAvailable templates: ` +
        Object.keys(templateCatalog()).join(', ')
    )
  }

  const tree = embeddedTemplateDir(entry)
  if (Object.keys(tree).length === 0) {
    return stopCommand(1, `Error: Template directory has no embedded files: ${entry}`)
  }

  return entry
}

/**
 * Copy a single embedded template file into the target, preserving its relative
 * subpath.
 *
 * Additive — a pre-existing file is preserved verbatim and NOT clobbered
 * (mirrors `.gitignore` / `.env.example` / `public/` rules: `init` never
 * overwrites a file it does not own). The lone exception is `app.yaml`, which
 * `init` does own: when `clobber` is set (because `--force` was passed) it is
 * overwritten; otherwise an existing `app.yaml` already exits upstream in
 * `assertNoConflict`. Returns whether bytes were written (skipped files report
 * `false` so the caller's count reflects what actually landed).
 *
 * `Bun.file(embeddedPath)` works for both dev paths and `$bunfs/...` paths in
 * the compiled binary, so this writes the same bytes the manifest embedded.
 * Intermediate directories are created on demand.
 */
const writeOneTreeFile = async (
  srcEmbeddedPath: string,
  destAbsPath: string,
  clobber: boolean
): Promise<boolean> => {
  if (!clobber && (await Bun.file(destAbsPath).exists())) return false
  await mkdir(dirname(destAbsPath), { recursive: true })
  await Bun.write(destAbsPath, Bun.file(srcEmbeddedPath))
  return true
}

const copyTemplateTree = async (
  templateName: string,
  targetDir: string,
  forceFlag: boolean
): Promise<readonly string[]> => {
  const tree = embeddedTemplateDir(templateName)
  const relPaths = Object.keys(tree).filter(isScaffoldedTemplateFile).toSorted()
  // `app.yaml` is the only file `init` owns — `--force` clobbers just it; every
  // other tree file (including `public/README.md`) is additive.
  const written = await Promise.all(
    relPaths.map((relPath) => {
      const clobber = forceFlag && relPath === 'app.yaml'
      return writeOneTreeFile(tree[relPath]!, join(targetDir, relPath), clobber)
    })
  )
  const copied = relPaths.filter((_, i) => written[i] === true)
  const rendered = await writeRenderedTemplateWrappers(
    templateName,
    tree,
    targetDir,
    templateCatalog()[templateName]
  )
  return [...copied, ...rendered]
}

/**
 * Scaffold from a `--template <name>`: the template's config, `seed/` and
 * `public/`, plus the `CLAUDE.md` and `.env.example` rendered from its
 * `template.yaml` (see `template-scaffold.ts`). Never the manifest, the
 * published repository's README and licence, or a host's deploy manifest.
 */
export const scaffoldFromTemplate = async (
  templateName: string,
  targetDir: string,
  forceFlag: boolean
): Promise<readonly string[]> => {
  const template = resolveTemplate(templateName)
  const relPaths = await copyTemplateTree(template, targetDir, forceFlag)
  return relPaths.map((relPath) => join(targetDir, relPath))
}

/**
 * Whether this scaffold should grow a `public/`.
 *
 * Resolves the alias to its template name first, so legacy aliases (`landing`)
 * still qualify. Unknown names already exit upstream in `resolveTemplate`, so
 * the lookup here is safe. A bare `init` is always web-facing.
 */
export const isWebFacingTemplate = (templateName: string | undefined): boolean => {
  if (templateName === undefined) return true
  const template = templateDirOf(templateName)
  return template !== undefined && isWebFacingCatalogTemplate(template)
}
