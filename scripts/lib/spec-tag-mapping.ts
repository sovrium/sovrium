/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { readFileSync } from 'node:fs'

export const DOMAINS = [
  'schema',
  'auth',
  'tables',
  'records',
  'pages',
  'theme',
  'i18n',
  'cli',
  'migrations',
  'api',
  'examples',
  'automations',
  'user-mgmt',
  'activity',
  'analytics',
  'storage',
  'search',
  'ai-config',
  'ai-fields',
  'ai-chat',
  'ai-agents',
  'ai-rag',
  'ai-memory',
  'mcp',
  'notifications',
] as const

export type Domain = (typeof DOMAINS)[number]

const DOMAIN_SET: ReadonlySet<string> = new Set(DOMAINS)

const DOMAIN_ALIASES: Readonly<Record<string, Domain>> = {
  authentication: 'auth',
  'records-api': 'records',
  forms: 'pages',
  ai: 'ai-config',
  theming: 'theme',
}

interface SpecPathRule {
  readonly pattern: RegExp
  readonly domain: Domain
}

export const SPEC_PATH_TO_DOMAIN: readonly SpecPathRule[] = [
  { pattern: /^specs\/api\/tables\/[^/]+\/records\//, domain: 'records' },
  { pattern: /^specs\/api\/tables\/\{tableId\}\/records\//, domain: 'records' },
  { pattern: /^specs\/api\/tables\/\{tableId\}\/trash\//, domain: 'records' },
  { pattern: /^specs\/api\/tables\/\{tableSlug\}\//, domain: 'records' },

  { pattern: /^specs\/api\/tables\/\{tableId\}\/views\//, domain: 'tables' },
  { pattern: /^specs\/api\/tables\/\{tableId\}\/permissions\//, domain: 'tables' },
  { pattern: /^specs\/api\/tables\/\{tableId\}\//, domain: 'tables' },
  { pattern: /^specs\/api\/tables\/permissions\//, domain: 'tables' },
  { pattern: /^specs\/api\/tables\//, domain: 'tables' },
  { pattern: /^specs\/app\/tables\//, domain: 'tables' },

  { pattern: /^specs\/api\/auth\/admin\//, domain: 'user-mgmt' },

  { pattern: /^specs\/app\/auth\//, domain: 'auth' },
  { pattern: /^specs\/api\/auth\//, domain: 'auth' },

  { pattern: /^specs\/app\/pages\/ai-chat\//, domain: 'ai-chat' },

  { pattern: /^specs\/app\/pages\//, domain: 'pages' },

  { pattern: /^specs\/app\/theme\//, domain: 'theme' },

  { pattern: /^specs\/app\/languages\//, domain: 'i18n' },

  { pattern: /^specs\/cli\//, domain: 'cli' },

  { pattern: /^specs\/migrations\//, domain: 'migrations' },

  { pattern: /^specs\/api\/health\//, domain: 'api' },
  { pattern: /^specs\/api\/openapi\//, domain: 'api' },

  { pattern: /^specs\/examples\//, domain: 'examples' },

  { pattern: /^specs\/api\/activity\//, domain: 'activity' },

  { pattern: /^specs\/app\/analytics\//, domain: 'analytics' },
  { pattern: /^specs\/api\/analytics\//, domain: 'analytics' },

  { pattern: /^specs\/app\/automations\//, domain: 'automations' },
  { pattern: /^specs\/app\/actions\//, domain: 'automations' },

  { pattern: /^specs\/app\/connections\//, domain: 'automations' },

  { pattern: /^specs\/app\/storage\//, domain: 'storage' },

  { pattern: /^specs\/app\/notifications\//, domain: 'notifications' },
  { pattern: /^specs\/api\/notifications\//, domain: 'notifications' },

  { pattern: /^specs\/app\/agents\//, domain: 'ai-agents' },
  { pattern: /^specs\/app\/ai\/agents\//, domain: 'ai-agents' },

  { pattern: /^specs\/app\/ai\/chat\//, domain: 'ai-chat' },

  { pattern: /^specs\/app\/ai\//, domain: 'ai-config' },

  { pattern: /^specs\/app\/components\//, domain: 'pages' },

  { pattern: /^specs\/app\/json-schema\//, domain: 'schema' },
  { pattern: /^specs\/app\/name\.spec\.ts$/, domain: 'schema' },
  { pattern: /^specs\/app\/description\.spec\.ts$/, domain: 'schema' },
  { pattern: /^specs\/app\/version\.spec\.ts$/, domain: 'schema' },
]

export const DOMAIN_TAG_REGEX = /@domain:([a-z][a-z0-9-]*)/

export function canonicalizeDomain(raw: string): Domain | null {
  if (DOMAIN_SET.has(raw)) return raw as Domain
  if (raw in DOMAIN_ALIASES) return DOMAIN_ALIASES[raw] ?? null
  return null
}

export function getDomainForSpecByPath(specPath: string): Domain | null {
  for (const rule of SPEC_PATH_TO_DOMAIN) {
    if (rule.pattern.test(specPath)) {
      return rule.domain
    }
  }
  return null
}

export function getDomainForSpecByTag(specPath: string): Domain | null {
  let content: string
  try {
    content = readFileSync(specPath, 'utf8')
  } catch {
    return null
  }

  const match = content.match(DOMAIN_TAG_REGEX)
  if (!match || !match[1]) return null

  return canonicalizeDomain(match[1])
}

export function getDomainForSpec(specPath: string): Domain | null {
  const fromTag = getDomainForSpecByTag(specPath)
  if (fromTag) return fromTag

  return getDomainForSpecByPath(specPath)
}

export function getPatternsForDomain(domain: Domain): readonly RegExp[] {
  return SPEC_PATH_TO_DOMAIN.filter((rule) => rule.domain === domain).map((rule) => rule.pattern)
}
