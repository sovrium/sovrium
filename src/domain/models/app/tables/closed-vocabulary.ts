/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Closed vocabularies — a config term is one the engine implements, or it is
 * refused BY NAME.
 *
 * WHY THIS FILE EXISTS. Two properties in `tables/` were declared
 * `Schema.String` with nothing but a description: a rollup's `aggregation` and
 * a view filter's `operator`. Both feed a `switch` whose `default:` branch is a
 * silent substitution rather than a failure — `aggregation` falls through to
 * `SUM(...)` and `operator` falls through to `field = value`. So a config
 * declaring `aggregation: 'average'` or `operator: 'gt'` validated clean, booted
 * clean, and then served a SUM from a column named for an average, or equality
 * where the author wrote a comparison. Nothing anywhere said so.
 *
 * The two defects are one defect wearing two hats, which is why the refusal is
 * built once here rather than twice at the two call sites. Copy-pasting a
 * vocabulary next to each consumer is precisely how the two spellings drift
 * apart, and drift is what this whole area has been paying for.
 *
 * WHAT A GOOD REFUSAL OWES THE AUTHOR. Three things, all asserted by spec:
 *
 *   1. The value they actually wrote, quoted. "Invalid aggregation" on a config
 *      with six rollups leaves them exactly where the silent SUM did.
 *   2. WHERE it is — the field or column the term was attached to, so the search
 *      ends the moment the message is read. This is why the refusals below are
 *      attached to the enclosing STRUCT rather than to the string property: a
 *      refinement on the property alone can only see the string, and the decoder
 *      renders paths as `tables[0].fields[2]`, never as `order_total`.
 *   3. What WOULD have worked — the full vocabulary, not a sample. A message
 *      listing three of eight terms teaches the author the other five do not
 *      exist.
 *
 * CASE-FOLDING IS PER-VOCABULARY AND IS NOT A STYLE CHOICE. It mirrors the
 * consumer exactly: the aggregation mapper folds (`toUpperCase()`), so the
 * refusal folds; nothing on the filter-operator path folds, so the refusal does
 * not. Inventing a fold where the runtime has none would be a NEW behaviour
 * smuggled in under a bug fix — the config would start accepting `EQUALS` and
 * then equate it, which is the very failure being closed.
 */

/**
 * A closed set of terms, and whether the engine matches them case-blind.
 *
 * @public
 */
export interface ClosedVocabulary {
  /** Every term the engine implements, in the order an author should read them. */
  readonly terms: readonly string[]
  /** True when the consuming code folds case before matching. */
  readonly caseInsensitive: boolean
}

/**
 * Is `value` a term of `vocabulary`?
 *
 * The empty string is not a term of any vocabulary — it is called out because it
 * is the shape a near-miss heuristic would let through, and it is exactly as
 * silently wrong as a typo (today it resolves to `SUM` / to `=`).
 */
export const isVocabularyTerm = (vocabulary: ClosedVocabulary, value: string): boolean =>
  vocabulary.caseInsensitive
    ? vocabulary.terms.some((term) => term.toLowerCase() === value.toLowerCase())
    : vocabulary.terms.includes(value)

/**
 * The refusal an author reads when they wrote a term that is not a term.
 *
 * @param params.kind - What the term names, in author words (`rollup aggregation`).
 * @param params.value - Verbatim, quoted, so a config with several is navigable.
 * @param params.subject - Where it sits (`field "order_total"`).
 * @param params.vocabulary - Listed in FULL; a sample would misinform.
 */
export const unknownTermRefusal = (params: {
  readonly kind: string
  readonly value: string
  readonly subject: string
  readonly vocabulary: ClosedVocabulary
}): string => {
  const { kind, value, subject, vocabulary } = params
  const matching = vocabulary.caseInsensitive ? 'case-insensitive' : 'case-sensitive'
  return (
    `Unknown ${kind} "${value}" on ${subject}. ` +
    `Supported ${kind}s (${matching}): ${vocabulary.terms.join(', ')}.`
  )
}

/**
 * The eight aggregations `mapAggregationToSql` implements.
 *
 * TAKEN FROM THE MAPPER'S BRANCHES, NOT FROM THE COMPATIBILITY VALIDATOR.
 * `checkAggregationCompatibility` only constrains `sum` / `avg` (numeric) and
 * `min` / `max` (numeric or date). `counta` and `countall` are listed but return
 * no error, and `arrayunique` is absent and falls through to the same no-op — so
 * a refusal written from the terms that validator VERIFIES would reject three
 * functions the engine ships and three specs already prove work (`ROLLUP-006`,
 * `-007`, `-010`).
 *
 * Those four are unchecked because nothing needs checking: measured across
 * text / integer / decimal / boolean / date / timestamp / json / array columns
 * on BOTH engines, `count`, `counta`, `countall` and `arrayunique` are
 * compatible with every field type Sovrium generates.
 *
 * `ARRAYUNIQUE` stays IN, and keeping it in was the right call for a reason that
 * has since been settled rather than merely argued: at the time it could not
 * boot on SQLite at all (`ARRAY_AGG(...)` / `ARRAY[]::TEXT[]`), and dropping it
 * from the vocabulary would have hidden that portability defect behind this
 * refusal while silently removing a working PostgreSQL feature. It is now
 * portable on both engines — see `distinctArrayAggExpression`.
 *
 * @public
 */
export const ROLLUP_AGGREGATION_VOCABULARY: ClosedVocabulary = {
  terms: ['SUM', 'COUNT', 'AVG', 'MIN', 'MAX', 'COUNTA', 'COUNTALL', 'ARRAYUNIQUE'],
  caseInsensitive: true,
}

/**
 * The fifteen operators `generateSqlCondition` implements.
 *
 * NOT the same vocabulary as `pages[].components[].dataSource.filters` — that
 * one (`FilterOperatorSchema`) is already a proper literal union spelled
 * `eq` / `neq` / `gt` / `gte` / `lt` / `lte` / `contains` / `in`, and shares not
 * one spelling with this one. Two vocabularies for one concept is a real wart,
 * but unifying them would change which rows shipped apps return; refusing the
 * silent mistranslation between them is the part that is safe to do now.
 *
 * Case-SENSITIVE: nothing on this path folds.
 *
 * @public
 */
export const FILTER_OPERATOR_VOCABULARY: ClosedVocabulary = {
  terms: [
    'equals',
    'notEquals',
    'greaterThan',
    'lessThan',
    'greaterThanOrEqual',
    'lessThanOrEqual',
    'contains',
    'startsWith',
    'endsWith',
    'isNull',
    'isNotNull',
    'isEmpty',
    'isTrue',
    'isFalse',
    'in',
  ],
  caseInsensitive: false,
}
