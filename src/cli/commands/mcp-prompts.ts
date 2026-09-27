/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { ProtocolError, type Server } from '@modelcontextprotocol/server'

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
 * The skills payload is reached by `await import()` inside each handler,
 * never at the top of this module: `mcp.ts` imports this file, and a session
 * that never asks for a prompt must not pay for the payload
 * (`embedded-skills-boot.test.ts`).
 */

/** JSON-RPC `Invalid params` — an unknown prompt name is a bad argument, not a bad method. */
const INVALID_PARAMS = -32_602

const loadSkills = async () => import('@/infrastructure/assets/embedded-skills')

// eslint-disable-next-line functional/prefer-immutable-types -- `Server` is the SDK's own class; we neither own nor can annotate it
export const registerSkillPrompts = (server: Server): void => {
  server.setRequestHandler('prompts/list', async () => {
    const skills = await loadSkills()
    const prompts = await Promise.all(
      skills.embeddedSkillNames().map(async (name) => ({
        name,
        description: (await skills.readEmbeddedSkillFrontmatter(name)).description,
      }))
    )
    return { prompts } as unknown as never
  })

  server.setRequestHandler('prompts/get', async (request) => {
    const { params } = request as { readonly params?: { readonly name?: unknown } }
    const name = typeof params?.name === 'string' ? params.name : ''
    const skills = await loadSkills()
    const known = skills.embeddedSkillNames()
    if (!known.includes(name)) {
      // eslint-disable-next-line functional/no-throw-statements -- the SDK surfaces a JSON-RPC error member only via a thrown ProtocolError
      throw new ProtocolError(
        INVALID_PARAMS,
        `Unknown prompt: ${name || '(none)'}. Known prompts: ${known.join(', ')}.`
      )
    }
    const { description, body } = await skills.readEmbeddedSkillFrontmatter(name)
    return {
      description,
      messages: [{ role: 'user', content: { type: 'text', text: body } }],
    } as unknown as never
  })
}
