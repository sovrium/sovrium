/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { Effect } from 'effect'
import { ENV_EXAMPLE_CONTENT } from '@/cli/commands/env-example-template'
import {
  assertForkableUrl,
  fetchForkedConfig,
  writeForkedConfig,
  type ForkedConfig,
} from '@/cli/commands/init-from-url'
import { initGitRepository } from '@/cli/commands/init-git'
import {
  isRemoteTemplateRef,
  scaffoldFromRemoteTemplate,
} from '@/cli/commands/init-remote-template'
import { CLAUDE_MD_BODY, PUBLIC_README_BODY } from '@/cli/commands/init-scaffold-content'
import {
  isScaffoldedTemplateFile,
  writeRenderedTemplateWrappers,
} from '@/cli/commands/init-template-scaffold'
import { writeSkillsForScaffold } from '@/cli/commands/skills-files'
import { isHeadlessEntry, readEmbeddedTemplateCatalog } from '@/cli/commands/templates-catalog'
import { writeConfigTypesFiles } from '@/cli/commands/types'
import { embeddedTemplateDir } from '@/infrastructure/assets/embedded-static-assets'
import { printDocument, printFailure, printStderr } from '@/infrastructure/logging/cli-output'
import type { TemplateCatalog } from '@/cli/commands/templates-catalog'

/**
 * The bundled templates, read from the catalogue the binary embeds.
 *
 * Each template is a directory under `src/templates/<template>/`, named after its
 * slug one-to-one (business jobs such as `crm`, `intranet`, with no aliases
 * for older names — the templates are pre-1.0 content, not API). Init copies
 * the template's config, `seed/` and `public/` into the target and renders its
 * `CLAUDE.md` and `.env.example` from its `template.yaml`
 * (`init-template-scaffold.ts`). The agent skills are not part of any
 * template: they come from the binary (`writeSkillsForScaffold`), added beside
 * the tree without overwriting.
 *
 * The slugs and their `headless` flags come from the SAME reader
 * `sovrium templates` prints from, so the list a developer is shown and the
 * names this command accepts cannot disagree. A catalogue that does not
 * decode is a build defect and exits 1.
 */
const templateCatalog = (): TemplateCatalog => {
  const outcome = Effect.runSync(Effect.result(readEmbeddedTemplateCatalog))
  if (outcome._tag === 'Failure') {
    printStderr(`Error: ${outcome.failure.message}`)
    process.exit(1)
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
 * Sanitize a directory name into a valid npm package name for use in app.yaml.
 * Converts to lowercase, replaces invalid characters with hyphens,
 * strips leading dots/underscores/hyphens, and falls back to 'my-app'.
 */
const sanitizeAppName = (dirName: string): string => {
  const sanitized = dirName
    .toLowerCase()
    .replace(/[^a-z0-9-._~]/g, '-')
    .replace(/^[._-]+/, '')
    .replace(/-+/g, '-')
    .replace(/-$/, '')
  return sanitized.length > 0 ? sanitized : 'my-app'
}

/**
 * Generate default app.yaml content using the directory name as the app name
 */
const generateDefaultAppYaml = (appName: string): string =>
  [`name: ${sanitizeAppName(appName)}`, `description: A Sovrium application`, ''].join('\n')

/**
 * Generate the default `app.ts` for `sovrium init --typescript`.
 *
 * The import is TYPE-ONLY and the object is checked with `satisfies` — never a
 * `defineConfig()` value import. The binary leaves bare-package specifiers
 * unresolved, so a value import would type-check and then fail at boot, whereas
 * `import type` is erased at transpile time and never resolved at all. That is
 * why the emitted declaration exports no runtime value either.
 *
 * `satisfies` over an `AppConfig` annotation: it validates the literal against
 * the type WITHOUT widening it, so the export keeps its precise shape and a
 * misspelled property is still an excess-property error.
 *
 * `sanitizeAppName` restricts the name to `[a-z0-9-._~]`, so no quote escaping
 * is required in the emitted single-quoted string.
 */
const generateDefaultAppTs = (appName: string): string =>
  [
    "import type { AppConfig } from 'sovrium'",
    '',
    'export default {',
    `  name: '${sanitizeAppName(appName)}',`,
    "  description: 'A Sovrium application',",
    '} satisfies AppConfig',
    '',
  ].join('\n')

/**
 * Generate default `.gitignore` content for a sovrium project.
 *
 * `.sovrium/` is the consolidated runtime data dir — the zero-config SQLite
 * database, the server lock file, and local file-storage uploads all nest under
 * it (relocatable via the `SOVRIUM_DATA_DIR` env var), so a single entry keeps a
 * fresh project's working tree clean. `.env*` is ignored because it may hold
 * secrets (`DATABASE_URL`, `AUTH_SECRET`, S3 keys).
 */
const generateGitignore = (): string =>
  [
    '# Sovrium runtime data (SQLite database, server lock file, file uploads).',
    '# Relocatable via the SOVRIUM_DATA_DIR env var.',
    '.sovrium/',
    '',
    '# Environment variables (may contain secrets)',
    '.env',
    '.env.local',
    '',
  ].join('\n')

/**
 * Write a `.gitignore` to the target directory unless one already exists.
 *
 * Never clobbers a project's existing `.gitignore` (even under `--force`, which
 * only governs `app.yaml`) — `init` is additive for files it does not own.
 * Returns whether a new file was written, so the caller can report it.
 */
const writeGitignoreIfMissing = async (targetDir: string): Promise<boolean> => {
  const gitignorePath = join(targetDir, '.gitignore')
  if (await Bun.file(gitignorePath).exists()) return false
  await writeFile(gitignorePath, generateGitignore())
  return true
}

/**
 * Scaffold `public/.gitkeep` and `public/README.md` next to `app.yaml`,
 * additive — never clobbers an existing file (mirrors `.gitignore` /
 * `.env.example` rules). Returns the relative paths created so the caller can
 * report them.
 */
const writePublicDirIfMissing = async (targetDir: string): Promise<readonly string[]> => {
  const publicDir = join(targetDir, 'public')
  await mkdir(publicDir, { recursive: true })

  // Resolve each file's existence + plant, then compose the report list
  // immutably (no array.push — functional/immutable-data). Both writes are
  // independent so they run in parallel.
  const gitkeepPath = join(publicDir, '.gitkeep')
  const readmePath = join(publicDir, 'README.md')
  const [wroteGitkeep, wroteReadme] = await Promise.all([
    Bun.file(gitkeepPath)
      .exists()
      .then(async (exists) => {
        if (exists) return false
        await writeFile(gitkeepPath, '')
        return true
      }),
    Bun.file(readmePath)
      .exists()
      .then(async (exists) => {
        if (exists) return false
        await writeFile(readmePath, PUBLIC_README_BODY)
        return true
      }),
  ])
  return [...(wroteGitkeep ? [gitkeepPath] : []), ...(wroteReadme ? [readmePath] : [])]
}

/**
 * Write a `.env.example` to the target directory unless one already exists.
 *
 * Additive like `.gitignore` — `init` never clobbers a file it does not own
 * (even under `--force`, which only governs `app.yaml`). The content is the
 * canonical, eco-defaulted reference shared with the repo-root `.env.example`
 * (see `@/cli/commands/env-example-template`). Returns whether a new file was written.
 */
const writeEnvExampleIfMissing = async (targetDir: string): Promise<boolean> => {
  const envExamplePath = join(targetDir, '.env.example')
  if (await Bun.file(envExamplePath).exists()) return false
  await writeFile(envExamplePath, ENV_EXAMPLE_CONTENT)
  return true
}

/**
 * Generate `CLAUDE.md` content for a scaffolded sovrium project (title + body).
 */
const generateClaudeMd = (appName: string): string => `# ${appName}\n\n${CLAUDE_MD_BODY}`

/**
 * Write scaffold files (the config file + CLAUDE.md) to the target directory.
 *
 * `configFilename` is `app.yaml` by default and `app.ts` under `--typescript`.
 * Exactly ONE of them is written: `DEFAULT_CONFIG_FILENAMES` resolves
 * `app.yaml` before `app.ts`, so scaffolding both would leave the typed config
 * permanently shadowed — edited by its author and never read by the runtime.
 */
const writeScaffoldFiles = async (
  targetDir: string,
  configFilename: string,
  configContent: string
): Promise<string> => {
  const targetPath = join(targetDir, configFilename)
  const appName = basename(targetDir)
  await writeFile(targetPath, configContent)
  await writeFile(join(targetDir, 'CLAUDE.md'), generateClaudeMd(appName))
  return targetPath
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
    printStderr(
      `Error: Unknown template "${templateName}" — does not exist\n\nAvailable templates: ` +
        Object.keys(templateCatalog()).join(', ')
    )
    process.exit(1)
  }

  const tree = embeddedTemplateDir(entry)
  if (Object.keys(tree).length === 0) {
    printStderr(`Error: Template directory has no embedded files: ${entry}`)
    process.exit(1)
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
 * Handle the 'init' command - scaffold a new project from a template or defaults
 */
export interface InitCommandOptions {
  readonly templateName?: string
  readonly outputDir?: string
  readonly positionalDir?: string
  readonly forceFlag?: boolean
  readonly appName?: string
  /**
   * `--typescript` — scaffold a typed `app.ts` (plus `sovrium.d.ts` and
   * `tsconfig.json`) instead of `app.yaml`. Mutually exclusive with
   * `--template`: a template ships its own config, so honouring both would mean
   * silently discarding one of the two things the operator asked for.
   */
  readonly typescript?: boolean
  /**
   * `--git` — initialise a repository and land one commit over the scaffold.
   *
   * Runs LAST, after the support files, so the `.gitignore` written alongside
   * them is already in place when the commit is staged. See `init-git.ts`.
   */
  readonly gitInit?: boolean
  /**
   * `--from-url <https://…>` — fork one published config document into the
   * project instead of generating a starter one. See `init-from-url.ts`.
   */
  readonly fromUrl?: string
}

/**
 * Scaffold from a `--template <name>`: the template's config, `seed/` and
 * `public/`, plus the `CLAUDE.md` and `.env.example` rendered from its
 * `template.yaml` (see `init-template-scaffold.ts`). Never the manifest, the
 * published repository's README and licence, or a host's deploy manifest.
 */
const scaffoldFromTemplate = async (
  templateName: string,
  targetDir: string,
  forceFlag: boolean
): Promise<readonly string[]> => {
  const template = resolveTemplate(templateName)
  const relPaths = await copyTemplateTree(template, targetDir, forceFlag)
  return relPaths.map((relPath) => join(targetDir, relPath))
}

/**
 * The no-template scaffold: a config file and CLAUDE.md — and,
 * under `--typescript`, the two files that make the typed config check.
 *
 * `sovrium.d.ts` + `tsconfig.json` are written here rather than left to a
 * follow-up `sovrium types` so the scaffolded directory type-checks and
 * validates on the first try. Emitting `app.ts` alone would hand the author a
 * config whose very first line — `import type { AppConfig } from 'sovrium'` —
 * is an unresolved-module error.
 */
const scaffoldDefault = async (
  targetDir: string,
  appName: string | undefined,
  typescript: boolean
): Promise<readonly string[]> => {
  const resolvedName = appName || basename(targetDir)
  const createdPath = typescript
    ? await writeScaffoldFiles(targetDir, 'app.ts', generateDefaultAppTs(resolvedName))
    : await writeScaffoldFiles(targetDir, 'app.yaml', generateDefaultAppYaml(resolvedName))

  const typesFiles = typescript ? await writeConfigTypesFiles(targetDir) : undefined
  const typesPaths = typesFiles
    ? [typesFiles.declarationPath, ...(typesFiles.tsconfigWritten ? [typesFiles.tsconfigPath] : [])]
    : []

  return [createdPath, ...typesPaths]
}

const assertNoConflict = async (targetPath: string, forceFlag: boolean): Promise<void> => {
  if (forceFlag) return
  const exists = await Bun.file(targetPath).exists()
  if (!exists) return
  printStderr(`Error: ${targetPath} already exists (use --force to overwrite)`)
  process.exit(1)
}

/**
 * Run the one scaffold strategy the invocation selected, and report what it
 * created so the caller can render a single document.
 *
 * The remote path returns nothing: it lives in `init-remote-template.ts` and
 * prints its own summary line before this banner, as stream narration.
 */
/**
 * Whether this scaffold should grow a `public/`.
 *
 * Resolves the alias to its template name first, so legacy aliases (`landing`)
 * still qualify. Unknown names already exit upstream in `resolveTemplate`, so
 * the lookup here is safe. A bare `init` is always web-facing.
 */
const isWebFacingTemplate = (templateName: string | undefined): boolean => {
  if (templateName === undefined) return true
  const template = templateDirOf(templateName)
  return template !== undefined && isWebFacingCatalogTemplate(template)
}

/**
 * The forked-config scaffold: the published bytes verbatim, its provenance,
 * and the same CLAUDE.md a bare `init` writes.
 *
 * A forked project is a first-class project, not a bare config file — which is
 * why this writes the bundle rather than only the document it fetched.
 */
const scaffoldFromUrl = async (
  forked: ForkedConfig,
  targetDir: string
): Promise<readonly string[]> => {
  const written = await writeForkedConfig(forked, targetDir)
  await writeFile(join(targetDir, 'CLAUDE.md'), generateClaudeMd(basename(targetDir)))
  return [...written, join(targetDir, 'CLAUDE.md')]
}

const scaffoldTree = async (params: {
  readonly templateName: string | undefined
  readonly targetDir: string
  readonly forceFlag: boolean
  readonly appName: string | undefined
  readonly typescript: boolean
  readonly forked: ForkedConfig | undefined
}): Promise<readonly string[]> => {
  const { templateName, targetDir, forceFlag, appName, typescript, forked } = params
  if (forked) return scaffoldFromUrl(forked, targetDir)
  if (templateName && isRemoteTemplateRef(templateName)) {
    // Remote-shaped refs (`owner/repo`, `gh:…`, GitHub URLs, optional #ref)
    // fetch from GitHub; bare names stay embedded-only (offline).
    await scaffoldFromRemoteTemplate(templateName, targetDir, forceFlag)
    return []
  }
  if (templateName) return scaffoldFromTemplate(templateName, targetDir, forceFlag)
  return scaffoldDefault(targetDir, appName, typescript)
}

/**
 * Refuse `--typescript` alongside `--template`, naming both.
 *
 * A template ships its own `app.yaml`, so there is no honest way to satisfy
 * both flags: writing an `app.ts` next to the template's config would leave one
 * of them permanently shadowed, and ignoring `--typescript` would report
 * success for a flag that did nothing. Refusing is the only answer that does
 * not silently discard part of the request.
 */
/**
 * Refuse `--from-url` alongside a flag that would decide the same file.
 *
 * `--template` ships its own config and `--typescript` generates one, so
 * either would have to be silently discarded for the fork to land. Refusing is
 * the only answer that does not throw away half of what was asked for.
 */
const assertFromUrlAlone = (
  fromUrl: string | undefined,
  templateName: string | undefined,
  typescript: boolean
): void => {
  if (fromUrl === undefined) return
  const conflicting = templateName !== undefined ? '--template' : typescript ? '--typescript' : ''
  if (conflicting === '') return
  printFailure({
    headline: `Cannot combine --from-url with ${conflicting}.`,
    detail: [
      'Both decide what the project config is, and only one of them can win —',
      'so honouring either would mean silently discarding the other.',
    ],
    guidance: `Pick one: fork the published config with --from-url, or scaffold with ${conflicting}.`,
  })
  process.exit(1)
}

const assertFlagsCompatible = (templateName: string | undefined, typescript: boolean): void => {
  if (!typescript || templateName === undefined) return
  printFailure({
    headline: 'Cannot combine --typescript with --template.',
    detail: [
      `The "${templateName}" template ships its own app.yaml, which would shadow a`,
      'generated app.ts — Sovrium resolves app.yaml before app.ts.',
    ],
    guidance:
      'Scaffold the template, then convert its config by hand:\n' +
      `  sovrium init --template ${templateName}\n` +
      '  sovrium types',
  })
  process.exit(1)
}

/**
 * The config file this invocation will write.
 *
 * Hoisted out of `handleInitCommand` (rather than inlined as a ternary) to keep
 * that function under the per-function complexity cap.
 */
const configFilenameFor = (typescript: boolean): string => (typescript ? 'app.ts' : 'app.yaml')

export const handleInitCommand = async (options: InitCommandOptions = {}): Promise<void> => {
  const { templateName, outputDir, positionalDir, appName } = options
  // `=== true` rather than a destructuring default: a default counts as a
  // branch against this function's complexity budget, and it is already at it.
  const forceFlag = options.forceFlag === true
  const typescript = options.typescript === true
  const targetDir = positionalDir || outputDir || process.cwd()

  assertFlagsCompatible(templateName, typescript)
  assertFromUrlAlone(options.fromUrl, templateName, typescript)

  // Pure refusals first (scheme, extension), so a URL this command will not
  // fork is rejected before a request is made — and therefore before anything
  // could have been written.
  const forkTarget = options.fromUrl ? assertForkableUrl(options.fromUrl) : undefined

  // The conflict check follows the config file this invocation will actually
  // write — otherwise `init --typescript` in a directory holding an `app.ts`
  // would check `app.yaml`, find nothing, and overwrite the author's config.
  await assertNoConflict(
    join(targetDir, forkTarget?.filename ?? configFilenameFor(typescript)),
    forceFlag
  )

  // Fetched, size-checked and DECODED before the first write. A rejected fork
  // leaves nothing behind by construction rather than through a cleanup path
  // that has to be right.
  const forked =
    options.fromUrl && forkTarget
      ? await fetchForkedConfig(options.fromUrl, forkTarget.filename)
      : undefined

  await mkdir(targetDir, { recursive: true })

  const scaffolded = await scaffoldTree({
    templateName,
    targetDir,
    forceFlag,
    appName,
    typescript,
    forked,
  })

  // Scaffold the additive support files (`.gitignore`, `.env.example`,
  // `public/`) the project doesn't already own.
  const supportFiles = await scaffoldSupportFiles(targetDir, isWebFacingTemplate(templateName))

  // AFTER the support files: the commit below stages what is on disk, and the
  // `.gitignore` those files include is what keeps `.sovrium/` and `.env` out
  // of it.
  if (options.gitInit === true) await initGitRepository(targetDir)

  printInitSummary([...scaffolded, ...supportFiles], targetDir, templateName)
}

/**
 * One document instead of a per-file narration.
 *
 * A data block is capped at ten rows; beyond that the count carries the
 * information and the list is noise.
 */
const printInitSummary = (
  created: readonly string[],
  targetDir: string,
  templateName: string | undefined
): void => {
  const listed = created.length <= 10 ? created : []
  const from = templateName ? ` from template ${templateName}` : ''

  printDocument([
    [
      {
        text:
          created.length === 0
            ? `Nothing to create in ${targetDir} — every file already exists.`
            : `Created ${created.length} file${created.length === 1 ? '' : 's'} in ${targetDir}${from}`,
        ...(listed.length > 0 ? { detail: listed } : {}),
      },
    ],
    [{ text: `Run 'sovrium start' in ${targetDir} to see it running.` }],
  ])
}

/**
 * Write the additive support files (`.gitignore`, `.env.example`, and
 * conditionally `public/`) into the target directory unless they already
 * exist, reporting each one created. Extracted from `handleInitCommand` to
 * keep it within statement/complexity limits.
 *
 * `scaffoldPublicDir` only fires for web-facing templates (`isWebFacing`) so
 * headless templates (`api-only`, `mcp-server`) don't grow an inert public/.
 * All three writers are additive — a pre-existing file is preserved verbatim.
 */
const scaffoldSupportFiles = async (
  targetDir: string,
  isWebFacing: boolean
): Promise<readonly string[]> => {
  const wroteGitignore = await writeGitignoreIfMissing(targetDir)
  const wroteEnvExample = await writeEnvExampleIfMissing(targetDir)
  const publicCreated = isWebFacing ? await writePublicDirIfMissing(targetDir) : []
  // Every scaffold path funnels through here — bare, `--template`, a remote
  // template and `--from-url` alike — so this one call is how each of them gets
  // the agent skills. Add-only, like the other support files.
  const skillsCreated = await writeSkillsForScaffold(targetDir)

  return [
    ...(wroteGitignore ? [join(targetDir, '.gitignore')] : []),
    ...(wroteEnvExample ? [join(targetDir, '.env.example')] : []),
    ...publicCreated,
    ...skillsCreated,
  ]
}
