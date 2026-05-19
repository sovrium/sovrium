/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'


export const ToolAnnotationsSchema = Schema.Struct({
  readOnly: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({
        description: 'Tool only reads data; safe to auto-approve. Maps to MCP readOnlyHint.',
      })
    )
  ),
  destructive: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({
        description:
          'Tool performs destructive operations (delete, send email, charge card); clients should require explicit confirmation. Maps to MCP destructiveHint.',
      })
    )
  ),
  idempotent: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({
        description:
          'Calling the tool twice with the same args is safe (no duplicate side effects). Maps to MCP idempotentHint.',
      })
    )
  ),
  openWorld: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({
        description:
          'Tool reaches outside the local app (external API, network call). Maps to MCP openWorldHint.',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'ToolAnnotations',
    title: 'MCP Tool Risk Annotations',
    description:
      'Risk hints exposed to MCP clients to drive auto-approve vs. confirmation UX. Optional; sensible defaults are derived from the operation type when unset.',
  })
)

export type ToolAnnotations = typeof ToolAnnotationsSchema.Type


export const AiAccessOperationSchema = Schema.Literal('read', 'list', 'create', 'update', 'delete')

export type AiAccessOperation = typeof AiAccessOperationSchema.Type

export const FieldExposureSchema = Schema.Literal('all', 'permissioned', 'whitelist')

export type FieldExposure = typeof FieldExposureSchema.Type

export const AiAccessConfigSchema = Schema.Struct({
  description: Schema.optional(
    Schema.String.pipe(
      Schema.maxLength(2000),
      Schema.annotations({
        description:
          'Hand-written description shown to the AI client. Overrides auto-generated descriptions. The single biggest UX lever for steering AI behavior — explain when to use this tool, what context the AI needs, and any non-obvious constraints.',
      })
    )
  ),
  operations: Schema.optional(
    Schema.Array(AiAccessOperationSchema).pipe(
      Schema.minItems(1),
      Schema.annotations({
        description:
          'Subset of CRUD operations to expose. Defaults to all 5 (read, list, create, update, delete) for tables. Automations and actions ignore this field — they expose a single invocation tool.',
      })
    )
  ),
  fieldExposure: Schema.optional(
    FieldExposureSchema.pipe(
      Schema.annotations({
        description:
          'Field exposure mode. Defaults to permissioned (only fields the connecting role can read/write per RBAC).',
      })
    )
  ),
  whitelistFields: Schema.optional(
    Schema.Array(Schema.String.pipe(Schema.minLength(1))).pipe(
      Schema.annotations({
        description:
          'Fields to expose when fieldExposure=whitelist. Required and must be non-empty when fieldExposure=whitelist; ignored otherwise.',
      })
    )
  ),
  annotations: Schema.optional(ToolAnnotationsSchema),
  requireConfirmation: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({
        description:
          'Force destructiveHint=true on the resulting MCP tool regardless of operation type. Use for automations/actions whose effects are non-reversible (e.g. sending emails) even if technically idempotent.',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'AiAccessConfig',
    title: 'AI Access Configuration (rich form)',
    description:
      'Object form for entities needing custom AI exposure config. Supplying any config IS the enable signal — no separate enabled field.',
  })
)

export type AiAccessConfig = typeof AiAccessConfigSchema.Type

export const AiAccessSchema = Schema.Union(Schema.Boolean, AiAccessConfigSchema).pipe(
  Schema.annotations({
    identifier: 'AiAccess',
    title: 'AI Access',
    description:
      'Per-entity declaration of MCP/AI exposure intent. Boolean shorthand (true = enabled with defaults) or rich config object. Schema author declares; operator activates via MCP_ENABLED env var.',
    examples: [
      true,
      false,
      { description: 'Customer contacts', operations: ['read', 'list'] as const },
    ],
  })
)

export type AiAccess = typeof AiAccessSchema.Type

export const isAiAccessEnabled = (access: AiAccess | undefined): boolean => {
  if (access === undefined) return false
  if (typeof access === 'boolean') return access
  return true
}
