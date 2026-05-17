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
 * Context shape: { trigger, steps, env, actions, log, inputData, packages }
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
 *
 * The `packages` context provides access to declared npm packages:
 *   const _ = context.packages.lodash
 *   const { format } = context.packages['date-fns']
 *
 * Packages are resolved and installed at app start (or via `sovrium install`).
 * A lockfile (`sovrium.lock`) ensures deterministic subsequent installs.
 * Packages support optional version pinning: `lodash@4.17.21`, `date-fns@^3.0.0`.
 * Undeclared packages throw at runtime.
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
      Schema.minLength(1),
      Schema.annotations({
        description:
          'TypeScript source for a named `execute(context)` function — validated at server startup. Context provides: { trigger, steps, env, actions, log, inputData, packages }. In TS configs use String(function execute(context: CodeContext) { ... }) for IDE autocompletion.',
      })
    ),

    /** Input data (template-resolved key-value pairs passed to code context) */
    inputData: Schema.optional(
      Schema.Record({ key: Schema.String, value: Schema.Unknown }).pipe(
        Schema.annotations({
          description:
            'Template-resolved key-value pairs passed as inputData to code context. Separates template resolution from code execution.',
        })
      )
    ),

    /**
     * Alias for {@link inputData} — template-resolved key-value pairs surfaced
     * to the sandbox as `context.input`. Provided for parity with the
     * cross-cutting action-feature convention where steps reference prior
     * outputs via `{{stepName.property}}` and type helpers
     * (`{{number ...}}`, `{{json ...}}`, etc.).
     */
    input: Schema.optional(
      Schema.Record({ key: Schema.String, value: Schema.Unknown }).pipe(
        Schema.annotations({
          description:
            'Template-resolved key-value pairs passed as `context.input` to the code sandbox. Same resolution rules as inputData.',
        })
      )
    ),

    /** NPM packages to make available in the execution sandbox (with optional version pinning) */
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

    /** Timeout in milliseconds (default: 30000) */
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

/** @public */
export type CodeRunTypescriptAction = Schema.Schema.Type<typeof CodeRunTypescriptActionSchema>
