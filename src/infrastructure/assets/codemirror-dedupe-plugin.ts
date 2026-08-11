/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { BunPlugin } from 'bun'

/**
 * Bun.build plugin that forces every `@codemirror/*` (and `@lezer/*`) import to
 * resolve to a SINGLE top-level copy.
 *
 * Why this exists: the dependency tree ships multiple nested copies of
 * `@codemirror/state` (top-level `6.7.1`, but every `@codemirror/*` package
 * carries its own nested `6.6.0`). CodeMirror's extension system relies on
 * per-module Facet identity — an `Extension` produced by a language package
 * (`json()`, `yaml()`, …) built against one `@codemirror/state` instance is
 * NOT recognized by the `flatten`/`EditorState.create` code path of a
 * different `@codemirror/state` instance. When the schema-config-editor island
 * bundle pulls in two copies, `EditorState.create` throws
 * `Unrecognized extension value in extension set ([object Object])`, the
 * `<CodeMirror>` component crashes on mount, and (with no error boundary) the
 * island stays stuck on its disabled SSR skeleton — the Submit button never
 * enables.
 *
 * Redirecting all `@codemirror/*` / `@lezer/*` bare specifiers to the top-level
 * package collapses them to one instance, so Facet identity is consistent and
 * the editor hydrates. All copies are semver-compatible (`^6`), so resolving
 * to the newest top-level copy is safe.
 *
 * Applied in BOTH island-bundle build paths:
 *   - dev/runtime build   → `server/route-setup/static-assets.ts`
 *   - packaging/binary    → `scripts/build/lib/runtime-assets.ts`
 */
// eslint-disable-next-line functional/prefer-immutable-types
export const codemirrorDedupePlugin: BunPlugin = {
  name: 'codemirror-single-instance',
  setup(build) {
    build.onResolve({ filter: /^(@codemirror|@lezer)\// }, (args) => ({
      // Resolve from this module's directory: no nested node_modules exists
      // along the `src/` path, so every specifier lands on the single
      // top-level copy under the project's `node_modules`.
      path: Bun.resolveSync(args.path, import.meta.dir),
    }))
  },
}
