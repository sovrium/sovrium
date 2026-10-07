/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context } from 'effect'

/**
 * What the automation engine asks of a template engine: render an authored
 * `{{...}}` string against a context, and tell a registered helper name from
 * a path.
 *
 * Both are synchronous and total. A template that fails to compile, or a
 * helper that throws, renders as its own input — a malformed template in
 * authored config must never crash a run — so there is no error channel to
 * carry.
 */
export interface TemplateRenderer {
  /** Render `template` against `context`. Unknown paths render as `''`. */
  readonly render: (template: string, context: Readonly<Record<string, unknown>>) => string
  /**
   * Whether `name` is a helper the engine registers (`now`, `uppercase`, …),
   * as opposed to a path that is merely missing from the context.
   */
  readonly isHelper: (name: string) => boolean
}

/**
 * The template engine behind `{{...}}` substitution in automation props.
 *
 * A port because the engine is a dependency the use-cases should not choose:
 * the Handlebars environment, its registered helpers and its compile cache
 * live in infrastructure, and the run loop reads the engine once and threads
 * the {@link TemplateRenderer} it got down to the synchronous resolvers on the
 * step and action contexts it already builds.
 */
export class TemplateEngine extends Context.Service<TemplateEngine, TemplateRenderer>()(
  'TemplateEngine'
) {}
