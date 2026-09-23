/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { AiAccessSchema } from '@/domain/models/app/auth/ai-access'
import { ActionSchema } from './action'
import { ActionTemplateVariablesSchema } from './variables'

/**
 * Reusable Action Template Schema
 *
 * A preconfigured action template that can be referenced in automations
 * using the $ref pattern (similar to how components work for pages).
 */
export const ActionTemplateSchema = Schema.Struct({
  /** Unique template name for $ref referencing */
  name: Schema.String.pipe(
    Schema.annotate({
      description: 'Unique action template name for $ref referencing (kebab-case)',
    }),
    Schema.check(
      Schema.isPattern(/^[a-z][a-z0-9-]*$/),
      Schema.isMinLength(1),
      Schema.isMaxLength(100)
    )
  ),

  /** The action configuration (any action type) */
  // NOTE: no annotation here. `ActionSchema` is a codec whose ENCODED side is
  // `Schema.Unknown`, and `Schema.Unknown` discards every annotation on the way
  // to JSON Schema (measured on effect 4.0.0-rc.108, in every position). The
  // prose lives on `ActionSchema` itself, where the AST keeps it.
  action: ActionSchema,

  /** Variable declarations with defaults */
  variables: Schema.optional(ActionTemplateVariablesSchema),

  /**
   * AI/MCP exposure configuration.
   *
   * Declares this action template as a directly-invocable MCP tool. The tool's
   * input parameter schema is derived from `variables` (each variable becomes
   * a tool parameter). Tool name follows `{appName}_action_{name}`.
   *
   * Whether the operator actually mounts the MCP server is controlled
   * separately via `MCP_ENABLED`. This flag is the schema author's
   * declaration of intent; the operator decides activation.
   *
   * @example AI-callable archive-record action
   * ```typescript
   * {
   *   name: 'archive-record',
   *   variables: { table: '', id: '' },
   *   action: {
   *     type: 'record', operator: 'update',
   *     props: { table: '$table',
   *              filter: { conditions: [{ field: 'id', operator: 'equals', value: '$id' }] },
   *              data: { archived_at: '{{now}}' } }
   *   },
   *   aiAccess: {
   *     description: 'Archive a record by setting its archived_at timestamp.',
   *     annotations: { readOnly: false, destructive: false, idempotent: true },
   *   },
   * }
   * ```
   *
   * @see AiAccessSchema for full configuration options
   */
  aiAccess: Schema.optional(AiAccessSchema),
}).pipe(
  Schema.annotate({
    identifier: 'ActionTemplate',
    title: 'Reusable Action Template',
    description: 'Preconfigured action template reusable across automations via $ref',
  })
)

export type ActionTemplate = Schema.Schema.Type<typeof ActionTemplateSchema>

/**
 * Reserved template names — these collide with the runtime `context.actions`
 * proxy's reserved methods exposed to code action bodies. A schema author
 * naming a template `ref` would shadow `context.actions.ref('<name>', vars)`
 * and break runtime template invocation; reject at schema-validation time
 * so the failure surfaces with a clear domain-specific message instead of
 * a confusing runtime error.
 */
const RESERVED_TEMPLATE_NAMES: ReadonlySet<string> = new Set(['ref'])

/**
 * Action Templates Array (top-level property on AppSchema)
 */
export const ActionTemplatesSchema = Schema.Array(ActionTemplateSchema).pipe(
  Schema.annotate({
    identifier: 'ActionTemplates',
    title: 'Reusable Action Templates',
    description:
      'Library of preconfigured action templates reusable across automations via $ref pattern',
  }),
  Schema.check(
    Schema.makeFilter((templates) => {
      const names = templates.map((t) => t.name)
      const uniqueNames = new Set(names)
      if (names.length !== uniqueNames.size) return 'Action template names must be unique'
      const reserved = names.find((n) => RESERVED_TEMPLATE_NAMES.has(n))
      if (reserved !== undefined) {
        return `Action template name '${reserved}' is reserved (collides with the runtime context.actions.${reserved}() method exposed to code action bodies). Rename the template.`
      }
      return true
    })
  )
)

/** @public */
export type ActionTemplates = Schema.Schema.Type<typeof ActionTemplatesSchema>
