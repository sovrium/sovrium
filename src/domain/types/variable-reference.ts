/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

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
