/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/*
 * The five Action variants the browser resolves on its own — `filter`,
 * `navigate`, `toast`, `openDrawer` and `fill`. None of them invokes an engine
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
  type: Schema.Literal('filter').annotate({
    description: 'Which kind of action this is. It decides which of the other keys apply.',
  }),
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
  type: Schema.Literal('navigate').annotate({
    description: 'Which kind of action this is. It decides which of the other keys apply.',
  }),
  /** Destination URL path. Supports `$record.X` substitution. */
  path: Schema.String.annotate({
    description: 'Destination URL path (supports $record.X substitution)',
  }),
  /**
   * Open the destination in a new tab, opened with `noopener,noreferrer` so it
   * gets no handle on the page that opened it.
   */
  openInNewTab: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'Opens the address in a new tab instead of leaving the page. The new tab gets no handle on this one.',
      examples: [true],
    })
  ),
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
  type: Schema.Literal('toast').annotate({
    description: 'Which kind of action this is. It decides which of the other keys apply.',
  }),
  /** Message to display. Supports $variable references. */
  message: Schema.String.annotate({
    description: 'Toast notification message. Supports $variable references.',
  }),
  /** Visual variant */
  variant: Schema.optional(ToastVariantSchema),
  /** Auto-dismiss duration in milliseconds */
  duration: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        description: 'Auto-dismiss duration in milliseconds (default: 5000)',
        examples: [2000, 5000, 10_000],
      }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
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
  action: Schema.Literal('openDrawer').annotate({
    description:
      'Set to `openDrawer` to open a sibling drawer instead of running one of the `type` actions.',
  }),
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
          Schema.annotate({ description: 'Drawer width in pixels for this trigger instance' }),
          Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
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

/**
 * Fill action - writes a value into a form control on the same page.
 *
 * The composer pattern: a list of reusable scripts beside a message form, where
 * clicking a script puts its text into the message box. `target` names the
 * component (by its `props.id`) that holds the control: a `form`, in which case
 * `field` names the control by its field name, or a standalone `input` /
 * `textarea`, in which case `field` is omitted. `value` is a literal, a
 * `$record.<field>` read from the record the trigger belongs to (the clicked
 * list item, the row a button is drawn in, the card a board dropped), or a
 * template mixing both. `mode: replace` (the default) overwrites what the
 * control holds; `append` adds the value after it.
 *
 * Nothing is sent: the control changes as if the reader had typed, and the
 * form submits it the way it submits anything else.
 *
 * @example
 * ```yaml
 * # A script list beside a message composer
 * onRowClick:
 *   type: fill
 *   target: composer
 *   field: body
 *   value: $record.content
 *   mode: append
 * ```
 */
export const FillActionSchema = Schema.Struct({
  type: Schema.Literal('fill').annotate({
    description: 'Which kind of action this is. It decides which of the other keys apply.',
  }),
  /** Component id (`props.id`) of the form or standalone control to write into. */
  target: Schema.String.pipe(
    Schema.annotate({
      description:
        'The `props.id` of the component on this page holding the control to fill: a `form`, or a standalone `input` or `textarea`.',
      examples: ['composer', 'reply-box'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  /** Field name of the control inside a target form. */
  field: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'When `target` is a form, the field whose control is filled, by its field name. Omitted when `target` is itself an `input` or `textarea`.',
        examples: ['body', 'notes'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /** The text written into the control. */
  value: Schema.String.annotate({
    description:
      'The text written into the control: a literal, a `$record.<field>` read from the record the trigger belongs to, or a template mixing both.',
    examples: ['$record.content', 'Hello $record.first_name,'],
  }),
  /** Whether the value replaces the control's text or is added after it. */
  mode: Schema.optional(
    Schema.Literals(['replace', 'append']).annotate({
      description:
        '`replace` overwrites what the control holds; `append` adds the value after it, exactly as written, and leaves the cursor at the end.',
      defaultNote: 'replace',
    })
  ),
}).annotate({
  title: 'Fill Action',
  description:
    'Writes a value into a form control on the same page, as if the reader had typed it. Nothing is sent until the form is submitted.',
})

/** @public */
export type FilterAction = Schema.Schema.Type<typeof FilterActionSchema>
/** @public */
export type NavigateAction = Schema.Schema.Type<typeof NavigateActionSchema>
/** @public */
export type ToastAction = Schema.Schema.Type<typeof ToastActionSchema>
/** @public */
export type OpenDrawerAction = Schema.Schema.Type<typeof OpenDrawerActionSchema>
/** @public */
export type FillAction = Schema.Schema.Type<typeof FillActionSchema>
