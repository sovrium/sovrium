/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
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

export interface McpCompileOptions {
  readonly confirmDestructive?: boolean
}

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
