/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `code.contentFrom` — fold a system endpoint's ROWS into ONE code block's
 * content.
 *
 * ─── THE GAP THIS CLOSES ───────────────────────────────────────────────────
 *
 * A collection reaches a page today as row ELEMENTS: `expandSystemRowTemplates`
 * clones an arbitrary child template once per row, which is how `/env` became
 * config. What has no expression is a collection folded into a single STRING —
 * one runnable, copyable, syntax-highlighted artifact whose lines are derived
 * from the operator's own declarations.
 *
 * Two measured facts make that gap real rather than stylistic, and both were
 * checked before this field was proposed:
 *
 *  1. `expandDataSourceChildren` wraps every row's clone in a SYNTHESIZED
 *     `{ type: 'li' }` (`data-source-resolver.ts`). Inside a code block's
 *     `<pre>` that is invalid markup, and it renders as a bulleted list wearing
 *     a code frame. So a row template cannot live in a `code` node, even though
 *     `renderCode` does fall back to `content ?? renderedChildren`.
 *  2. `resolvePageCodeHighlights` reads `component.content` and nothing else, so
 *     a children-based block loses Shiki attribution entirely — and the copy
 *     affordance, which resolves its payload from the command `<pre>`, would be
 *     copying list items.
 *
 * The alternative considered and REFUSED was an endpoint publishing the joined
 * string ready-made. That is a rendered string in an API contract: it freezes
 * the console's own prose, comment lines and whitespace into a payload other
 * readers see, and it forecloses `$t:` translation of a line the console wrote.
 * — the rule is that an admin read endpoint publishes FACTS the
 * console gates and templates on, never a string the console would otherwise
 * have composed.
 *
 * ─── HOW IT READS ──────────────────────────────────────────────────────────
 *
 * The binding is fetched on the RENDER path through the same
 * `SystemRowsFetcher` the row-template pass uses, so it borrows the requesting
 * session's own credentials — never the server's (rule S1). Each row substitutes
 * `$record.*` into `template`; the results are joined by `separator`; the joined
 * string becomes the node's `content`, BEFORE the Shiki highlight pass, so the
 * block is attributed and copyable exactly like a hand-written one.
 *
 * Zero rows yield `empty` when the author declared one, and an empty block
 * otherwise. Never the template: a leaked `$record.name` in a block an operator
 * is invited to paste into a shell is worse than a block that says nothing.
 *
 * ─── THE RESULT IS ALWAYS TEXT ─────────────────────────────────────────────
 *
 * `substituteRecordInContent` decides between React children and the
 * `dangerouslySetInnerHTML` sink by sniffing whether the string starts with
 * `<`. A row value is DATA, and data must not pick the sink — so a
 * `contentFrom` result is pinned to the text branch whatever it begins with.
 * An author templating an XML or HTML example gets a code block, not markup.
 *
 * @see src/domain/models/app/pages/components/component-types/content/code-element.ts
 * @see src/domain/models/app/pages/component-rule-validation.ts — the four refusals
 */

import { Schema } from 'effect'
import { optStr } from '../../shared-schemas'

/**
 * Rows-to-one-string binding for a `code` block.
 *
 * A SPECIALIZED source rather than a reuse of `SystemSourceSchema`, following
 * the precedent that module states for itself: `chart` and `kpi` keep their own
 * series- and scalar-shaped sources because the shared rows envelope carries
 * fields that are meaningless to them. The same applies here — `idKey`,
 * `totalKey`, `param`, `bindTo` and `sharedFilter` have no referent in a string
 * fold, and admitting them would publish five options that silently do nothing.
 */
export const CodeContentFromSchema = Schema.Struct({
  /** The read endpoint whose rows compose this block (required). */
  endpoint: Schema.String.pipe(
    Schema.check(Schema.isMinLength(1)),
    Schema.annotate({
      description:
        "Read endpoint whose rows compose this block's content. Fetched on the render path with the caller's own credentials, exactly like a system row template.",
      examples: ['/api/admin/tables/overview', '/api/admin/mcp/tools'],
    })
  ),
  /** Array key in the response envelope (default: 'items'). */
  rowsKey: optStr(
    "Key of the rows array in the response envelope (default: 'items'). Same envelope contract as a system row template."
  ),
  /** Static query params merged into the request. */
  query: Schema.optional(
    Schema.Record(
      Schema.String,
      Schema.Union([Schema.String, Schema.Finite, Schema.Boolean])
    ).annotate({
      description:
        'Static query params merged into the request to the endpoint. Percent-encoded, so a value carrying an "&" cannot inject a second parameter.',
    })
  ),
  /**
   * The per-row line. Substituted with `$record.*` exactly as a row template's
   * strings are, then joined.
   */
  template: Schema.String.pipe(
    Schema.check(Schema.isMinLength(1)),
    Schema.annotate({
      description:
        'The line rendered once per row, with $record.<field> substituted from that row. Must reference at least one $record. field — a template with none renders the same constant once per row, which no author means.',
      examples: ['GET  /api/tables/$record.name/records      # List “$record.name”'],
    })
  ),
  /**
   * What joins the per-row lines. Omitted means a newline.
   *
   * A plain optional rather than a DECODING default, matching `rowsKey` in the
   * shared rows envelope next door: the domain layer may not name `Effect`, and
   * every `withDecodingDefault*` spelling takes an `Effect` rather than a value.
   * The cost is that the published JSON Schema carries no `default` for this
   * field — the same cost `rowsKey` already pays, so the two read alike.
   */
  separator: optStr(
    'String joining the per-row lines. Omit for a newline, which is what a code block wants in every case this field was designed for; declare ", " for an inline enumeration.'
  ),
  /**
   * Content rendered when the endpoint returns no rows.
   *
   * The copy lives HERE and not on the endpoint, which is the whole posture of
   * [internal ref]: an empty state is a sentence the console writes, so the console
   * keeps it. Like every other top-level `code` field it is NOT reached by `$t:`
   * substitution (that runs over `props`), so a renderer wanting it translated
   * must resolve it with `resolveTranslationPattern`, as the frame labels do.
   */
  empty: optStr(
    'Content rendered when the endpoint returns no rows. Omit to render an empty block. The template is NEVER rendered on an empty result — a leaked $record token in a block an operator pastes into a shell is worse than silence.'
  ),
}).annotate({
  identifier: 'CodeContentFrom',
  title: 'Code Content From',
  description:
    "Compose a code block's content from a system endpoint's rows: one templated line per row, joined by a separator.",
})

/** @public */
export type CodeContentFrom = Schema.Schema.Type<typeof CodeContentFromSchema>
