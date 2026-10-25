/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The facts a template's wrapper files are rendered from, read off the
 * template's own files — pure: the caller hands the texts in, nothing here
 * touches the filesystem.
 *
 * Every fact is derived from the config, never declared beside it, so a
 * template that gains an email step or an AI agent gets the matching
 * `.env.example` block without anyone remembering to add it.
 */

/**
 * The part of a template's `catalog.json` entry the facts read: its topics.
 * Any catalogue entry satisfies it (`templates-catalog.ts` owns the full shape).
 */
export interface TemplateCatalogFacts {
  readonly topics?: readonly string[]
}

export interface TemplateFacts {
  readonly slug: string
  /** The `name` of `app.yaml`: the h1 of the rendered `CLAUDE.md`. */
  readonly appName: string
  /** The top-level keys of `app.yaml`, in file order. */
  readonly rootKeys: readonly string[]
  /** Every `$env.X` the config reads, sorted and unique. */
  readonly envReads: readonly string[]
  readonly hasSeed: boolean
  /** The seed creates sign-in accounts (`seed/users.yaml`). */
  readonly hasSeedUsers: boolean
  readonly hasPublic: boolean
  readonly hasAuth: boolean
  readonly hasAgents: boolean
  readonly hasMcp: boolean
  readonly hasBuckets: boolean
  /**
   * The app sends mail: an automation step of `type: email`, a sign-in by
   * emailed link or code, or the operator alerts an app with both accounts and
   * automations sends when a run fails.
   */
  readonly usesSmtp: boolean
  /** An AI step, an agent or a chat reads a model. */
  readonly usesAi: boolean
}

const CONFIG_FILE = /\.(?:ya?ml|json)$/

/**
 * Whether a template file is config text the facts read. Every caller that
 * gathers a template's files for {@link collectTemplateFacts} — `init` and the
 * mirror publisher — reads exactly these as text, so both see the same facts.
 */
export const isTemplateConfigText = (path: string): boolean => CONFIG_FILE.test(path)
const ENV_READ = /\$env\.([A-Z][A-Z0-9_]*)/g
const EMAIL_STEP = /(?:^|\n)\s*-?\s*type:\s*['"]?email['"]?\s*(?:\n|$)|"type"\s*:\s*"email"/
const MAILED_SIGN_IN = /\b(?:magicLink|emailOtp)\b/
const AI_STEP =
  /(?:^|\n)\s*-?\s*type:\s*['"]?(?:ai|agent|chat)['"]?\s*(?:\n|$)|"type"\s*:\s*"(?:ai|agent|chat)"/

const readsMcp = (configTexts: readonly string[], catalogEntry?: TemplateCatalogFacts): boolean =>
  (catalogEntry?.topics ?? []).includes('mcp') ||
  configTexts.some((text) => text.includes('MCP_ENABLED'))

const runsAModel = (
  hasAgents: boolean,
  envReads: readonly string[],
  configTexts: readonly string[]
): boolean =>
  hasAgents ||
  envReads.some((name) => name.startsWith('AI_')) ||
  configTexts.some((text) => AI_STEP.test(text))

const sendsMail = (rootKeys: readonly string[], configTexts: readonly string[]): boolean =>
  configTexts.some((text) => EMAIL_STEP.test(text) || MAILED_SIGN_IN.test(text)) ||
  (rootKeys.includes('auth') && rootKeys.includes('automations'))

const parseAppYaml = (text: string): Readonly<Record<string, unknown>> => {
  try {
    const parsed = Bun.YAML.parse(text) as unknown
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Readonly<Record<string, unknown>>)
      : {}
  } catch {
    // An unparseable app.yaml has no facts to give; `sovrium validate` is the
    // command that reports why, and the template's own CI runs it.
    return {}
  }
}

/**
 * Collect the facts of one template.
 *
 * `files` maps each path relative to the template directory (`app.yaml`,
 * `config/tables/deals.yaml`, `seed/users.yaml`, …) to its text; binary files
 * may be passed with any text, only their paths are read.
 */
export const collectTemplateFacts = (
  slug: string,
  files: Readonly<Record<string, string>>,
  catalogEntry?: TemplateCatalogFacts
): TemplateFacts => {
  const app = parseAppYaml(files['app.yaml'] ?? files['app.yml'] ?? '')
  const rootKeys = Object.keys(app)
  const configTexts = Object.entries(files)
    .filter(([path]) => isTemplateConfigText(path))
    .map(([, text]) => text)
  const envReads = [
    ...new Set(configTexts.flatMap((text) => [...text.matchAll(ENV_READ)].map((m) => m[1] ?? ''))),
  ].toSorted()
  const paths = Object.keys(files)
  const hasKey = (key: string): boolean => rootKeys.includes(key)
  const hasAgents = hasKey('agents')
  return {
    slug,
    appName: typeof app['name'] === 'string' ? app['name'] : slug,
    rootKeys,
    envReads,
    hasSeed: paths.some((path) => path.startsWith('seed/')),
    hasSeedUsers: paths.some((path) => /^seed\/users\.ya?ml$/.test(path)),
    hasPublic: paths.some((path) => path.startsWith('public/')),
    hasAuth: hasKey('auth'),
    hasAgents,
    hasMcp: readsMcp(configTexts, catalogEntry),
    hasBuckets: hasKey('buckets'),
    usesSmtp: sendsMail(rootKeys, configTexts),
    usesAi: runsAModel(hasAgents, envReads, configTexts),
  }
}
