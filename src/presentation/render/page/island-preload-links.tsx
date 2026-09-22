/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ReactElement } from 'react'

/**
 * `<link rel="modulepreload">` for the island chunks this page mounts.
 *
 * NOT AN OPTIMISATION — `crud-form` needs these links to be CORRECT
 * ----------------------------------------------------------------
 * The island entry is ONE deferred module script, and a browser fetches its
 * static import closure whole before evaluating a line of it. That is why
 * almost every island is behind `import()` (see
 * `@/presentation/islands/island-registry`) and resolved by a runtime preload
 * pass instead.
 *
 * The runtime pass buys *"resolved before the mount pass"*, never *"resolved
 * before `load`"*: a module script's top-level `await` does not hold back the
 * load event, and `page.goto()` returns on `load`. The `crud-form` chunk pulls a
 * sub-graph (react-hook-form, zod, the field renderers), so it lost that race
 * consistently — the island mounted just after `load`, a `setInputFiles` had
 * already landed on the SSR `<input type="file">`, and React discarded the value
 * on its first render. The form looked perfect and dropped the file.
 *
 * A link here is discovered at HTML-PARSE time, so the chunk fetch runs BESIDE
 * the entry rather than behind it and the entry's own `import()` finds the
 * module already in the map. Measured by mutation on 2026-09-02: with these
 * links 17/17 of `[internal ref]`
 * pass, with them suppressed 7/17.
 *
 * The hrefs are resolved per page by `resolveIslandAssets`
 * (`@/presentation/rendering/render-page`) and scoped to the island types the
 * page declares, so a page mounting no form island emits nothing at all. That
 * scoping is the point: the unscoped shape would put every preloadable island's
 * sub-graph into every island-bearing page's `<head>`, which is the defect this
 * whole line of work removed from the runtime path.
 *
 * See `@/infrastructure/assets/island-preload-manifest` for how a chunk href is
 * derived from the emitted bundle, and why the map covers two island types.
 */
export function IslandPreloadLinks({
  hrefs,
}: {
  readonly hrefs?: readonly string[]
}): readonly ReactElement[] {
  return (hrefs ?? []).map((href) => (
    <link
      key={href}
      rel="modulepreload"
      href={href}
    />
  ))
}
