/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionBaseFields } from '../base'

export const CodeRunTypescriptActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('code'),
  operator: Schema.Literal('runTypescript'),
  props: Schema.Struct({
    code: Schema.String.pipe(
      Schema.minLength(1),
      Schema.annotations({
        description:
          'TypeScript source for a named `execute(context)` function — validated at server startup. Context provides: { trigger, steps, env, actions, log, inputData, packages }. In TS configs use String(function execute(context: CodeContext) { ... }) for IDE autocompletion.',
      })
    ),

    inputData: Schema.optional(
      Schema.Record({ key: Schema.String, value: Schema.Unknown }).pipe(
        Schema.annotations({
          description:
            'Template-resolved key-value pairs passed as inputData to code context. Separates template resolution from code execution.',
        })
      )
    ),

    input: Schema.optional(
      Schema.Record({ key: Schema.String, value: Schema.Unknown }).pipe(
        Schema.annotations({
          description:
            'Template-resolved key-value pairs passed as `context.input` to the code sandbox. Same resolution rules as inputData.',
        })
      )
    ),

    packages: Schema.optional(
      Schema.Array(
        Schema.String.pipe(
          Schema.pattern(/^(@[a-z0-9._-]+\/)?[a-z0-9._-]+(@[~^]?[\d.*]+[\w.-]*)?$/),
          Schema.annotations({
            description:
              'npm package specifier with optional version pin (e.g., "lodash", "date-fns@3.6.0", "lodash@^4.0.0", "@scope/pkg@1.2.3")',
          })
        )
      ).pipe(
        Schema.annotations({
          description:
            'NPM packages available via context.packages in the sandbox. Resolved and installed at app start or via `sovrium install`.',
        })
      )
    ),

    timeout: Schema.optional(
      Schema.Number.pipe(
        Schema.int(),
        Schema.between(1000, 300_000),
        Schema.annotations({
          description: 'Execution timeout in ms (1000-300000, default: 30000)',
        })
      )
    ),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'CodeRunTypescriptAction',
    title: 'Code Run TypeScript Action',
    description:
      'Execute a named execute(context) function with typed CodeContext including actions, packages, and structured logging — body is type-checked at server startup',
  })
)

export type CodeRunTypescriptAction = Schema.Schema.Type<typeof CodeRunTypescriptActionSchema>
