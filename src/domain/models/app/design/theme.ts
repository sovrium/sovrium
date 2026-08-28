/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { ThemeSchema, type Theme } from '../theme'

/**
 * The mount point for `design.theme`.
 *
 * THIS FILE MOVES NOTHING. `src/domain/models/app/theme/` stays exactly where
 * it is — ~38 modules read `app.theme`, the CSS compiler is one of them, and
 * two unskippable drift checks AST-parse the theme generators. Relocating the
 * directory would turn a schema-shape change into a repo-wide import churn for
 * no gain.
 *
 * What changes is COMPOSITION, not layout: `design/index.ts` re-mounts the same
 * `ThemeSchema` under the new `design` key, so one theme definition serves both
 * the canonical `design.theme` position and the deprecated top-level `theme`
 * alias. Two schemas would be two things to keep in sync, and they would drift.
 *
 * The module exists as a distinct file rather than an inline import in
 * `index.ts` because `design` is a top-level AppSchema property, and the
 * folder-structure gate in `[internal ref]` requires every
 * non-simple property of a schema folder to have a mirroring `{kebab}.ts` file
 * or subfolder. A one-line re-export satisfies that by naming the mount
 * explicitly, which is also the clearest place to explain why the directory did
 * not move.
 */
export const DesignThemeSchema = ThemeSchema

/** The theme type, re-exported under the design namespace. @public */
export type DesignTheme = Theme
