/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The shared `?q=` free-text search contract for admin list endpoints.
 *
 * ## Why this is one contract and not three
 *
 * `/api/admin/users`, `/api/admin/buckets/:name/files` and
 * `/api/admin/agents/:name/conversations` are all read by the SAME client search
 * box — the data-table's `globalFilter`, which emits `?q=` verbatim
 * (`use-system-source-fetch.ts` → `params.set('q', globalFilter)`). An operator
 * who learns that a trailing space is ignored on one surface, or that `%` is a
 * literal on one surface, has learned it about a control that looks identical on
 * every other surface. Three independently-derived spellings of "trim and
 * lowercase" is how that promise breaks quietly, so the term parsing lives here
 * once and every endpoint extends it.
 *
 * ## The bug this exists to close
 *
 * All three endpoints accepted `?q=` and silently discarded it — Hono ignores an
 * unknown query param, so the request looked well-formed and the response was a
 * confident 200 carrying the WRONG rows. The client then narrowed the page it
 * already held, which means the operator saw "no results" for a record that was
 * sitting in the table, unreachable on a later page. A search that answers the
 * question it was not asked is worse than one that refuses.
 *
 * @see ./cursor-pagination.ts — the pagination contract `q` composes with
 * @see src/presentation/api/routes/tables/record/list-records-search.ts —
 *   the equivalent contract for user-declared tables, whose honesty principle
 *   ("a term with nowhere to match returns nothing, never everything") this
 *   inherits
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'
import { transformed } from '@/domain/models/api/combinators/transform'

/**
 * The longest search term an endpoint accepts.
 *
 * A term over this length is REJECTED with 400 rather than truncated. Silent
 * truncation would answer a question the operator did not ask — the same class
 * of confident wrong answer this whole contract exists to close — and it does it
 * invisibly, since the response looks like an ordinary successful search. 200
 * characters is past the length of any real e-mail address, filename or
 * conversation title, so a term above it is a mistake worth surfacing.
 */
export const SEARCH_TERM_MAX_LENGTH = 200

/**
 * The `q` free-text search term.
 *
 * Contract, IDENTICAL on every endpoint that extends this:
 *
 * | Input                    | Parsed value | Meaning                       |
 * |--------------------------|--------------|-------------------------------|
 * | omitted                  | `undefined`  | no search — unfiltered page   |
 * | `?q=`                    | `undefined`  | no search — unfiltered page   |
 * | `?q=%20%20` (whitespace) | `undefined`  | no search — unfiltered page   |
 * | `?q=%20ada%20`           | `'ada'`      | search for `ada`              |
 * | 201+ characters          | parse error  | 400                           |
 *
 * **Empty means "no search", NOT "match nothing".** The distinction is the whole
 * behaviour of clearing the box: an operator who deletes their term expects the
 * full list back, and an empty-string term that matched nothing would leave them
 * staring at a blank table with no way to recover but a reload.
 *
 * **Matching is substring, case-insensitive, and literal.** Implementations use
 * `containsInsensitive` (`src/infrastructure/database/sql/dialect-sql-helpers.ts`),
 * which is the single portable spelling of both properties:
 *
 * - case-insensitivity is `lower(col) LIKE lower(pattern)`, NOT `ILIKE` —
 *   `ILIKE` is Postgres-only and SQLite rejects it outright, while bare `LIKE`
 *   silently means case-SENSITIVE on Postgres and case-INSENSITIVE on SQLite, so
 *   it is not a neutral fallback but two different features per engine;
 * - `%` and `_` inside the operator's term are LITERAL, escaped rather than
 *   interpreted. An operator searching for `50%` wants the rows containing
 *   `50%`, not every row containing `50`, and an unescaped `%` inverts the
 *   operator into "match everything" — a search that answers "all" answers
 *   nothing.
 *
 * Honest limit, inherited from the helper: `lower()` is locale-aware on Postgres
 * but ASCII-only on SQLite without ICU, so `MÜLLER` matches `müller` on Postgres
 * and not on SQLite. That gap fails SOFT — a row is missed, the query still runs.
 */
export const searchTermSchema = optionalField(
  transformed(Schema.UndefinedOr(Schema.String), Schema.UndefinedOr(Schema.String), (value) => {
    const trimmed = value?.trim() ?? ''
    return trimmed.length > 0 ? trimmed : undefined
  })
    .pipe(
      Schema.check(
        Schema.makeFilter((value) =>
          value === undefined || value.length <= SEARCH_TERM_MAX_LENGTH
            ? undefined
            : `Search term must be ${SEARCH_TERM_MAX_LENGTH} characters or fewer`
        )
      )
    )
    .annotate({
      description:
        'Optional free-text search term. Trimmed; an empty or whitespace-only value means "no search" (the unfiltered page), NOT "match nothing". Matching is a case-insensitive substring across the endpoint\'s documented searchable fields; `%` and `_` are matched literally, not as wildcards. Over 200 characters is rejected with 400 rather than truncated.',
    })
)

/**
 * The search term the server ACTUALLY applied, echoed back on the response.
 *
 * ## Why the response says this at all
 *
 * Two layers can filter these lists — the server, and the data-table's in-memory
 * `globalFilter` over the page it holds — and **exactly one of them must**.
 * Both failure modes are wrong-answer bugs, in opposite directions:
 *
 * - **neither filters** → the box is inert. The operator types, every row stays,
 *   and nothing signals that the control did nothing.
 * - **both filter** → the server's matches are silently dropped by the client
 *   whenever the matched field is not one of the RENDERED columns. The users
 *   directory is the live example: searching a person by `name` matches
 *   server-side, but `name` is not a column, so an in-memory re-filter over the
 *   visible cells discards the very row the server just found.
 *
 * The client cannot know which endpoints search server-side — that is a property
 * of the endpoint, not of the component, and it changes per endpoint as each one
 * is migrated. So the ENDPOINT declares it, in the only channel the client
 * already reads: its own response.
 *
 * ## The three states, and why absent is not null
 *
 * | Value                | Meaning                                                |
 * |----------------------|--------------------------------------------------------|
 * | `"<term>"`           | the server applied this term; the client MUST NOT re-filter |
 * | `null`               | this endpoint searches server-side, but no term was applied |
 * | field entirely absent| this endpoint does NOT search; the client filters as before |
 *
 * The absent case is what makes this safe to ship incrementally. An endpoint that
 * has not been migrated yet (automation runs, connections, form submissions)
 * simply omits the field and keeps today's client-side behaviour — a half-aware
 * client degrades to CORRECT rather than to an inert search box. `null` rather
 * than omission on a no-term request keeps the field's PRESENCE a stable,
 * observable property of the endpoint, so "does this endpoint search server-side"
 * can be answered without sending a term.
 */
export const appliedQuerySchema = optionalField(
  Schema.NullOr(
    Schema.String.annotate({
      description:
        'The search term the server actually applied, echoed back so the client knows the filtering already happened and must not re-filter the page in memory. `null` when no term was applied. Endpoints that do not implement server-side search OMIT this field entirely, which is the signal for the client to keep filtering client-side.',
    })
  )
)

/** @public */
export type SearchTerm = typeof searchTermSchema.Type
