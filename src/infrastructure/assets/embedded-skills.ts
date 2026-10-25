/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Typed accessors over the generated Agent Skills payload ([internal ref] A2).
 *
 * The generated module is `@ts-nocheck`, because a `with { type: 'file' }`
 * import has no static type; this module re-types it and is the only place
 * that cast is written.
 *
 * ## Read it lazily
 *
 * NOTHING on the boot path may import this module, and neither may the top of
 * `src/cli/commands/mcp.ts`: `sovrium init`, `sovrium skills` and the MCP
 * prompt handlers reach it through an `await import()` at the point of use.
 * `embedded-skills-boot.test.ts` holds both halves with a child-process probe.
 *
 * ## Why there is no `$bunfs` reverse lookup here
 *
 * The manual's reader (`embedded-docs.ts`) accepts an embedded VALUE as well as
 * a key, because its caller is a typed section manifest holding a `body` that
 * is itself a file import — inside the compiled binary that is a directory-less
 * `/$bunfs/root/<name>-<hash>.md`, so the reader has to map it back. Nothing
 * here has that shape. Every caller addresses a skill file by the two KEYS the
 * payload is built from — the skill's name and the file's path inside it — and
 * `Bun.file()` reads the value those keys resolve to, a real path in dev and a
 * `$bunfs` path in the binary alike. So there is no value to map back, and the
 * content-hash collision the manual has to refuse (two byte-identical files
 * sharing one `$bunfs` path) cannot misroute a read: two keys holding the same
 * bytes still answer the same bytes.
 */

import {
  parseSkillFrontmatter,
  SKILL_FRONTMATTER_BLOCK,
} from '@/domain/kernel/markdown/skill-frontmatter'
import {
  EMBEDDED_AGENT_FILES as RAW_AGENTS,
  EMBEDDED_SKILLS as RAW_SKILLS,
} from './embedded-skills.generated'

// `with { type: 'file' }` imports return a path string at runtime while TS types
// them as the imported module's shape. Cast through `unknown` to recover the
// true runtime type — the same recovery `embedded-docs.ts` makes.
const SKILLS = RAW_SKILLS as Readonly<Record<string, Readonly<Record<string, string>>>>
const AGENTS = RAW_AGENTS as Readonly<Record<string, string>>

/** The name, description and metadata a skill's frontmatter declares, plus its body. */
export interface EmbeddedSkillFrontmatter {
  readonly name: string
  readonly description: string
  readonly metadata: Readonly<Record<string, unknown>>
  /** Everything after the closing `---` of the frontmatter block. */
  readonly body: string
}

/** Every skill the binary ships, sorted. */
export const embeddedSkillNames = (): readonly string[] => Object.keys(SKILLS).toSorted()

/** Every file one skill ships, as paths inside the skill (`SKILL.md`, `references/x.md`). */
export const embeddedSkillFiles = (name: string): readonly string[] =>
  Object.keys(SKILLS[name] ?? {}).toSorted()

/**
 * One skill file's text, by the skill's name and the file's path inside it.
 *
 * Refuses an unknown skill or file BY NAME rather than returning an empty
 * string: a caller that asked for a file the payload does not hold has diverged
 * from the payload, and writing an empty `SKILL.md` into a user's project would
 * install a skill no host can load.
 */
export const readEmbeddedSkillFile = async (name: string, relPath: string): Promise<string> => {
  const embedded = SKILLS[name]?.[relPath]
  if (embedded === undefined) {
    const known = SKILLS[name] === undefined ? embeddedSkillNames() : embeddedSkillFiles(name)
    throw new Error(
      `No embedded skill file '${name}/${relPath}'. Known: ${known.join(', ')}. ` +
        'Regenerate with `bun run build:skills` if a skill file was added or moved.'
    )
  }
  return Bun.file(embedded).text()
}

/**
 * Every agent file the binary ships ([internal ref] A2.9), by its published name, sorted.
 *
 * An agent file is a Claude Code subagent projecting the whole skill set, kept
 * apart from {@link embeddedSkillNames} on purpose: everything that lists
 * skills (the MCP prompt list, the skills catalogue) must never see it.
 */
export const embeddedAgentNames = (): readonly string[] => Object.keys(AGENTS).toSorted()

/**
 * One agent file's text, by its published name.
 *
 * Refuses an unknown name BY NAME, for the reason {@link readEmbeddedSkillFile}
 * does. Never stamped with a product version: its frontmatter is a subagent's,
 * which has no `metadata` block, and the bytes a user receives are the source's.
 */
export const readEmbeddedAgentFile = async (name: string): Promise<string> => {
  const embedded = AGENTS[name]
  if (embedded === undefined) {
    throw new Error(
      `No embedded agent file '${name}'. Known: ${embeddedAgentNames().join(', ') || 'none'}. ` +
        'Regenerate with `bun run build:skills` if an agent file was added or moved.'
    )
  }
  return Bun.file(embedded).text()
}

/**
 * A skill's frontmatter, parsed, and its body without it.
 *
 * Throws on a `SKILL.md` without a frontmatter block, or one missing its
 * `name`/`description` — the two keys every host reads to decide whether to
 * load the skill at all. `metadata` is `{}` when absent. The parsing is the
 * one `parseSkillFrontmatter` an app's own agent skills are read with.
 */
export const readEmbeddedSkillFrontmatter = async (
  name: string
): Promise<EmbeddedSkillFrontmatter> => {
  const parsed = parseSkillFrontmatter(await readEmbeddedSkillFile(name, 'SKILL.md'))
  if (!parsed.ok) {
    throw new Error(
      `Embedded skill '${name}' has no readable frontmatter: SKILL.md must open with a ` +
        '`---` block declaring `name` and `description`.'
    )
  }
  return parsed.skill
}

/** One `key: value` line of a YAML mapping, at an exact indent. */
const PRODUCT_VERSION_LINE = /^[ \t]+product-version:.*$/

/**
 * `metadata.product-version` stamped with the running binary's version.
 *
 * The SOURCE of a skill carries no product version, on purpose: a literal in
 * the tree would go stale on every release and turn the generated-assets gate
 * red. The version belongs to the copy a user receives, so the one place that
 * writes a copy — `sovrium skills` — stamps it from the binary it runs in,
 * through this helper, and nothing else invents one.
 *
 * Pure. Replaces an existing `product-version` line under `metadata`, adds one
 * as the block's first entry when `metadata` has none, and adds a whole
 * `metadata` block at the end of the frontmatter when there is none. Returns
 * the input untouched when there is no frontmatter at all — a file with no
 * header is not a skill, and fabricating one here would hide that.
 */
export const stampProductVersion = (skillMarkdown: string, version: string): string => {
  const match = SKILL_FRONTMATTER_BLOCK.exec(skillMarkdown)
  if (match === null) return skillMarkdown
  const lines = (match[1] ?? '').split(/\r?\n/)
  const stamp = `product-version: ${JSON.stringify(version)}`
  const metadataAt = lines.findIndex((line) => /^metadata:\s*$/.test(line))
  const stamped = ((): readonly string[] => {
    if (metadataAt === -1) return [...lines, 'metadata:', `  ${stamp}`]
    const blockEnd = lines.findIndex((line, at) => at > metadataAt && !/^[ \t]/.test(line))
    const end = blockEnd === -1 ? lines.length : blockEnd
    const existing = lines.findIndex(
      (line, at) => at > metadataAt && at < end && PRODUCT_VERSION_LINE.test(line)
    )
    const indent = /^([ \t]+)/.exec(lines[metadataAt + 1] ?? '')?.[1] ?? '  '
    return existing === -1
      ? [...lines.slice(0, metadataAt + 1), `${indent}${stamp}`, ...lines.slice(metadataAt + 1)]
      : lines.map((line, at) => (at === existing ? `${indent}${stamp}` : line))
  })()
  return `---\n${stamped.join('\n')}\n---\n${skillMarkdown.slice(match[0].length)}`
}
