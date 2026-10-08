/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * The annotation key that marks a prop as template TEXT.
 *
 * Every other `TemplateString` prop is substituted by the run's generic pass
 * before its handler runs. A prop carrying this annotation is SKIPPED by that
 * pass — both the pre-dispatch one and the MCP-invoked one — and rendered once
 * by its own action, with escaping on, against the action's `data` only.
 *
 * ## The contract a reader of the schema relies on
 *
 * - The skip list is DERIVED from the schema, never hand-written: walk the
 *   automation action union, and every string node whose annotations carry
 *   this key contributes its `type/operator` and prop path to the table. A
 *   parity test holds that derived table against the props a handler reads as
 *   templates, so a new template-bearing prop cannot be pre-rendered by
 *   omission.
 * - The value is the escaping mode the action renders with:
 *   - `html` escapes HTML (HTML and SVG templates, email bodies),
 *   - `xml` escapes XML entities (OOXML parts),
 *   - `text` escapes nothing (a plain-text email part).
 * - A handler never reads such a prop through the whole-string `{{path}}`
 *   shortcut, which would bypass the template engine and its escaping.
 */
export const TEMPLATE_CONTEXT_ANNOTATION = 'templateContext' as const

/** The escaping mode of a template body — chosen by the output, never by the author. */
export const TEMPLATE_CONTEXTS = ['html', 'xml', 'text'] as const

/** @public */
export type TemplateContext = (typeof TEMPLATE_CONTEXTS)[number]

const TEMPLATE_BODY_DESCRIPTIONS: Readonly<Record<TemplateContext, string>> = {
  html: 'Template text rendered by the action with HTML escaping: {{value}} prints as text, {{{safeHtml value}}} keeps sanitized rich text. It reads the action data only.',
  xml: 'Template text rendered by the action with XML escaping. It reads the action data only.',
  text: 'Template text rendered by the action with no escaping, for a plain-text output. It reads the action data only.',
}

/**
 * A `TemplateString` variant holding template TEXT, rendered by its action.
 *
 * Same wire type as {@link TemplateStringSchema} — a string — so a config
 * author writes it the same way; only the annotation differs, and the
 * annotation is what tells the run's generic pass to leave it alone.
 */
export const templateBodySchema = (context: TemplateContext) =>
  Schema.String.pipe(
    Schema.annotate({
      title: 'Template Body',
      description: TEMPLATE_BODY_DESCRIPTIONS[context],
      [TEMPLATE_CONTEXT_ANNOTATION]: context,
    })
  )
