/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Render a template's `.env.example` from its `template.yaml` and the facts of
 * its config.
 *
 * Four layers, each written over the previous one:
 *
 * 1. **Core** — the engine's own reference, {@link ENV_EXAMPLE_CONTENT}, the
 *    same text a bare `sovrium init` writes, under a header naming the app.
 * 2. **Feature blocks** — chosen by facts: an auth block, a demo-data block
 *    when the template has a `seed/`, an AI block when it runs a model, an MCP
 *    block, an email block when an automation sends mail. A block OWNS its
 *    variables: an active block takes them out of the core text and writes
 *    them with {@link FEATURE_BLOCK_DEFAULTS}, in place when the core section
 *    it came from bears the block's title, else in a section of its own.
 * 3. **The manifest** — every `env[]` entry. One naming a variable already
 *    written replaces that line and its description in place; any other lands
 *    under its `section`.
 * 4. **The rest of the config** — a `$env.X` the config reads that no layer
 *    named yet, so the file never misses a variable the app reads.
 *
 * Every variable is therefore written exactly once, and every one is commented
 * out: the app starts with none of them set.
 */

import { ENV_EXAMPLE_CONTENT } from './env-example-template'
import {
  appendToSection,
  findVariable,
  groupFor,
  mergeRuns,
  parseCore,
  renderSections,
  replaceVariable,
} from './init-template-env-document'
import type { EnvDocument, EnvItem } from './init-template-env-document'
import type { TemplateFacts } from './init-template-facts'
import type { TemplateEnvEntry, TemplateManifest } from './init-template-manifest'

interface BlockDefault {
  readonly example: string
  readonly description: string
}

const NO_DEFAULT: BlockDefault = { example: '', description: '' }

/**
 * What a generated feature-block entry says when the template adds nothing.
 * A template's `env[]` entry for the same name overrides it.
 */
export const FEATURE_BLOCK_DEFAULTS: Readonly<Record<string, BlockDefault>> = {
  SMTP_HOST: NO_DEFAULT,
  SMTP_PORT: { example: '587', description: '' },
  SMTP_USER: NO_DEFAULT,
  SMTP_PASS: NO_DEFAULT,
  SMTP_FROM: NO_DEFAULT,
  AI_PROVIDER: { example: 'ollama', description: 'ollama | openai | anthropic | mistral | google' },
  AI_API_KEY: { example: '', description: 'cloud providers only (not ollama)' },
  AI_MODEL: NO_DEFAULT,
  AI_BASE_URL: { example: 'http://localhost:11434', description: 'ollama endpoint' },
  MCP_ENABLED: { example: 'true', description: '' },
  MCP_TRANSPORT: { example: 'streamable-http', description: '' },
  SOVRIUM_SEED_PASSWORD: {
    example: '',
    description: [
      '`sovrium seed` creates the demo accounts of seed/users.yaml with this',
      'password. Seeding refuses to run without it.',
      'Every seeded account shares it, the admin included: pick a strong one, or',
      'do not seed an app other people can reach.',
    ].join('\n'),
  },
  SOVRIUM_SELF_SEED: {
    example: 'reset',
    description: [
      'The nightly-reset automation puts the demo back to its seed at 04:07 each',
      'night, and only when this is set.',
    ].join('\n'),
  },
  AUTH_ADMIN_EMAIL: {
    example: 'admin@example.com',
    description: 'Bootstrap an admin on first start — or run: sovrium admin create <email>',
  },
  AUTH_ADMIN_PASSWORD: NO_DEFAULT,
}

/** Appended to the self-seed description when the seed-password line is written beside it. */
const SELF_SEED_NEEDS_PASSWORD = 'A reset also needs the password above.'

interface FeatureBlock {
  readonly title: string
  readonly names: readonly string[] | ((facts: TemplateFacts) => readonly string[])
  readonly active: (facts: TemplateFacts) => boolean
}

const FEATURE_BLOCKS: readonly FeatureBlock[] = [
  {
    title: 'Auth (only when app.auth is enabled)',
    names: ['AUTH_ADMIN_EMAIL', 'AUTH_ADMIN_PASSWORD'],
    active: (facts) => facts.hasAuth,
  },
  {
    title: 'Demo data',
    // The password only matters to a seed that creates accounts.
    names: (facts) => [
      ...(facts.hasSeedUsers ? ['SOVRIUM_SEED_PASSWORD'] : []),
      'SOVRIUM_SELF_SEED',
    ],
    active: (facts) => facts.hasSeed,
  },
  {
    title: 'Email',
    names: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'],
    active: (facts) => facts.usesSmtp,
  },
  {
    title: 'AI (disabled unless AI_PROVIDER is set)',
    names: ['AI_PROVIDER', 'AI_API_KEY', 'AI_MODEL', 'AI_BASE_URL'],
    active: (facts) => facts.usesAi || facts.hasAgents,
  },
  {
    title: 'MCP server',
    names: ['MCP_ENABLED', 'MCP_TRANSPORT'],
    active: (facts) => facts.hasMcp,
  },
]

/** The section the variables the config reads, and no layer named, land in. */
const READ_BY_THE_CONFIG = 'Read by this app'

const blockEntry = (name: string, names: readonly string[]): TemplateEnvEntry => {
  const fallback = FEATURE_BLOCK_DEFAULTS[name] ?? NO_DEFAULT
  const description =
    name === 'SOVRIUM_SELF_SEED' && names.includes('SOVRIUM_SEED_PASSWORD')
      ? `${fallback.description}\n${SELF_SEED_NEEDS_PASSWORD}`
      : fallback.description
  return { name, section: '', description, example: fallback.example }
}

/**
 * Write one active block: its variables leave the text they sat in, and the
 * block's entries take the place of the first of them when that section bears
 * the block's title — else they go to a section of that title.
 */
const placeBlock = (
  sections: EnvDocument,
  block: FeatureBlock,
  facts: TemplateFacts
): EnvDocument => {
  const names = typeof block.names === 'function' ? block.names(facts) : block.names
  const owned = new Set(names)
  const groups = names.map((name) => groupFor(blockEntry(name, names)))
  const pass = sections.reduce<{ readonly sections: EnvDocument; readonly placed: boolean }>(
    (state, section) => {
      const walked = section.items.reduce<{
        readonly items: readonly EnvItem[]
        readonly placed: boolean
      }>(
        (acc, item) => {
          if (item.kind !== 'group' || !item.variables.some((v) => owned.has(v.name))) {
            return { ...acc, items: [...acc.items, item] }
          }
          const kept = item.variables.filter((variable) => !owned.has(variable.name))
          const here = !acc.placed && section.title === block.title
          return {
            items: [
              ...acc.items,
              ...(kept.length > 0 ? [{ ...item, variables: kept }] : []),
              ...(here ? groups : []),
            ],
            placed: acc.placed || here,
          }
        },
        { items: [], placed: state.placed }
      )
      return {
        sections: [...state.sections, { ...section, items: walked.items }],
        placed: walked.placed,
      }
    },
    { sections: [], placed: false }
  )
  return pass.placed ? pass.sections : appendToSection(pass.sections, block.title, groups)
}

/** The `.env.example` of a project scaffolded from a template. */
export const renderTemplateEnvExample = (
  manifest: TemplateManifest,
  facts: TemplateFacts
): string => {
  const core = parseCore(ENV_EXAMPLE_CONTENT)
  const blocks = FEATURE_BLOCKS.filter((block) => block.active(facts)).reduce(
    (sections, block) => placeBlock(sections, block, facts),
    core.sections
  )
  const withManifest = manifest.env.reduce(
    (sections, entry) =>
      replaceVariable(sections, entry) ??
      appendToSection(sections, entry.section, [groupFor(entry)]),
    blocks
  )
  const sections = facts.envReads.reduce(
    (current, name) =>
      findVariable(current, name) === undefined
        ? appendToSection(current, READ_BY_THE_CONFIG, [
            groupFor({ name, section: READ_BY_THE_CONFIG, description: '' }),
          ])
        : current,
    withManifest
  )
  const { footer } = core
  const header = [
    `# Sovrium environment variables — ${manifest.title}`,
    '# Copy to .env and uncomment what you need. Every variable is OPTIONAL:',
    '# `sovrium start app.yaml` runs zero-config with embedded SQLite and local',
    '# file storage.',
    '',
  ].join('\n')
  const merged = sections.map((section) => ({ ...section, items: mergeRuns(section.items) }))
  const rendered = renderSections(merged).replace(/\n+$/, '')
  return `${header}\n${rendered}\n${footer.length > 0 ? `\n${footer.join('\n')}\n` : ''}`
}
