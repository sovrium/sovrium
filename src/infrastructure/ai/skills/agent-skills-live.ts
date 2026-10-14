/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { realpath, stat } from 'node:fs/promises'
import { join, sep } from 'node:path'
import { Effect } from 'effect'
import {
  AgentSkillLoadError,
  type AgentSkillsShape,
  type LoadedAgentSkill,
} from '@/application/ports/services/agent-skills'
import {
  describeSkillFrontmatterProblem,
  parseSkillFrontmatter,
} from '@/domain/kernel/markdown/skill-frontmatter'
import { isContainedPath } from '@/domain/models/app/asset-path'

/**
 * Reading the skills an app gives its agents (`agents[].skills`): the boot
 * index, and the on-demand reads behind the agent's `load_skill` tool.
 *
 * A skill path's spelling was already checked by the schema (relative, `/`, no
 * `..`). What only the filesystem can say is checked here, at boot: the
 * directory resolves — symbolic links followed — inside the project directory,
 * it holds a `SKILL.md` of at most {@link SKILL_FILE_MAX_BYTES}, and that file's
 * frontmatter declares a `name` and a `description` in the Agent Skills format
 * (the same parser the binary's own skills are read with).
 *
 * After boot, the body and the files beside it are read when asked, so an edit
 * to a skill's text reaches the next load without a restart. Every read is
 * re-contained: a path that leaves the skill directory, by its spelling or
 * through a symbolic link, is refused rather than followed.
 */

/** Largest `SKILL.md` accepted: the whole body goes to the model in one tool result. */
export const SKILL_FILE_MAX_BYTES = 128 * 1024

/** Largest reference file handed to the model in one load. */
export const SKILL_REFERENCE_MAX_BYTES = 256 * 1024

/** Most reference paths listed for one skill; a larger tree is truncated, not refused. */
const MAX_LISTED_REFERENCES = 200

/** The Agent Skills naming rule: lowercase kebab-case, at most 64 characters. */
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SKILL_NAME_MAX = 64
const SKILL_DESCRIPTION_MAX = 1024

/** The part of an agent declaration this module reads. */
interface SkilledAgentDeclaration {
  readonly name: string
  readonly skills?: readonly string[]
}

/** One skill of one agent, as the boot index holds it. */
interface IndexedSkill {
  readonly name: string
  readonly description: string
  /** The path as declared, for messages. */
  readonly path: string
  /** The skill directory's real path. */
  readonly dir: string
}

/** Whether `path` sits strictly beneath `dir`. */
const isBeneath = (path: string, dir: string): boolean => path.startsWith(dir + sep)

const realpathOrUndefined = (path: string): Promise<string | undefined> =>
  realpath(path).catch(() => undefined)

type Checked =
  | { readonly ok: true; readonly skill: IndexedSkill }
  | { readonly ok: false; readonly issue: string }

/** Why a parsed skill's name or description breaks the Agent Skills format. */
const formatIssue = (file: string, name: string, description: string): string | undefined => {
  if (!SKILL_NAME.test(name) || name.length > SKILL_NAME_MAX) {
    return `${file} declares the name ${JSON.stringify(name)}; a skill name is lowercase kebab-case, at most ${SKILL_NAME_MAX} characters`
  }
  if (description.length > SKILL_DESCRIPTION_MAX) {
    return `${file} has a description over ${SKILL_DESCRIPTION_MAX} characters`
  }
  return undefined
}

/** Check one listed skill directory and index it. */
const checkSkill = async (path: string, root: string): Promise<Checked> => {
  const file = `${path}/SKILL.md`
  const fail = (issue: string): Checked => ({ ok: false, issue })
  const dir = await realpathOrUndefined(join(root, path))
  if (dir === undefined) return fail(`${file} does not exist: the skill directory is missing`)
  if (!isBeneath(dir, root)) {
    return fail(`skill directory ${path} resolves outside the project directory`)
  }
  const resolved = await realpathOrUndefined(join(dir, 'SKILL.md'))
  if (resolved === undefined) return fail(`${file} does not exist`)
  const info = await stat(resolved).catch(() => undefined)
  if (!isBeneath(resolved, dir) || info === undefined || !info.isFile()) {
    return fail(`${file} is not a file inside the skill directory`)
  }
  if (info.size > SKILL_FILE_MAX_BYTES) {
    return fail(`${file} is over ${SKILL_FILE_MAX_BYTES / 1024} KB`)
  }
  const parsed = parseSkillFrontmatter(await Bun.file(resolved).text())
  if (!parsed.ok) return fail(`${file} ${describeSkillFrontmatterProblem(parsed.problem)}`)
  const { name, description } = parsed.skill
  const misformatted = formatIssue(file, name, description)
  if (misformatted !== undefined) return fail(misformatted)
  return { ok: true, skill: { name, description, path, dir } }
}

/** Index one agent's skills; every problem is reported, prefixed with the agent. */
const indexAgent = async (
  agent: SkilledAgentDeclaration,
  root: string
): Promise<{ readonly skills: readonly IndexedSkill[]; readonly issues: readonly string[] }> => {
  const checked = await Promise.all((agent.skills ?? []).map((path) => checkSkill(path, root)))
  const skills = checked.flatMap((c) => (c.ok ? [c.skill] : []))
  const duplicates = skills.filter(
    (skill, index) => skills.findIndex((other) => other.name === skill.name) !== index
  )
  const issues = [
    ...checked.flatMap((c) => (c.ok ? [] : [c.issue])),
    ...duplicates.map(
      (skill) =>
        `${skill.path}/SKILL.md declares the name '${skill.name}', which another of this agent's skills already uses`
    ),
  ]
  return { skills, issues: issues.map((issue) => `agent '${agent.name}': ${issue}`) }
}

const refuse = (reason: AgentSkillLoadError['reason'], message: string) =>
  Effect.fail(new AgentSkillLoadError({ reason, message }))

/** Read a contained file as UTF-8 text, under a size cap. */
const readContainedText = (
  dir: string,
  relPath: string,
  maxBytes: number,
  label: string
): Effect.Effect<string, AgentSkillLoadError> =>
  Effect.gen(function* () {
    const read = Effect.tryPromise({
      try: async () => {
        const resolved = await realpathOrUndefined(join(dir, relPath))
        if (resolved === undefined) return { kind: 'missing' } as const
        if (!isBeneath(resolved, dir)) return { kind: 'outside' } as const
        const info = await stat(resolved)
        if (!info.isFile()) return { kind: 'missing' } as const
        if (info.size > maxBytes) return { kind: 'large' } as const
        const bytes = new Uint8Array(await Bun.file(resolved).arrayBuffer())
        return { kind: 'read', bytes } as const
      },
      catch: () =>
        new AgentSkillLoadError({ reason: 'unreadable', message: `${label} could not be read.` }),
    })
    const outcome = yield* read
    switch (outcome.kind) {
      case 'missing':
        return yield* refuse('not-found', `${label} does not exist.`)
      case 'outside':
        return yield* refuse('outside-skill', `${label} is outside the skill.`)
      case 'large':
        return yield* refuse('too-large', `${label} is over ${maxBytes / 1024} KB.`)
      case 'read':
        return yield* Effect.try({
          try: () => new TextDecoder('utf-8', { fatal: true }).decode(outcome.bytes),
          catch: () =>
            new AgentSkillLoadError({ reason: 'unreadable', message: `${label} is not text.` }),
        })
    }
  })

/** Every file in a skill directory but `SKILL.md`, `/`-separated, sorted, capped. */
const listReferences = (dir: string): Effect.Effect<readonly string[], AgentSkillLoadError> =>
  Effect.tryPromise({
    try: () =>
      Array.fromAsync(new Bun.Glob('**/*').scan({ cwd: dir, onlyFiles: true, dot: false })),
    catch: () =>
      new AgentSkillLoadError({
        reason: 'unreadable',
        message: 'The skill directory could not be listed.',
      }),
  }).pipe(
    Effect.map((paths) =>
      paths
        .map((path) => path.split(sep).join('/'))
        .filter((path) => path !== 'SKILL.md')
        .toSorted()
        .slice(0, MAX_LISTED_REFERENCES)
    )
  )

/** The store over a boot index: `list` from memory, `load*` from disk. */
const storeFor = (index: ReadonlyMap<string, readonly IndexedSkill[]>): AgentSkillsShape => {
  const find = (agentName: string, skillName: string) => {
    const skills = index.get(agentName) ?? []
    const skill = skills.find((candidate) => candidate.name === skillName)
    if (skill !== undefined) return Effect.succeed(skill)
    const known = skills.map((candidate) => candidate.name).join(', ')
    return refuse(
      'not-listed',
      `'${skillName}' is not one of this agent's skills. ${known === '' ? 'This agent has no skills.' : `Its skills are: ${known}.`}`
    )
  }
  return {
    list: (agentName) =>
      (index.get(agentName) ?? []).map(({ name, description }) => ({ name, description })),
    load: (agentName, skillName) =>
      Effect.gen(function* () {
        const skill = yield* find(agentName, skillName)
        const label = `The SKILL.md of skill '${skill.name}'`
        const text = yield* readContainedText(skill.dir, 'SKILL.md', SKILL_FILE_MAX_BYTES, label)
        const parsed = parseSkillFrontmatter(text)
        if (!parsed.ok) {
          return yield* refuse(
            'unreadable',
            `${label} ${describeSkillFrontmatterProblem(parsed.problem)}.`
          )
        }
        const references = yield* listReferences(skill.dir)
        const loaded: LoadedAgentSkill = {
          name: skill.name,
          description: skill.description,
          body: parsed.skill.body,
          references,
        }
        return loaded
      }),
    loadReference: (agentName, skillName, path) =>
      Effect.gen(function* () {
        const skill = yield* find(agentName, skillName)
        if (!isContainedPath(path)) {
          return yield* refuse(
            'outside-skill',
            `${JSON.stringify(path)} is outside the skill '${skill.name}': a reference path is relative to the skill's directory, uses '/', and has no '..' segment.`
          )
        }
        const label = `${JSON.stringify(path)} in skill '${skill.name}'`
        return yield* readContainedText(skill.dir, path, SKILL_REFERENCE_MAX_BYTES, label)
      }),
  }
}

/** What indexing an app's agent skills produced: the store, or every reason it could not. */
export type AgentSkillsLoadOutcome =
  | { readonly ok: true; readonly store: AgentSkillsShape }
  | { readonly ok: false; readonly issues: readonly string[] }

/**
 * Index every skill every agent lists. All problems are reported together, so
 * one boot names every file to fix. `projectDir` is the directory skill paths
 * resolve against: the config's, or the working directory for an inline one.
 */
export const loadAgentSkills = async (
  agents: readonly SkilledAgentDeclaration[] | undefined,
  projectDir: string
): Promise<AgentSkillsLoadOutcome> => {
  const declaring = (agents ?? []).filter((agent) => (agent.skills ?? []).length > 0)
  const root = await realpath(projectDir).catch(() => projectDir)
  const indexed = await Promise.all(declaring.map((agent) => indexAgent(agent, root)))
  const issues = indexed.flatMap((entry) => entry.issues)
  if (issues.length > 0) return { ok: false, issues }
  return {
    ok: true,
    store: storeFor(
      new Map(declaring.map((agent, position) => [agent.name, indexed[position]?.skills ?? []]))
    ),
  }
}
