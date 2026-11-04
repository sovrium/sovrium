/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Contract for a surface brief, `.impeccable/surfaces/<slug>.md`: the YAML
 * front matter naming the files one surface is made of, and the Mode its
 * `## Scope and mode` section states.
 *
 * `sovrium design-system --format design-md --output <file>` writes one brief
 * per zone of the app, beside the DESIGN.md, and never replaces one that
 * exists: a brief is meant to be completed by hand.
 *
 * ─── THE SLUG ──────────────────────────────────────────────────────────────
 *
 * The slug is the primary target's path, lowercased, every run of other
 * characters turned into one `-`: `config/pages/dashboard.yaml` becomes
 * `config-pages-dashboard-yaml`. The file is named after it.
 *
 * ─── THE MODE ──────────────────────────────────────────────────────────────
 *
 * One line of the body, `Mode: <mode>`, names what kind of surface it is:
 * one people operate, read, are persuaded by, or experience. A brief whose
 * Mode could not be inferred says so on that line instead.
 */

/** The four kinds of surface a brief's Mode line names. */
export const surfaceModeSchema = Schema.Literals([
  'Operate',
  'Read',
  'Persuade',
  'Experience',
]).annotate({ description: 'What kind of surface it is' })

/** @public */
export type SurfaceMode = Schema.Schema.Type<typeof surfaceModeSchema>

/** A slug: lowercase letters, digits and single hyphens. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** The front matter of a surface brief. Strict: an unknown key is refused. */
export const surfaceBriefFrontMatterSchema = Schema.Struct({
  version: Schema.Literal(1).annotate({ description: 'Brief format version' }),
  slug: Schema.String.annotate({
    description: 'The primary target, lowercased, other characters as `-`',
    examples: ['config-pages-dashboard-yaml'],
  }).check(Schema.isPattern(SLUG_PATTERN)),
  primary_target: Schema.String.annotate({
    description: 'The file the surface is made of, relative to the project root',
    examples: ['config/pages/dashboard.yaml'],
  }).check(Schema.isMinLength(1)),
  related_targets: Schema.Array(Schema.String).annotate({
    description: 'The other files of the same surface',
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'SurfaceBriefFrontMatter',
})

/** @public */
export type SurfaceBriefFrontMatter = Schema.Schema.Type<typeof surfaceBriefFrontMatterSchema>
