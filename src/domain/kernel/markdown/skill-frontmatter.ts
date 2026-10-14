/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Agent Skills file format: a `SKILL.md` that opens with a `---`-fenced
 * YAML block declaring a `name` and a `description`, followed by a Markdown
 * body.
 *
 * ONE parser for every reader of that format: the skills the binary ships
 * (`infrastructure/assets/embedded-skills.ts`, read by `sovrium skills` and the
 * MCP prompts) and the skills an app gives its agents
 * (`infrastructure/ai/skills/`). Two readers with two parsers would sooner or
 * later disagree about which file is a skill.
 */

/** A `---`-fenced YAML block at the very start of the file, and what follows it. */
export const SKILL_FRONTMATTER_BLOCK = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/

/** A skill's frontmatter, parsed, and its body without it. */
export interface SkillFrontmatter {
  readonly name: string
  readonly description: string
  /** The `metadata` mapping; `{}` when absent. */
  readonly metadata: Readonly<Record<string, unknown>>
  /** Everything after the closing `---` of the frontmatter block. */
  readonly body: string
}

/**
 * Why a text is not a readable skill: no frontmatter block, YAML that does not
 * parse, or a block missing one of the two keys every host reads to decide
 * whether to load the skill at all.
 */
export type SkillFrontmatterProblem =
  | { readonly kind: 'no-frontmatter' }
  | { readonly kind: 'malformed'; readonly detail: string }
  | { readonly kind: 'missing'; readonly keys: readonly ('name' | 'description')[] }

export type SkillFrontmatterResult =
  | { readonly ok: true; readonly skill: SkillFrontmatter }
  | { readonly ok: false; readonly problem: SkillFrontmatterProblem }

/** Parse YAML, reporting a syntax error as a value rather than a throw. */
const parseYaml = (
  source: string
):
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly detail: string } => {
  try {
    return { ok: true, value: Bun.YAML.parse(source) }
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? (error.message.split('\n', 1)[0] ?? '') : String(error),
    }
  }
}

/** A non-empty string, else `undefined`. */
const nonEmpty = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value : undefined

/** A YAML value as a mapping; anything else reads as an empty one. */
const asMapping = (value: unknown): Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null ? (value as Readonly<Record<string, unknown>>) : {}

/** The skill a parsed frontmatter mapping declares, or which keys it lacks. */
const skillFromMapping = (
  record: Readonly<Record<string, unknown>>,
  body: string
): SkillFrontmatterResult => {
  const name = nonEmpty(record['name'])
  const description = nonEmpty(record['description'])
  if (name === undefined || description === undefined) {
    const keys = [
      ...(name === undefined ? (['name'] as const) : []),
      ...(description === undefined ? (['description'] as const) : []),
    ]
    return { ok: false, problem: { kind: 'missing', keys } }
  }
  return { ok: true, skill: { name, description, metadata: asMapping(record['metadata']), body } }
}

/**
 * Parse a `SKILL.md`. Pure: the text in, the skill or the reason it is not one
 * out. A `name` or `description` that is absent, not a string or blank counts
 * as missing — a host cannot index a skill by an empty name.
 */
export const parseSkillFrontmatter = (text: string): SkillFrontmatterResult => {
  const match = SKILL_FRONTMATTER_BLOCK.exec(text)
  if (match === null) return { ok: false, problem: { kind: 'no-frontmatter' } }
  const [block, yaml] = match
  const parsed = parseYaml(yaml ?? '')
  if (!parsed.ok) return { ok: false, problem: { kind: 'malformed', detail: parsed.detail } }
  return skillFromMapping(asMapping(parsed.value), text.slice(block.length))
}

/** The problem in words, for a message that already names the file. */
export const describeSkillFrontmatterProblem = (problem: SkillFrontmatterProblem): string => {
  switch (problem.kind) {
    case 'no-frontmatter':
      return 'does not open with a `---` frontmatter block declaring `name` and `description`'
    case 'malformed':
      return `has frontmatter that is not valid YAML (${problem.detail})`
    case 'missing':
      return `has no ${problem.keys.map((key) => `\`${key}\``).join(' and no ')} in its frontmatter`
  }
}
