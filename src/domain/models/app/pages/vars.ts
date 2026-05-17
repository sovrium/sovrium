/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Page-level variables for substitution in sections
 *
 * Variables can be referenced in section content, props, and children using
 * $variableName syntax. These variables are substituted at runtime.
 *
 * Page-level variables provide values for sections without component references.
 * They complement component-level vars (from $ref with $vars) for direct sections.
 *
 * @example
 * ```yaml
 * vars:
 *   siteName: Sovrium
 *   primaryColor: blue
 * ```
 */
export const PageVarsSchema = Schema.Record({
  key: Schema.String,
  value: Schema.Union(Schema.String, Schema.Number, Schema.Boolean),
}).pipe(
  Schema.annotations({
    identifier: 'PageVars',
    title: 'Page Variables',
    description:
      'Key-value variables for substitution in page sections. Values can be strings, numbers, or booleans.',
  })
)

/** @public */
export type PageVars = Schema.Schema.Type<typeof PageVarsSchema>
