/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Variable reference pattern for template substitution
 *
 * Matches strings containing $variableName syntax for runtime substitution.
 * Variables are replaced with values from the 'vars' object when component templates are instantiated.
 *
 * Variable naming rules:
 * - Must start with $ followed by a letter
 * - Can contain only alphanumeric characters after the initial letter
 * - Multiple variables can appear in the same string
 *
 * @example
 * ```typescript
 * const refs = [
 *   '$color',
 *   '$primaryText',
 *   'Welcome to $siteName',
 *   'The $productName costs $price',
 *   '$icon-$size'
 * ]
 * ```
 *
 * @see specs/app/pages/common/variable-reference.schema.json
 */
export const VariableReferenceSchema = Schema.String.pipe(
  Schema.pattern(/^.*\$[a-zA-Z][a-zA-Z0-9]*.*$/, {
    message: () =>
      'Variable reference must contain $variableName where variableName starts with a letter and contains only alphanumeric characters',
  }),
  Schema.annotations({
    title: 'Variable Reference',
    description:
      'Pattern for referencing variables in component templates using $variableName syntax',
    examples: [
      '$color',
      '$primaryText',
      'Welcome to $siteName',
      'The $productName costs $price',
      '$icon-$size',
    ],
  })
)

export type VariableReference = Schema.Schema.Type<typeof VariableReferenceSchema>
