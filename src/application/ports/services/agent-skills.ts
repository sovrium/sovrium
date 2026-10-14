/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data, Effect } from 'effect'

/** What an agent always knows of one of its skills: its name and what it is for. */
export interface AgentSkillSummary {
  readonly name: string
  readonly description: string
}

/** A skill, loaded: its `SKILL.md` body and the files beside it it may point to. */
export interface LoadedAgentSkill extends AgentSkillSummary {
  /** The `SKILL.md` body, frontmatter removed. */
  readonly body: string
  /**
   * Every other file in the skill's directory, as `/`-separated paths inside it
   * (`references/discount-grid.md`) — the paths `loadReference` accepts.
   */
  readonly references: readonly string[]
}

/**
 * Why a skill or one of its files could not be handed to an agent.
 *
 * - `not-listed`: the agent does not list a skill by that name.
 * - `outside-skill`: the path is not a file inside the skill's directory.
 * - `not-found`: no such file in the skill (or the skill vanished since boot).
 * - `too-large`: the file is over the size cap.
 * - `unreadable`: the filesystem refused the read, or the file is not text.
 *
 * The message is written for the model as much as for a log: it says what was
 * refused and why, never where on disk the project lives.
 */
export class AgentSkillLoadError extends Data.TaggedError('AgentSkillLoadError')<{
  readonly reason: 'not-listed' | 'outside-skill' | 'not-found' | 'too-large' | 'unreadable'
  readonly message: string
}> {}

/**
 * The skills the running app gave its agents (`agents[].skills`), indexed and
 * checked at boot: every listed directory holds a `SKILL.md` whose frontmatter
 * declares a `name` and a `description`, inside the project directory.
 *
 * Disclosure is progressive. `list` answers from the boot index and reads
 * nothing; `load` and `loadReference` read the file when asked, so a skill
 * costs an agent its name and description until it is used.
 *
 * Every method is scoped by AGENT NAME: an agent reaches only the skills its
 * own declaration lists, and a name another agent lists is `not-listed`.
 */
export interface AgentSkillsShape {
  /** The agent's skills, in declaration order; `[]` for an agent with none. */
  readonly list: (agentName: string) => readonly AgentSkillSummary[]
  /** One of the agent's skills, by the `name` its frontmatter declares. */
  readonly load: (
    agentName: string,
    skillName: string
  ) => Effect.Effect<LoadedAgentSkill, AgentSkillLoadError>
  /** One file inside one of the agent's skills, by its path inside the skill. */
  readonly loadReference: (
    agentName: string,
    skillName: string,
    path: string
  ) => Effect.Effect<string, AgentSkillLoadError>
}

/** No skills: a process that loaded none (a unit test, a config whose agents list none). */
const NO_AGENT_SKILLS: AgentSkillsShape = {
  list: () => [],
  load: (agentName, skillName) =>
    Effect.fail(
      new AgentSkillLoadError({
        reason: 'not-listed',
        message: `'${skillName}' is not one of this agent's skills (agent '${agentName}' lists none).`,
      })
    ),
  loadReference: (agentName, skillName) =>
    Effect.fail(
      new AgentSkillLoadError({
        reason: 'not-listed',
        message: `'${skillName}' is not one of this agent's skills (agent '${agentName}' lists none).`,
      })
    ),
}

/**
 * The agent skills of the running server. A `Reference`, so a context that
 * loaded none (unit tests, a config-less harness) reads an empty index rather
 * than failing to resolve a service; the server's domain runtime provides the
 * index its boot loaded.
 */
export const AgentSkills = Context.Reference<AgentSkillsShape>('AgentSkills', {
  defaultValue: () => NO_AGENT_SKILLS,
})
