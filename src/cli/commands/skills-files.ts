/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createHash } from 'node:crypto'
import { lstat, mkdir, readFile, readdir, realpath, rm, rmdir, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { getCurrentVersion } from '@/cli/commands/update'
import { printStderr } from '@/infrastructure/logging/cli-output'

/**
 * The file half of `sovrium skills`: what the binary ships, what a project
 * holds, what one run would change, and the add-only writer `sovrium init`
 * calls. The reporting and the argv surface live in `skills.ts`.
 *
 * ## Ownership, per file
 *
 * The verb writes a `.sovrium-skills.json` beside the skills recording a
 * SHA-256 for EVERY file it wrote. That digest is what separates the three
 * states a refresh has to tell apart: a file that is current (its bytes equal
 * the embedded bytes), a file that is Sovrium's and merely stale (its bytes
 * equal the recorded digest), and a file the person edited (neither). Only the
 * second may be replaced without asking; the third needs `--force`; and a file
 * the manifest never recorded is never Sovrium's to replace, whatever its name.
 *
 * ## Never through a symlink
 *
 * Every path a run would write or delete is `lstat`ed first — each skill
 * directory, everything below it, and the manifest. A symbolic link anywhere
 * there refuses the WHOLE run, `--force` included: `writeFile` and `rm` follow
 * links, so a link planted in `[internal ref]` would otherwise redirect a
 * refresh onto any file the person can write. The skills ROOT is the one
 * link honoured, because sharing one folder between `[internal ref]` and
 * `.agents/skills` is a legitimate layout — and only while it resolves inside
 * the project.
 *
 * ## Read lazily
 *
 * The skills payload is reached through an `await import()` inside
 * {@link loadSkillsCatalogue}, never a static import: `init` imports this
 * module, and nothing on a boot path may pull the payload in
 * (`embedded-skills-boot.test.ts`).
 */

const MANIFEST_FILENAME = '.sovrium-skills.json'

/** A directory a host reads skills from. */
export type SkillsTarget = 'claude' | 'agents'

/** Where each target lives, under the project root. */
const TARGET_SEGMENTS: Readonly<Record<SkillsTarget, readonly [string, string]>> = {
  claude: ['.claude', 'skills'],
  agents: ['.agents', 'skills'],
}

/**
 * The only paths a manifest may name. A manifest is a file in the person's
 * project and may have been edited; a `../` entry must never become a deletion
 * outside the skills directory, so anything else is ignored rather than acted on.
 */
const OWNED_PATH = /^[a-z0-9]+(?:-[a-z0-9]+)*\/(?:SKILL\.md|references\/[^/\\]+\.md)$/

/** One file the binary ships, as the verb writes it. */
interface CatalogueFile {
  /** `<skill>/<path inside the skill>`, POSIX separators. */
  readonly path: string
  readonly content: string
  readonly sha256: string
}

/** Everything one run writes, stamped with the running version. */
export interface SkillsCatalogue {
  readonly version: string
  readonly files: readonly CatalogueFile[]
  readonly skills: readonly { readonly name: string; readonly description: string }[]
}

interface ManifestEntry {
  readonly path: string
  readonly sha256: string
}

type FileState = 'current' | 'missing' | 'stale' | 'edited' | 'foreign'

/** One file whose state keeps a directory from being current. */
export interface Finding {
  readonly state: Exclude<FileState, 'current'> | 'retired' | 'manifest' | 'symlink'
  readonly path: string
}

/** What one run would do to one target directory. */
export interface TargetPlan {
  readonly target: SkillsTarget
  /** Absolute directory holding the skills. */
  readonly dir: string
  /** Project-relative prefix used in every reported path. */
  readonly label: string
  readonly writes: readonly CatalogueFile[]
  readonly removals: readonly string[]
  readonly keptRetired: readonly string[]
  readonly findings: readonly Finding[]
  readonly manifestText: string
  readonly manifestCurrent: boolean
}

const sha256Of = (bytes: string | Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex')

const byPath = (a: { readonly path: string }, b: { readonly path: string }): number =>
  a.path < b.path ? -1 : a.path > b.path ? 1 : 0

/** The digest of a file on disk, or `undefined` when there is none. */
const diskSha = async (path: string): Promise<string | undefined> =>
  readFile(path).then(
    (bytes) => sha256Of(bytes),
    () => undefined
  )

/** Every file below `root`, as POSIX paths relative to it. */
const listFiles = async (root: string): Promise<readonly string[]> =>
  readdir(root, { recursive: true, withFileTypes: true }).then(
    (entries) =>
      entries
        .filter((entry) => entry.isFile())
        .map((entry) => relative(root, join(entry.parentPath, entry.name)).split(sep).join('/')),
    () => []
  )

type EntryKind = 'absent' | 'link' | 'directory' | 'file'

/** What sits at `path`, WITHOUT following a link — a dangling link is a `link`. */
const entryKind = async (path: string): Promise<EntryKind> =>
  lstat(path).then(
    (stats): EntryKind =>
      stats.isSymbolicLink() ? 'link' : stats.isDirectory() ? 'directory' : 'file',
    (): EntryKind => 'absent'
  )

/** Every symlink at or below `root` (POSIX, relative to `base`), never following one. */
const linksBelow = async (root: string, base: string): Promise<readonly string[]> => {
  const toRelative = (path: string): string => relative(base, path).split(sep).join('/')
  const kind = await entryKind(root)
  if (kind === 'link') return [`${toRelative(root)}/`]
  if (kind !== 'directory') return []
  const entries = await readdir(root, { withFileTypes: true }).catch(() => [])
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(root, entry.name)
      if (entry.isSymbolicLink()) return [toRelative(path)]
      return entry.isDirectory() ? linksBelow(path, base) : []
    })
  )
  return nested.flat()
}

const isInside = (root: string, candidate: string): boolean =>
  candidate === root || candidate.startsWith(`${root}${sep}`)

/**
 * Whether the skills root — or, when it does not exist yet, its parent
 * (`.claude`) — resolves OUTSIDE the project. A dangling link there resolves
 * nowhere, which counts as outside: nothing can be written through it safely.
 */
const rootEscapesProject = async (projectDir: string, dir: string): Promise<boolean> => {
  const project = await realpath(projectDir).catch(() => resolve(projectDir))
  const probe = async (candidates: readonly string[]): Promise<boolean> => {
    const [candidate, ...rest] = candidates
    if (candidate === undefined) return false
    if ((await entryKind(candidate)) === 'absent') return probe(rest)
    const real = await realpath(candidate).catch(() => undefined)
    return real === undefined || !isInside(project, real)
  }
  return probe([dir, dirname(dir)])
}

/**
 * Every symlink a run would write or delete through: at or below each skill
 * directory the catalogue or the manifest names, and at the manifest path.
 * Sorted, so the first one named is the same on every run.
 */
const symlinkFindings = async (
  dir: string,
  catalogue: SkillsCatalogue,
  manifest: ReadonlyMap<string, string> | undefined
): Promise<readonly Finding[]> => {
  const names = new Set([
    ...catalogue.skills.map(({ name }) => name),
    ...[...(manifest?.keys() ?? [])].map((path) => path.split('/')[0] ?? ''),
  ])
  const below = await Promise.all([...names].map(async (name) => linksBelow(join(dir, name), dir)))
  const manifestLink = (await entryKind(join(dir, MANIFEST_FILENAME))) === 'link'
  return [...below.flat(), ...(manifestLink ? [MANIFEST_FILENAME] : [])]
    .toSorted()
    .map((path) => ({ state: 'symlink' as const, path }))
}

/**
 * The binary's skills, as this version writes them: every `SKILL.md` stamped
 * with `metadata.product-version`, every reference verbatim, sorted by path.
 */
export const loadSkillsCatalogue = async (): Promise<SkillsCatalogue> => {
  const loader = await import('@/infrastructure/assets/embedded-skills')
  const version = await getCurrentVersion()
  const names = loader.embeddedSkillNames()
  const nested = await Promise.all(
    names.map(async (name) =>
      Promise.all(
        loader.embeddedSkillFiles(name).map(async (relPath): Promise<CatalogueFile> => {
          const raw = await loader.readEmbeddedSkillFile(name, relPath)
          const content = relPath === 'SKILL.md' ? loader.stampProductVersion(raw, version) : raw
          return { path: `${name}/${relPath}`, content, sha256: sha256Of(content) }
        })
      )
    )
  )
  const skills = await Promise.all(
    names.map(async (name) => ({
      name,
      description: (await loader.readEmbeddedSkillFrontmatter(name)).description,
    }))
  )
  return { version, files: nested.flat().toSorted(byPath), skills }
}

/** The manifest's raw text in `dir`, or `undefined` when there is none. */
const readManifestText = async (dir: string): Promise<string | undefined> =>
  (await entryKind(join(dir, MANIFEST_FILENAME))) === 'file'
    ? readFile(join(dir, MANIFEST_FILENAME), 'utf-8').catch(() => undefined)
    : undefined

/**
 * A manifest's text, as `path → sha256`. `undefined` when there is none; a
 * throw when there is one this version cannot read, because guessing at the
 * ownership of a person's files is worse than stopping.
 */
const parseManifest = (
  dir: string,
  text: string | undefined
): ReadonlyMap<string, string> | undefined => {
  if (text === undefined) return undefined
  const parsed = ((): unknown => {
    try {
      return JSON.parse(text)
    } catch {
      return undefined
    }
  })()
  const record = typeof parsed === 'object' && parsed !== null ? parsed : {}
  const files = 'files' in record && Array.isArray(record.files) ? record.files : undefined
  if (!('format' in record) || record.format !== 'sovrium-skills' || files === undefined) {
    throw new Error(`${join(dir, MANIFEST_FILENAME)} is not a Sovrium skills manifest.`)
  }
  const entries = (files as readonly unknown[]).flatMap((entry): readonly [string, string][] => {
    const candidate = entry as Partial<ManifestEntry> | null
    return typeof candidate?.path === 'string' &&
      typeof candidate.sha256 === 'string' &&
      OWNED_PATH.test(candidate.path)
      ? [[candidate.path, candidate.sha256]]
      : []
  })
  return new Map(entries)
}

const renderManifest = (
  catalogue: SkillsCatalogue,
  target: SkillsTarget,
  files: readonly ManifestEntry[]
): string =>
  `${JSON.stringify(
    {
      format: 'sovrium-skills',
      schemaVersion: 1,
      engine: catalogue.version,
      target,
      files: files.toSorted(byPath).map(({ path, sha256 }) => ({ path, sha256 })),
    },
    undefined,
    2
  )}\n`

const classify = (
  file: CatalogueFile,
  disk: string | undefined,
  listed: string | undefined
): FileState => {
  if (disk === undefined) return 'missing'
  if (disk === file.sha256) return 'current'
  if (listed === undefined) return 'foreign'
  return disk === listed ? 'stale' : 'edited'
}

/**
 * Skill directories that exist, that the manifest records nothing in, and that
 * hold a file which is not byte-equal to the embedded one — a skill of the
 * same name the person wrote. Refused even with `--force`.
 */
const foreignSkillDirs = async (
  dir: string,
  catalogue: SkillsCatalogue,
  manifest: ReadonlyMap<string, string> | undefined
): Promise<readonly Finding[]> => {
  const shipped = new Map(catalogue.files.map((file) => [file.path, file.sha256]))
  const owned = [...(manifest?.keys() ?? [])]
  const results = await Promise.all(
    catalogue.skills.map(async ({ name }) => {
      if (owned.some((path) => path.startsWith(`${name}/`))) return []
      const files = await listFiles(join(dir, name))
      const shas = await Promise.all(files.map(async (file) => diskSha(join(dir, name, file))))
      const alien = files.some((file, at) => shipped.get(`${name}/${file}`) !== shas[at])
      return alien ? [{ state: 'foreign' as const, path: `${name}/` }] : []
    })
  )
  return results.flat()
}

/** Manifest entries for skill files this version no longer ships. */
const planRetired = async (
  dir: string,
  catalogue: SkillsCatalogue,
  manifest: ReadonlyMap<string, string> | undefined
): Promise<{ readonly removals: readonly string[]; readonly kept: readonly string[] }> => {
  const shipped = new Set(catalogue.files.map((file) => file.path))
  const retired = [...(manifest?.entries() ?? [])].filter(([path]) => !shipped.has(path))
  const states = await Promise.all(
    retired.map(async ([path, sha]) => ({ path, sha, disk: await diskSha(join(dir, path)) }))
  )
  return {
    removals: states.filter(({ sha, disk }) => disk === sha).map(({ path }) => path),
    kept: states
      .filter(({ sha, disk }) => disk !== undefined && disk !== sha)
      .map(({ path }) => path),
  }
}

interface PlanOptions {
  readonly projectDir: string
  readonly target: SkillsTarget
  readonly force: boolean
}

export const planTarget = async (
  catalogue: SkillsCatalogue,
  { projectDir, target, force }: PlanOptions
): Promise<TargetPlan> => {
  const dir = join(projectDir, ...TARGET_SEGMENTS[target])
  const escapes = await rootEscapesProject(projectDir, dir)
  const onDisk = escapes ? undefined : await readManifestText(dir)
  const manifest = parseManifest(dir, onDisk)
  const states = await Promise.all(
    catalogue.files.map(async (file) => ({
      file,
      state: classify(file, await diskSha(join(dir, file.path)), manifest?.get(file.path)),
    }))
  )
  const retired = await planRetired(dir, catalogue, manifest)
  const manifestText = renderManifest(catalogue, target, catalogue.files)
  const writable = new Set<FileState>(force ? ['missing', 'stale', 'edited'] : ['missing', 'stale'])
  const manifestCurrent = onDisk === manifestText
  return {
    target,
    dir,
    label: TARGET_SEGMENTS[target].join('/'),
    writes: states.filter(({ state }) => writable.has(state)).map(({ file }) => file),
    removals: retired.removals,
    keptRetired: retired.kept,
    findings: [
      ...(escapes
        ? [{ state: 'symlink' as const, path: '' }]
        : await symlinkFindings(dir, catalogue, manifest)),
      ...states.flatMap(({ file, state }) =>
        state === 'current' ? [] : [{ state, path: file.path }]
      ),
      ...(await foreignSkillDirs(dir, catalogue, manifest)),
      ...retired.removals.map((path) => ({ state: 'retired' as const, path })),
      ...(manifestCurrent ? [] : [{ state: 'manifest' as const, path: MANIFEST_FILENAME }]),
    ],
    manifestText,
    manifestCurrent,
  }
}

/** Findings that stop a write: `edited` unless forced, `foreign` and `symlink` always. */
export const blockingFindings = (plan: TargetPlan, force: boolean): readonly Finding[] =>
  plan.findings.filter(
    ({ state }) => state === 'foreign' || state === 'symlink' || (state === 'edited' && !force)
  )

export const findingRow = (plan: TargetPlan, finding: Finding): string =>
  `${finding.state.padEnd(8)} ${plan.label}/${finding.path}`

/** Delete a retired file, then its directories once they are empty. */
const removeRetired = async (dir: string, path: string): Promise<void> => {
  await rm(join(dir, path), { force: true })
  const parents = [dirname(path), dirname(dirname(path))].filter((parent) => parent !== '.')
  for (const parent of parents) {
    await rmdir(join(dir, parent)).catch(() => undefined)
  }
}

export const applyPlan = async (plan: TargetPlan): Promise<void> => {
  await Promise.all(
    plan.writes.map(async (file) => {
      const destination = join(plan.dir, file.path)
      await mkdir(dirname(destination), { recursive: true })
      await writeFile(destination, file.content, 'utf-8')
    })
  )
  for (const path of plan.removals) {
    await removeRetired(plan.dir, path)
  }
  if (!plan.manifestCurrent) {
    await mkdir(plan.dir, { recursive: true })
    await writeFile(join(plan.dir, MANIFEST_FILENAME), plan.manifestText, 'utf-8')
  }
}

/**
 * Write the skills into a freshly scaffolded project, ADD-ONLY.
 *
 * `sovrium init` never overwrites: a skill whose directory already exists is
 * skipped whole (it may be the person's own, and mixing Sovrium's references
 * into it would make it neither). A skill directory that is a symlink — dangling
 * or not — is skipped and reported, never written through, and the whole write
 * is skipped when the skills root or the record leads outside the project.
 * Every other skill directory is created fresh, so nothing below it can
 * pre-exist.
 * The manifest then records exactly what this call wrote, merged into one that
 * was already present.
 *
 * @returns One summary entry naming the skills directory, or nothing when every
 *          skill was already present — the init banner lists entries, and thirty
 *          reference files would drown the ones a person needs to see.
 */
export const writeSkillsForScaffold = async (projectDir: string): Promise<readonly string[]> => {
  const catalogue = await loadSkillsCatalogue()
  const dir = join(projectDir, ...TARGET_SEGMENTS.claude)
  const label = TARGET_SEGMENTS.claude.join('/')
  if (
    (await rootEscapesProject(projectDir, dir)) ||
    (await entryKind(join(dir, MANIFEST_FILENAME))) === 'link'
  ) {
    printStderr(
      `Skipped the agent skills: ${label} or its record is a symlink leading outside the ` +
        "project, and Sovrium never writes through one. Run 'sovrium skills' once it is fixed."
    )
    return []
  }
  const kinds = await Promise.all(
    catalogue.skills.map(async ({ name }) => ({ name, kind: await entryKind(join(dir, name)) }))
  )
  for (const { name } of kinds.filter(({ kind }) => kind === 'link')) {
    printStderr(
      `Skipped agent skill ${name}: ${label}/${name} is a symlink, and Sovrium never writes through one.`
    )
  }
  const skipped = new Set(kinds.filter(({ kind }) => kind !== 'absent').map(({ name }) => name))
  const writes = catalogue.files.filter((file) => !skipped.has(file.path.split('/')[0] ?? ''))
  if (writes.length === 0) return []

  const existing = await readManifestText(dir)
    .then((text) => parseManifest(dir, text))
    .catch(() => undefined)
  await applyPlan({
    target: 'claude',
    dir,
    label,
    writes,
    removals: [],
    keptRetired: [],
    findings: [],
    manifestText: renderManifest(catalogue, 'claude', [
      ...[...(existing ?? new Map<string, string>())]
        .filter(([path]) => !writes.some((file) => file.path === path))
        .map(([path, sha256]) => ({ path, sha256 })),
      ...writes,
    ]),
    manifestCurrent: false,
  })
  const count = catalogue.skills.length - skipped.size
  return [`${dir}${sep} (${count} agent skill${count === 1 ? '' : 's'})`]
}
