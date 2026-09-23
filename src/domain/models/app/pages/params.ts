/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { SystemSourceSchema } from './components/system-source'

/**
 * One declared route parameter — the closed set of segment values this page
 * serves, supplied by a read endpoint rather than written out.
 *
 * ─── THIS IS NOT A NEW IDEA, IT IS AN EXISTING ONE GENERALISED ─────────────
 *
 * A path segment constrained to a set already ships:
 * `route-bound-table-resolver.ts` answers 404 when a `$param`-bound `table`
 * names no declared table, and its docstring gives the reason — "this table
 * does not exist" and "this table is empty" must not look the same (rule S1).
 * The only thing hardcoded there is WHICH set: `app.tables`. Every other route
 * whose segments come from somewhere else — a component-type catalogue, an
 * automation registry, a bucket list — has no way to say the same thing, so a
 * mistyped URL renders a page-shaped emptiness and a broken link looks live.
 *
 * `page.params` names the set. The page then answers 404 for a segment outside
 * it exactly as the table-bound route does for an undeclared table, and 200 for
 * a segment inside it whatever any one component on the page can do with it.
 *
 * ─── AND IT IS THE PAGE THAT VOUCHES, NOT A COMPONENT ──────────────────────
 *
 * That last clause is the whole reason this is declared on the PAGE. A
 * component's implicit constraint is about what it can DRAW — a `specimen`
 * naming a type the catalogue refuses to draw has nothing to show — and letting
 * a drawing failure decide the route means adding a component to a page can
 * silently narrow which URLs that page serves. Once the page states its route's
 * domain, that statement is the authority: a segment in the set is a real URL
 * of this page, and a component that cannot render it reports so in place, the
 * way a row does. Drawability stops being a routing fact the moment routing has
 * a declaration of its own.
 *
 * ─── THE SOURCE SHAPE IS THE ONE `optionsSource` ALREADY USES ──────────────
 *
 * `{ system, valueKey }` is `SelectSystemOptionSourceSchema` minus the two keys
 * a route has no use for (`labelKey` — a segment has no display form; `limit` —
 * see below). Same shared rows envelope, so `rowsKey` / `idKey` / a static
 * `query` are described once for every consumer that reads rows, and a
 * table-backed variant can join later as a sibling member exactly as it did
 * there.
 *
 * ─── THERE IS DELIBERATELY NO `limit` ──────────────────────────────────────
 *
 * A truncated option list offers fewer choices; a truncated ALLOW-LIST answers
 * 404 for URLs that exist. The failure is silent, it lands on whichever entries
 * happened to sort last, and it looks exactly like the page never having been
 * built. An endpoint that genuinely pages must be narrowed through the
 * envelope's own `query` instead, where the author states the bound and can see
 * it.
 *
 * @example
 * ```yaml
 * pages:
 *   - name: Component type
 *     path: /design-system/ui-kit/:type
 *     params:
 *       type:
 *         system:
 *           endpoint: /api/admin/schema/component-types
 *         valueKey: type
 * ```
 */
export const PageParamPropSchema = Schema.Struct({
  /** The read endpoint supplying the permitted segment values (the shared rows envelope) */
  system: SystemSourceSchema,
  /**
   * Row key holding each permitted segment value.
   *
   * Defaults to the envelope's own `idKey` (itself `'id'`), because a row's
   * identity is the value a URL most often names. Declared when it is not: the
   * component catalogue is keyed by `type`, and the segment is that literal.
   */
  valueKey: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description: "Row key holding each permitted segment value (default: the envelope's idKey)",
        examples: ['type', 'name', 'slug'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
}).annotate({
  identifier: 'PageParamProp',
  title: 'Page Route Parameter',
  description:
    'A route parameter constrained to the set of values a read endpoint supplies; a segment outside the set answers 404',
})

/** @public */
export type PageParamProp = Schema.Schema.Type<typeof PageParamPropSchema>

/**
 * `page.params` — the map of constrained route parameters.
 *
 * Keyed by the parameter name, which must name a `:segment` of the page's own
 * `path`. The key schema is UNREFINED for the reason `PageQuerySchema`
 * records verbatim: Effect 4's `Schema.Record` silently DROPS an entry whose key
 * fails its key schema, so a typo'd `Type:` would become a constraint that
 * simply does not exist — and a constraint that silently does not exist is a
 * page serving every segment while its author believes it serves eleven.
 * Keeping the key is what lets the page-level rule NAME it; the grammar, the
 * path cross-check, and the three envelope keys a route may not use are all
 * enforced by `collectPageBindingViolations`
 * (`src/domain/models/app/pages/route-param-allow-list-validation.ts`).
 *
 * A parameter with NO entry here is unconstrained, exactly as today — declaring
 * the map narrows the parameters it names and no others.
 */
export const PageParamsSchema = Schema.Record(Schema.String, PageParamPropSchema).annotate({
  identifier: 'PageParams',
  title: 'Page Route Parameters',
  description:
    'Route parameters constrained to a closed set supplied by a read endpoint; a segment outside the set answers 404 rather than rendering an empty page',
})

/** @public */
export type PageParams = Schema.Schema.Type<typeof PageParamsSchema>
