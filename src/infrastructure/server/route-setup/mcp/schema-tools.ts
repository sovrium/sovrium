/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { CompiledTool } from '@/infrastructure/server/route-setup/mcp/tool-compiler'

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const

const DESTRUCTIVE = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
} as const

const EMPTY_INPUT = { type: 'object', properties: {} } as const

const SCHEMA_TOOL_SPECS: ReadonlyArray<{
  readonly suffix: string
  readonly description: string
  readonly readOnly: boolean
  readonly inputSchema: CompiledTool['inputSchema']
}> = [
  {
    suffix: 'schema_status',
    description: 'Report schema-edit API status: active version, bootstrap mode, draft state.',
    readOnly: true,
    inputSchema: EMPTY_INPUT,
  },
  {
    suffix: 'schema_versions_list',
    description: 'List all published schema versions, newest-first.',
    readOnly: true,
    inputSchema: EMPTY_INPUT,
  },
  {
    suffix: 'schema_versions_get',
    description: 'Fetch a single published schema version by its version number.',
    readOnly: true,
    inputSchema: {
      type: 'object',
      properties: { versionNumber: { type: 'integer', minimum: 1 } },
      required: ['versionNumber'],
    },
  },
  {
    suffix: 'schema_versions_restore',
    description: 'Restore an older schema version as a new published version.',
    readOnly: false,
    inputSchema: {
      type: 'object',
      properties: { versionNumber: { type: 'integer', minimum: 1 } },
      required: ['versionNumber'],
    },
  },
  {
    suffix: 'schema_draft_get',
    description: 'Get the current draft snapshot and the version it was branched from.',
    readOnly: true,
    inputSchema: EMPTY_INPUT,
  },
  {
    suffix: 'schema_draft_replace',
    description: 'Replace the entire draft snapshot with a new App configuration.',
    readOnly: false,
    inputSchema: {
      type: 'object',
      properties: {
        snapshot: { type: 'object' },
        baseVersion: { type: 'integer', minimum: 0 },
      },
      required: ['snapshot'],
    },
  },
  {
    suffix: 'schema_draft_discard',
    description: 'Discard the current draft, reverting to the active published version.',
    readOnly: false,
    inputSchema: EMPTY_INPUT,
  },
  {
    suffix: 'schema_draft_validate',
    description: 'Validate the current draft against the App schema; returns errors[].',
    readOnly: true,
    inputSchema: EMPTY_INPUT,
  },
  {
    suffix: 'schema_draft_publish',
    description: 'Publish the current draft as a new version (optimistic-concurrency baseVersion).',
    readOnly: false,
    inputSchema: {
      type: 'object',
      properties: {
        baseVersion: { type: 'integer', minimum: 0 },
        message: { type: 'string', maxLength: 500 },
      },
      required: ['baseVersion'],
    },
  },
  {
    suffix: 'schema_draft_rebase',
    description:
      'Re-point the draft baseVersion to the active version (clears staleness, no merge).',
    readOnly: false,
    inputSchema: EMPTY_INPUT,
  },
  {
    suffix: 'schema_diff',
    description:
      'Preview live-vs-file schema drift: returns driftStatus + changed top-level paths.',
    readOnly: true,
    inputSchema: EMPTY_INPUT,
  },
  {
    suffix: 'schema_draft_tables_create',
    description: 'Add a new table to the draft schema.',
    readOnly: false,
    inputSchema: {
      type: 'object',
      properties: { table: { type: 'object' } },
      required: ['table'],
    },
  },
  {
    suffix: 'schema_prune',
    description:
      'Prune the schema-version ledger; retains v1, active, the restore chain, and the newest `keep`.',
    readOnly: false,
    inputSchema: {
      type: 'object',
      properties: { keep: { type: 'integer', minimum: 1 } },
    },
  },
  {
    suffix: 'schema_draft_preview_start',
    description: 'Start an ephemeral preview server running the current draft.',
    readOnly: false,
    inputSchema: {
      type: 'object',
      properties: { ttlMinutes: { type: 'integer', minimum: 1 } },
    },
  },
  {
    suffix: 'schema_draft_preview_status',
    description: 'Report whether a preview server is currently running.',
    readOnly: true,
    inputSchema: EMPTY_INPUT,
  },
  {
    suffix: 'schema_draft_preview_stop',
    description: 'Stop the running preview server.',
    readOnly: false,
    inputSchema: EMPTY_INPUT,
  },
]

const PER_RESOURCE_FAMILIES = [
  'tables',
  'pages',
  'auth_strategies',
  'forms',
  'automations',
  'connections',
  'theme',
  'languages',
  'components',
  'actions',
  'agents',
  'buckets',
  'notifications',
  'scripts',
  'env',
] as const

const PER_RESOURCE_OPS = ['create', 'update', 'delete'] as const

const buildFamilyTool = (appName: string, family: string, op: string): CompiledTool => ({
  name: `${appName}_schema_draft_${family}_${op}`,
  description: `${op} a ${family} entry in the draft schema`,
  inputSchema: { type: 'object', properties: {} },
  annotations: { ...DESTRUCTIVE },
})

export const compileSchemaTools = (
  appName: string,
  schemaEditEnabled: boolean
): ReadonlyArray<CompiledTool> => {
  if (!schemaEditEnabled) return []
  const baseTools = SCHEMA_TOOL_SPECS.map((spec) => ({
    name: `${appName}_${spec.suffix}`,
    description: spec.description,
    inputSchema: spec.inputSchema,
    annotations: spec.readOnly ? { ...READ_ONLY } : { ...DESTRUCTIVE },
  }))
  const familyTools = PER_RESOURCE_FAMILIES.flatMap((family) =>
    PER_RESOURCE_OPS.map((op) => buildFamilyTool(appName, family, op))
  ).filter((tool) => tool.name !== `${appName}_schema_draft_tables_create`)
  return [...baseTools, ...familyTools]
}

export const isSchemaEditEnabled = (env: Readonly<NodeJS.ProcessEnv>): boolean =>
  env.SCHEMA_EDIT_API_ENABLED === 'true'

export const isSchemaTool = (appName: string, toolName: string): boolean =>
  toolName.startsWith(`${appName}_schema_`)
