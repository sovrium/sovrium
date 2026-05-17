/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Prefill Source — references a `$query.{name}` URL parameter, `$user.{prop}`
 * value, or `$parent.{path}` parent-record reference (for inline-relationship
 * forms). The server resolves these references at render time.
 *
 * Allowed shapes:
 * - `$query.utm_source` — query string parameter
 * - `$user.email` — only allowed when access requires authentication
 * - `$parent.id` / `$parent.<field>` — only valid for inline-relationship
 *   forms embedded in a parent record context (Y-5)
 * - any literal string / number / boolean as a fallback default
 */
export const PrefillSourceSchema = Schema.Union(
  Schema.String.pipe(
    Schema.pattern(/^\$(query|user|parent)\.[a-zA-Z_][a-zA-Z0-9_.]*$/, {
      message: () =>
        'Prefill source must be a literal value or a reference like $query.<name>, $user.<prop>, or $parent.<path>',
    })
  ),
  Schema.String,
  Schema.Number,
  Schema.Boolean
).annotations({
  identifier: 'PrefillSource',
  title: 'Prefill Source',
  description:
    'A literal default value or a $query.{name} / $user.{prop} / $parent.{path} reference',
})

/**
 * Prefill Map — keys are form field names, values are prefill sources.
 */
export const PrefillSchema = Schema.Record({
  key: Schema.String,
  value: PrefillSourceSchema,
}).annotations({
  identifier: 'Prefill',
  title: 'Prefill Configuration',
  description:
    'Map of form field name → prefill source (literal or $query/$user/$parent reference)',
})

/** @public */
export type PrefillSource = Schema.Schema.Type<typeof PrefillSourceSchema>
/** @public */
export type Prefill = Schema.Schema.Type<typeof PrefillSchema>

// ---------------------------------------------------------------------------
// Inline Relationship Prefill (Y-5 — Noloco-style "Add to view" patterns)
// ---------------------------------------------------------------------------

/**
 * Inline Relationship Prefill Schema
 *
 * Configures an inline form embedded in a parent-record context (e.g., a
 * "+ New ticket" button on a Project detail page that prefills the
 * `project_id` relationship). When `lockPrefill: true`, the user cannot
 * override the prefilled value (the field is hidden but submitted as-is).
 * When `lockPrefill: false` (default), the field is shown with the prefill
 * as the initial value but the user may change it.
 *
 * Maps directly to Noloco's documented "Passing linked record values to a
 * form" pattern.
 *
 * @example A "+ New ticket" button on a Project page
 * ```yaml
 * components:
 *   - type: form
 *     formRef: new-ticket
 *     inlinePrefill:
 *       prefill:
 *         project_id: $parent.id
 *         reporter_id: $user.id
 *       lockPrefill: true     # project_id is locked, hidden from UI
 * ```
 */
export const InlinePrefillSchema = Schema.Struct({
  /** Field-name -> prefill-source map (uses the same PrefillSource union) */
  prefill: PrefillSchema,
  /**
   * If true, the prefilled fields are hidden in the UI and the user cannot
   * override them. The values are still validated server-side. Defaults to
   * false (fields are visible with the prefilled values as defaults).
   */
  lockPrefill: Schema.optional(Schema.Boolean),
}).annotations({
  identifier: 'InlinePrefill',
  title: 'Inline Relationship Prefill',
  description:
    'Configures inline-form prefill from a parent record context. Used for "+ New child" patterns.',
})

/** @public */
export type InlinePrefill = Schema.Schema.Type<typeof InlinePrefillSchema>
