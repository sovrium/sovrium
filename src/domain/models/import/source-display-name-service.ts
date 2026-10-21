/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The names a report shows a person: a tool as its makers spell it, and a
 * source step by its app and its action in plain words, with the raw id the
 * tool uses kept in parentheses so the operator can still find it in the
 * export.
 *
 * `airtable`, `n8n-nodes-base.merge` and `SlackCLIAPI channel_message` are
 * identifiers, not prose; every reason and TODO written for a reader goes
 * through here instead.
 */

import { appWordOf } from './flow-app-catalogue-service'
import type { AutomationSourceTool } from './flow-step-mappings'
import type { ImportSourceTool } from './import-source'

/** Each tool as its makers write its name. */
const TOOL_DISPLAY_NAMES: Readonly<Record<ImportSourceTool, string>> = {
  airtable: 'Airtable',
  notion: 'Notion',
  'google-sheets': 'Google Sheets',
  csv: 'CSV',
  xlsx: 'Excel',
  baserow: 'Baserow',
  'retool-database': 'Retool Database',
  webflow: 'Webflow',
  'zapier-tables': 'Zapier Tables',
  zite: 'Zite',
  n8n: 'n8n',
  make: 'Make',
  zapier: 'Zapier',
  'retool-workflows': 'Retool Workflows',
  'retool-classic': 'Retool',
  typeform: 'Typeform',
  jotform: 'Jotform',
  'google-forms': 'Google Forms',
  tally: 'Tally',
  fillout: 'Fillout',
  'microsoft-forms': 'Microsoft Forms',
}

/** A tool's name as a reader knows it: `typeform` → `Typeform`. */
export const toolDisplayName = (tool: ImportSourceTool): string => TOOL_DISPLAY_NAMES[tool]

/** `Typeform's`, or `Retool Workflows'` for a name ending in s. */
export const toolPossessive = (tool: ImportSourceTool): string => {
  const name = toolDisplayName(tool)
  return name.endsWith('s') ? `${name}'` : `${name}'s`
}

/** The words of an identifier: `channel_message` and `CreateMessage` → `channel message`, `create message`. */
const wordsOf = (id: string): readonly string[] =>
  id
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter((word) => word !== '')

/** An identifier as a name: `googleSheets` → `Google Sheets`, `merge` → `Merge`. */
const titleOf = (id: string): string =>
  wordsOf(id)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ')

/** What each automation tool calls one of its steps. */
const STEP_NOUNS: Readonly<Partial<Record<AutomationSourceTool, string>>> = {
  n8n: 'node',
  make: 'module',
  'retool-workflows': 'block',
}

/** Make's built-in apps, under the names its editor shows them. */
const MAKE_APP_NAMES: Readonly<Record<string, string>> = {
  util: 'Tools',
  builtin: 'Flow Control',
  onerror: 'Error Handler',
  gateway: 'Webhooks',
}

/** An app's name as its tool shows it. */
const appNameOf = (tool: AutomationSourceTool, app: string): string => {
  const word = appWordOf(tool, app)
  const shown = tool === 'make' ? MAKE_APP_NAMES[word] : undefined
  return shown ?? (titleOf(word) || app)
}

/** The raw id of a step, as the export spells it: the app, then the operation unless the app holds it. */
const rawIdOf = (app: string, operation: string): string =>
  operation === '' || app.endsWith(operation) ? app : `${app} ${operation}`

/**
 * A source step in a reader's words, its raw id in parentheses:
 * `n8n's Merge node (n8n-nodes-base.merge)`,
 * `Zapier's Slack step "channel message" (SlackCLIAPI channel_message)`.
 */
export const sourceStepPhrase = (
  tool: AutomationSourceTool,
  app: string,
  operation = ''
): string => {
  const name = appNameOf(tool, app)
  const action = wordsOf(operation).join(' ').toLowerCase()
  const noun = STEP_NOUNS[tool] ?? 'step'
  const named = action === '' ? '' : ` "${action}"`
  return `${toolPossessive(tool)} ${name} ${noun}${named} (${rawIdOf(app, operation)})`
}

/** A code step's language as its name is written: `javascript` → `JavaScript`. */
const LANGUAGE_NAMES: Readonly<Record<string, string>> = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  python: 'Python',
}

/** A code language as its name is written; one outside the list is plain "code". */
export const languageDisplayName = (lang: string): string => LANGUAGE_NAMES[lang] ?? 'code'

/**
 * A step the adapter knows only by its source type, in a reader's words: a
 * Zapier type is `<app> <action>`, a Make one `<app>:<module>`, an n8n one the
 * node type alone.
 */
export const sourceTypePhrase = (tool: AutomationSourceTool, sourceType: string): string => {
  if (tool === 'zapier') {
    const space = sourceType.indexOf(' ')
    return space === -1
      ? sourceStepPhrase(tool, sourceType)
      : sourceStepPhrase(tool, sourceType.slice(0, space), sourceType.slice(space + 1))
  }
  if (tool === 'make' && sourceType.includes(':')) {
    return sourceStepPhrase(tool, sourceType, sourceType.slice(sourceType.lastIndexOf(':') + 1))
  }
  return sourceStepPhrase(tool, sourceType)
}
