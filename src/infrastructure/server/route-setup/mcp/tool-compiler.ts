/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * MCP tool catalog compiler (US-AI-MCP-SERVER-DISCOVERY/TABLES, M-1/M-3).
 *
 * Walks `app.tables[].aiAccess` and `app.actions[].aiAccess` to produce the
 * MCP `tools/list` payload. Extracted from `mcp-routes.ts` to keep both
 * modules under the project-wide 400-line limit (`max-lines` rule).
 *
 * Tool-naming convention:
 *  - Table operations: `{appName}_{tableName}_{operation}` where operation ∈
 *    {read, list, create, update, delete}.
 *  - Action templates: `{appName}_action_{templateName}`.
 *
 * Field-input schemas are minimal-but-honest — `tools/call` (M-5/M-6) handles
 * the real validation; the catalog merely needs JSON-Schema-shaped inputs so
 * MCP clients can render the form / argument hints.
 */

import { isAiAccessEnabled } from '@/domain/models/shared/ai-access'
import type { App } from '@/domain/models/app'
import type { ActionTemplate } from '@/domain/models/app/actions'
import type { Automation } from '@/domain/models/app/automations'
import type { Fields } from '@/domain/models/app/tables/fields'
import type { Table } from '@/domain/models/app/tables/table'
import type { AiAccess, AiAccessOperation, ToolAnnotations } from '@/domain/models/shared/ai-access'

const DEFAULT_TABLE_OPERATIONS: ReadonlyArray<AiAccessOperation> = [
  'read',
  'list',
  'create',
  'update',
  'delete',
]

export interface CompiledToolAnnotations {
  readonly readOnlyHint?: boolean
  readonly destructiveHint?: boolean
  readonly idempotentHint?: boolean
  readonly openWorldHint?: boolean
}

export interface CompiledTool {
  readonly name: string
  readonly description: string
  readonly inputSchema: {
    readonly type: 'object'
    readonly properties: Record<string, unknown>
    readonly required?: ReadonlyArray<string>
  }
  readonly annotations: CompiledToolAnnotations
}

/**
 * Compile-time switches that operators flip via env vars to tune the catalog.
 *
 * - `confirmDestructive`: When `false`, `requireConfirmation: true` no longer
 *   forces `destructiveHint=true` (operators opt out via
 *   `MCP_CONFIRM_DESTRUCTIVE=false` per US-AI-MCP-SERVER-ANNOTATIONS,
 *   APP-AI-MCP-ANNOT-005). Default: `true` (force-confirm is on).
 */
export interface McpCompileOptions {
  readonly confirmDestructive?: boolean
}

/**
 * Compile MCP tool definitions from the app schema.
 *
 * Three tool sources contribute to the catalog:
 *  - One tool per `(table, operation)` pair when the table has `aiAccess`.
 *    Tool name = `{appName}_{tableName}_{operation}`. Operation defaults
 *    follow `aiAccess.operations` (all 5 CRUD verbs when unset).
 *  - One tool per action template that has `aiAccess`. Tool name =
 *    `{appName}_action_{templateName}`. The variable schema for the action
 *    template becomes the input schema (M-7+ will refine this).
 *  - One tool per manual-trigger automation that has `aiAccess` (M-8). Tool
 *    name = `{appName}_automation_{automationName}`. The cross-validator
 *    `validateAllAiAccessRules` rejects aiAccess on non-manual triggers
 *    (record / cron / webhook) at decode time, so this stage only ever
 *    sees manual triggers.
 */
export const compileMcpTools = (
  app: App,
  options: McpCompileOptions = {}
): ReadonlyArray<CompiledTool> => {
  const confirmDestructive = options.confirmDestructive ?? true
  const tableTools = (app.tables ?? []).flatMap((table) =>
    compileTableTools(app.name, table, confirmDestructive)
  )
  const actionTools = (app.actions ?? []).flatMap((template) =>
    compileActionTemplateTools(app.name, template, confirmDestructive)
  )
  const automationTools = (app.automations ?? []).flatMap((automation) =>
    compileAutomationTools(app.name, automation, confirmDestructive)
  )
  return [...tableTools, ...actionTools, ...automationTools]
}

const compileTableTools = (
  appName: string,
  table: Table,
  confirmDestructive: boolean
): ReadonlyArray<CompiledTool> => {
  const access = table.aiAccess
  if (!isAiAccessEnabled(access)) return []

  const operations = resolveOperations(access)
  return operations.map((operation) => ({
    name: `${appName}_${table.name}_${operation}`,
    description: buildToolDescription(table, operation, access),
    inputSchema: buildToolInputSchema(operation, table, access),
    annotations: buildTableToolAnnotations(operation, access, confirmDestructive),
  }))
}

const compileActionTemplateTools = (
  appName: string,
  template: ActionTemplate,
  confirmDestructive: boolean
): ReadonlyArray<CompiledTool> => {
  const access = template.aiAccess
  if (!isAiAccessEnabled(access)) return []

  const overriddenDescription = typeof access === 'object' ? access.description : undefined
  return [
    {
      name: `${appName}_action_${template.name}`,
      description:
        overriddenDescription && overriddenDescription.length > 0
          ? overriddenDescription
          : `Invoke the '${template.name}' action template`,
      inputSchema: buildActionTemplateInputSchema(template),
      annotations: buildActionToolAnnotations(access, confirmDestructive),
    },
  ]
}

/**
 * Build the `inputSchema` for an action-template MCP tool. Three sources
 * contribute, in priority order:
 *
 *  1. `aiAccess.fieldExposure: 'whitelist'` + `whitelistFields` — every
 *     whitelisted field becomes a required string property. The cross-
 *     validator `validateAllAiAccessRules` already rejects empty whitelists
 *     at decode time, so this branch is guaranteed to produce a non-empty
 *     `required` array when reached. Whitelist mode is the schema author's
 *     authoritative declaration of which parameters the tool accepts —
 *     `tools/call` enforces the same whitelist as a wire-input gate.
 *  2. `template.variables` — when no whitelist is declared, every declared
 *     variable becomes an optional string property (the variable's
 *     declared default already covers the missing-input case at run time).
 *  3. Otherwise, an empty-object schema is exposed so trivial templates
 *     (no inputs) can be invoked without a payload.
 *
 * The mapping is intentionally coarse — every property is `{ type: 'string' }`
 * because the template's underlying action body resolves `{{var}}`
 * placeholders via Handlebars, which stringifies values it inlines.
 * Number / boolean inputs still work end-to-end (Handlebars formats them);
 * the JSON Schema hint just promises strings to MCP clients that surface
 * the form. Future migration specs can refine this if the
 * `template.variables` declaration grows a richer per-variable type.
 */
const buildActionTemplateInputSchema = (
  template: ActionTemplate
): {
  readonly type: 'object'
  readonly properties: Record<string, unknown>
  readonly required?: ReadonlyArray<string>
} => {
  const access = template.aiAccess
  if (typeof access === 'object' && access.fieldExposure === 'whitelist') {
    const whitelist = access.whitelistFields ?? []
    if (whitelist.length === 0) return { type: 'object', properties: {} }
    const properties = Object.fromEntries(whitelist.map((name) => [name, { type: 'string' }]))
    return { type: 'object', properties, required: whitelist }
  }
  const { variables } = template
  if (variables !== undefined) {
    const variableNames = Object.keys(variables)
    if (variableNames.length === 0) return { type: 'object', properties: {} }
    const properties = Object.fromEntries(variableNames.map((name) => [name, { type: 'string' }]))
    return { type: 'object', properties }
  }
  return { type: 'object', properties: {} }
}

/**
 * Compile a single MCP tool for a manual-trigger automation that opted into
 * `aiAccess` (M-8). The cross-validator `validateAllAiAccessRules` already
 * rejected aiAccess on non-manual triggers at decode time, so by the time
 * this function runs every `automation` with declared aiAccess is guaranteed
 * to have `trigger.type === 'manual'`. We still defensively check the trigger
 * type to short-circuit cleanly should the cross-validator's contract ever
 * drift — better to silently omit the tool than emit a tool whose dispatcher
 * cannot honor it.
 *
 * Tool name format: `{appName}_automation_{automationName}`. The automation
 * name is preserved verbatim (kebab-case is the schema-author's chosen
 * identifier; the MCP spec accepts arbitrary tool names).
 *
 * Input schema mirrors the action-template approach — when the manual
 * trigger declares an `inputSchema` it is forwarded verbatim (already
 * JSON-Schema-shaped per the trigger schema's `Record<string, unknown>`
 * definition). When no inputSchema is declared the tool exposes the
 * empty-object shape so MCP clients can invoke without a payload.
 *
 * Annotations follow the action-template defaults (non-readOnly,
 * non-idempotent, non-openWorld) because automations execute side-effecting
 * workflows. `requireConfirmation: true` forces `destructiveHint=true` —
 * the canonical lever for tagging non-reversible side effects (sending
 * emails, charging cards, etc.) even on otherwise-safe-looking automations.
 */
const compileAutomationTools = (
  appName: string,
  automation: Automation,
  confirmDestructive: boolean
): ReadonlyArray<CompiledTool> => {
  const access = automation.aiAccess
  if (!isAiAccessEnabled(access)) return []
  if (automation.trigger.type !== 'manual') return []

  const overriddenDescription = typeof access === 'object' ? access.description : undefined
  return [
    {
      name: `${appName}_automation_${automation.name}`,
      description:
        overriddenDescription && overriddenDescription.length > 0
          ? overriddenDescription
          : `Run the '${automation.name}' automation`,
      inputSchema: buildAutomationInputSchema(automation),
      annotations: buildActionToolAnnotations(access, confirmDestructive),
    },
  ]
}

/**
 * Build the `inputSchema` for a manual-trigger automation tool. When the
 * trigger declares `inputSchema` (a `Record<string, unknown>` per the
 * `ManualTriggerSchema`), we expose it verbatim — schema authors are
 * responsible for shaping it as a JSON Schema object so MCP clients can
 * render argument hints. When unset, fall back to an empty-object schema
 * so trivial automations (no inputs) can be invoked without a payload.
 */
const buildAutomationInputSchema = (
  automation: Automation
): {
  readonly type: 'object'
  readonly properties: Record<string, unknown>
  readonly required?: ReadonlyArray<string>
} => {
  if (automation.trigger.type !== 'manual') {
    return { type: 'object', properties: {} }
  }
  const declared = automation.trigger.inputSchema
  if (declared === undefined) return { type: 'object', properties: {} }

  // The trigger schema stores `inputSchema` as `Record<string, unknown>`,
  // not a strict JSON Schema. We normalize the wrapper but preserve the
  // author-supplied properties / required slots verbatim — anything else
  // would silently strip valid JSON Schema vocabulary the MCP client may
  // depend on (oneOf, examples, descriptions, etc.).
  const properties =
    typeof declared['properties'] === 'object' && declared['properties'] !== null
      ? (declared['properties'] as Record<string, unknown>)
      : {}
  const required = Array.isArray(declared['required'])
    ? (declared['required'] as ReadonlyArray<string>)
    : undefined
  return required === undefined
    ? { type: 'object', properties }
    : { type: 'object', properties, required }
}

const resolveOperations = (access: AiAccess | undefined): ReadonlyArray<AiAccessOperation> => {
  if (access === undefined || typeof access === 'boolean') return DEFAULT_TABLE_OPERATIONS
  return access.operations ?? DEFAULT_TABLE_OPERATIONS
}

const buildToolDescription = (
  table: Table,
  operation: AiAccessOperation,
  access: AiAccess | undefined
): string => {
  const overridden = typeof access === 'object' ? access.description : undefined
  if (overridden && overridden.length > 0) return `${operation}: ${overridden}`
  return `${operation} records in the ${table.name} table`
}

/**
 * Derive MCP tool annotations from operation type and any author-supplied
 * `aiAccess.annotations` overrides.
 *
 * Defaults follow the natural risk profile of each CRUD verb:
 * - `read / list`: readOnly=true, destructive=false, idempotent=true
 * - `create`: readOnly=false, destructive=false, idempotent=false
 * - `update`: readOnly=false, destructive=false, idempotent=true (PUT semantics)
 * - `delete`: readOnly=false, destructive=true, idempotent=true
 *
 * `requireConfirmation: true` from the rich aiAccess form forces
 * `destructiveHint=true` regardless of the operation type — this is the
 * lever for tagging non-reversible side effects (e.g. send-email).
 */
const buildTableToolAnnotations = (
  operation: AiAccessOperation,
  access: AiAccess | undefined,
  confirmDestructive: boolean
): CompiledToolAnnotations => {
  const overrides = typeof access === 'object' ? access.annotations : undefined
  const requireConfirmation =
    typeof access === 'object' ? (access.requireConfirmation ?? false) : false
  const isReadOnly = operation === 'read' || operation === 'list'
  const isDestructive = operation === 'delete'
  const isIdempotent = operation !== 'create'
  const merged = mergeAnnotations(
    {
      readOnlyHint: isReadOnly,
      destructiveHint: isDestructive,
      idempotentHint: isIdempotent,
      openWorldHint: false,
    },
    overrides
  )
  return forceDestructiveOnConfirmation(merged, requireConfirmation, confirmDestructive)
}

const buildActionToolAnnotations = (
  access: AiAccess | undefined,
  confirmDestructive: boolean
): CompiledToolAnnotations => {
  const overrides = typeof access === 'object' ? access.annotations : undefined
  const requireConfirmation =
    typeof access === 'object' ? (access.requireConfirmation ?? false) : false
  // Action templates execute side-effecting workflows; default to non-readOnly
  // and non-idempotent. Schema authors can override per-template via
  // `aiAccess.annotations` when the actual workflow is safe.
  const merged = mergeAnnotations(
    {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    overrides
  )
  return forceDestructiveOnConfirmation(merged, requireConfirmation, confirmDestructive)
}

/**
 * `requireConfirmation: true` is the schema author's strongest signal that
 * the entity is non-reversible (sending email, charging cards, dispatching
 * a quarterly report). It MUST force `destructiveHint=true` regardless of
 * any `annotations.destructive: false` override the same author may have
 * supplied — otherwise a copy-pasted "destructive: false" boilerplate
 * could silently mask the confirmation intent. The asymmetry is
 * intentional: confirmation upgrades the destructive hint, but plain
 * annotation overrides cannot downgrade past it.
 *
 * Operators who fully trust their schema authors (or whose AI client surfaces
 * its own confirmation flow) can disable the force-upgrade with
 * `MCP_CONFIRM_DESTRUCTIVE=false`. When that env switch is off, author
 * `annotations.destructive: false` is honored verbatim and `requireConfirmation`
 * stops asymmetrically upgrading the hint (US-AI-MCP-SERVER-ANNOTATIONS,
 * APP-AI-MCP-ANNOT-005).
 */
const forceDestructiveOnConfirmation = (
  annotations: CompiledToolAnnotations,
  requireConfirmation: boolean,
  confirmDestructive: boolean
): CompiledToolAnnotations => {
  if (!confirmDestructive) return annotations
  if (!requireConfirmation) return annotations
  return { ...annotations, destructiveHint: true }
}

const mergeAnnotations = (
  defaults: CompiledToolAnnotations,
  overrides: ToolAnnotations | undefined
): CompiledToolAnnotations => {
  if (overrides === undefined) return defaults
  return {
    readOnlyHint: overrides.readOnly ?? defaults.readOnlyHint,
    destructiveHint: overrides.destructive ?? defaults.destructiveHint,
    idempotentHint: overrides.idempotent ?? defaults.idempotentHint,
    openWorldHint: overrides.openWorld ?? defaults.openWorldHint,
  }
}

const buildToolInputSchema = (
  operation: AiAccessOperation,
  table: Table,
  access: AiAccess | undefined
): {
  readonly type: 'object'
  readonly properties: Record<string, unknown>
  readonly required?: ReadonlyArray<string>
} => {
  // Minimal-but-honest input schemas. Read/list/delete share a stable shape
  // (id-or-pagination); create/update expose per-field properties when the
  // schema author opts into `fieldExposure: 'all'` or `'whitelist'` so MCP
  // clients can render argument hints. The default `'permissioned'` mode
  // keeps the legacy `data: object` shape because per-role compilation is
  // not yet wired through the `tools/list` request pipeline (M-10 territory).
  if (operation === 'list') {
    return {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 100 },
        offset: { type: 'integer', minimum: 0 },
      },
    }
  }
  if (operation === 'read' || operation === 'delete') {
    return {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    }
  }
  return buildWriteInputSchema(operation, table, access)
}

/**
 * Build the inputSchema for create/update tools. When `fieldExposure: 'all'`
 * or `'whitelist'` is set, expose each writable field as a top-level property
 * mapped to a JSON Schema type derived from the field type. The `'permissioned'`
 * default keeps the legacy `data: object` envelope to preserve backward
 * compatibility with clients that still send `{ data: { ... } }`.
 *
 * Update tools always include the `id` property at top level; the field
 * properties are siblings (not nested under `data`) so the MCP wire format
 * stays flat — the tool-call dispatcher's `extractFields` already tolerates
 * either nesting style.
 */
const buildWriteInputSchema = (
  operation: AiAccessOperation,
  table: Table,
  access: AiAccess | undefined
): {
  readonly type: 'object'
  readonly properties: Record<string, unknown>
  readonly required?: ReadonlyArray<string>
} => {
  const exposedFields = resolveExposedFields(table.fields ?? [], access)
  if (exposedFields.length === 0) {
    if (operation === 'update') {
      return {
        type: 'object',
        properties: { id: { type: 'string' }, data: { type: 'object' } },
        required: ['id', 'data'],
      }
    }
    return {
      type: 'object',
      properties: { data: { type: 'object' } },
      required: ['data'],
    }
  }

  const fieldProperties = Object.fromEntries(
    exposedFields.map((field) => [field.name, mapFieldToJsonSchema(field)])
  )
  if (operation === 'update') {
    return {
      type: 'object',
      properties: { id: { type: 'string' }, ...fieldProperties },
      required: ['id'],
    }
  }
  return { type: 'object', properties: fieldProperties }
}

/**
 * Determine which fields appear in the input schema given the configured
 * `fieldExposure` mode. Returns an empty array for the `'permissioned'`
 * default — the compiler does not yet know the caller's role at compile
 * time, so it falls back to the opaque `data: object` envelope.
 */
const resolveExposedFields = (
  fields: Fields,
  access: AiAccess | undefined
): ReadonlyArray<Fields[number]> => {
  const exposure = typeof access === 'object' ? access.fieldExposure : undefined
  if (exposure === 'all') return fields
  if (exposure === 'whitelist') {
    const whitelist = (typeof access === 'object' ? access.whitelistFields : undefined) ?? []
    const allowed = new Set(whitelist)
    return fields.filter((field) => allowed.has(field.name))
  }
  return []
}

/**
 * Map a Sovrium field type to a JSON Schema fragment suitable for the MCP
 * tool inputSchema. The mapping is deliberately coarse — the runtime relies
 * on PostgreSQL + the records-API for the authoritative validation; the
 * inputSchema only needs to give MCP clients enough hints to render forms.
 */
const mapFieldToJsonSchema = (field: Fields[number]): Record<string, unknown> => {
  const fieldType = field.type
  if (NUMERIC_FIELD_TYPES.has(fieldType)) return { type: 'number' }
  if (BOOLEAN_FIELD_TYPES.has(fieldType)) return { type: 'boolean' }
  if (OBJECT_FIELD_TYPES.has(fieldType)) return { type: 'object' }
  if (fieldType === 'single-select' || fieldType === 'status') {
    return mapEnumStringField(field)
  }
  if (fieldType === 'multi-select') return mapEnumArrayField(field)
  if (fieldType === 'array') return { type: 'array', items: {} }
  return { type: 'string' }
}

const mapEnumStringField = (field: Fields[number]): Record<string, unknown> => {
  const { options } = field as { readonly options?: ReadonlyArray<string> }
  if (options && options.length > 0) return { type: 'string', enum: [...options] }
  return { type: 'string' }
}

const mapEnumArrayField = (field: Fields[number]): Record<string, unknown> => {
  const { options } = field as { readonly options?: ReadonlyArray<string> }
  if (options && options.length > 0) {
    return { type: 'array', items: { type: 'string', enum: [...options] } }
  }
  return { type: 'array', items: { type: 'string' } }
}

const NUMERIC_FIELD_TYPES: ReadonlySet<string> = new Set([
  'number',
  'integer',
  'decimal',
  'currency',
  'percentage',
  'rating',
  'progress',
  'autonumber',
  'count',
])

const BOOLEAN_FIELD_TYPES: ReadonlySet<string> = new Set(['checkbox', 'boolean'])

const OBJECT_FIELD_TYPES: ReadonlySet<string> = new Set(['json', 'ai-extract', 'ai-tag'])
