/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isOperatorConsoleApp } from '@/domain/models/app/admin/admin-data-nav'
import { collectDeclaredComponentTypes } from '@/domain/models/app/pages/declared-component-types'
import { collectAppCandidates } from '@/infrastructure/css/native-free-compiler'
import type { App } from '@/domain/models/app'

/**
 * Whether an app's stylesheet carries the Typeset sheets.
 *
 * Typeset is about 13 KB of plain CSS. The candidate-driven compiler cannot
 * drop it the way it drops an unused utility — it is not a utility, and its
 * `typeset` class name sits in the core candidate set because the markdown
 * article draws it — so it is gated here instead, on the three things that set
 * prose with it:
 *
 *  - a **markdown page**: one declaring `markdown`, a `contentDir`, or a
 *    `.md` `source.file` (the resolver's three triggers);
 *  - an **ai-chat** component, whose answer is set with the chat preset;
 *  - an authored **`typeset` class** — the `content-prose` library block
 *    writes one onto its article, and an author may write it anywhere.
 *
 * It answers `true` wherever the narrowing cannot be trusted, the same places
 * the candidate set falls back to the whole built-in corpus: no app (the
 * generic compile, which must stay a superset of every app's), the operator
 * console, and a config whose component types cannot be read. Over-including
 * costs bytes; under-including would set a page's prose unstyled.
 *
 * Pure. The compile key folds the answer in (`cssCompileKey`), so two apps
 * alike in every other input but this one never share a cached stylesheet.
 */
export const appSetsTypeset = (app?: App): boolean => {
  if (app === undefined || isOperatorConsoleApp(app)) return true
  const declared = collectDeclaredComponentTypes(app)
  if (declared === 'all' || declared.has('ai-chat')) return true
  return (
    (app.pages ?? []).some(
      (page) =>
        page.markdown !== undefined ||
        page.contentDir !== undefined ||
        (typeof page.source?.file === 'string' && page.source.file.toLowerCase().endsWith('.md'))
    ) || collectAppCandidates(app).includes('typeset')
  )
}
