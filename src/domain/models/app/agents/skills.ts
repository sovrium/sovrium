/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { isContainedPath } from '../asset-path'

/**
 * One skill directory an agent may use, relative to the directory holding the
 * config (or to the working directory when the config is passed inline).
 *
 * The spelling is checked here: relative, `/`-separated, no `..` or empty
 * segment, no backslash — the same rule a private asset's path follows. Where
 * the directory really leads (a symbolic link out of the project) and whether
 * it holds a readable `SKILL.md` is checked against the filesystem when the
 * app starts.
 *
 * The description sits before the check: an annotation placed after a check
 * lands on the check rather than on the node the published schema documents.
 */
const AgentSkillPathSchema = Schema.String.pipe(
  Schema.annotate({
    description:
      "A skill directory holding a SKILL.md, written relative to the directory that holds the config with '/' (e.g. 'skills/quote-review'). It must stay inside the project: no leading '/', no '..' segment, no backslash.",
    examples: ['skills/quote-review'],
  }),
  Schema.check(
    Schema.makeFilter((path: string) =>
      isContainedPath(path)
        ? true
        : `skill path ${JSON.stringify(path)} must be relative to the config directory, use '/', and contain no '..' or empty segment`
    )
  )
)

/**
 * The skills an agent may load: written know-how, one directory each, in the
 * Agent Skills format (a `SKILL.md` with a `name` and a `description` in its
 * frontmatter, a Markdown body, optional reference files beside it).
 */
export const AgentSkillsSchema = Schema.Array(AgentSkillPathSchema).pipe(
  Schema.annotate({
    description:
      'The skill directories this agent may use. Each holds a SKILL.md whose frontmatter declares a name and a description. A listed directory whose SKILL.md is missing, or whose frontmatter lacks a name or a description, stops the boot with a message naming the file, and makes `sovrium validate` exit 1 with the same message.',
    defaultNote: 'none: the agent has no skills',
  }),
  Schema.check(Schema.isUnique({ message: 'skills must not list the same directory twice' }))
)

/** @public */
export type AgentSkills = typeof AgentSkillsSchema.Type
