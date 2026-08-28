/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionBaseFields } from '../base'

/**
 * Code Action (type: code, operator: runTypescript)
 *
 * Execute a named `execute` function with a typed CodeContext parameter.
 *
 * The body is statically type-checked at SERVER STARTUP via in-process
 * `tsc` against an ambient `declare const context: CodeContext` (see
 * `src/infrastructure/automations/typescript-validator/`). Misconfigured
 * actions short-circuit `startServer` BEFORE the HTTP listener binds —
 * type failures cannot reach traffic time.
 *
 * Context shape: { inputData, actions, env, log, run }
 *
 * In TypeScript configs, developers write:
 *   code: String(async function execute(context: CodeContext) { ... })
 * which gives full IDE autocompletion but serializes to a string at runtime.
 *
 * In YAML configs, developers write the function as a multiline string.
 *
 * The `actions` context provides programmatic access to ALL action types:
 *   actions.record.create({ table, data })
 *   actions.record.read({ table, filter })
 *   actions.email.send({ to, subject, body })
 *   actions.http.request({ url, method, headers, body })
 *   actions.webhook.send({ url, event, data })
 *   actions.analytics.track({ event, properties })
 *   actions.auth.createUser({ email, name, role })
 */
export const CodeRunTypescriptActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('code'),
  operator: Schema.Literal('runTypescript'),
  props: Schema.Struct({
    /**
     * Code string containing a named `execute` function.
     *
     * TypeScript source — validated at server startup by in-process `tsc`.
     *
     * TypeScript configs: `String(async function execute(context: CodeContext) { ... })`
     * YAML configs: multiline string with `async function execute(context) { ... }`
     */
    code: Schema.String.pipe(
      Schema.check(Schema.isMinLength(1)),
      Schema.annotate({
        description:
          'TypeScript source for a named `execute(context)` function — validated at server startup. Context provides: { inputData, actions, env, log, run }. In TS configs use String(function execute(context: CodeContext) { ... }) for IDE autocompletion.',
      })
    ),

    /** Input data (template-resolved key-value pairs passed to code context) */
    inputData: Schema.optional(
      Schema.Record(Schema.String, Schema.Unknown).pipe(
        Schema.annotate({
          description:
            'Template-resolved key-value pairs passed as inputData to code context. Separates template resolution from code execution.',
        })
      )
    ),

    /** Timeout in milliseconds (default: 30000) */
    timeout: Schema.optional(
      Schema.Finite.pipe(
        Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 1000, maximum: 300_000 })),
        Schema.annotate({
          description: 'Execution timeout in ms (1000-300000, default: 30000)',
        })
      )
    ),
  }),
}).pipe(
  Schema.annotate({
    identifier: 'CodeRunTypescriptAction',
    title: 'Code Run TypeScript Action',
    description:
      'Execute a named execute(context) function with typed CodeContext including actions and structured logging — body is type-checked at server startup',
  })
)

/** @public */
export type CodeRunTypescriptAction = Schema.Schema.Type<typeof CodeRunTypescriptActionSchema>
