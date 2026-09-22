/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ComponentPropsSchema } from '../../props'

/**
 * When one item of a set is the CURRENT one.
 *
 * ─── WHY THIS IS NOT A VISIBILITY GATE ─────────────────────────────────────
 *
 * Every conditional the page schema ships decides whether an element EXISTS:
 * `visibility.condition` and `visibility.capability` SSR-exclude it, `when` and
 * `roles` CSS-hide it, `visibility.record` omits it from a row. A period
 * selector needs none of those. All three of its presets are always present —
 * they are the choice. What varies is one ATTRIBUTE on one of them:
 * `aria-current="page"`, plus the class that makes it look selected.
 *
 * Spelling that with a visibility gate means SIX links to render three, each
 * pair duplicating an href and a label so the two halves can drift apart. That
 * is the shape this exists to avoid.
 *
 * ─── WHY A VALUE COMPARISON AND NOT URL MATCHING ───────────────────────────
 *
 * The obvious alternative is the framework primitive: mark a link current when
 * its `href` matches the request URL. It was rejected for two reasons. It needs
 * a match MODE (exact / path-only / prefix) because a period rail differs only
 * in its query string while a sidebar must stay current across a whole subtree,
 * and every mode is wrong for some nav. And it would need the request URL
 * plumbed into a render pass that does not otherwise have it.
 *
 * A value comparison needs neither. By the time this is evaluated the
 * substitution passes have already run, so `$window.id`, `$query.<name>`,
 * `$param.<name>` and `$app.<name>` are all literals — and the same key
 * therefore expresses "the selected period", "the open tab" and "the current
 * section" without knowing anything about URLs.
 *
 * ─── AT MOST ONE COMPARISON ────────────────────────────────────────────────
 *
 * String equality, not the condition vocabulary. `ConditionOperatorsSchema` is
 * the render-time predicate over a RECORD field and `FilterOperatorSchema` is
 * the DB-query one; neither subject is present here, and admitting `in` or
 * `contains` would let two items of a set both claim to be current, which is an
 * `aria-current` violation rather than a design choice.
 *
 * @example
 * ```yaml
 * # The active preset of a period rail (`$window.id` is already a literal here)
 * - type: link
 *   content: 7 days
 *   props:
 *     href: '?period=7d'
 *     className: 'text-foreground-muted rounded px-2.5 py-1 text-xs'
 *   activeWhen: { value: '$window.id', equals: '7d' }
 *   activeProps:
 *     aria-current: page
 *     className: 'bg-background-raised text-foreground rounded px-2.5 py-1 text-xs font-medium'
 * ```
 */
export const ActiveWhenSchema = Schema.Struct({
  /**
   * The value under test — in practice a `$`-reference, resolved to a literal by
   * the substitution passes that run before this one.
   */
  value: Schema.String.pipe(
    Schema.check(Schema.isMinLength(1)),
    Schema.annotate({
      description:
        'Value under test, normally a $-reference ($window.id, $query.<name>, $param.<name>, $app.<name>) resolved before evaluation',
      examples: ['$window.id', '$query.tab', '$param.section'],
    })
  ),
  /** The literal `value` must equal for this item to be the current one. */
  equals: Schema.String.annotate({
    description: 'The literal `value` must equal for this item to be the current one',
    examples: ['7d', 'overview'],
  }),
}).annotate({
  identifier: 'ActiveWhen',
  title: 'Active When',
  description:
    'String equality deciding whether this item is the CURRENT one of a set; evaluated after $-reference substitution.',
})

/** @public */
export type ActiveWhen = Schema.Schema.Type<typeof ActiveWhenSchema>

/**
 * Fields for a component that can be the CURRENT one of a set.
 *
 * The two keys are useless apart and are refused apart at decode
 * (`collectPageBindingViolations`): `activeProps` with no `activeWhen` is a
 * merge that can never happen, and `activeWhen` with no `activeProps` is a
 * comparison with nothing to do. Both are the "validates and silently does
 * nothing" class.
 *
 * `activeProps` is a full {@link ComponentPropsSchema} and is MERGED over
 * `props` — key by key, last wins — rather than replacing it. So an attribute
 * appears only on the current item, and a `className` declared in both is
 * SWAPPED rather than concatenated, which is what a selected style usually
 * wants and what a rail written by hand already does.
 */
export const activeFields = {
  activeWhen: Schema.optional(ActiveWhenSchema),
  activeProps: Schema.optional(
    ComponentPropsSchema.annotate({
      description:
        'Props merged over `props` (key by key, last wins) when `activeWhen` holds; omitted entirely otherwise',
    })
  ),
} as const
