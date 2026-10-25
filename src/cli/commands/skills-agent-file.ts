/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createHash } from 'node:crypto'
import { lstat, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { printStderr } from '@/infrastructure/logging/cli-output'

/**
 * The agent-file half of `sovrium skills`, and the ownership record both
 * halves share.
 *
 * ## The agent file
 *
 * Beside the skills, the `claude` target writes one Claude Code subagent,
 * `[internal ref]`, projecting the whole skill set.
 * It is refreshed by the same rules as a skill file and recorded in the same
 * `.sovrium-skills.json`, under a top-level `agents` list. Its bytes are the
 * source's, never stamped: the frontmatter is a subagent's, not a skill's.
 * Nothing goes to `.agents/`: the file is Claude Code's format.
 *
 * ## The manifest
 *
 * `.sovrium-skills.json` records a SHA-256 for every file a run wrote, under
 * `files` (paths relative to the skills directory) and, for the `claude`
 * target, `agents` (file names relative to `[internal ref]`). `schemaVersion`
 * stays 1: `agents` is additive, an older binary ignores it, and a manifest
 * written before it parses with no agent entries.
 */

export const MANIFEST_FILENAME = '.sovrium-skills.json'

/** Where the agent files live, under the project root. */
export const AGENT_SEGMENTS = ['.claude', 'agents'] as const

/** The project-relative prefix every reported agent path carries. */
export const AGENT_LABEL = AGENT_SEGMENTS.join('/')

/**
 * The only paths a manifest may name. A manifest is a file in the person's
 * project and may have been edited; a `../` entry must never become a deletion
 * outside the skills directory, so anything else is ignored rather than acted on.
 */
const OWNED_PATH = /^[a-z0-9]+(?:-[a-z0-9]+)*\/(?:SKILL\.md|references\/[^/\\]+\.md)$/

/** An agent entry: one kebab file name, never a second segment, never outside `[internal ref]`. */
export const AGENT_OWNED_PATH = /^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/

/** One file the binary ships, as the verb writes it. */
export interface CatalogueFile {
  /** Relative to the directory it is written in, POSIX separators. */
  readonly path: string
  readonly content: string
  readonly sha256: string
}

/** One recorded file: what the manifest says Sovrium wrote. */
export interface ManifestEntry {
  readonly path: string
  readonly sha256: string
}

/** A parsed manifest: `path → sha256`, for the skill files and the agent files. */
export interface Manifest {
  readonly files: ReadonlyMap<string, string>
  readonly agents: ReadonlyMap<string, string>
}

export const sha256Of = (bytes: string | Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex')

export const byPath = (a: { readonly path: string }, b: { readonly path: string }): number =>
  a.path < b.path ? -1 : a.path > b.path ? 1 : 0

export type EntryKind = 'absent' | 'link' | 'directory' | 'file'

/** What sits at `path`, WITHOUT following a link — a dangling link is a `link`. */
export const entryKind = async (path: string): Promise<EntryKind> =>
  lstat(path).then(
    (stats): EntryKind =>
      stats.isSymbolicLink() ? 'link' : stats.isDirectory() ? 'directory' : 'file',
    (): EntryKind => 'absent'
  )

export type FileState = 'current' | 'missing' | 'stale' | 'edited' | 'foreign'

/** One file whose state keeps a directory from being current. */
export interface Finding {
  readonly state: Exclude<FileState, 'current'> | 'retired' | 'manifest' | 'symlink'
  readonly path: string
  /** The project-relative path to report, when it is not under the plan's label. */
  readonly label?: string
}

/** The digest of a file on disk, or `undefined` when there is none. */
export const diskSha = async (path: string): Promise<string | undefined> =>
  readFile(path).then(
    (bytes) => sha256Of(bytes),
    () => undefined
  )

/** Where one shipped file stands against the disk and the record. */
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

/** Manifest entries, below `dir`, for files this version no longer ships. */
export const planRetired = async (
  dir: string,
  files: readonly CatalogueFile[],
  listed: ReadonlyMap<string, string> | undefined
): Promise<{ readonly removals: readonly string[]; readonly kept: readonly string[] }> => {
  const shipped = new Set(files.map((file) => file.path))
  const retired = [...(listed?.entries() ?? [])].filter(([path]) => !shipped.has(path))
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

/** {@link classify} for every file of `files`, below `dir`. */
export const classifyAll = async (
  files: readonly CatalogueFile[],
  dir: string,
  listed: ReadonlyMap<string, string> | undefined
): Promise<readonly { readonly file: CatalogueFile; readonly state: FileState }[]> =>
  Promise.all(
    files.map(async (file) => ({
      file,
      state: classify(file, await diskSha(join(dir, file.path)), listed?.get(file.path)),
    }))
  )

/** What one run does to the agent files. */
export interface AgentPlan {
  readonly writes: readonly CatalogueFile[]
  readonly removals: readonly string[]
  /** Project-relative paths of retired agent files kept because they were edited. */
  readonly kept: readonly string[]
  /** Shipped agent files the person edited, kept because the run is not forced. */
  readonly edited: readonly string[]
  readonly findings: readonly Finding[]
}

const asAgentFinding = (state: Finding['state'], path: string): Finding => ({
  state,
  path,
  label: `${AGENT_LABEL}/${path}`,
})

/** The states a run replaces: a missing or stale file, and an edited one only under `--force`. */
export const writableStates = (force: boolean): ReadonlySet<FileState> =>
  new Set<FileState>(force ? ['missing', 'stale', 'edited'] : ['missing', 'stale'])

/**
 * The agent files' share of a plan, classified exactly as skill files are.
 * `files` is `undefined` for a target that holds no agent file (`agents`):
 * that plans nothing and reads nothing, the manifest's `agents` list included.
 */
export const planAgentFiles = async (
  dir: string,
  files: readonly CatalogueFile[] | undefined,
  manifest: Manifest | undefined,
  writable: ReadonlySet<FileState>
): Promise<AgentPlan> => {
  const listed = manifest?.agents
  const paths = [...(files ?? []).map(({ path }) => path), ...(listed?.keys() ?? [])]
  if (files === undefined || paths.length === 0) {
    return { writes: [], removals: [], kept: [], edited: [], findings: [] }
  }
  const states = await classifyAll(files, dir, listed)
  const retired = await planRetired(dir, files, listed)
  const links = await agentSymlinkFindings(dir, paths)
  return {
    writes: states.filter(({ state }) => writable.has(state)).map(({ file }) => file),
    removals: retired.removals,
    kept: retired.kept.map((path) => `${AGENT_LABEL}/${path}`),
    edited: keptEdited(states, writable),
    findings: [
      ...links.map((link) => ({ state: 'symlink' as const, ...link })),
      ...states.flatMap(({ file, state }) =>
        state === 'current' ? [] : [asAgentFinding(state, file.path)]
      ),
      ...retired.removals.map((path) => asAgentFinding('retired', path)),
    ],
  }
}

/** The paths of edited files a run keeps: every `edited` one, unless `--force` makes it writable. */
export const keptEdited = (
  states: readonly { readonly file: CatalogueFile; readonly state: FileState }[],
  writable: ReadonlySet<FileState>
): readonly string[] =>
  states
    .filter(({ state }) => state === 'edited' && !writable.has(state))
    .map(({ file }) => file.path)

/**
 * The manifest entries one run records for `files`: each file's shipped digest,
 * except a `kept` (edited, unforced) file, which keeps the digest Sovrium
 * recorded before — so the next run still tells the edit from Sovrium's file
 * and names it again, instead of adopting the person's bytes.
 */
export const recordedKeeping = (
  files: readonly CatalogueFile[],
  kept: readonly string[],
  listed: ReadonlyMap<string, string> | undefined
): readonly ManifestEntry[] =>
  files.map((file) => {
    const previous = kept.includes(file.path) ? listed?.get(file.path) : undefined
    return { path: file.path, sha256: previous ?? file.sha256 }
  })

/** A manifest list: the entries already recorded, with `written` replacing any of the same path. */
export const recordedWith = (
  recorded: ReadonlyMap<string, string> | undefined,
  written: readonly CatalogueFile[]
): readonly ManifestEntry[] => [
  ...[...(recorded ?? new Map<string, string>())]
    .filter(([path]) => !written.some((file) => file.path === path))
    .map(([path, sha256]) => ({ path, sha256 })),
  ...written,
]

/** The agent directory beside a skills directory: `<project>/.claude/skills` → `<project>/.claude/agents`. */
export const agentDirFor = (planDir: string): string =>
  join(dirname(dirname(planDir)), ...AGENT_SEGMENTS)

/** The binary's agent files, as this version writes them: the source bytes, sorted by path. */
export const loadAgentCatalogue = async (): Promise<readonly CatalogueFile[]> => {
  const loader = await import('@/infrastructure/assets/embedded-skills')
  const files = await Promise.all(
    loader.embeddedAgentNames().map(async (name): Promise<CatalogueFile> => {
      const content = await loader.readEmbeddedAgentFile(name)
      return { path: `${name}.md`, content, sha256: sha256Of(content) }
    })
  )
  return files.toSorted(byPath)
}

/**
 * Every symlink a run would write or delete an agent file through: the agent
 * directory itself, or any of `paths` inside it. A linked `[internal ref]` is
 * refused whole — unlike the skills root, no layout needs to share it.
 */
export const agentSymlinkFindings = async (
  dir: string,
  paths: readonly string[]
): Promise<readonly { readonly path: string; readonly label: string }[]> => {
  if ((await entryKind(dir)) === 'link') return [{ path: '', label: `${AGENT_LABEL}/` }]
  const kinds = await Promise.all(
    [...new Set(paths)].map(async (path) => ({ path, kind: await entryKind(join(dir, path)) }))
  )
  return kinds
    .filter(({ kind }) => kind === 'link')
    .map(({ path }) => ({ path, label: `${AGENT_LABEL}/${path}` }))
    .toSorted(byPath)
}

/**
 * The agent files `sovrium init` may add, ADD-ONLY: none when `[internal ref]`
 * is a symlink (dangling or not), and never one whose file already exists —
 * it may be the person's own. Each skip is said on stderr.
 */
export const agentWritesForScaffold = async (
  dir: string,
  files: readonly CatalogueFile[]
): Promise<readonly CatalogueFile[]> => {
  if (files.length === 0) return []
  if ((await entryKind(dir)) === 'link') {
    printStderr(
      `Skipped the config editor agent: ${AGENT_LABEL} is a symlink, and Sovrium never writes through one.`
    )
    return []
  }
  const kinds = await Promise.all(
    files.map(async (file) => ({ file, kind: await entryKind(join(dir, file.path)) }))
  )
  for (const { file } of kinds.filter(({ kind }) => kind !== 'absent')) {
    printStderr(
      `Kept ${AGENT_LABEL}/${file.path}: sovrium init never replaces a file that is already there; ` +
        'run sovrium skills to compare it with this version.'
    )
  }
  return kinds.filter(({ kind }) => kind === 'absent').map(({ file }) => file)
}

/** The manifest's raw text in `dir`, or `undefined` when there is none. */
export const readManifestText = async (dir: string): Promise<string | undefined> =>
  (await entryKind(join(dir, MANIFEST_FILENAME))) === 'file'
    ? readFile(join(dir, MANIFEST_FILENAME), 'utf-8').catch(() => undefined)
    : undefined

/** The well-formed entries of one manifest list whose path `owned` accepts. */
const ownedEntries = (list: unknown, owned: RegExp): ReadonlyMap<string, string> =>
  new Map(
    (Array.isArray(list) ? (list as readonly unknown[]) : []).flatMap(
      (entry): readonly [string, string][] => {
        const candidate = entry as Partial<ManifestEntry> | null
        return typeof candidate?.path === 'string' &&
          typeof candidate.sha256 === 'string' &&
          owned.test(candidate.path)
          ? [[candidate.path, candidate.sha256]]
          : []
      }
    )
  )

/**
 * A manifest's text, parsed. `undefined` when there is none; a throw when
 * there is one this version cannot read, because guessing at the ownership of
 * a person's files is worse than stopping. A missing `agents` list is empty.
 */
export const parseManifest = (dir: string, text: string | undefined): Manifest | undefined => {
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
  return {
    files: ownedEntries(files, OWNED_PATH),
    agents: ownedEntries('agents' in record ? record.agents : undefined, AGENT_OWNED_PATH),
  }
}

/**
 * The manifest text one run records. `agents` is written only when given —
 * the `claude` target always gives it, the `agents` target never does.
 */
export const renderManifest = (
  version: string,
  target: string,
  files: readonly ManifestEntry[],
  agents?: readonly ManifestEntry[]
): string => {
  const entries = (list: readonly ManifestEntry[]): readonly ManifestEntry[] =>
    list.toSorted(byPath).map(({ path, sha256 }) => ({ path, sha256 }))
  return `${JSON.stringify(
    {
      format: 'sovrium-skills',
      schemaVersion: 1,
      engine: version,
      target,
      files: entries(files),
      ...(agents === undefined ? {} : { agents: entries(agents) }),
    },
    undefined,
    2
  )}\n`
}
