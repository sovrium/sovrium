/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context } from 'effect'
import type { Effect } from 'effect'

/**
 * Copies the rules of an email's `<style>` blocks onto the elements they
 * match, and removes the blocks.
 *
 * Mail clients drop `<style>`, so a message styled the way designers write it
 * (a style block and classes) reads unstyled unless each rule travels as a
 * `style` attribute. Callers run it BEFORE the email sanitizer, so an inlined
 * declaration is filtered exactly like an authored `style` attribute. It never
 * loads anything: a linked stylesheet is not followed.
 *
 * A port rather than a kernel function because the inliner is a CSS engine
 * (cheerio and a CSS parser), which has no place in the pure domain.
 */
export class EmailCssInliner extends Context.Service<
  EmailCssInliner,
  {
    readonly inline: (html: string) => Effect.Effect<string>
  }
>()('EmailCssInliner') {}
