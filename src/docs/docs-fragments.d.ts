/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Ambient declaration for the co-located documentation fragments.
 *
 * A `*.docs.md` sits beside the schema it documents and is pulled into a
 * section manifest by import, so that moving or deleting a fragment fails
 * `tsc` rather than silently emptying an article.
 *
 * ─── THE IMPORT ATTRIBUTE IS LOAD-BEARING, AND THIS SHIM CANNOT ENFORCE IT ──
 *
 * On Bun 1.4.2 the same specifier resolves three different ways depending on
 * the attribute, and **all three satisfy the `string` below**:
 *
 *   import body from './x.docs.md'                      → rendered HTML
 *   import body from './x.docs.md' with { type: 'text' } → the markdown source
 *   import body from './x.docs.md' with { type: 'file' } → a PATH to the file
 *
 * Only the third is wanted: the payload is embedded as a file and read lazily,
 * so `sovrium start` never loads a byte of prose. Typing the export as a path
 * string documents the intent and catches nothing, which is why
 * `docs-structure.test.ts` asserts at runtime that every imported body is a
 * path ending in `.docs.md` rather than a document that begins with `<h1>`.
 */
declare module '*.docs.md' {
  /** Absolute path to the fragment — a real file in dev, `/$bunfs/…` in the binary. */
  const path: string
  export default path
}

/**
 * The cross-cutting articles under `src/docs/{get-started,guides,operations}/`.
 *
 * Deliberately a SECOND declaration rather than a widening of the one above.
 * The two shapes are different things by the placement rule — a `*.docs.md` is
 * a fragment about the code beside it, a `src/docs/**` article is prose about a
 * workflow that belongs to no single feature — and every gate that walks
 * documentation tells them apart by exactly this filename distinction
 * (`isManualPath` in `[internal ref]`, `collectFragments` in
 * `[internal ref]`). Naming the cross-cutting articles
 * `*.docs.md` to reuse one declaration would put them in the fragment
 * denominator, where they would each be a fragment in a directory
 * DOC_BEARING_DIRECTORIES does not name.
 *
 * TypeScript resolves the most specific wildcard, so a `*.docs.md` specifier
 * still matches the declaration above and this one never shadows it.
 */
declare module '*.md' {
  /** Absolute path to the article — a real file in dev, `/$bunfs/…` in the binary. */
  const path: string
  export default path
}
