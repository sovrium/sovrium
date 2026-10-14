/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What an agent's model sees of its skills (`agents[].skills`), and how a
 * loaded skill is handed back to it. Pure: the files are read by the skills
 * store; this module only decides the wording of the index, the `load_skill`
 * tool and its result.
 *
 * Disclosure is progressive. The index — every skill's name and description —
 * rides in the system prompt from the first request; a skill's body reaches
 * the model only when it calls `load_skill` with the skill's name, and a file
 * beside it only when it calls `load_skill` with the skill's name and the
 * file's path.
 */

import type { ChatToolDefinition } from './ai-chat-tools'

/** The built-in tool through which an agent reads its skills. */
export const LOAD_SKILL_TOOL_NAME = 'load_skill'

/** What the index says of one skill. */
export interface SkillIndexEntry {
  readonly name: string
  readonly description: string
}

/** A loaded skill, as the tool hands it back. */
export interface LoadedSkillContent {
  readonly body: string
  readonly references: readonly string[]
}

/**
 * The paragraph the system prompt gains for an agent with skills: what a skill
 * is, how to load one, then one line per skill, name and description only.
 * `undefined` for an agent with none.
 */
export const skillIndexText = (skills: readonly SkillIndexEntry[]): string | undefined =>
  skills.length === 0
    ? undefined
    : [
        '## Skills',
        '',
        `You have skills: instructions written for tasks you may be asked to do. Before such a task, load the skill with the \`${LOAD_SKILL_TOOL_NAME}\` tool and its name, then follow it. A skill may point to files beside it; load one with \`${LOAD_SKILL_TOOL_NAME}\`, the skill's name and the file's path.`,
        '',
        ...skills.map((skill) => `- ${skill.name}: ${skill.description}`),
      ].join('\n')

/** The `load_skill` definition, as advertised to the model. */
export const loadSkillToolDefinition = (): ChatToolDefinition => ({
  type: 'function',
  function: {
    name: LOAD_SKILL_TOOL_NAME,
    description:
      "Load one of your skills by its name, to read its instructions. With a path, load one of the files the skill's instructions point to instead.",
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The name of the skill, as the skills list gives it.',
        },
        path: {
          type: 'string',
          description:
            "A file inside the skill, by the path its instructions give (references/example.md). Leave out to load the skill's instructions.",
        },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
})

/** A `load_skill` call's arguments, read: a skill to load, or one of its files. */
export type LoadSkillRequest =
  | { readonly kind: 'skill'; readonly name: string }
  | { readonly kind: 'reference'; readonly name: string; readonly path: string }
  | { readonly kind: 'invalid'; readonly message: string }

/** Read a `load_skill` call's arguments; a missing or non-text `name` is invalid. */
export const parseLoadSkillArguments = (
  args: Readonly<Record<string, unknown>>
): LoadSkillRequest => {
  const { name, path } = args
  if (typeof name !== 'string' || name.trim() === '') {
    return { kind: 'invalid', message: 'load_skill needs the name of one of your skills.' }
  }
  if (path === undefined || path === null || path === '') return { kind: 'skill', name }
  if (typeof path !== 'string') {
    return { kind: 'invalid', message: 'load_skill takes the path of a file as text.' }
  }
  return { kind: 'reference', name, path }
}

/** What the model reads for a loaded skill: its body, then the files beside it. */
export const loadedSkillText = (skill: LoadedSkillContent): string =>
  skill.references.length === 0
    ? skill.body
    : [
        skill.body.trimEnd(),
        '',
        `Files in this skill (load one with ${LOAD_SKILL_TOOL_NAME}, this skill's name and the path):`,
        ...skill.references.map((path) => `- ${path}`),
      ].join('\n')
