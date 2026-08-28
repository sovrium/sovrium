/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

/**
 * Component type literal for the public-pages search component.
 *
 * Activation gate: the presence of any `type: 'pageSearch'` component anywhere
 * in `app.pages[].components[]` is what causes `sovrium build` and
 * `sovrium start` to emit the static search index (under
 * `<outputDir>/sovrium-search/`). No env var, no top-level config — the schema
 * declares intent, the build/start path activates it.
 *
 * The indexer crawls only public pages (`access` missing or `access: 'all'`).
 * Pages with `access: 'authenticated'`, role arrays, or extended
 * `require`-based access are excluded from the index.
 */
export const PageSearchTypeLiteral = Schema.Literal('pageSearch')

export const pageSearchFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  placeholder: Schema.optional(Schema.String),
  maxResults: Schema.optional(
    Schema.Finite.pipe(Schema.check(Schema.isInt(), Schema.isGreaterThan(0)))
  ),
} as const
