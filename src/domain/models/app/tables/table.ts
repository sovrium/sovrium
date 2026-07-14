/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { AiAccessSchema } from '@/domain/models/shared/ai-access'
import { TableIdSchema } from '@/domain/types/branded-ids'
import { SPECIAL_FIELDS, validateFormulaFields } from '@/domain/validators/table-formula-validation'
import { validateIndexes } from '@/domain/validators/table-indexes-validation'
import { validateTablePermissions } from '@/domain/validators/table-permissions-validation'
import { validatePrimaryKey } from '@/domain/validators/table-primary-key-validation'
import { validateViews } from '@/domain/validators/table-views-validation'
import { CommentsConfigSchema } from './comments'
import { CheckConstraintsSchema } from './constraints'
import { FieldsSchema } from './fields'
import { ForeignKeySchema } from './foreign-keys'
import { IndexesSchema } from './indexes'
import { NameSchema } from './name'
import { TablePermissionsSchema } from './permissions'
import { PrimaryKeySchema } from './primary-key'
import { RowLevelPermissionsSchema } from './row-level-permissions'
import { ViewSchema } from './views'
import { WebhookSchema } from './webhooks'

export { SPECIAL_FIELDS }


type ValidationError = { readonly message: string; readonly path: ReadonlyArray<string> }

const validateStructure = (
  table: Record<string, unknown>,
  fieldNames: ReadonlySet<string>
): ValidationError | undefined => {
  if (table.primaryKey) {
    const primaryKey = table.primaryKey as {
      readonly type: string
      readonly fields?: ReadonlyArray<string>
    }
    const primaryKeyError = validatePrimaryKey(primaryKey, fieldNames)
    if (primaryKeyError) return primaryKeyError
  }

  const indexes = table.indexes as
    ReadonlyArray<{ readonly name: string; readonly fields: ReadonlyArray<string> }> | undefined
  if (indexes && indexes.length > 0) {
    const indexError = validateIndexes(indexes, fieldNames)
    if (indexError) return indexError
  }

  return undefined
}

const validateAccessAndViews = (
  table: Record<string, unknown>,
  fields: ReadonlyArray<{
    readonly name: string
    readonly type: string
    readonly formula?: string
  }>,
  fieldNames: ReadonlySet<string>
): ValidationError | undefined => {
  if (table.permissions) {
    const permissions = table.permissions as {
      readonly fields?: ReadonlyArray<{ readonly field: string }>
    }
    const permissionsError = validateTablePermissions(permissions, fields, fieldNames)
    if (permissionsError) return permissionsError
  }

  const views = table.views as
    ReadonlyArray<{ readonly id: string | number; readonly isDefault?: boolean }> | undefined
  if (views && views.length > 0) {
    const viewsError = validateViews(views, fields, fieldNames)
    if (viewsError) return viewsError
  }

  return undefined
}

const validateTableSchema = (table: Record<string, unknown>): ValidationError | true => {
  const fields = table.fields as ReadonlyArray<{
    readonly name: string
    readonly type: string
    readonly formula?: string
  }>
  const fieldNames = new Set(fields.map((field) => field.name))

  const formulaError = validateFormulaFields(fields)
  if (formulaError) return formulaError

  const structureError = validateStructure(table, fieldNames)
  if (structureError) return structureError

  const accessError = validateAccessAndViews(table, fields, fieldNames)
  if (accessError) return accessError

  const webhookError = validateWebhooks(table, fieldNames)
  if (webhookError) return webhookError

  return true
}

type WebhookForValidation = {
  readonly name: string
  readonly payload?: {
    readonly includeFields?: ReadonlyArray<string>
    readonly excludeFields?: ReadonlyArray<string>
  }
}

const validateWebhookPayloadFields = (
  webhooks: ReadonlyArray<WebhookForValidation>,
  fieldNames: ReadonlySet<string>
): ValidationError | undefined => {
  const isKnown = (field: string): boolean => field === 'id' || fieldNames.has(field)
  const offending = webhooks.flatMap((webhook) => {
    const selectors = [
      ...(webhook.payload?.includeFields ?? []),
      ...(webhook.payload?.excludeFields ?? []),
    ]
    return selectors
      .filter((field) => !isKnown(field))
      .map((field) => ({ webhook: webhook.name, field }))
  })
  const first = offending[0]
  if (first) {
    return {
      message: `Webhook '${first.webhook}' payload references field '${first.field}' which does not exist on the table`,
      path: ['webhooks'],
    }
  }
  return undefined
}

const validateWebhooks = (
  table: Record<string, unknown>,
  fieldNames: ReadonlySet<string>
): ValidationError | undefined => {
  const webhooks = table.webhooks as ReadonlyArray<WebhookForValidation> | undefined
  if (!webhooks || webhooks.length === 0) return undefined

  const names = webhooks.map((webhook) => webhook.name)
  const duplicate = names.find((name, index) => names.indexOf(name) !== index)
  if (duplicate !== undefined) {
    return {
      message: `Duplicate webhook name '${duplicate}': webhook names must be unique within a table`,
      path: ['webhooks'],
    }
  }

  return validateWebhookPayloadFields(webhooks, fieldNames)
}

export const TableSchema = Schema.Struct({
  id: Schema.optional(TableIdSchema),
  name: NameSchema,
  fields: FieldsSchema,
  primaryKey: Schema.optional(PrimaryKeySchema),
  indexes: Schema.optional(IndexesSchema),

  unique: Schema.optional(
    Schema.Array(
      Schema.Struct({
        fields: Schema.Array(Schema.String).pipe(
          Schema.minItems(1, { message: () => 'At least one field is required' })
        ),
      })
    ).pipe(
      Schema.annotations({
        title: 'Table Unique Constraints',
        description:
          'Top-level unique-constraint declarations. Each entry covers one or more fields.',
        examples: [[{ fields: ['slug'] }], [{ fields: ['tenant_id', 'slug'] }]],
      })
    )
  ),
  views: Schema.optional(Schema.Array(ViewSchema)),

  foreignKeys: Schema.optional(Schema.Array(ForeignKeySchema)),

  constraints: Schema.optional(CheckConstraintsSchema),

  permissions: Schema.optional(TablePermissionsSchema),

  rowLevelPermissions: Schema.optional(RowLevelPermissionsSchema),

  allowDestructive: Schema.optional(Schema.Boolean),

  allowForceDelete: Schema.optional(Schema.Boolean),

  webhooks: Schema.optional(
    Schema.Array(WebhookSchema).pipe(
      Schema.annotations({
        title: 'Table Webhooks',
        description: 'Outgoing webhooks triggered on record create/update/delete events',
      })
    )
  ),

  comments: Schema.optional(CommentsConfigSchema),

  aiAccess: Schema.optional(AiAccessSchema),
}).pipe(
  Schema.annotations({
    identifier: 'Table',
    title: 'Table',
    description:
      'A database table that defines the structure of an entity in your application. Contains fields, constraints, and indexes to organize and validate data.',
    examples: [
      {
        id: 1,
        name: 'users',
        fields: [
          { id: 1, name: 'email', type: 'email' as const, required: true },
          { id: 2, name: 'name', type: 'single-line-text' as const, required: true },
        ],
      },
      {
        id: 2,
        name: 'products',
        fields: [
          { id: 1, name: 'title', type: 'single-line-text' as const, required: true },
          {
            id: 2,
            name: 'price',
            type: 'currency' as const,
            required: true,
            currency: 'USD',
          },
          { id: 3, name: 'description', type: 'long-text' as const, required: false },
        ],
        primaryKey: { type: 'composite', fields: ['id'] },
      },
    ],
  }),
  Schema.filter(validateTableSchema)
)

export type Table = Schema.Schema.Type<typeof TableSchema>

export * from './constraints'
export * from './fields/field-name'
export * from './fields/field-types'
export * from './fields'
export * from './foreign-keys'
export * from './id'
export * from './indexes'
export * from './name'
export * from './permissions'
export * from './primary-key'
export * from './row-level-permissions'
export * from './views'
