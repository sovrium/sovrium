/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { Effect, Console } from 'effect'
import {
  isRemoteTemplateRef,
  scaffoldFromRemoteTemplate,
} from '@/cli/commands/init-remote-template'
import { CLAUDE_MD_BODY, PUBLIC_README_BODY } from '@/cli/commands/init-scaffold-content'
import { ENV_EXAMPLE_CONTENT } from '@/cli/env-example-template'
import { embeddedTemplateDir } from '@/infrastructure/assets/embedded-static-assets'
import { printDocument } from '@/infrastructure/logging/cli-output'

/**
 * Relative path of the starter Claude Code agent inside every template tree.
 *
 * Every `templates/<slug>/` checks in a byte-identical copy of this file, so a
 * `--template` scaffold receives it for free via the tree copy. A no-template
 * `init` has no tree to copy and sources the same bytes from the embedded
 * `hello-world` template (see `writeStarterAgentIfMissing`).
 */
const STARTER_AGENT_RELPATH = '.claude/agents/app-editor.md'

/**
 * Template name → directory name under `templates/`.
 *
 * Each template is a directory under `templates/<template>/` (post-2026-05 split,
 * see the CLAUDE.md split rules in `CLAUDE_MD_BODY`). Init copies the entire
 * tree into the target verbatim — including the template's own `CLAUDE.md` and
 * `[internal ref]`. Nothing is generated or installed on top.
 *
 * Template names are their directory names, one-to-one. The former `crud-app` /
 * `member-portal` templates were renamed to `crm` / `intranet` (business-job
 * names) with no aliases — the templates are pre-1.0 content, not API.
 */
const TEMPLATE_MAP: Readonly<Record<string, string>> = {
  'hello-world': 'hello-world',
  'landing-page': 'landing-page',
  crm: 'crm',
  'api-only': 'api-only',
  intranet: 'intranet',
  'mcp-server': 'mcp-server',
  blog: 'blog',
  'docs-site': 'docs-site',
  projects: 'projects',
  helpdesk: 'helpdesk',
  'content-calendar': 'content-calendar',
  people: 'people',
  events: 'events',
  assets: 'assets',
  expenses: 'expenses',
  'company-os': 'company-os',
  'automation-recipes': 'automation-recipes',
  'knowledge-base': 'knowledge-base',
}

/**
 * Templates that ship with a user-facing front-end and benefit from a
 * pre-scaffolded `public/` directory next to `app.yaml`. `api-only` and
 * `mcp-server` are excluded — both are headless and a blank public/ would
 * just be noise. The default no-template `init` (no positional template
 * arg) also scaffolds `public/` so the convention is discoverable from
 * the very first run.
 */
const WEB_FACING_TEMPLATE_NAMES: ReadonlySet<string> = new Set([
  'hello-world',
  'landing-page',
  'crm',
  'intranet',
  'blog',
  'docs-site',
  'projects',
  'helpdesk',
  'content-calendar',
  'people',
  'events',
  'assets',
  'expenses',
  'company-os',
  'automation-recipes',
  'knowledge-base',
])

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
  // eslint-disable-next-line functional/no-expression-statements
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
  // eslint-disable-next-line functional/no-expression-statements
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
        // eslint-disable-next-line functional/no-expression-statements
        await writeFile(gitkeepPath, '')
        return true
      }),
    Bun.file(readmePath)
      .exists()
      .then(async (exists) => {
        if (exists) return false
        // eslint-disable-next-line functional/no-expression-statements
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
 * (see `@/cli/env-example-template`). Returns whether a new file was written.
 */
const writeEnvExampleIfMissing = async (targetDir: string): Promise<boolean> => {
  const envExamplePath = join(targetDir, '.env.example')
  if (await Bun.file(envExamplePath).exists()) return false
  // eslint-disable-next-line functional/no-expression-statements
  await writeFile(envExamplePath, ENV_EXAMPLE_CONTENT)
  return true
}

/**
 * Generate `CLAUDE.md` content for a scaffolded sovrium project (title + body).
 */
const generateClaudeMd = (appName: string): string => `# ${appName}\n\n${CLAUDE_MD_BODY}`

/**
 * Write scaffold files (app.yaml + CLAUDE.md) to the target directory
 */
const writeScaffoldFiles = async (targetDir: string, appYamlContent: string): Promise<string> => {
  const targetPath = join(targetDir, 'app.yaml')
  const appName = basename(targetDir)
  // eslint-disable-next-line functional/no-expression-statements
  await writeFile(targetPath, appYamlContent)
  // eslint-disable-next-line functional/no-expression-statements
  await writeFile(join(targetDir, 'CLAUDE.md'), generateClaudeMd(appName))
  return targetPath
}

/**
 * Resolve and validate a template name, returning its directory under `templates/`.
 *
 * Exits with code 1 (and a list of available templates) on an unknown name,
 * and on a known name whose embedded template directory turns out to be empty
 * — the latter is an asset-pipeline bug (the manifest claims this template
 * exists but no files were embedded), not a user error, but still fatal.
 */
const resolveTemplate = (templateName: string): string => {
  const entry = TEMPLATE_MAP[templateName]
  if (entry === undefined) {
    Effect.runSync(
      Console.error(
        `Error: Unknown template "${templateName}" — does not exist\n\nAvailable templates: ` +
          Object.keys(TEMPLATE_MAP).join(', ')
      )
    )
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }

  const tree = embeddedTemplateDir(entry)
  if (Object.keys(tree).length === 0) {
    Effect.runSync(Console.error(`Error: Template directory has no embedded files: ${entry}`))
    // eslint-disable-next-line functional/no-expression-statements
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
  // eslint-disable-next-line functional/no-expression-statements
  await mkdir(dirname(destAbsPath), { recursive: true })
  // eslint-disable-next-line functional/no-expression-statements
  await Bun.write(destAbsPath, Bun.file(srcEmbeddedPath))
  return true
}

/**
 * Template-root files that exist for the mirrored `sovrium/<slug>` GitHub
 * repos (auto-published from `templates/`), not for scaffolded projects: the
 * mirror README's "PRs go upstream" notice and the MIT LICENSE are statements
 * about OUR repository and would be wrong inside a user's new project. The
 * deploy manifests (`scalingo.json`, `.buildpacks`, `Procfile`, `.env.example`)
 * ARE copied — a scaffolded project pushed to GitHub is one-click deployable.
 */
const MIRROR_ONLY_FILES: ReadonlySet<string> = new Set(['README.md', 'LICENSE'])

const copyTemplateTree = async (
  templateName: string,
  targetDir: string,
  forceFlag: boolean
): Promise<readonly string[]> => {
  const tree = embeddedTemplateDir(templateName)
  const relPaths = Object.keys(tree)
    .filter((relPath) => !MIRROR_ONLY_FILES.has(relPath))
    .toSorted()
  // `app.yaml` is the only file `init` owns — `--force` clobbers just it; every
  // other tree file (including `public/README.md`) is additive.
  const written = await Promise.all(
    relPaths.map((relPath) => {
      const clobber = forceFlag && relPath === 'app.yaml'
      return writeOneTreeFile(tree[relPath]!, join(targetDir, relPath), clobber)
    })
  )
  return relPaths.filter((_, i) => written[i] === true)
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
}

/**
 * Scaffold from a `--template <name>` — a pure copy of the embedded tree.
 *
 * The template's own `CLAUDE.md` and `[internal ref]` are checked
 * into `templates/<slug>/`, so they land with the rest of the tree. Nothing is
 * generated or overwritten on top: whatever the template ships is what the user
 * gets.
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
 * Write the starter Claude Code agent into a no-template scaffold.
 *
 * A `--template` scaffold gets this file from its tree copy. A bare `init` has
 * no tree, so it reads the same bytes from the embedded `hello-world` template
 * — every template ships a byte-identical copy (enforced by the
 * [internal ref] drift guard), so the choice of source is arbitrary.
 *
 * Additive: a pre-existing agent file is preserved verbatim.
 */
const writeStarterAgentIfMissing = async (targetDir: string): Promise<readonly string[]> => {
  const sourcePath = embeddedTemplateDir('hello-world')[STARTER_AGENT_RELPATH]
  if (sourcePath === undefined) {
    // The `Warning:` label went: `Error:` is load-bearing because scrapers grep
    // it, but `Warning:` only restates the tone the sentence already carries.
    Effect.runSync(Console.error(`Starter agent not embedded — skipping ${STARTER_AGENT_RELPATH}.`))
    return []
  }
  const destPath = join(targetDir, ...STARTER_AGENT_RELPATH.split('/'))
  const wrote = await writeOneTreeFile(sourcePath, destPath, false)
  return wrote ? [destPath] : []
}

const scaffoldDefault = async (
  targetDir: string,
  appName: string | undefined
): Promise<readonly string[]> => {
  const createdPath = await writeScaffoldFiles(
    targetDir,
    generateDefaultAppYaml(appName || basename(targetDir))
  )
  return [createdPath, ...(await writeStarterAgentIfMissing(targetDir))]
}

const assertNoConflict = async (targetPath: string, forceFlag: boolean): Promise<void> => {
  if (forceFlag) return
  const exists = await Bun.file(targetPath).exists()
  if (!exists) return
  Effect.runSync(Console.error(`Error: ${targetPath} already exists (use --force to overwrite)`))
  // eslint-disable-next-line functional/no-expression-statements
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
  const template = TEMPLATE_MAP[templateName]
  return template !== undefined && WEB_FACING_TEMPLATE_NAMES.has(template)
}

const scaffoldTree = async (params: {
  readonly templateName: string | undefined
  readonly targetDir: string
  readonly forceFlag: boolean
  readonly appName: string | undefined
}): Promise<readonly string[]> => {
  const { templateName, targetDir, forceFlag, appName } = params
  if (templateName && isRemoteTemplateRef(templateName)) {
    // Remote-shaped refs (`owner/repo`, `gh:…`, GitHub URLs, optional #ref)
    // fetch from GitHub; bare names stay embedded-only (offline).
    // eslint-disable-next-line functional/no-expression-statements
    await scaffoldFromRemoteTemplate(templateName, targetDir, forceFlag)
    return []
  }
  if (templateName) return scaffoldFromTemplate(templateName, targetDir, forceFlag)
  return scaffoldDefault(targetDir, appName)
}

export const handleInitCommand = async (options: InitCommandOptions = {}): Promise<void> => {
  const { templateName, outputDir, positionalDir, forceFlag = false, appName } = options
  const targetDir = positionalDir || outputDir || process.cwd()

  // eslint-disable-next-line functional/no-expression-statements
  await assertNoConflict(join(targetDir, 'app.yaml'), forceFlag)
  // eslint-disable-next-line functional/no-expression-statements
  await mkdir(targetDir, { recursive: true })

  const scaffolded = await scaffoldTree({ templateName, targetDir, forceFlag, appName })

  // Scaffold the additive support files (`.gitignore`, `.env.example`,
  // `public/`) the project doesn't already own.
  const supportFiles = await scaffoldSupportFiles(targetDir, isWebFacingTemplate(templateName))

  // One document instead of a per-file narration. A data block is capped at ten
  // rows; beyond that the count carries the information and the list is noise.
  const created = [...scaffolded, ...supportFiles]
  const listed = created.length <= 10 ? created : []

  printDocument([
    [
      {
        text:
          created.length === 0
            ? `Nothing to create in ${targetDir} — every file already exists.`
            : `Created ${created.length} file${created.length === 1 ? '' : 's'} in ${targetDir}${
                templateName ? ` from template ${templateName}` : ''
              }`,
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

  return [
    ...(wroteGitignore ? [join(targetDir, '.gitignore')] : []),
    ...(wroteEnvExample ? [join(targetDir, '.env.example')] : []),
    ...publicCreated,
  ]
}
