/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a manual render answers: the text, or why it was refused. The
 * renderers in `docs-markdown.ts` and `docs-frontmatter.ts` stay pure and
 * synchronous and return a {@link Rendering}; the site export and the CLI each
 * decide what a refusal becomes.
 */

import { Data } from 'effect'

/**
 * A directive naming a schema the registry does not hold.
 *
 * Tagged so a caller can tell it from a genuine programming error: the CLI
 * prints it as a bad-fragment message, while anything else is a crash.
 */
export class UnknownDocsDirectiveError extends Data.TaggedError('UnknownDocsDirectiveError')<{
  readonly identifier: string
  readonly known: readonly string[]
}> {
  override get message(): string {
    return (
      `Unknown sovrium:options identifier "${this.identifier}". ` +
      `The registry holds: ${this.known.length === 0 ? '(nothing)' : this.known.join(', ')}.`
    )
  }
}

/**
 * A directive whose schema resolves but publishes no options.
 *
 * The same failure as an unknown identifier wearing a different cause: the
 * fragment promised a table and the page ships without one. It is separate from
 * {@link UnknownDocsDirectiveError} because the fix is different — that one is a
 * typo, this one is a directive aimed one node too high.
 *
 * Measured, it is almost always an ARRAY root. `RedirectsSchema` is
 * `Schema.Array(RedirectSchema)`, and the walk addresses `Objects`, `Union` and
 * `Suspend` roots only, so a fragment naming the plural gets silence where it
 * wanted the element's four options. Hence the tag in the message: it is the one
 * fact that tells an author which schema to name instead.
 */
export class EmptyDocsDirectiveError extends Data.TaggedError('EmptyDocsDirectiveError')<{
  readonly identifier: string
  readonly rootTag: string
}> {
  override get message(): string {
    return (
      `The sovrium:options identifier "${this.identifier}" resolves to a ` +
      `${this.rootTag} node, which publishes no options. Name the schema whose ` +
      `keys the table should list — for an array, that is its element schema.`
    )
  }
}

/** Why a fragment's directive could not become a table. */
export type DocsDirectiveError = UnknownDocsDirectiveError | EmptyDocsDirectiveError

/**
 * A render, or the first reason it was refused. The renderers stay pure and
 * synchronous; the site export turns a refusal into its typed failure and the
 * CLI prints it as a bad-fragment message.
 */
export type Rendering<A, E> =
  { readonly ok: true; readonly value: A } | { readonly ok: false; readonly error: E }

/** A render that succeeded. */
export const rendered = <A>(value: A): Rendering<A, never> => ({ ok: true, value })

/** A render that was refused. */
export const refused = <E>(error: E): Rendering<never, E> => ({ ok: false, error })
