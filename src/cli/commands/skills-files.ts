/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { mkdir, rm, rmdir, writeFile } from 'node:fs/promises'
import { dirname, join, sep } from 'node:path'
import {
  AGENT_LABEL,
  agentDirFor,
  agentWritesForScaffold,
  byPath,
  classifyAll,
  diskSha,
  entryKind,
  keptEdited,
  loadAgentCatalogue,
  MANIFEST_FILENAME,
  parseManifest,
  planAgentFiles,
  planRetired,
  readManifestText,
  recordedKeeping,
  recordedWith,
  renderManifest,
  sha256Of,
  writableStates,
  type CatalogueFile,
  type Finding,
  type Manifest,
} from '@/cli/commands/skills-agent-file'
import { rootEscapesProject, symlinkFindings } from '@/cli/commands/skills-symlinks'
import { listFilesBelow } from '@/infrastructure/filesystem/list-files-below'
import { printStderr } from '@/infrastructure/logging/cli-output'
import { devStampNotice, getBuildStamp, isDevStamp } from '@/infrastructure/process/build-stamp'

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
 * second may be replaced without asking; the third is kept, and named, unless
 * `--force` — the rest of the run goes ahead, and the manifest keeps Sovrium's
 * previous digest for it so every later run names it again; and a file the
 * manifest never recorded is never Sovrium's to replace, whatever its name.
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
 * ## The agent file
 *
 * The `claude` target also writes `[internal ref]`,
 * under the same rules and the same manifest (`skills-agent-file.ts`).
 *
 * ## Read lazily
 *
 * The skills payload is reached through an `await import()` inside
 * {@link loadSkillsCatalogue}, never a static import: `init` imports this
 * module, and nothing on a boot path may pull the payload in
 * (`embedded-skills-boot.test.ts`).
 */

/** A directory a host reads skills from. */
export type SkillsTarget = 'claude' | 'agents'

/** Where each target lives, under the project root. */
const TARGET_SEGMENTS: Readonly<Record<SkillsTarget, readonly [string, string]>> = {
  claude: ['.claude', 'skills'],
  agents: ['.agents', 'skills'],
}

/** Everything one run writes, stamped with the running version. */
export interface SkillsCatalogue {
  readonly version: string
  readonly files: readonly CatalogueFile[]
  readonly skills: readonly { readonly name: string; readonly description: string }[]
  /** The agent files the `claude` target writes to `[internal ref]`. */
  readonly agents: readonly CatalogueFile[]
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
  /** Absolute `[internal ref]`, and the agent files written or removed there. */
  readonly agentDir: string
  readonly agentWrites: readonly CatalogueFile[]
  readonly agentRemovals: readonly string[]
  /** Project-relative paths of retired files kept because they were edited. */
  readonly keptRetired: readonly string[]
  /**
   * Project-relative paths of shipped files the person edited, kept as they
   * are because the run is not forced; every other file is still refreshed.
   */
  readonly keptEdited: readonly string[]
  readonly findings: readonly Finding[]
  readonly manifestText: string
  readonly manifestCurrent: boolean
}

/** Every file below `root`, as POSIX paths relative to it, never through a symlink. */
const listFiles = async (root: string): Promise<readonly string[]> =>
  listFilesBelow(root).catch(() => [])

/**
 * The binary's skills, as this version writes them: every `SKILL.md` stamped
 * with `metadata.product-version`, every reference verbatim, sorted by path.
 * The stamp is the build's (`getBuildStamp`): the version for a tagged
 * release, `<version>-dev+<sha>` for a source run or any other build.
 */
export const loadSkillsCatalogue = async (): Promise<SkillsCatalogue> => {
  const loader = await import('@/infrastructure/assets/embedded-skills')
  const version = getBuildStamp()
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
  const agents = await loadAgentCatalogue()
  return { version, files: nested.flat().toSorted(byPath), skills, agents }
}

/**
 * Skill directories that exist, that the manifest records nothing in, and that
 * hold a file which is not byte-equal to the embedded one — a skill of the
 * same name the person wrote. Refused even with `--force`.
 */
const foreignSkillDirs = async (
  dir: string,
  catalogue: SkillsCatalogue,
  manifest: Manifest | undefined
): Promise<readonly Finding[]> => {
  const shipped = new Map(catalogue.files.map((file) => [file.path, file.sha256]))
  const owned = [...(manifest?.files.keys() ?? [])]
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

interface PlanOptions {
  readonly projectDir: string
  readonly target: SkillsTarget
  readonly force: boolean
}

/**
 * The manifest one run records: the shipped digests, except for each kept
 * edited file, whose previous digest stays. `kept.agents` is `undefined` for a
 * target that holds no agent file, and then no `agents` list is written.
 */
const renderPlannedManifest = (
  catalogue: SkillsCatalogue,
  target: SkillsTarget,
  manifest: Manifest | undefined,
  kept: { readonly files: readonly string[]; readonly agents: readonly string[] | undefined }
): string =>
  renderManifest(
    catalogue.version,
    target,
    recordedKeeping(catalogue.files, kept.files, manifest?.files),
    kept.agents === undefined
      ? undefined
      : recordedKeeping(catalogue.agents, kept.agents, manifest?.agents)
  )

export const planTarget = async (
  catalogue: SkillsCatalogue,
  { projectDir, target, force }: PlanOptions
): Promise<TargetPlan> => {
  const dir = join(projectDir, ...TARGET_SEGMENTS[target])
  const label = TARGET_SEGMENTS[target].join('/')
  const agentDir = agentDirFor(dir)
  const agents = target === 'claude' ? catalogue.agents : undefined
  const escapes = await rootEscapesProject(projectDir, dir)
  const onDisk = escapes ? undefined : await readManifestText(dir)
  const manifest = parseManifest(dir, onDisk)
  const writable = writableStates(force)
  const states = await classifyAll(catalogue.files, dir, manifest?.files)
  const retired = await planRetired(dir, catalogue.files, manifest?.files)
  const agent = await planAgentFiles(agentDir, agents, manifest, writable)
  const edited = keptEdited(states, writable)
  const kept = { files: edited, agents: agents && agent.edited }
  const manifestText = renderPlannedManifest(catalogue, target, manifest, kept)
  const manifestCurrent = onDisk === manifestText
  return {
    target,
    dir,
    label,
    writes: states.filter(({ state }) => writable.has(state)).map(({ file }) => file),
    removals: retired.removals,
    agentDir,
    agentWrites: agent.writes,
    agentRemovals: agent.removals,
    keptRetired: [...retired.kept.map((path) => `${label}/${path}`), ...agent.kept],
    keptEdited: [
      ...edited.map((path) => `${label}/${path}`),
      ...agent.edited.map((path) => `${AGENT_LABEL}/${path}`),
    ],
    findings: [
      ...(escapes
        ? [{ state: 'symlink' as const, path: '' }]
        : await symlinkFindings(dir, catalogue.skills, manifest)),
      ...states.flatMap(({ file, state }) =>
        state === 'current' ? [] : [{ state, path: file.path }]
      ),
      ...(await foreignSkillDirs(dir, catalogue, manifest)),
      ...retired.removals.map((path) => ({ state: 'retired' as const, path })),
      ...agent.findings,
      ...(manifestCurrent ? [] : [{ state: 'manifest' as const, path: MANIFEST_FILENAME }]),
    ],
    manifestText,
    manifestCurrent,
  }
}

/**
 * Findings that stop a write: `foreign` and `symlink`, with `--force` or without.
 * An `edited` file never does — the run keeps it and refreshes the rest.
 */
export const blockingFindings = (plan: TargetPlan): readonly Finding[] =>
  plan.findings.filter(({ state }) => state === 'foreign' || state === 'symlink')

/**
 * Findings that make `--check` fail: every one but `edited`. A kept edit is the
 * state a refresh leaves behind on purpose, so the check names it and passes.
 */
export const failingCheckFindings = (plan: TargetPlan): readonly Finding[] =>
  plan.findings.filter(({ state }) => state !== 'edited')

export const findingRow = (plan: TargetPlan, finding: Finding): string =>
  `${finding.state.padEnd(8)} ${finding.label ?? `${plan.label}/${finding.path}`}`

/** Delete a retired file, then its directories once they are empty. */
const removeRetired = async (dir: string, path: string): Promise<void> => {
  await rm(join(dir, path), { force: true })
  const parents = [dirname(path), dirname(dirname(path))].filter((parent) => parent !== '.')
  for (const parent of parents) {
    await rmdir(join(dir, parent)).catch(() => undefined)
  }
}

const writeAll = async (dir: string, files: readonly CatalogueFile[]): Promise<void> => {
  await Promise.all(
    files.map(async (file) => {
      const destination = join(dir, file.path)
      await mkdir(dirname(destination), { recursive: true })
      await writeFile(destination, file.content, 'utf-8')
    })
  )
}

export const applyPlan = async (plan: TargetPlan): Promise<void> => {
  await writeAll(plan.dir, plan.writes)
  await writeAll(plan.agentDir, plan.agentWrites)
  for (const path of plan.removals) {
    await removeRetired(plan.dir, path)
  }
  for (const path of plan.agentRemovals) {
    await removeRetired(plan.agentDir, path)
  }
  if (!plan.manifestCurrent) {
    await mkdir(plan.dir, { recursive: true })
    await writeFile(join(plan.dir, MANIFEST_FILENAME), plan.manifestText, 'utf-8')
  }
}

/** The skill files `init` may add: every skill whose directory is absent, links reported. */
const skillWritesForScaffold = async (
  catalogue: SkillsCatalogue,
  dir: string,
  label: string
): Promise<{ readonly writes: readonly CatalogueFile[]; readonly count: number }> => {
  const kinds = await Promise.all(
    catalogue.skills.map(async ({ name }) => ({ name, kind: await entryKind(join(dir, name)) }))
  )
  for (const { name } of kinds.filter(({ kind }) => kind === 'link')) {
    printStderr(
      `Skipped agent skill ${name}: ${label}/${name} is a symlink, and Sovrium never writes through one.`
    )
  }
  const skipped = new Set(kinds.filter(({ kind }) => kind !== 'absent').map(({ name }) => name))
  return {
    writes: catalogue.files.filter((file) => !skipped.has(file.path.split('/')[0] ?? '')),
    count: catalogue.skills.length - skipped.size,
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
 * pre-exist. The agent file follows the same rule in `[internal ref]`.
 * The manifest then records exactly what this call wrote, merged into one that
 * was already present.
 *
 * @returns One summary entry naming the skills directory, unless every skill
 *          was already present — thirty reference files would drown the init
 *          banner — then one per agent file written.
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
  const { writes, count } = await skillWritesForScaffold(catalogue, dir, label)
  const agentDir = agentDirFor(dir)
  const agentWrites = await agentWritesForScaffold(agentDir, catalogue.agents)
  if (writes.length === 0 && agentWrites.length === 0) return []
  if (isDevStamp(catalogue.version)) printStderr(devStampNotice(catalogue.version))

  const existing = await readManifestText(dir)
    .then((text) => parseManifest(dir, text))
    .catch(() => undefined)
  await applyPlan({
    target: 'claude',
    dir,
    label,
    writes,
    removals: [],
    agentDir,
    agentWrites,
    agentRemovals: [],
    keptRetired: [],
    keptEdited: [],
    findings: [],
    manifestText: renderManifest(
      catalogue.version,
      'claude',
      recordedWith(existing?.files, writes),
      recordedWith(existing?.agents, agentWrites)
    ),
    manifestCurrent: false,
  })
  return [
    ...(writes.length > 0 ? [`${dir}${sep} (${count} agent skill${count === 1 ? '' : 's'})`] : []),
    ...agentWrites.map((file) => join(agentDir, file.path)),
  ]
}
