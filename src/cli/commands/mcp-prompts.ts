/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ProtocolError, type Server } from '@modelcontextprotocol/server'
import {
  PROJECT_BRIEF_FILES,
  composeProjectBrief,
  describeSkippedBriefFile,
  type ProjectBrief,
} from '@/cli/commands/mcp-project-brief'
import { printStderr } from '@/infrastructure/logging/cli-output'

/**
 * The binary's agent skills, served as MCP `prompts` over stdio.
 *
 * Claude Desktop has no shell to run `sovrium skills` and does not read skill
 * folders from a project, so the stdio server hands it the same `SKILL.md`
 * text as prompts: `prompts/list` names one per skill, `prompts/get` returns
 * its body as a single `user` message. Read-only by construction — these
 * handlers read no configuration and write nothing, so they answer in an
 * empty directory and with config writing switched off. Stdio only: the HTTP
 * mount declares no prompts ([internal ref] A8).
 *
 * The body is what `sovrium skills` writes, minus the frontmatter a harness
 * reads to decide whether to load a skill — a prompt has no loader. Its
 * `references/` are not served: a prompt is one message, and the body is
 * written to stand on its own.
 *
 * Beside the skills, the project's OWN brief: a root `PROMPT.md` and/or
 * `CLAUDE.md` (what a starter ships for the AI that builds it) is offered as
 * the `project-brief` prompt. It is read from disk on every `prompts/list` and
 * `prompts/get`, so an edit shows without a restart and `listChanged` can stay
 * false; with neither file it is absent, exactly like an unknown name.
 *
 * The skills payload is reached by `await import()` inside each handler,
 * never at the top of this module: `mcp.ts` imports this file, and a session
 * that never asks for a prompt must not pay for the payload
 * (`embedded-skills-boot.test.ts`).
 */

/** JSON-RPC `Invalid params` — an unknown prompt name is a bad argument, not a bad method. */
const INVALID_PARAMS = -32_602

const loadSkills = async () => import('@/infrastructure/assets/embedded-skills')

/** The prompt name the project's own brief is served under. */
const PROJECT_BRIEF_PROMPT = 'project-brief'

const readBriefFile = async (projectDir: string, name: string) => {
  try {
    return { name, bytes: new Uint8Array(await readFile(join(projectDir, name))) }
  } catch {
    // Absent, a directory, unreadable: not a brief file, and not a fault.
    return undefined
  }
}

/** Read the brief afresh; each skipped file earns one stderr line, never stdout. */
const readProjectBrief = async (projectDir: string): Promise<ProjectBrief | undefined> => {
  const files = await Promise.all(
    PROJECT_BRIEF_FILES.map(async (name) => readBriefFile(projectDir, name))
  )
  const { brief, skipped } = composeProjectBrief(files.filter((file) => file !== undefined))
  skipped.forEach((skip) => printStderr(describeSkippedBriefFile(skip)))
  return brief
}

export const registerSkillPrompts = (server: Server, projectDir: string): void => {
  server.setRequestHandler('prompts/list', async () => {
    const skills = await loadSkills()
    const prompts = await Promise.all(
      skills.embeddedSkillNames().map(async (name) => ({
        name,
        description: (await skills.readEmbeddedSkillFrontmatter(name)).description,
      }))
    )
    const brief = await readProjectBrief(projectDir)
    const listed = brief
      ? [...prompts, { name: PROJECT_BRIEF_PROMPT, description: brief.description }]
      : prompts
    return { prompts: listed } as never
  })

  server.setRequestHandler('prompts/get', async (request) => {
    const { params } = request as { readonly params?: { readonly name?: unknown } }
    const name = typeof params?.name === 'string' ? params.name : ''
    const brief = name === PROJECT_BRIEF_PROMPT ? await readProjectBrief(projectDir) : undefined
    if (brief) {
      return {
        description: brief.description,
        messages: [{ role: 'user', content: { type: 'text', text: brief.text } }],
      } as never
    }
    const skills = await loadSkills()
    const known = skills.embeddedSkillNames()
    if (!known.includes(name)) {
      throw new ProtocolError(
        INVALID_PARAMS,
        `Unknown prompt: ${name || '(none)'}. Known prompts: ${known.join(', ')}.`
      )
    }
    const { description, body } = await skills.readEmbeddedSkillFrontmatter(name)
    return {
      description,
      messages: [{ role: 'user', content: { type: 'text', text: body } }],
    } as never
  })
}
