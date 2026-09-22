/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/*
 * The four Action variants the browser resolves on its own — `filter`,
 * `navigate`, `toast` and `openDrawer`. None of them invokes an engine
 * operation, which is what separates them from the variants in
 * `action-operations.ts` and from the arbitrary HTTP call in `action-fetch.ts`.
 */

import { Schema } from 'effect'
import { ActionResponseSchema, ToastVariantSchema } from './action-response'

/**
 * Filter action - cross-component data filtering
 *
 * @example
 * ```yaml
 * action:
 *   type: filter
 *   targetDataSource: product-list
 *   field: category
 *   operator: eq
 * ```
 */
export const FilterActionSchema = Schema.Struct({
  type: Schema.Literal('filter'),
  /** Target data source ID to apply filter to */
  targetDataSource: Schema.String.annotate({
    description: 'ID of the data source to filter (matches dataSource.targetId)',
  }),
  /** Field to filter on */
  field: Schema.String.annotate({
    description: 'Field name to apply the filter to',
  }),
  /** Filter operator */
  operator: Schema.optional(
    Schema.Literals(['eq', 'neq', 'contains', 'gt', 'lt', 'gte', 'lte']).annotate({
      description: 'Comparison operator (defaults to eq)',
    })
  ),
}).annotate({
  title: 'Filter Action',
  description: 'Cross-component filter action targeting a data source',
})

/**
 * Navigate Action
 *
 * Pure navigation primitive — first-class for callers (e.g. Kanban card
 * `onClick`) that just want to move the user to a new page without a
 * mutation side-effect. `crud` actions can already navigate via their
 * `onSuccess.navigate` response, but that path is overloaded with a
 * mutation; this variant is the navigate-only shape.
 *
 * `path` supports `$record.X` substitution at render time so
 * row-bound elements (cards, table rows) can navigate to a per-record
 * destination.
 *
 * @example
 * ```yaml
 * # Card onClick to record detail
 * onClick:
 *   type: navigate
 *   path: '/tasks/$record.id'
 *
 * # Static path
 * onClick:
 *   type: navigate
 *   path: '/dashboard'
 * ```
 */
export const NavigateActionSchema = Schema.Struct({
  type: Schema.Literal('navigate'),
  /** Destination URL path. Supports `$record.X` substitution. */
  path: Schema.String.annotate({
    description: 'Destination URL path (supports $record.X substitution)',
  }),
  /** Optional success handler (rarely used for pure navigation). */
  onSuccess: Schema.optional(ActionResponseSchema),
  /** Optional error handler (e.g. router rejection). */
  onError: Schema.optional(ActionResponseSchema),
}).annotate({
  title: 'Navigate Action',
  description: 'Pure navigation action — no mutation side-effect',
})

/**
 * Toast Action
 *
 * Pure notification primitive — first-class for callers (e.g. a reorderable
 * list `onReorder` handler) that just want to surface a transient toast
 * without a mutation or navigation side-effect. Mirrors the inline
 * `ToastSchema` shape used by `ActionResponse.toast`, lifted to a top-level
 * action variant discriminated by `type: 'toast'`.
 *
 * @example
 * ```yaml
 * # Reorderable list onReorder handler
 * onReorder:
 *   type: toast
 *   message: Reordered
 *   variant: success
 *
 * # Minimal toast
 * onClick:
 *   type: toast
 *   message: Copied to clipboard
 * ```
 */
export const ToastActionSchema = Schema.Struct({
  type: Schema.Literal('toast'),
  /** Message to display. Supports $variable references. */
  message: Schema.String.annotate({
    description: 'Toast notification message. Supports $variable references.',
  }),
  /** Visual variant */
  variant: Schema.optional(ToastVariantSchema),
  /** Auto-dismiss duration in milliseconds */
  duration: Schema.optional(
    Schema.Finite.pipe(
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0)),
      Schema.annotate({
        description: 'Auto-dismiss duration in milliseconds (default: 5000)',
        examples: [2000, 5000, 10_000],
      })
    )
  ),
}).annotate({
  title: 'Toast Action',
  description: 'Pure notification action — shows a transient toast with no side-effect',
})

/**
 * Open-Drawer action - opens a referenced drawer component (record-detail
 * quick-edit pattern, PG-04).
 *
 * Unlike sibling action variants which use `type` as the discriminator, this
 * schema is discriminated by the literal `action: 'openDrawer'` key — the
 * user-story doc and PG-04 specs define the wire shape as
 * `{ action: 'openDrawer', component: '<drawer-id>', props?: {...} }`,
 * declared this way so the data-table `onRowClick` reads as a verb-phrase
 * ("open Drawer named record-detail") rather than yet another typed
 * action variant. The companion `drawer` page component (referenced by
 * `component`) materialises the slide-in panel that fetches and renders
 * the clicked record's detail.
 *
 * `props.width` overrides the drawer's default size for this trigger
 * instance (other geometry options live on the drawer component itself).
 *
 * @example
 * ```yaml
 * # On a data-table row click, open the `record-detail` drawer
 * onRowClick:
 *   action: openDrawer
 *   component: record-detail
 *   props:
 *     width: 600
 * ```
 */
export const OpenDrawerActionSchema = Schema.Struct({
  /** Discriminator literal — matches `action: openDrawer` in YAML/JSON */
  action: Schema.Literal('openDrawer'),
  /**
   * ID of the drawer component to open. Must match a sibling
   * `{ type: 'drawer', id: '<this-value>' }` component on the same page.
   */
  component: Schema.String.annotate({
    description:
      "ID of the drawer page-component to open (matches a sibling `{ type: 'drawer', id }`)",
  }),
  /** Per-trigger overrides applied to the drawer (currently `width`). */
  props: Schema.optional(
    Schema.Struct({
      width: Schema.optional(
        Schema.Finite.pipe(
          Schema.check(Schema.isInt(), Schema.isGreaterThan(0)),
          Schema.annotate({ description: 'Drawer width in pixels for this trigger instance' })
        )
      ),
    }).annotate({
      description: 'Per-trigger overrides applied to the referenced drawer component',
    })
  ),
}).annotate({
  title: 'Open Drawer Action',
  description:
    'Opens a referenced drawer component (record-detail quick-edit pattern). Discriminated by the `action: openDrawer` literal (not `type`).',
})

/** @public */
export type FilterAction = Schema.Schema.Type<typeof FilterActionSchema>
/** @public */
export type NavigateAction = Schema.Schema.Type<typeof NavigateActionSchema>
/** @public */
export type ToastAction = Schema.Schema.Type<typeof ToastActionSchema>
/** @public */
export type OpenDrawerAction = Schema.Schema.Type<typeof OpenDrawerActionSchema>
