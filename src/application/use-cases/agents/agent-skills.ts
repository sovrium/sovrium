/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The agent-facing reads over an app's agent skills (`agents[].skills`).
 *
 * Three reads, one per step of progressive disclosure:
 *
 * 1. {@link listAgentSkills} — every skill's name and description, for the
 *    index the agent carries from its first turn. Reads no file.
 * 2. {@link loadAgentSkill} — one skill's `SKILL.md` body and the paths of the
 *    files beside it, when the agent decides to use the skill.
 * 3. {@link loadSkillReference} — one of those files, by the path the body
 *    gives.
 *
 * The agent runtime registers them as its built-in `load_skill` tool, whose
 * arguments are `{ name }` for step 2 and `{ name, path }` for step 3. A
 * refusal ({@link AgentSkillLoadError}) is meant to become the tool's result,
 * not to end the turn: its message says what was refused and why, in words a
 * model can act on.
 *
 * Each read is scoped by the agent's NAME. The index was built at boot from
 * that agent's own declaration, so a skill another agent lists is refused as
 * `not-listed`, and a path that leaves the skill's directory as
 * `outside-skill`.
 */

import { Effect } from 'effect'
import {
  AgentSkills,
  type AgentSkillLoadError,
  type AgentSkillSummary,
  type LoadedAgentSkill,
} from '@/application/ports/services/agent-skills'

/** The agent a read is for. Only its name is read; any agent value fits. */
interface SkilledAgent {
  readonly name: string
}

/**
 * The agent's skills, by name and description, in declaration order. `[]`
 * for an agent that lists none.
 *
 * @public — consumed by the agent runtime's system-prompt index.
 */
export const listAgentSkills = (agent: SkilledAgent): Effect.Effect<readonly AgentSkillSummary[]> =>
  Effect.gen(function* () {
    const skills = yield* AgentSkills
    return skills.list(agent.name)
  }).pipe(Effect.withSpan('agents.list-skills', { attributes: { agent: agent.name } }))

/**
 * One of the agent's skills: its `SKILL.md` body and the files beside it.
 *
 * @public — consumed by the agent runtime's `load_skill` tool.
 */
export const loadAgentSkill = (
  agent: SkilledAgent,
  skillName: string
): Effect.Effect<LoadedAgentSkill, AgentSkillLoadError> =>
  Effect.gen(function* () {
    const skills = yield* AgentSkills
    return yield* skills.load(agent.name, skillName)
  }).pipe(
    Effect.withSpan('agents.load-skill', { attributes: { agent: agent.name, skill: skillName } })
  )

/**
 * One file inside one of the agent's skills, by its `/`-separated path inside
 * the skill directory (`references/discount-grid.md`).
 *
 * @public — consumed by the agent runtime's `load_skill` tool.
 */
export const loadSkillReference = (
  agent: SkilledAgent,
  skillName: string,
  path: string
): Effect.Effect<string, AgentSkillLoadError> =>
  Effect.gen(function* () {
    const skills = yield* AgentSkills
    return yield* skills.loadReference(agent.name, skillName, path)
  }).pipe(
    Effect.withSpan('agents.load-skill-reference', {
      attributes: { agent: agent.name, skill: skillName },
    })
  )
