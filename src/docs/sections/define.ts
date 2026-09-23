/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The shape of a documentation section and its articles.
 *
 * TYPES AND IDENTITY FUNCTIONS ONLY. No Effect, no schema decoding, no I/O —
 * a manifest is data the `docs` verb reads, and it must cost nothing to import
 * from a test or from a build script.
 *
 * ─── WHAT EACH FIELD IS FOR ────────────────────────────────────────────────
 *
 * `body` is the fragment, imported `with { type: 'file' }`, so the value is a
 * PATH and the prose is never loaded until something reads it.
 *
 * `documents` names the schemas whose option tables the fragment's
 * `<!-- sovrium:options X -->` directives expand. They are imported BY VALUE
 * rather than by name so that deleting a schema fails `tsc` here, at the
 * manifest, instead of at the moment a reader asks for the article.
 *
 * `stories` names the user stories the article documents. The behaviour block
 * is rendered from their passing acceptance criteria, and the coverage
 * analysis reads the same list from the other end — every implemented story
 * must be cited by exactly one article.
 */

/** One schema whose options a fragment expands. Opaque here on purpose. */
export type DocumentedSchema = unknown

export interface DocArticle {
  /** URL-safe identifier, unique across every section. */
  readonly slug: string
  readonly title: string
  readonly description: string
  readonly keywords: readonly string[]
  /** Sort order within the section. Unique per section. */
  readonly order: number
  readonly sidebarLabel: string
  /** Path to the `*.docs.md` fragment, imported `with { type: 'file' }`. */
  readonly body: string
  /** Schemas the fragment's `sovrium:options` directives name. */
  readonly documents: readonly DocumentedSchema[]
  /** `US-…` ids whose acceptance criteria become the Behaviour block. */
  readonly stories: readonly string[]
}

export interface DocSection {
  /** URL-safe identifier, unique across the manual. */
  readonly slug: string
  readonly title: string
  /** Sort order across sections. */
  readonly order: number
  /** The navigation group this section belongs to. */
  readonly tab: string
  readonly articles: readonly DocArticle[]
}

/**
 * Identity functions that exist for their TYPE, not their behaviour.
 *
 * Writing `defineArticle({ … })` rather than a bare object literal is what
 * makes an unknown key, a missing field or a wrong type an error at the call
 * site — on the line the author is looking at — instead of an error at the
 * array that collects them.
 */
export const defineArticle = (article: DocArticle): DocArticle => article

export const defineSection = (section: DocSection): DocSection => section
