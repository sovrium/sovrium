/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * One declared query property — a closed allow-list plus the value used when
 * the URL supplies nothing usable.
 *
 * The allow-list is the whole point. A page reads `?period=` straight off an
 * attacker-controlled URL, so accepting an open string would put arbitrary input
 * into every `$query.period` substitution site and give the page an unbounded
 * response space. A closed `enum` bounds it to `enum.length` renderings, which
 * is what keeps a rendered page cacheable per-value.
 *
 * @example
 * ```yaml
 * period:
 *   default: 7d
 *   enum: [24h, 7d, 30d]
 * ```
 */
export const PageQueryPropSchema = Schema.Struct({
  /** Value used when the URL omits the parameter or supplies one outside `enum` */
  default: Schema.String.pipe(
    Schema.check(Schema.isMinLength(1)),
    Schema.annotate({
      description: 'Value used when the URL omits the parameter or supplies one outside enum',
      examples: ['7d', 'all'],
    })
  ),
  /** The closed allow-list of accepted values */
  enum: Schema.Array(Schema.String.pipe(Schema.check(Schema.isMinLength(1)))).pipe(
    Schema.check(Schema.isMinLength(1)),
    Schema.annotate({
      description: 'Closed allow-list of accepted values; anything else falls back to default',
      examples: [['24h', '7d', '30d']],
    })
  ),
  /**
   * The value an UNKNOWN URL value resolves to, when that has to be told apart
   * from the URL saying nothing at all.
   *
   * ─── THE TWO FACTS `default` COLLAPSES ────────────────────────────────────
   *
   * `default` answers both "the URL omitted the parameter" and "the URL supplied
   * something outside `enum`". For a period selector that is right: a stale
   * `?period=90d` should show the same dashboard a bare `/dashboard` shows. For a
   * FILTER it is wrong in a way the page cannot repair. `?category=nonsense`
   * clamps to `all` and renders the unfiltered grid, so the page confidently
   * answers a question nobody asked, and a reader following a mistyped link is
   * told nothing. A config page has no `if`, so the only way it can say "no such
   * category" is for the two cases to arrive as two different values.
   *
   * ─── WHY IT NAMES AN `enum` MEMBER RATHER THAN KEEPING THE RAW VALUE ──────
   *
   * Passing the supplied string through was the obvious shape and is refused,
   * for three reasons that point the same way. It would UNBOUND the response
   * space — {@link pageQueryVariantKey} is a page-cache dimension precisely
   * because every resolved value is already clamped into a finite set, and any
   * visitor could otherwise mint unbounded cache entries out of one URL. It would
   * put attacker-controlled text into every `$query.<name>` substitution site,
   * which is the open-string hazard the allow-list exists to remove. And
   * `visibility.query` values are checked at DECODE against this same `enum`, so
   * a resolved value outside it would name a state no gate could ever match — the
   * block would be permanently dead, which is the failure that rule exists to
   * catch.
   *
   * Naming a member instead costs one declared value and keeps all three
   * properties: the response space stays `enum.length`.
   *
   * ─── OMITTED IS TODAY'S BEHAVIOUR, EXACTLY ────────────────────────────────
   *
   * Absent, an unknown value resolves to `default` as it always has, so every
   * page already shipped renders byte-identical HTML.
   *
   * `?category=` — the key present with an empty value — counts as UNKNOWN rather
   * than omitted. The empty string can never be an `enum` member (each is
   * `minLength: 1`), so "supplied, and not accepted" is the only true reading of
   * it, and a page that distinguishes the two cases at all should not have a
   * third silent one.
   *
   * Refused at decode when it is not itself an `enum` member, by the same rule
   * and in the same place as `default` (`collectPageBindingViolations`): a
   * fallback the page can never reach is exactly the config-time typo this
   * allow-list exists to catch.
   *
   * @example
   * ```yaml
   * category:
   *   default: all
   *   enum: [all, buttons, forms, unknown]
   *   onUnknown: unknown
   * ```
   */
  onUnknown: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Value an unknown URL value resolves to, told apart from the URL omitting the parameter. Must itself be one of enum. Omit to fall back to default, which is the historical behaviour.',
        examples: ['unknown', 'none'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
}).annotate({
  identifier: 'PageQueryProp',
  title: 'Page Query Property',
  description: 'A URL query parameter opened as a page input, with a closed value allow-list',
})

/** @public */
export type PageQueryProp = Schema.Schema.Type<typeof PageQueryPropSchema>

/**
 * `page.query` — the map of declared URL query properties.
 *
 * Keyed by the query parameter name. The key schema is deliberately UNREFINED:
 * Effect 4's `Schema.Record` silently DROPS an entry whose key fails its key
 * schema, which would turn a typo'd `Period:` into a property that simply does
 * not exist — no error, and a `$query.Period` that never resolves. Keeping the
 * key is what lets the page-level rule NAME it; the lowercase-kebab-case
 * requirement, and the `default` ∈ `enum` requirement above, are both enforced
 * by `collectPageBindingViolations`
 * (`src/domain/models/app/pages/page-binding-validation.ts`), which explains there why
 * they cannot sit on these nodes without dropping their published `$defs`
 * entries.
 */
export const PageQuerySchema = Schema.Record(Schema.String, PageQueryPropSchema).annotate({
  identifier: 'PageQuery',
  title: 'Page Query Properties',
  description:
    'URL query parameters opened as page inputs, each with a closed allow-list, referenceable as $query.<name>',
})

/** @public */
export type PageQuery = Schema.Schema.Type<typeof PageQuerySchema>
