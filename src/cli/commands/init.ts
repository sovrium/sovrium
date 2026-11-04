/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { ENV_EXAMPLE_CONTENT } from '@/cli/commands/env-example-template'
import { printCodeNotice } from '@/cli/commands/init/code-notice'
import { generateClaudeMd, scaffoldDefault } from '@/cli/commands/init/default-scaffold'
import {
  designRecordsRoadFor,
  writeDesignRecordsForScaffold,
  type DesignRecordsRoad,
} from '@/cli/commands/init/design-records'
import { assertNotABundleUrl } from '@/cli/commands/init/from-bundle-source'
import { isWebFacingTemplate, scaffoldFromTemplate } from '@/cli/commands/init/from-template'
import { assertForkableUrl, type ForkedConfig } from '@/cli/commands/init/from-url'
import {
  assertFromUrlAlone,
  fetchPinnedConfig,
  inspectFromUrl,
} from '@/cli/commands/init/from-url-inspect'
import { writeForkedConfig } from '@/cli/commands/init/from-url-provenance'
import { initGitRepository } from '@/cli/commands/init/git'
import {
  isRemoteTemplateRef,
  scaffoldFromRemoteTemplate,
} from '@/cli/commands/init/remote-template'
import { PUBLIC_README_BODY } from '@/cli/commands/init/scaffold-content'
import { writeSkillsForScaffold } from '@/cli/commands/skills-files'
import { defineFlags, flag } from '@/cli/runtime/flag-schema'
import { refuseCommand, stopCommand, withFlagsAsync } from '@/cli/runtime/run-command'
import { printDocument } from '@/infrastructure/logging/cli-output'
import type { ForkTarget } from '@/cli/commands/init/from-url-format'

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

/** What `index.ts` hands `handleInitCommand` from the parsed command line. */
export interface InitCommandOptions {
  readonly templateName?: string
  readonly outputDir?: string
  readonly positionalDir?: string
  readonly forceFlag?: boolean
  readonly appName?: string
  /** `--typescript` — a typed `app.ts` instead of `app.yaml`; refused beside `--template`. */
  readonly typescript?: boolean
  /**
   * `--git` — initialise a repository and land one commit over the scaffold.
   *
   * Runs LAST, after the support files, so the `.gitignore` written alongside
   * them is already in place when the commit is staged. See `init/git.ts`.
   */
  readonly gitInit?: boolean
  /**
   * `--from-url <https://…>` — fork one published config document into the
   * project (`init/from-url.ts`); `--inspect` reports it and writes nothing,
   * `--expect-sha256` refuses any other bytes (`init/from-url-inspect.ts`).
   */
  readonly fromUrl?: string
  readonly inspect?: boolean
  readonly expectSha256?: string
  /** `--allow-code` — create a remote template that contains code. See `init/code-notice.ts`. */
  readonly allowCode?: boolean
}

const assertNoConflict = async (targetPath: string, forceFlag: boolean): Promise<void> => {
  if (forceFlag) return
  const exists = await Bun.file(targetPath).exists()
  if (!exists) return
  return stopCommand(1, `Error: ${targetPath} already exists (use --force to overwrite)`)
}

/** The config filename known before any fetch; a fork whose path names no format has none yet. */
const knownConfigName = (forkTarget: ForkTarget | undefined, typescript: boolean) =>
  forkTarget ? forkTarget.filename : configFilenameFor(typescript)

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
  printCodeNotice(forked.code, 'This project contains code — read it before you start it.')
  await writeFile(join(targetDir, 'CLAUDE.md'), generateClaudeMd(basename(targetDir)))
  return [...written, join(targetDir, 'CLAUDE.md')]
}

/**
 * Run the one scaffold strategy the invocation selected, and report what it
 * created so the caller can render a single document.
 *
 * The remote path returns nothing: it lives in `init/remote-template.ts` and
 * prints its own summary line before this banner, as stream narration.
 */
const scaffoldTree = async (params: {
  readonly templateName: string | undefined
  readonly targetDir: string
  readonly forceFlag: boolean
  readonly appName: string | undefined
  readonly typescript: boolean
  readonly forked: ForkedConfig | undefined
  readonly allowCode: boolean
}): Promise<readonly string[]> => {
  const { templateName, targetDir, forceFlag, appName, typescript, forked, allowCode } = params
  if (forked) return scaffoldFromUrl(forked, targetDir)
  if (templateName && isRemoteTemplateRef(templateName)) {
    // Remote-shaped refs (`owner/repo`, `gh:…`, GitHub URLs, optional #ref)
    // fetch from GitHub; bare names stay embedded-only (offline).
    await scaffoldFromRemoteTemplate(templateName, targetDir, { forceFlag, allowCode })
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
const assertFlagsCompatible = (templateName: string | undefined, typescript: boolean): void => {
  if (!typescript || templateName === undefined) return
  return refuseCommand({
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
}

/**
 * The config file this invocation will write.
 *
 * Hoisted out of `handleInitCommand` (rather than inlined as a ternary) to keep
 * that function under the per-function complexity cap.
 */
const configFilenameFor = (typescript: boolean): string => (typescript ? 'app.ts' : 'app.yaml')

/** `sovrium init`: `--from-url … --inspect` writes nothing; every other form scaffolds a project. */
export const handleInitCommand = async (options: InitCommandOptions = {}): Promise<void> =>
  options.inspect === true && options.fromUrl !== undefined
    ? inspectFromUrl({ ...options, fromUrl: options.fromUrl })
    : scaffoldProject(options)

const scaffoldProject = async (options: InitCommandOptions): Promise<void> => {
  const { templateName, outputDir, positionalDir, appName } = options
  // `=== true` rather than a destructuring default: a default counts as a
  // branch against this function's complexity budget, and it is already at it.
  const forceFlag = options.forceFlag === true
  const typescript = options.typescript === true
  const targetDir = positionalDir || outputDir || process.cwd()

  assertFlagsCompatible(templateName, typescript)
  assertFromUrlAlone(options.fromUrl, templateName, typescript)

  // Pure refusals (scheme, a remote `.ts`, a bundle's address) before any request or write.
  const forkTarget = options.fromUrl
    ? assertForkableUrl(assertNotABundleUrl(options.fromUrl))
    : undefined

  // The conflict check follows the config file this invocation will actually
  // write — otherwise `init --typescript` in a directory holding an `app.ts`
  // would check `app.yaml`, find nothing, and overwrite the author's config.
  // A fork whose path names no format learns its filename from the response.
  const knownName = knownConfigName(forkTarget, typescript)
  if (knownName) await assertNoConflict(join(targetDir, knownName), forceFlag)

  // Fetched, size-checked and DECODED before the first write. A rejected fork
  // leaves nothing behind by construction rather than through a cleanup path
  // that has to be right.
  const forked =
    options.fromUrl && forkTarget
      ? await fetchPinnedConfig(options.fromUrl, forkTarget.format, options.expectSha256)
      : undefined
  if (forked) await assertNoConflict(join(targetDir, forked.filename), forceFlag)

  await mkdir(targetDir, { recursive: true })

  const scaffolded = await scaffoldTree({
    templateName,
    targetDir,
    forceFlag,
    appName,
    typescript,
    forked,
    allowCode: options.allowCode === true,
  })

  // Scaffold the additive support files (`.gitignore`, `.env.example`,
  // `public/`) the project doesn't already own.
  const supportFiles = await scaffoldSupportFiles(
    targetDir,
    isWebFacingTemplate(templateName),
    designRecordsRoadFor(templateName, forked !== undefined)
  )

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
export const scaffoldSupportFiles = async (
  targetDir: string,
  isWebFacing: boolean,
  records: DesignRecordsRoad
): Promise<readonly string[]> => {
  const wroteGitignore = await writeGitignoreIfMissing(targetDir)
  const wroteEnvExample = await writeEnvExampleIfMissing(targetDir)
  const publicCreated = isWebFacing ? await writePublicDirIfMissing(targetDir) : []
  // Every scaffold path funnels through here — bare, `--template`, a remote
  // template and `--from-url` alike — so this one call is how each of them gets
  // the agent skills. Add-only, like the other support files.
  const skillsCreated = await writeSkillsForScaffold(targetDir)
  // PRODUCT.md, and DESIGN.md with its records when `init` wrote the config itself.
  const recordsCreated = await writeDesignRecordsForScaffold(targetDir, records)

  return [
    ...(wroteGitignore ? [join(targetDir, '.gitignore')] : []),
    ...(wroteEnvExample ? [join(targetDir, '.env.example')] : []),
    ...publicCreated,
    ...skillsCreated,
    ...recordsCreated,
  ]
}

/** The flags `sovrium init` reads beyond the shared ones. */
export const initFlags = defineFlags({
  typescript: flag.switch('--typescript'),
  gitInit: flag.switch('--git'),
  fromUrl: flag.value('--from-url'),
  fromBundle: flag.value('--from-bundle'),
  expectSha256: flag.value('--expect-sha256'),
  inspect: flag.switch('--inspect'),
  withDemoData: flag.switch('--with-demo-data'),
  allowCode: flag.switch('--allow-code'),
})

/** `sovrium init`, as the dispatcher runs it: `--from-bundle` opens a bundle, anything else scaffolds. */
export const initCommand = withFlagsAsync(initFlags, async ({ flags, ...args }) =>
  flags.fromBundle !== undefined
    ? (await import('@/cli/commands/init/from-bundle')).handleInitFromBundle({
        ...args,
        ...flags,
        source: flags.fromBundle,
        targetDir: args.configFile ?? args.outputPath,
      })
    : handleInitCommand({
        ...args,
        ...flags,
        outputDir: args.outputPath,
        positionalDir: args.configFile,
      })
)
